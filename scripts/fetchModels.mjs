// Puts NavYeo's sentence model (all-MiniLM-L6-v2, quantised, 23 MB, Apache-2.0) into public/, so it ships inside the app and
// it works offline. It is too big for git, so this runs before each build; a file already there is left alone.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const MODEL = 'Xenova/all-MiniLM-L6-v2';
const files = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx'];
for (const f of files) {
  const out = `public/models/${MODEL}/${f}`;
  if (existsSync(out)) continue;
  mkdirSync(dirname(out), { recursive: true });
  const r = await fetch(`https://huggingface.co/${MODEL}/resolve/main/${f}`);
  if (!r.ok) throw new Error(`${f}: ${r.status}`);
  writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  console.log(`fetched ${out}`);
}
