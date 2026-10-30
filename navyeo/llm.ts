import { useSyncExternalStore } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Complete } from './smart';
import { GRAMMAR, SYSTEM_PROMPT, userPrompt } from './llmPrompt';

// NavYeo's on-phone language model, from the app's side (the native side is android/.../NavLlmPlugin.java). The model file is chosen once from the phone's
// storage; it is loaded when it is first needed and let go after a few idle minutes, since it takes some 600 MB of memory.

interface NavLlmPlugin {
  status(): Promise<{ installed: boolean; sizeMb: number; loaded: boolean }>;
  importModel(): Promise<{ sizeMb: number }>;
  load(): Promise<{ loaded: boolean }>;
  complete(o: { system: string; user: string; grammar?: string; maxTokens?: number; temperature?: number }): Promise<{ text: string }>;
  stop(): Promise<void>;
  unload(): Promise<void>;
  removeModel(): Promise<void>;
  addListener(name: 'importProgress', cb: (e: { percent: number; doneMb: number }) => void): Promise<{ remove: () => void }>;
}
const Native = registerPlugin<NavLlmPlugin>('NavLlm');

/** browser: no model here; none: none installed; installed: on the phone, not in memory; loading; ready; error */
export type BrainState = 'browser' | 'none' | 'installed' | 'loading' | 'ready' | 'error';
export interface BrainSnapshot { state: BrainState; sizeMb: number; error: string; /** percent while a model file is being copied in, else -1 */ progress: number; /** the user lets NavYeo use the model */ on: boolean }

const IDLE_MS = 10 * 60_000;   // the model stays in memory (about 600 MB) for ten idle minutes: reading its fixed instructions again takes a while
const ANSWER_MS = 15_000;      // an answer once the fixed instructions are in memory: past this the keyword answer is better than waiting
const FIRST_MS = 60_000;       // the first request reads the instructions (about 500 words of the model's) as well
const ON_KEY = 'navyeo:llm';
const savedOn = () => { try { return localStorage.getItem(ON_KEY) !== 'off'; } catch { return true; } };
let snap: BrainSnapshot = { state: Capacitor.isNativePlatform() ? 'none' : 'browser', sizeMb: 0, error: '', progress: -1, on: savedOn() };
const subs = new Set<() => void>();
const set = (p: Partial<BrainSnapshot>) => { snap = { ...snap, ...p }; subs.forEach(f => f()); };
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let loading: Promise<void> | null = null;
let warmed = false;
let primed = false;            // the fixed instructions are in the model's memory (a request has finished since it was loaded)
// The phone answers one request at a time. Each waits for the one before it, and its time limit starts only when its own turn comes: a question asked
// while the instructions are still being read waits for them (and is then quick) rather than timing out behind them.
let queue: Promise<unknown> = Promise.resolve();

const message = (e: unknown) => String((e as { message?: string })?.message ?? e ?? 'Something went wrong.');

export const brain = {
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
  get: (): BrainSnapshot => snap,
  /** is there a model on this phone that can be used, and switched on */
  usable: () => snap.on && (snap.state === 'installed' || snap.state === 'ready' || snap.state === 'loading'),

  /** Switches the model on or off (remembered). Off: NavYeo answers by its rules alone and the model's memory is given back. */
  setOn(on: boolean): void {
    try { localStorage.setItem(ON_KEY, on ? 'on' : 'off'); } catch { /* kept for this session only */ }
    set({ on });
    if (on) void brain.warm(); else void brain.unload();
  },

  async refresh(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const s = await Native.status();
      set({ state: s.loaded ? 'ready' : s.installed ? 'installed' : 'none', sizeMb: s.sizeMb, error: '' });
    } catch (e) { set({ state: 'error', error: message(e) }); }
  },

  /** Brings the model into memory (once; callers wait for the same load). */
  load(): Promise<void> {
    if (snap.state === 'ready') return Promise.resolve();
    if (snap.state !== 'installed' && snap.state !== 'loading' && snap.state !== 'error') return Promise.reject(new Error('No model is installed.'));
    if (loading) return loading;
    set({ state: 'loading', error: '' });
    loading = Native.load().then(() => { set({ state: 'ready' }); }).catch(e => { set({ state: 'error', error: message(e) }); throw e; }).finally(() => { loading = null; });
    return loading;
  },

  /** The model's reply to (system, user), held to `grammar`; loads the model first if needed. Rejects if it is too slow or fails. */
  complete: ((system, user, grammar) => {
    const run = async () => {
      await brain.load();
      if (idleTimer) clearTimeout(idleTimer);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const r = await Promise.race([
          Native.complete({ system, user, grammar, maxTokens: 80, temperature: 0 }),
          new Promise<never>((_, rej) => { timer = setTimeout(() => { void Native.stop(); rej(new Error('The NavYeo model took too long.')); }, primed ? ANSWER_MS : FIRST_MS); }),
        ]);
        primed = true;
        return r.text;
      } finally {
        if (timer) clearTimeout(timer);
        idleTimer = setTimeout(() => { void brain.unload(); }, IDLE_MS);
      }
    };
    const mine = queue.then(run, run);
    queue = mine.catch(() => undefined);
    return mine;
  }) as Complete,

  async unload(): Promise<void> {
    if (snap.state !== 'ready') return;
    try { await Native.unload(); warmed = false; primed = false; set({ state: 'installed' }); } catch { /* it stays loaded */ }
  },

  /** Loads the model and reads the fixed instructions once, so the first real question is answered quickly. */
  async warm(): Promise<void> {
    if (!brain.usable() || warmed) return;
    warmed = true;
    try { await brain.complete(SYSTEM_PROMPT, userPrompt('ok'), GRAMMAR); } catch { warmed = false; }
  },

  /** Opens the phone's file picker and copies the chosen GGUF into the app. */
  async importModel(): Promise<void> {
    if (!Capacitor.isNativePlatform()) throw new Error('The model can only be installed in the Android app.');
    const sub = await Native.addListener('importProgress', e => set({ progress: e.percent }));
    set({ progress: 0, error: '' });
    try {
      const r = await Native.importModel();
      set({ state: 'installed', sizeMb: r.sizeMb, progress: -1, error: '' });
    } catch (e) {
      set({ progress: -1, error: /No file was chosen/.test(message(e)) ? '' : message(e) });
      throw e;
    } finally { void sub.remove(); }
  },

  async remove(): Promise<void> {
    try { await Native.removeModel(); set({ state: 'none', sizeMb: 0, error: '' }); } catch (e) { set({ error: message(e) }); }
  },
};

/** The model's state, redrawn when it changes. */
export function useBrain(): BrainSnapshot { return useSyncExternalStore(brain.subscribe, brain.get); }

/** Whether the phone has a connection (it can change while the app is open). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    f => { window.addEventListener('online', f); window.addEventListener('offline', f); return () => { window.removeEventListener('online', f); window.removeEventListener('offline', f); }; },
    () => typeof navigator === 'undefined' || navigator.onLine !== false,
  );
}
