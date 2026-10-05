// A minimal Word (.docx) writer and table reader. A .docx is a zip of XML parts; we write the three parts Word
// requires and read tables back out of word/document.xml. `node services/docx.check.ts` checks the round trip.
import JSZip from 'jszip';

export interface DocxTable {
  /** a bold line above the table */
  heading?: string;
  /** the first row is the header */
  rows: string[][];
}

const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

// characters XML cannot carry (control codes) are dropped; & < > are escaped
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const esc = (s: string) => clean(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const para = (text: string, opts: { bold?: boolean; size?: number } = {}) =>
  `<w:p><w:r>${opts.bold || opts.size ? `<w:rPr>${opts.bold ? '<w:b/>' : ''}${opts.size ? `<w:sz w:val="${opts.size}"/>` : ''}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;

const cell = (text: string, header: boolean) =>
  `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>${header ? '<w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/>' : ''}</w:tcPr>${para(text, { bold: header, size: 18 })}</w:tc>`;

const border = (side: string) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>`;

function table(rows: string[][]): string {
  const cols = Math.max(1, ...rows.map(r => r.length));
  const grid = Array.from({ length: cols }, () => '<w:gridCol w:w="1300"/>').join('');
  const body = rows.map((r, i) => `<w:tr>${Array.from({ length: cols }, (_, c) => cell(r[c] ?? '', i === 0)).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl><w:p/>`;
}

/** Builds a landscape A4 document: a title, then each table under its heading. */
export async function buildDocx(title: string, tables: DocxTable[]): Promise<Uint8Array> {
  const content = para(title, { bold: true, size: 32 }) + tables.map(t => (t.heading ? para(t.heading, { bold: true, size: 22 }) : '') + table(t.rows)).join('');
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="${NS}"><w:body>${content}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const zip = new JSZip();
  const opts = { createFolders: false };                 // no folder entries: strict readers dislike them
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>', opts);
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>', opts);
  zip.file('word/document.xml', document, opts);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

const decode = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');                                                    // last, so "&amp;lt;" stays "&lt;"

/** The text of one table cell: its runs joined, paragraphs separated by a space, tabs and line breaks as spaces. */
function cellText(xml: string): string {
  return xml.split(/<\/w:p>/).map(p =>
    [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g)].map(m => (m[1] !== undefined ? decode(m[1]) : ' ')).join('')
  ).map(t => t.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/** Every table in a .docx as rows of cell text. Merged cells are read as the cells Word stores. */
export async function readDocxTables(data: ArrayBuffer | Uint8Array): Promise<string[][][]> {
  let xml: string | undefined;
  try { xml = await (await JSZip.loadAsync(data)).file('word/document.xml')?.async('string'); }
  catch { throw new Error('That is not a Word (.docx) file.'); }
  if (!xml) throw new Error('That is not a Word (.docx) file.');
  return [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)].map(t =>
    [...t[1].matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].map(r =>
      [...r[0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map(c => cellText(c[0]))));
}
