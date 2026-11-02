/* Сборка двух HTML-файлов. Общая для репозитория (build.js) и для самодостаточного архива (kap-engine.js).
   read(относительный_путь_в_src) → текст. */
'use strict';
module.exports = function makeAssembler(read, ORDER) {
  function cyrb53(str, seed) {
    seed = seed || 0; let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  const hashHex = s => { let x = cyrb53(s).toString(16); while (x.length < 14) x = '0' + x; return x; };
  const safeJs = s => s.replace(/<\/script/gi, '<\\/script');

  function meta(packSrc, engineVersion, packName) {
    return {
      materialId: (packSrc.match(/materialId:\s*'([^']+)'/) || [])[1] || packName || 'pack',
      engineVersion: engineVersion, contentVersion: (packSrc.match(/contentVersion:\s*'([^']+)'/) || [])[1] || '0.0.0', contentHash: hashHex(packSrc)
    };
  }
  function bundle(kind, packSrc, m, packLabel) {
    const parts = kind === 'student' ? ORDER.student : ORDER.teacher;
    const title = kind === 'student' ? 'Мои уроки' : 'Кабинет учителя';
    const css = (kind === 'student' ? ['styles/shared.css', 'styles/student.css'] : ['styles/shared.css', 'styles/teacher.css']).map(f => read(f)).join('\n');
    const body = kind === 'student' ? '<div id="app" class="app" aria-live="polite"></div>' : '<div id="app" class="app"></div>';
    const js = [
      '/* ядро */', ...ORDER.core.map(f => `/* --- ${f} --- */\n` + read(f)),
      '/* содержание */', `/* --- ${packLabel} · contentHash ${m.contentHash} --- */\n` + packSrc, `KAP.PRODUCER = ${JSON.stringify(m)};`,
      '/* интерфейс */', ...parts.map(f => `/* --- ${f} --- */\n` + read(f))
    ].join('\n');
    return `<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${title}</title>\n<style>\n${css}\n</style>\n</head>\n<body>\n${body}\n<script>\n${safeJs(js)}\n</script>\n</body>\n</html>\n`;
  }
  return { hashHex, meta, bundle };
};
