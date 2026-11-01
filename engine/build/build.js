/* Сборка: node engine/build/build.js [имя_набора]  →  engine/dist/<имя>/student_material.html и teacher_console.html
   Одно и то же содержание (pack.js) встраивается в оба файла из одного источника; contentHash совпадает. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ORDER = require('./order.js');
const name = process.argv[2] || 'demo';

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function cyrb53(str, seed) {
  seed = seed || 0; let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
const hashHex = s => { let x = cyrb53(s).toString(16); while (x.length < 14) x = '0' + x; return x; };
const safeJs = s => s.replace(/<\/script/gi, '<\\/script');

const engineVersion = read('VERSION').trim();
const packSrc = read(`content/${name}/pack.js`);
const contentHash = hashHex(packSrc);
const packMeta = (packSrc.match(/materialId:\s*'([^']+)'/) || [])[1] || name;
const contentVersion = (packSrc.match(/contentVersion:\s*'([^']+)'/) || [])[1] || '0.0.0';

function bundle(parts, title, cssFiles, bodyHtml) {
  const producer = `KAP.PRODUCER = ${JSON.stringify({ materialId: packMeta, engineVersion, contentVersion, contentHash })};`;
  const js = [
    '/* ядро */', ...ORDER.core.map(f => `/* --- ${f} --- */\n` + read('src/' + f)),
    '/* содержание */', `/* --- content/${name}/pack.js · contentHash ${contentHash} --- */\n` + packSrc, producer,
    '/* интерфейс */', ...parts.map(f => `/* --- ${f} --- */\n` + read('src/' + f))
  ].join('\n');
  const css = cssFiles.map(f => read('src/' + f)).join('\n');
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
${css}
</style>
</head>
<body>
${bodyHtml}
<script>
${safeJs(js)}
</script>
</body>
</html>
`;
}

const outDir = path.join(ROOT, 'dist', name);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'student_material.html'),
  bundle(ORDER.student, 'Мои уроки', ['styles/shared.css', 'styles/student.css'], '<div id="app" class="app" aria-live="polite"></div>'));
fs.writeFileSync(path.join(outDir, 'teacher_console.html'),
  bundle(ORDER.teacher, 'Кабинет учителя', ['styles/shared.css', 'styles/teacher.css'], '<div id="app" class="app"></div>'));
console.log(`Сборка «${name}»: engine ${engineVersion}, content ${contentVersion}, contentHash ${contentHash}`);
['student_material.html', 'teacher_console.html'].forEach(f => console.log('  ' + path.join('dist', name, f) + ' · ' + Math.round(fs.statSync(path.join(outDir, f)).size / 1024) + ' КБ'));
