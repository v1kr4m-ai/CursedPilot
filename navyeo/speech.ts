// Speaking NavYeo's answers aloud, for the voice assistant. The phone's own speech engine does the talking (no network is needed when it has a voice
// installed); the text is first made speakable: bearings are read a digit at a time and units spelt out. `speakable` is pure; `node navyeo/speech.check.ts`.

export const canSpeak = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner'];
const unit = (v: string, one: string, many: string) => (parseFloat(v) === 1 ? one : many);

/** An answer as it should be read aloud: "Steer 044° at 12 kn (30 m)" becomes "Steer zero four four degrees at 12 knots, 30 metres". */
export function speakable(text: string): string {
  let s = text;
  s = s.replace(/\b(\d{3})\s*°/g, (_m, d: string) => `${d.split('').map(x => DIGITS[+x]).join(' ')} degrees`);        // courses and bearings, digit by digit
  s = s.replace(/(\d+(?:\.\d+)?)\s*°/g, (_m, v: string) => `${v} ${unit(v, 'degree', 'degrees')}`);
  s = s.replace(/(\d+(?:\.\d+)?)\s*′/g, (_m, v: string) => `${v} ${unit(v, 'minute', 'minutes')}`);
  s = s.replace(/(\d+(?:\.\d+)?)\s*nm\b/g, (_m, v: string) => `${v} nautical ${unit(v, 'mile', 'miles')}`);
  s = s.replace(/(\d+(?:\.\d+)?)\s*kn\b/g, (_m, v: string) => `${v} ${unit(v, 'knot', 'knots')}`);
  s = s.replace(/(\d+(?:\.\d+)?)\s*km\b/g, (_m, v: string) => `${v} ${unit(v, 'kilometre', 'kilometres')}`);
  s = s.replace(/(\d+(?:\.\d+)?)\s*yd\b/g, (_m, v: string) => `${v} ${unit(v, 'yard', 'yards')}`);
  s = s.replace(/(\d+(?:\.\d+)?)\s*ft\b/g, (_m, v: string) => `${v} ${unit(v, 'foot', 'feet')}`);
  s = s.replace(/(\d+(?:\.\d+)?)\s*fm\b/g, (_m, v: string) => `${v} ${unit(v, 'fathom', 'fathoms')}`);
  s = s.replace(/(\d+(?:\.\d+)?)\s*m\b/g, (_m, v: string) => `${v} ${unit(v, 'metre', 'metres')}`);
  s = s.replace(/(\d+(?:\.\d+)?)\s*t\/h\b/g, (_m, v: string) => `${v} ${unit(v, 'tonne', 'tonnes')} an hour`);
  s = s.replace(/(\d+(?:\.\d+)?)\s*t\b/g, (_m, v: string) => `${v} ${unit(v, 'tonne', 'tonnes')}`);
  s = s.replace(/×/g, ' times ').replace(/≈/g, ' about ').replace(/\s*[;·•]\s*/g, '. ').replace(/[()]/g, ', ').replace(/\//g, ' over ');
  return s.replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/\s+/g, ' ').replace(/,\s*\./g, '.').replace(/[,\s]+$/, '').trim();
}

export interface Talking { cancel: () => void }

/** Reads `text` aloud and calls `onEnd` when it is done (or at once, after a pause for reading, where the device cannot speak). */
export function speak(text: string, onEnd: () => void): Talking {
  let done = false;
  const finish = () => { if (!done) { done = true; onEnd(); } };
  const said = speakable(text);
  if (!canSpeak()) {
    const t = setTimeout(finish, Math.min(8000, 1200 + said.length * 45));   // no voice here: leave time to read it
    return { cancel: () => { done = true; clearTimeout(t); } };
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(said);
  u.lang = 'en-IN'; u.rate = 1;
  u.onend = finish; u.onerror = finish;
  synth.speak(u);
  return { cancel: () => { done = true; synth.cancel(); } };
}
