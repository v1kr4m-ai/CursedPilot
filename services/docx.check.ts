// Run: node services/docx.check.ts
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { buildDocx, readDocxTables } from './docx.ts';

// a tag-balance check: every opened element is closed in order (catches the mistakes that make Word call a file corrupt)
function wellFormed(xml: string) {
  const stack: string[] = [];
  for (const m of xml.replace(/<\?[\s\S]*?\?>/g, '').matchAll(/<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>/g)) {
    const [, close, name, , self] = m;
    if (self) continue;
    if (close) assert.equal(stack.pop(), name, `unbalanced </${name}>`); else stack.push(name);
  }
  assert.deepEqual(stack, [], 'unclosed elements');
  assert.ok(!/<(?!\/?[A-Za-z?!])/.test(xml.replace(/<[^>]*>/g, '')), 'stray <');
}

const rows = [
  ['Speed (kn)', 'Wheel (°)', 'Side', 'Time', 'Note'],
  ['12', '15', 'Starboard', '01:45', 'a < b & "c" \'d\' > e'],
  ['8', '20', 'Port', '', 'café → ±'],
];
const bytes = await buildDocx('HMS <Test> & Co - turning data', [{ heading: 'Table one', rows }, { rows: [['A', 'B'], ['1', '2']] }]);

// the package has the three required parts and well-formed XML
const zip = await JSZip.loadAsync(bytes);
assert.deepEqual(Object.keys(zip.files).sort(), ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']);
for (const name of Object.keys(zip.files)) wellFormed(await zip.file(name)!.async('string'));
const doc = await zip.file('word/document.xml')!.async('string');
assert.ok(doc.includes('&lt;Test&gt; &amp; Co') && !doc.includes('<Test>'));                  // title is escaped
assert.ok(/<\/w:tbl><w:p\/>/.test(doc));                                                       // a paragraph follows each table (Word requires it)
assert.equal((doc.match(/<w:tbl>/g) ?? []).length, 2);
assert.ok(doc.includes('<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>'));

// round trip
const back = await readDocxTables(bytes);
assert.equal(back.length, 2);
assert.deepEqual(back[0], rows); assert.deepEqual(back[1], [['A', 'B'], ['1', '2']]);

// ragged rows are padded so every row has the same number of cells
const ragged = await readDocxTables(await buildDocx('t', [{ rows: [['a', 'b', 'c'], ['1']] }]));
assert.deepEqual(ragged[0], [['a', 'b', 'c'], ['1', '', '']]);

// a document written by Word: text split over runs, several paragraphs in a cell, tabs, entities, extra attributes
const word = `<?xml version="1.0"?><w:document xmlns:w="${'x'}"><w:body><w:p><w:r><w:t>Intro</w:t></w:r></w:p>
<w:tbl><w:tblPr/><w:tblGrid/><w:tr w:rsidR="00A"><w:tc><w:tcPr/><w:p><w:r><w:t>Turn </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">(&#176;)</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Time</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>60</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>02</w:t></w:r><w:r><w:t>:05</w:t></w:r></w:p><w:p><w:r><w:t>est.</w:t><w:tab/><w:t>&amp;lt;</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p/></w:body></w:document>`;
const z2 = new JSZip(); z2.file('word/document.xml', word);
const parsed = await readDocxTables(await z2.generateAsync({ type: 'uint8array' }));
assert.deepEqual(parsed, [[['Turn (°)', 'Time'], ['60', '02:05 est. &lt;']]]);

// not a docx
await assert.rejects(readDocxTables(new TextEncoder().encode('just text')), /not a Word/);
const empty = new JSZip(); empty.file('other.txt', 'x');
await assert.rejects(readDocxTables(await empty.generateAsync({ type: 'uint8array' })), /not a Word/);
assert.deepEqual(await readDocxTables(await buildDocx('no tables', [])), []);

console.log('docx: all checks passed');
