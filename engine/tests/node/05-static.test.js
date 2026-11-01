'use strict';
/* Статическая проверка собранных файлов: автономность и единый источник содержания (разделы 19, 23.2). */
const fs = require('fs'), path = require('path');
const dist = path.join(__dirname, '..', '..', 'dist', 'demo');
const files = ['student_material.html', 'teacher_console.html'];
if (files.every(f => fs.existsSync(path.join(dist, f)))) {
  const src = {}; files.forEach(f => src[f] = fs.readFileSync(path.join(dist, f), 'utf8'));
  files.forEach(f => {
    test(f + ': нет eval, new Function и внешних адресов', () => {
      const s = src[f];
      ok(!/[^A-Za-z_.]eval\s*\(/.test(s.replace(/\/\*[\s\S]*?\*\//g, '')), 'eval');
      ok(!/new\s+Function\s*\(/.test(s), 'new Function');
      const urls = (s.match(/https?:\/\/[^\s"'<>)]+/g) || []).filter(u => u !== 'http://www.w3.org/2000/svg');
      eq(urls, []);
      ok(!/<script[^>]+src=/i.test(s) && !/<link[^>]+href=/i.test(s) && !/@import/.test(s), 'внешние ресурсы');
    });
  });
  test('содержание (pack.js) в обоих файлах идентично и контрольная сумма совпадает', () => {
    const pick = s => { const a = s.indexOf('/* --- content/demo/pack.js'), b = s.indexOf('KAP.PRODUCER ='); return s.slice(a, b); };
    const a = pick(src[files[0]]), b = pick(src[files[1]]); ok(a.length > 1000, 'блок найден'); eq(a === b, true);
    const h = s => /"contentHash":"([0-9a-f]+)"/.exec(s)[1]; eq(h(src[files[0]]), h(src[files[1]]));
    const packSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'content', 'demo', 'pack.js'), 'utf8'); eq(globalThis.KAP.util.hashHex(packSrc), h(src[files[0]]));
  });
  test('ядро в обоих файлах идентично', () => {
    const core = s => s.slice(s.indexOf('/* --- core/util.js'), s.indexOf('/* содержание */'));
    eq(core(src[files[0]]) === core(src[files[1]]), true);
  });
}
