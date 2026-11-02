#!/usr/bin/env node
/* kap-engine: сборщик цифрового образовательного материала. Один файл, без зависимостей (Node 18+).
   Команды:
     node kap-engine.js check <pack.js>              проверка содержания и массовое тестирование генераторов
     node kap-engine.js build <pack.js> <папка>      сборка student_material.html и teacher_console.html
     node kap-engine.js smoke <папка>                испытание собранных файлов в Chromium (если доступен Playwright)
     node kap-engine.js all   <pack.js> <папка>      check + build + smoke
     node kap-engine.js version                      версия ядра                                              */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const EMBED = typeof __SRC !== 'undefined';
const ROOT = EMBED ? null : path.join(__dirname, '..');
const read = rel => EMBED ? __SRC[rel] : fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8');
function mod(name) {
  if (!EMBED) return require('./' + name);
  const m = { exports: {} }; new Function('module', 'exports', 'require', __MODS[name])(m, m.exports, n => (n === './order.js' ? mod('order.js') : require(n))); return m.exports;
}
const VERSION = EMBED ? __VERSION : fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const ORDER = mod('order.js');
const out = (...a) => console.log(...a);

function loadKap(packPath) {
  globalThis.KAP = {};
  ORDER.core.forEach(f => vm.runInThisContext(read(f), { filename: 'core/' + f }));
  const packSrc = fs.readFileSync(packPath, 'utf8');
  vm.runInThisContext(packSrc, { filename: packPath });
  return { K: globalThis.KAP, packSrc };
}

function check(packPath) {
  const { K } = loadKap(packPath);
  const r = mod('packcheck.js')(K, { runs: 600 });
  out('\nПроверка содержания: ' + packPath);
  out('Уроков: ' + (K.PACK && K.PACK.lessons ? K.PACK.lessons.length : 0) + ', используется генераторов: ' + new Set(r.genRows.map(x => x.id)).size);
  if (r.genRows.length) {
    out('\nМассовое тестирование генераторов (по ' + r.genRows[0].tried + ' генераций на профиль):');
    out('генератор | профиль | принято | отбраковано | различимых | итог');
    r.genRows.forEach(x => out([x.id, x.profile, x.accepted, x.rejected, x.unique, x.ok ? 'OK' : 'ОШИБКА'].join(' | ')));
  }
  if (r.warnings.length) { out('\nПредупреждения (' + r.warnings.length + '):'); r.warnings.forEach(w => out('  ! ' + w)); }
  if (r.errors.length) { out('\nОШИБКИ (' + r.errors.length + '): исправь и запусти проверку снова'); r.errors.forEach(e => out('  ✗ ' + e)); }
  else out('\nОшибок нет.');
  return r.errors.length === 0;
}

function build(packPath, outDir) {
  const A = mod('assemble.js')(read, ORDER);
  const packSrc = fs.readFileSync(packPath, 'utf8');
  const m = A.meta(packSrc, VERSION, path.basename(path.dirname(path.resolve(packPath))));
  fs.mkdirSync(outDir, { recursive: true });
  const label = 'pack.js';
  fs.writeFileSync(path.join(outDir, 'student_material.html'), A.bundle('student', packSrc, m, label));
  fs.writeFileSync(path.join(outDir, 'teacher_console.html'), A.bundle('teacher', packSrc, m, label));
  out('\nСборка: ядро ' + m.engineVersion + ', содержание ' + m.contentVersion + ' (' + m.materialId + '), контрольная сумма ' + m.contentHash);
  ['student_material.html', 'teacher_console.html'].forEach(f => out('  ' + path.join(outDir, f) + ' · ' + Math.round(fs.statSync(path.join(outDir, f)).size / 1024) + ' КБ'));
  return true;
}

async function smoke(outDir) {
  let chromium; try { chromium = require('playwright').chromium; } catch (e) { out('\nИспытание в браузере пропущено: Playwright недоступен. Это значит, что браузерная проверка НЕ выполнена.'); return null; }
  let browser; try { browser = await chromium.launch(); } catch (e) { out('\nИспытание в браузере пропущено: Chromium не запустился (' + e.message.split('\n')[0] + '). Браузерная проверка НЕ выполнена.'); return null; }
  const probs = []; const url = f => 'file://' + path.resolve(outDir, f);
  async function open(f, width) {
    const ctx = await browser.newContext({ viewport: { width: width || 390, height: 800 } }), page = await ctx.newPage(), errors = [], ext = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', r => { if (!/^(file:|data:|blob:|about:)/.test(r.url())) ext.push(r.url()); });
    await page.goto(url(f)); return { ctx, page, errors, ext };
  }
  const S = await open('student_material.html');
  const reports = await S.page.evaluate(() => {
    const d = KAP.app.debug, res = [], ids = d.lessons().map(l => l.lessonId), bad = [];
    ids.forEach((id, i) => {
      d.reset();
      [{ accuracy: 0.8 }, { accuracy: 1, skipFinal: true }, { accuracy: 0.5, finalActiveSec: 99999 }].forEach((o, k) => { try { const r = d.autoplay(id, Object.assign({ name: 'Проверка ' + (i + 1) + '.' + (k + 1), 'class': d.lessons()[i]['class'] + 'А', seed: 10 * i + k + 1 }, o)); res.push(r); } catch (e) { bad.push(id + ': ' + e.message); } });
    });
    return { reports: res, bad };
  });
  reports.bad.forEach(b => probs.push('автопрохождение: ' + b));
  const invalid = await S.page.evaluate(r => r.map(x => KAP.schema.validateReport(x)).filter(p => p.length).map(p => p[0]), reports.reports);
  invalid.forEach(p => probs.push('отчёт не прошёл проверку схемы: ' + p));
  await S.page.evaluate(() => KAP.app.debug.reset());
  await S.page.goto(url('student_material.html') + '#selftest'); await S.page.waitForSelector('[data-act=runSelftest]'); await S.page.click('[data-act=runSelftest]');
  await S.page.waitForSelector('#stOut[data-done="1"]', { timeout: 120000 });
  const stBad = await S.page.$$eval('#stOut td.bad', e => e.length); if (stBad) probs.push('самопроверка в браузере: строк с ошибками ' + stBad);
  S.errors.forEach(e => probs.push('ошибка JavaScript в ученическом файле: ' + e)); S.ext.forEach(u => probs.push('внешний запрос: ' + u)); await S.ctx.close();
  for (const w of [360, 430]) {
    const X = await open('student_material.html', w); await X.page.waitForSelector('#pname'); await X.page.fill('#pname', 'Тест Тестов'); await X.page.fill('#pclass', '6А'); await X.page.click('[data-act=createProfile]');
    const first = await X.page.$eval('.lesson-card', e => e.getAttribute('data-v')); await X.page.click('[data-act=openLesson][data-v="' + first + '"]'); await X.page.click('[data-act=start]');
    if (!(await X.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))) probs.push('горизонтальная прокрутка на ширине ' + w + ' px (ученик)'); await X.ctx.close();
  }
  const T = await open('teacher_console.html');
  await T.page.waitForSelector('#files');
  const imp = await T.page.evaluate(r => { KAP.teacher.importItems(r.map((x, i) => ({ name: 'r' + i + '.json', obj: x }))); const t = KAP.teacher; const bad = []; try { t.reports().forEach(x => t.eff(x)); } catch (e) { bad.push(e.message); } return { n: t.reports().length, bad }; }, reports.reports);
  if (imp.n !== reports.reports.length) probs.push('кабинет принял ' + imp.n + ' из ' + reports.reports.length + ' отчётов'); imp.bad.forEach(b => probs.push('кабинет: ' + b));
  for (const tab of ['classes', 'lessons', 'review', 'protocol']) { await T.page.click('[data-act=tab][data-v=' + tab + ']'); }
  const paper = await T.page.evaluate(() => { const bad = []; KAP.PACK.lessons.forEach(l => { try { const k = KAP.paper.build({ workType: 'sor', lessonIds: [l.lessonId], variantsCount: 2, taskCount: 6, seed: 7, classNum: +l['class'] || 6 }); const v = KAP.paper.validateKit(k); if (v.errors.length) bad.push(l.lessonId + ': ' + v.errors[0]); } catch (e) { bad.push(l.lessonId + ': ' + e.message); } }); return bad; });
  paper.forEach(b => probs.push('бумажный комплект: ' + b));
  T.errors.forEach(e => probs.push('ошибка JavaScript в кабинете: ' + e)); T.ext.forEach(u => probs.push('внешний запрос (кабинет): ' + u)); await T.ctx.close(); await browser.close();
  out('\nИспытание в браузере (Chromium): автопрохождение ' + reports.reports.length + ' работ, проверка схемы отчётов, самопроверка генераторов, кабинет (импорт, вкладки, бумажные комплекты), ширины 360 и 430 px.');
  if (probs.length) { out('ПРОБЛЕМЫ (' + probs.length + '):'); probs.forEach(p => out('  ✗ ' + p)); } else out('Проблем не найдено.');
  return probs.length === 0;
}

(async () => {
  const [cmd, a, b] = process.argv.slice(2); let ok = true;
  if (cmd === 'version') out('kap-engine ' + VERSION);
  else if (cmd === 'check' && a) ok = check(a);
  else if (cmd === 'build' && a && b) ok = build(a, b);
  else if (cmd === 'smoke' && a) { const r = await smoke(a); ok = r !== false; }
  else if (cmd === 'all' && a && b) { ok = check(a); if (ok) { build(a, b); const r = await smoke(b); ok = r !== false; } }
  else { out(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 9).join('\n')); ok = false; }
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
