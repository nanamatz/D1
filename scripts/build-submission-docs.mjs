/**
 * Render the two Korean submission documents in docs/submission/ to A4 PDFs.
 *
 * Usage:
 *   electron scripts/build-submission-docs.mjs
 *   electron scripts/build-submission-docs.mjs input.md output.pdf
 *
 * The renderer is intentionally small and offline. It supports the Markdown
 * used by these documents: headings, paragraphs, links, images, tables,
 * ordered/unordered lists, blockquotes, fenced code, horizontal rules, and
 * explicit `<!-- pagebreak -->` page boundaries.
 */
import { app, BrowserWindow } from 'electron';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs', 'submission');

const DEFAULT_JOBS = [
  {
    input: path.join(DOCS, '01_게임_소개_및_설명.md'),
    output: path.join(DOCS, 'Play-the-World_게임-소개-및-설명.pdf'),
  },
  {
    input: path.join(DOCS, '02_AI_활용_기술_문서.md'),
    output: path.join(DOCS, 'Play-the-World_AI-활용-기술-문서.pdf'),
  },
];

const cliInput = process.argv[2];
const cliOutput = process.argv[3];
const jobs = cliInput
  ? [{ input: path.resolve(cliInput), output: path.resolve(cliOutput ?? cliInput.replace(/\.md$/i, '.pdf')) }]
  : DEFAULT_JOBS;

const esc = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function parseFrontMatter(source) {
  if (!source.startsWith('---\n')) return { meta: {}, body: source };
  const end = source.indexOf('\n---\n', 4);
  if (end < 0) return { meta: {}, body: source };
  const meta = {};
  for (const line of source.slice(4, end).split(/\r?\n/)) {
    const split = line.indexOf(':');
    if (split < 0) continue;
    meta[line.slice(0, split).trim()] = line.slice(split + 1).trim();
  }
  return { meta, body: source.slice(end + 5) };
}

function inline(value) {
  return esc(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function imageHtml(markdownDir, alt, target) {
  const source = /^(?:https?:|data:|file:)/.test(target)
    ? target
    : pathToFileURL(path.resolve(markdownDir, target)).href;
  return `<figure><img src="${esc(source)}" alt="${esc(alt)}"><figcaption>${inline(alt)}</figcaption></figure>`;
}

function mdToHtml(source, markdownDir) {
  const lines = source.trim().split(/\r?\n/);
  const out = [];
  let index = 0;
  let para = [];

  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
  };

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      flushPara();
      index += 1;
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line.trim());
    if (image) {
      flushPara();
      out.push(imageHtml(markdownDir, image[1], image[2]));
      index += 1;
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      flushPara();
      out.push('<hr>');
      index += 1;
      continue;
    }

    if (line.startsWith('```')) {
      flushPara();
      const body = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) body.push(lines[index++]);
      index += 1;
      out.push(`<pre>${esc(body.join('\n'))}</pre>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushPara();
      const body = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        body.push(lines[index++].replace(/^>\s?/, ''));
      }
      out.push(`<blockquote>${body.map(inline).join('<br>')}</blockquote>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      flushPara();
      const items = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        let item = lines[index++].replace(/^\s*[-*]\s+/, '');
        while (index < lines.length && /^\s{2,}\S/.test(lines[index]) && !/^\s*[-*]\s+/.test(lines[index])) {
          item += ` ${lines[index++].trim()}`;
        }
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      flushPara();
      const items = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        let item = lines[index++].replace(/^\s*\d+\.\s+/, '');
        while (index < lines.length && /^\s{2,}\S/.test(lines[index])) item += ` ${lines[index++].trim()}`;
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    if (line.startsWith('|')) {
      flushPara();
      const rows = [];
      while (index < lines.length && lines[index].startsWith('|')) rows.push(lines[index++]);
      const cells = (row) => row.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((cell) => cell.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push(`<table><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }

    para.push(line.trim());
    index += 1;
  }

  flushPara();
  return out.join('\n');
}

function localFontCss(packageName, files) {
  const packageDir = path.join(ROOT, 'node_modules', '@fontsource', packageName);
  return files.map((file) => readFileSync(path.join(packageDir, file), 'utf8')
    .replace(/url\((\.\/files\/[^)]+)\)/g, (_match, relative) => {
      return `url("${pathToFileURL(path.resolve(packageDir, relative)).href}")`;
    })).join('\n');
}

const FONT_CSS = [
  localFontCss('noto-sans-kr', ['korean-500.css', 'korean-700.css', 'latin-500.css', 'latin-700.css']),
  localFontCss('baloo-2', ['latin-700.css']),
  localFontCss('jersey-10', ['latin-400.css']),
].join('\n');

const CSS = `
${FONT_CSS}
:root{
  --paper:#fffdf8; --ink:#17212b; --muted:#66717c; --navy:#111b2b;
  --line:#d8dde1; --gold:#f2b134; --red:#ef5350; --blue:#37a5f3;
  --green:#2e8b70; --soft:#f3f5f4;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--paper)}
body{
  width:184mm;
  color:var(--ink); font-family:"Noto Sans KR",sans-serif;
  font-size:8.75pt; line-height:1.48; -webkit-font-smoothing:antialiased;
}
@page{size:A4;margin:11mm 13mm 13mm}
.cover{
  min-height:271mm; position:relative; overflow:hidden; padding:17mm 14mm;
  color:#fff; background:
    radial-gradient(circle at 85% 8%,rgba(55,165,243,.25),transparent 31%),
    radial-gradient(circle at 8% 80%,rgba(242,177,52,.19),transparent 35%),
    repeating-linear-gradient(0deg,rgba(255,255,255,.018) 0 1px,transparent 1px 4px),
    var(--navy); break-after:page;
}
.cover::after{content:"";position:absolute;left:14mm;right:14mm;bottom:12mm;height:4px;background:linear-gradient(90deg,var(--gold),var(--red),var(--blue))}
.cover-kicker{font-family:"Jersey 10",sans-serif;color:var(--gold);font-size:12pt;letter-spacing:.22em;text-transform:uppercase}
.cover h1{font-family:"Baloo 2","Noto Sans KR",sans-serif;font-size:31pt;line-height:1.03;margin:7mm 0 2mm;letter-spacing:-.035em;color:#fff}
.cover h2{font-size:16pt;border:0;color:#fff;margin:0 0 6mm;padding:0}
.cover-subtitle{max-width:142mm;color:#d9e0e7;font-size:11.1pt;line-height:1.62;margin:0 0 8mm}
.cover-visual{height:90mm;border:1px solid rgba(255,255,255,.16);background:#070c13;border-radius:4mm;overflow:hidden;box-shadow:0 4mm 12mm rgba(0,0,0,.28)}
.cover-visual img{width:100%;height:100%;object-fit:cover;display:block}
.cover-art{position:absolute;right:10mm;bottom:19mm;height:54mm;image-rendering:pixelated;filter:drop-shadow(0 3mm 4mm rgba(0,0,0,.45))}
.cover-meta{position:absolute;left:14mm;bottom:18mm;color:#bbc4cd;font-size:8.4pt;line-height:1.65}
.cover-meta b{color:#fff}
.page{min-height:271mm;break-after:page;position:relative;padding-top:1mm}
.page:last-child{break-after:auto}
h1{font-family:"Baloo 2","Noto Sans KR",sans-serif;font-size:22pt;margin:0 0 8mm;color:var(--navy)}
h2{font-size:14.5pt;letter-spacing:-.02em;margin:0 0 4mm;padding:0 0 2.3mm;border-bottom:2px solid var(--navy);color:var(--navy)}
h2::before{content:"";display:inline-block;width:4px;height:.95em;background:var(--gold);margin-right:7px;vertical-align:-.08em}
h3{font-size:10.8pt;margin:3.8mm 0 2mm;padding-left:7px;border-left:3px solid var(--blue);color:#243548}
h4{font-size:9.5pt;margin:3mm 0 1.2mm;color:#2f4255}
p{margin:0 0 2.2mm}
strong{font-weight:700;color:#101820}
em{color:var(--muted)}
a{color:#176ba0;text-decoration:none;border-bottom:1px dotted #75a8c6}
code{font-family:Consolas,"Noto Sans KR",monospace;font-size:8.1pt;background:#e9edf0;border-radius:2px;padding:.4mm 1mm;color:#23364a}
pre{font-family:Consolas,"Noto Sans KR",monospace;font-size:7.7pt;line-height:1.52;white-space:pre-wrap;background:var(--navy);color:#f3f5f7;border-radius:2.5mm;padding:3.3mm 4.5mm;margin:0 0 3mm;break-inside:avoid;border-left:4px solid var(--gold)}
ul,ol{margin:0 0 2.8mm;padding-left:5.5mm}
li{margin:0 0 1.15mm;padding-left:1mm}
li::marker{color:#d18410;font-weight:700}
blockquote{margin:3mm 0;padding:3mm 4mm;background:#edf5f6;border-left:4px solid var(--green);border-radius:0 2mm 2mm 0;color:#263944;break-inside:avoid}
table{width:100%;border-collapse:separate;border-spacing:0;margin:0 0 3mm;font-size:8pt;break-inside:avoid;border:1px solid var(--line);border-radius:2mm;overflow:hidden}
th{background:var(--navy);color:#fff;text-align:left;padding:1.8mm 2.3mm;font-weight:700}
td{padding:1.65mm 2.3mm;border-top:1px solid var(--line);vertical-align:top}
tbody tr:nth-child(even){background:#f4f6f6}
hr{border:0;border-top:1px solid var(--line);margin:5mm 0}
figure{margin:3mm 0 3.5mm;break-inside:avoid}
figure img{display:block;width:100%;height:60mm;object-fit:contain;background:#111820;border-radius:2.5mm;border:1px solid #ccd2d6}
figcaption{margin-top:1.5mm;text-align:center;color:var(--muted);font-size:7.7pt}
.page-number-tag{position:absolute;right:0;bottom:0;color:#a4abb1;font-family:"Jersey 10";font-size:10pt}
`;

function coverHtml(meta, markdownDir) {
  const coverImage = meta.coverImage
    ? pathToFileURL(path.resolve(markdownDir, meta.coverImage)).href
    : '';
  const coverArt = meta.coverArt
    ? pathToFileURL(path.resolve(markdownDir, meta.coverArt)).href
    : '';
  return `<section class="cover">
    <div class="cover-kicker">${esc(meta.kicker ?? 'PLAY THE WOR!D / DOCUMENT')}</div>
    <h1>${esc(meta.title ?? 'Play the Wor!d')}</h1>
    <h2>${esc(meta.document ?? '')}</h2>
    <p class="cover-subtitle">${esc(meta.subtitle ?? '')}</p>
    ${coverImage ? `<div class="cover-visual"><img src="${coverImage}" alt=""></div>` : ''}
    ${coverArt ? `<img class="cover-art" src="${coverArt}" alt="">` : ''}
    <div class="cover-meta"><b>${esc(meta.author ?? 'Ben Kim')}</b><br>${esc(meta.version ?? '2026.08.04')}<br>${esc(meta.status ?? 'Submission Edition')}</div>
  </section>`;
}

function documentHtml(input) {
  const source = readFileSync(input, 'utf8').replace(/^\uFEFF/, '');
  const { meta, body } = parseFrontMatter(source);
  const markdownDir = path.dirname(input);
  const pages = body.split(/\n?<!-- pagebreak -->\n?/).map((part, index) => {
    return `<section class="page">${mdToHtml(part, markdownDir)}<span class="page-number-tag">${String(index + 2).padStart(2, '0')}</span></section>`;
  }).join('\n');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(meta.document ?? meta.title)}</title><style>${CSS}</style></head><body>${coverHtml(meta, markdownDir)}${pages}</body></html>`;
}

mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', mkdtempSync(path.join(ROOT, 'tmp', 'submission-pdf-profile-')));

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1100, height: 1400 });
  for (const job of jobs) {
    mkdirSync(path.dirname(job.output), { recursive: true });
    const htmlPath = path.join(ROOT, 'tmp', `${path.basename(job.input, '.md')}.html`);
    writeFileSync(htmlPath, documentHtml(job.input), 'utf8');

    await win.loadURL(pathToFileURL(htmlPath).href);
    await win.webContents.executeJavaScript(`Promise.all([
      document.fonts.ready,
      ...Array.from(document.images, (image) => image.complete
        ? Promise.resolve()
        : new Promise((resolve) => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); }))
    ])`, true);
    const layout = await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.cover,.page'), (section) => ({ client: Math.round(section.getBoundingClientRect().height), scroll: section.scrollHeight }))`, true);
    console.log(`layout ${path.basename(job.input)}: ${layout.map((value) => `${value.client}/${value.scroll}`).join(', ')} px`);
    const pdf = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="width:100%;font:7px Arial,sans-serif;color:#9ca3aa;padding:0 36px;display:flex;justify-content:space-between"><span>Play the Wor!d</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    });
    writeFileSync(job.output, pdf);
    console.log(`wrote ${job.output} (${(pdf.length / 1024).toFixed(0)} KB)`);
  }
  win.destroy();
  app.quit();
}).catch((error) => {
  console.error('submission PDF build failed:', error);
  app.exit(1);
});
