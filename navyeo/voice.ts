// Speech to text for NavYeo. On the phone it uses the device's recogniser through the Capacitor plugin; in a browser
// it uses the browser's own (Chrome, Edge, Safari). Nothing is recorded or kept here; the text goes to the same
// keyword matcher as typing. Where the device sends audio to its speech service depends on the device.
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

interface WebRecognition {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type WebCtor = new () => WebRecognition;
const webCtor = (): WebCtor | null => {
  const w = window as unknown as { SpeechRecognition?: WebCtor; webkitSpeechRecognition?: WebCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const voiceMaybeSupported = (): boolean => Capacitor.isNativePlatform() || webCtor() !== null;

/** Why the microphone cannot work here, for the one short notice when it is tapped; empty when it may work. */
export const voiceUnavailableReason = (): string => voiceMaybeSupported() ? '' : 'This browser has no speech recognition (Chrome, Edge or Safari have it, and so does the Android app). Type your request instead.';

const LANG = 'en-IN';
/** The recogniser sometimes never answers (no connection, no offline speech pack): give up after this long rather than stay on "listening". */
const GIVE_UP_MS = 12000;
const OFFLINE = 'Voice is offline here. Type your request instead.';
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

const explain = (code: string): string =>
  /not-allowed|permission|denied/i.test(code) ? 'Microphone permission was refused. Allow it for this app in the device settings.'
    : /no-speech|nomatch|no match/i.test(code) ? 'I did not hear anything. Tap the microphone and try again.'
      : /network|timeout|timed out|offline/i.test(code) ? OFFLINE
        : /not-supported|unavailable|service/i.test(code) ? 'Speech recognition is not available on this device.'
          : `Voice input stopped (${code}).`;

export interface Listening { stop: () => void }

/** Starts listening. `onText` gets the final text, `onEnd` is always called once, with an explanation if nothing usable came back. */
export interface ListenOptions { /** keep listening through short pauses and finish only after this many ms of silence (the voice assistant) */ holdMs?: number }
export async function startListening(onText: (text: string) => void, onEnd: (problem?: string) => void, onPartial?: (text: string) => void, opts: ListenOptions = {}): Promise<Listening> {
  if (Capacitor.isNativePlatform()) {
    let done = false, timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (p?: string) => { if (!done) { done = true; if (timer) clearTimeout(timer); onEnd(p); } };
    try {
      if (!(await SpeechRecognition.available()).available) { finish(isOffline() ? OFFLINE : 'Speech recognition is not available on this phone. It needs the Google app (Speech Services) installed and enabled: check Settings, Apps. Type your request instead.'); return { stop: () => undefined }; }
      // ask for the microphone only when it has not been decided, so a refusal does not bring the prompt back at every tap
      let granted: string = (await SpeechRecognition.checkPermissions()).speechRecognition;
      if (granted === 'prompt' || granted === 'prompt-with-rationale') granted = (await SpeechRecognition.requestPermissions()).speechRecognition;
      if (granted !== 'granted') { finish(explain('permission denied')); return { stop: () => undefined }; }
      // with no connection the phone's recogniser may never answer: stop it after a while and say so once
      timer = setTimeout(() => { SpeechRecognition.stop().catch(() => undefined); finish(isOffline() ? OFFLINE : explain('no match')); }, GIVE_UP_MS);
      SpeechRecognition.start({ language: LANG, maxResults: 1, partialResults: false, popup: false })
        .then(r => { const t = r.matches?.[0]; if (t) { onText(t); finish(); } else finish(isOffline() ? OFFLINE : explain('no match')); })
        .catch(e => finish(isOffline() ? OFFLINE : explain(String(e?.message ?? e))));
    } catch (e) { finish(isOffline() ? OFFLINE : explain(String((e as Error)?.message ?? e))); }
    return { stop: () => { SpeechRecognition.stop().catch(() => undefined); } };
  }

  if (isOffline()) { onEnd(OFFLINE); return { stop: () => undefined }; }   // the browser's recogniser sends the audio away: do not start it
  const Ctor = webCtor();
  if (!Ctor) { onEnd('This browser has no speech recognition. Type your request instead.'); return { stop: () => undefined }; }
  const rec = new Ctor();
  const hold = opts.holdMs;
  rec.lang = LANG; rec.interimResults = !!onPartial; rec.maxAlternatives = 1; rec.continuous = !!hold;
  let got = false, problem: string | undefined, ended = false, heard = '';
  let watchdog: ReturnType<typeof setTimeout> | undefined, stopTimer: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    if (ended) return;
    ended = true; clearTimeout(watchdog); clearTimeout(stopTimer);
    if (hold && heard.trim()) { got = true; onText(heard.trim()); }
    onEnd(got ? undefined : problem ?? explain('no match'));
  };
  const arm = () => { clearTimeout(watchdog); watchdog = setTimeout(() => { problem = isOffline() ? OFFLINE : explain('no-speech'); try { rec.abort(); } catch { /* already stopped */ } finish(); }, hold ? 15000 : GIVE_UP_MS); };
  arm();
  rec.onresult = e => {
    if (hold) {   // the assistant: words so far are shown as they come, and the turn ends after a pause
      let t = '';
      for (let k = 0; k < e.results.length; k++) t += e.results[k][0]?.transcript ?? '';
      heard = t; onPartial?.(t);
      clearTimeout(stopTimer); stopTimer = setTimeout(() => { try { rec.stop(); } catch { /* already stopped */ } }, hold);
      arm();
      return;
    }
    const t = e.results[0]?.[0]?.transcript;
    if (t) { got = true; onText(t); }
  };
  rec.onerror = e => { problem = explain(e.error); };
  rec.onend = finish;
  try { rec.start(); } catch (e) { problem = explain(String((e as Error)?.message ?? e)); finish(); }
  return { stop: () => { try { rec.stop(); } catch { /* already stopped */ } } };
}
