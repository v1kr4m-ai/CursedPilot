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

const LANG = 'en-IN';

const explain = (code: string): string =>
  /not-allowed|permission|denied/i.test(code) ? 'Microphone permission was refused. Allow it for this app in the device settings.'
    : /no-speech|nomatch|no match/i.test(code) ? 'I did not hear anything. Tap the microphone and try again.'
      : /network/i.test(code) ? 'Speech recognition needs a connection on this device.'
        : /not-supported|unavailable|service/i.test(code) ? 'Speech recognition is not available on this device.'
          : `Voice input stopped (${code}).`;

export interface Listening { stop: () => void }

/** Starts listening. `onText` gets the final text, `onEnd` is always called once, with an explanation if nothing usable came back. */
export async function startListening(onText: (text: string) => void, onEnd: (problem?: string) => void): Promise<Listening> {
  if (Capacitor.isNativePlatform()) {
    let done = false;
    const finish = (p?: string) => { if (!done) { done = true; onEnd(p); } };
    try {
      if (!(await SpeechRecognition.available()).available) { finish('Speech recognition is not available on this device.'); return { stop: () => undefined }; }
      const perm = await SpeechRecognition.requestPermissions();
      if (perm.speechRecognition !== 'granted') { finish(explain('permission denied')); return { stop: () => undefined }; }
      SpeechRecognition.start({ language: LANG, maxResults: 1, partialResults: false, popup: false })
        .then(r => { const t = r.matches?.[0]; if (t) { onText(t); finish(); } else finish(explain('no match')); })
        .catch(e => finish(explain(String(e?.message ?? e))));
    } catch (e) { finish(explain(String((e as Error)?.message ?? e))); }
    return { stop: () => { SpeechRecognition.stop().catch(() => undefined); } };
  }

  const Ctor = webCtor();
  if (!Ctor) { onEnd('This browser has no speech recognition. Type your request instead.'); return { stop: () => undefined }; }
  const rec = new Ctor();
  rec.lang = LANG; rec.interimResults = false; rec.maxAlternatives = 1; rec.continuous = false;
  let got = false, problem: string | undefined;
  rec.onresult = e => { const t = e.results[0]?.[0]?.transcript; if (t) { got = true; onText(t); } };
  rec.onerror = e => { problem = explain(e.error); };
  rec.onend = () => onEnd(got ? undefined : problem ?? explain('no match'));
  try { rec.start(); } catch (e) { onEnd(explain(String((e as Error)?.message ?? e))); }
  return { stop: () => { try { rec.stop(); } catch { /* already stopped */ } } };
}
