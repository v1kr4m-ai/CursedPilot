import { createMeaning } from './meaning';
import type { Embed, Meaning } from './meaning';
// the runtime's own files, as the bundle already ships them (pointing at them here keeps a second 21 MB copy out of the app)
// @ts-expect-error a Vite asset URL
import ortWasm from '../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm?url';
// @ts-expect-error a Vite asset URL
import ortMjs from '../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs?url';

// The sentence model behind NavYeo's matching by meaning: all-MiniLM-L6-v2 (quantised, 23 MB), shipped with the app in public/models and run in the
// app's own web view by Transformers.js, with its runtime bundled, so it works offline. Loaded on first use (about a second), then a few
// milliseconds a sentence.

let pipe: Promise<(texts: string[], o: object) => Promise<{ tolist(): number[][] }>> | null = null;

const load = () => pipe ??= (async () => {
  const t = await import('@huggingface/transformers');
  t.env.allowRemoteModels = false;                    // never fetched from the internet: the files are in the app
  t.env.allowLocalModels = true;
  t.env.localModelPath = new URL('models/', document.baseURI).href;
  const wasm = t.env.backends.onnx.wasm!;
  wasm.wasmPaths = { wasm: new URL(ortWasm as string, document.baseURI).href, mjs: new URL(ortMjs as string, document.baseURI).href };
  wasm.numThreads = 1;                                // the web view is not cross-origin isolated, so no worker threads
  const p = await t.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8', device: 'wasm' });
  return p as unknown as (texts: string[], o: object) => Promise<{ tolist(): number[][] }>;
})().catch(e => { pipe = null; throw e; });

export const embed: Embed = async texts => (await (await load())(texts, { pooling: 'mean', normalize: true })).tolist();

/** NavYeo's matching by meaning, with the thresholds measured for this model. */
// measured: nav phrasings 0.52-0.83, unrelated chat (jokes, weather, music) 0.31 or less; questions 0.54-0.64 against 0.13 for unrelated ones
export const meaning: Meaning = createMeaning(embed, { intentMin: 0.45, answerMin: 0.4 });
