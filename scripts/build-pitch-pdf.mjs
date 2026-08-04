/**
 * Render docs/PITCH.md to a print-ready A4 PDF using the Electron shell that
 * already ships with the project (no extra dependency, no network).
 *
 * Usage: electron scripts/build-pitch-pdf.mjs [in.md] [out.pdf]
 *
 * The markdown subset understood here is exactly what PITCH.md uses:
 * headings, tables, bullet lists, fenced code, hr, bold, inline code, links,
 * and `<!-- pagebreak -->` to pin a page boundary.
 */
import { app, BrowserWindow } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const inFile = process.argv[2] ?? path.join(root, 'docs', 'PITCH.md');
const outFile = process.argv[3] ?? path.join(root, 'docs', 'Play-the-Word-Pitch.pdf');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** inline: `code`, **bold**, [text](url) */
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;
  let para = [];

  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '<!-- pagebreak -->') {
      flushPara();
      out.push('<div class="pagebreak"></div>');
      i++;
      continue;
    }
    if (!line.trim()) {
      flushPara();
      i++;
      continue;
    }
    if (/^---+\s*$/.test(line)) {
      flushPara();
      out.push('<hr>');
      i++;
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      flushPara();
      const body = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      out.push(`<pre>${esc(body.join('\n'))}</pre>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara();
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let item = lines[i++].replace(/^\s*[-*]\s+/, '');
        // continuation lines (indented, not a new bullet)
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) {
          item += ' ' + lines[i++].trim();
        }
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (line.startsWith('|')) {
      flushPara();
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = (r) =>
        r.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells); // rows[1] is the ---|--- separator
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` +
          `<tbody>${body
            .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
            .join('')}</tbody></table>`,
      );
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flushPara();
  return out.join('\n');
}

const CSS = `
:root{
  --ink:#1b1d21; --muted:#6b7280; --rule:#e2e4e8;
  --accent:#e8a33d; --dark:#1b1d21;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  font-family:"Pretendard","Malgun Gothic","Noto Sans KR","Segoe UI",sans-serif;
  color:var(--ink); font-size:9.1pt; line-height:1.52;
  -webkit-font-smoothing:antialiased;
}
.hero{
  background:var(--dark); color:#fff; padding:24px 26px 22px;
  border-bottom:4px solid var(--accent); margin-bottom:18px;
}
.hero .kicker{
  color:var(--accent); font-size:7.6pt; letter-spacing:.34em; font-weight:700;
  margin:0 0 8px;
}
.hero h1{font-size:27pt; line-height:1.05; margin:0 0 10px; letter-spacing:-.01em}
.hero p{margin:0 0 4px; color:#d7dade; font-size:9.3pt}
.hero .meta{
  margin-top:14px; padding-top:12px; border-top:1px solid #3a3d44;
  font-size:8.4pt; color:#b9bec5;
}
.hero .meta strong{color:#fff}
.hero a{color:var(--accent); text-decoration:none}
.body{padding:0}
h2{
  font-size:13pt; margin:20px 0 9px; padding-bottom:5px;
  border-bottom:2px solid var(--dark); letter-spacing:-.01em;
}
h3{
  font-size:10pt; margin:14px 0 6px; padding-left:8px;
  border-left:3px solid var(--accent);
}
p{margin:0 0 7px}
ul{margin:0 0 8px; padding-left:17px}
li{margin:0 0 4px}
strong{font-weight:700}
a{color:#a26a13}
code{
  font-family:"Cascadia Mono","Consolas",monospace; font-size:8.2pt;
  background:#f1f2f4; padding:.5px 3.5px; border-radius:2px;
}
pre{
  background:var(--dark); color:#e9ecef; padding:11px 14px; border-radius:3px;
  font-family:"Cascadia Mono","Consolas",monospace; font-size:8.1pt;
  line-height:1.6; margin:0 0 9px; white-space:pre-wrap;
}
pre code{background:none;padding:0;color:inherit}
hr{border:0;border-top:1px solid var(--rule);margin:14px 0}
table{
  width:100%; border-collapse:collapse; margin:0 0 9px; font-size:8.6pt;
}
th{
  background:var(--dark); color:#fff; text-align:left; font-weight:700;
  padding:5px 9px; font-size:8.2pt;
}
td{padding:5px 9px; border-bottom:1px solid var(--rule); vertical-align:top}
tbody tr:nth-child(even){background:#f7f8f9}
.pagebreak{break-after:page}
h2,h3{break-after:avoid}
table,pre,ul{break-inside:avoid}
`;

const md = readFileSync(inFile, 'utf8');
// The leading title + meta block becomes the dark hero; the rest is the body.
const heroEnd = md.indexOf('\n---');
const heroSrc = md.slice(0, heroEnd);
const bodySrc = md.slice(md.indexOf('\n', heroEnd + 1));

const heroMeta = heroSrc
  .split(/\r?\n/)
  .filter((l) => l.startsWith('**'))
  .map(inline)
  .join('<br>');

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>Play the Wor!d — 게임 기획안</title><style>${CSS}</style></head><body>
<div class="hero">
  <p class="kicker">GAME PITCH / 2026</p>
  <h1>Play the Wor!d</h1>
  <p>알파벳 타일로 <strong>단어</strong>를 만들고, 그 단어들이 순서대로 쌓여 <strong>문장</strong>이 되면 폭발적인 보너스를 받는 로그라이트.</p>
  <p>당신은 마감에 쫓기는 <strong>작가</strong>다.</p>
  <div class="meta">${heroMeta}</div>
</div>
<div class="body">${mdToHtml(bodySrc)}</div>
</body></html>`;

const tmpHtml = path.join(root, 'tmp', 'pitch.html');
writeFileSync(tmpHtml, html, 'utf8');

// Isolated profile: the shared default Electron userData dir can keep a stale
// lock after a killed run and then whenReady() never resolves.
app.setPath('userData', path.join(root, 'tmp', 'pitch-electron'));

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 900, height: 1200 });
  await win.loadURL(pathToFileURL(tmpHtml).href);
  const pdf = await win.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
    margins: { top: 0.5, bottom: 0.58, left: 0.55, right: 0.55 },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="width:100%;font-size:7pt;color:#9aa0a6;padding:0 30px;' +
      'font-family:Malgun Gothic,sans-serif;display:flex;justify-content:space-between;">' +
      '<span>Play the Wor!d — Game Pitch</span>' +
      '<span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
  });
  writeFileSync(outFile, pdf);
  console.log(`wrote ${outFile} (${(pdf.length / 1024).toFixed(0)} KB)`);
  app.quit();
}).catch((err) => {
  console.error('pitch pdf failed:', err);
  app.exit(1);
});
