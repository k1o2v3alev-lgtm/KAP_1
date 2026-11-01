'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const L = require('./lib.js');
const { t, eq, ok } = L;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kap-teacher-'));

(async () => {
  const browser = await L.chromium.launch();
  console.log('Кабинет учителя · Chromium');

  // ---- реальные отчёты из ученического файла (автопрохождение) ----
  const S = await L.open(browser, 'student_material.html');
  const reps = await S.page.evaluate(() => {
    const d = KAP.app.debug, out = {};
    d.reset(); out.r1 = d.autoplay('demo-math-6-frac-L01', { name: 'Анна Тестова', 'class': '6А', accuracy: 0.6, seed: 1 });
    out.r2 = d.autoplay('demo-math-6-frac-L01', { accuracy: 1, seed: 2 });
    d.reset(); out.r3 = d.autoplay('demo-math-6-frac-L01', { name: 'Борис Тестов', 'class': '6А', accuracy: 0.3, seed: 3 });
    d.reset(); out.r4 = d.autoplay('demo-inf-8-bin-SOR', { name: 'Вера Тестова', 'class': '8Б', accuracy: 1, seed: 4, finalActiveSec: 9999 });
    out.r5 = d.autoplay('demo-inf-8-bin-L01', { accuracy: 0.8, seed: 5, skipFinal: true });
    return out;
  });
  await S.ctx.close();
  const w = (name, obj) => { const p = path.join(TMP, name); fs.writeFileSync(p, JSON.stringify(obj)); return p; };
  const files = [w('r1.json', reps.r1), w('r2.json', reps.r2), w('r3.json', reps.r3), w('r4.json', reps.r4), w('r5.json', reps.r5)];
  const dup = w('dup_r1.json', reps.r1);
  const pkg = w('package.json', { schemaVersion: '1.0', reportType: 'package_report', packageId: 'x', reports: [reps.r1, reps.r2, reps.r3, reps.r4, reps.r5] });
  const evil = JSON.parse(JSON.stringify(reps.r3)); evil.reportId = 'evil-1'; evil.attempt.startedAt = '2026-01-01T00:00:00+06:00'; evil.dedupeKey = 'x|y|z|9|' + Math.random();
  evil.student.name = 'Хакер Тестов'; evil.tasks[0].presentedCondition = '<img src=x onerror="window.__pwn=1"><script>window.__pwn=1</script>Условие';
  const evilP = w('evil.json', evil);
  const old = JSON.parse(JSON.stringify(reps.r3)); old.reportId = 'old-1'; old.attempt.startedAt = '2026-01-02T00:00:00+06:00'; old.dedupeKey = 'o|l|d|1|' + Math.random(); old.student.name = 'Старый Тестов'; old.producer.contentVersion = '0.9.0';
  const oldP = w('oldversion.json', old);
  const f6 = w('legacy_f6.json', { 'схема': 'сор-результат/1', 'длительность_сек': 1201, 'завершено': 'таймер', 'лимит_мин': 20, 'начало': '2026-10-15T08:57:18Z', 'окончание': '2026-10-15T09:17:19Z', 'предмет': 'Информатика', 'раздел': 'Р', 'сор_id': 'СОР-1', 'уходы_со_страницы': 5, 'учащийся': { 'ФИО': 'Леон Старый', 'класс': '8' }, 'итог': { 'балл': 9, 'макс': 16, 'процент': 56.3, 'ожидают_проверки_учителем': 1 }, 'по_критериям': {}, 'задания': [{ 'номер': 1, 'форма': 'текст', 'время_сек': 5, 'дескрипторы': [{ id: 'Д1', 'макс': 2, 'итог': null, 'требует_проверки': true }] }] });
  const notJson = path.join(TMP, 'broken.json'); fs.writeFileSync(notJson, '{не json');

  const T = await L.open(browser, 'teacher_console.html');
  const { page } = T;

  await t('загрузка без ошибок и без внешних запросов; две вкладки режимов', async () => {
    await page.waitForSelector('#files'); eq(T.errors, []); eq(T.external, []);
    ok((await page.innerText('body')).includes('Бумажный комплект'));
    ok(await L.noHScroll(page));
  });

  await t('импорт: один, несколько, пакет; дубликаты, прежний формат и повреждённый файл', async () => {
    await page.setInputFiles('#files', files);
    await page.waitForFunction(() => KAP.teacher.reports().length === 5);
    await page.setInputFiles('#files', [dup]);
    await page.waitForFunction(() => KAP.teacher.state.log.length === 6);
    eq(await page.evaluate(() => KAP.teacher.reports().length), 5, 'точный повтор не удвоил отчёты');
    await page.setInputFiles('#files', [pkg]); await page.waitForFunction(() => KAP.teacher.state.log.length === 7);
    eq(await page.evaluate(() => KAP.teacher.reports().length), 5, 'пакет из тех же отчётов не удвоил попытки');
    await page.setInputFiles('#files', [evilP, oldP, f6, notJson]);
    await page.waitForFunction(() => KAP.teacher.state.log.length === 11);
    eq(await page.evaluate(() => KAP.teacher.reports().length), 8);
    const log = await page.evaluate(() => KAP.teacher.state.log.map(l => [l.family, l.n, l.added, l.dup]));
    eq(log[5], ['v1', 1, 0, 1]); eq(log[6][3], 5); eq(log[10][0], 'F6');
    ok((await page.innerText('body')).includes('не JSON'), 'повреждённый файл назван');
  });

  await t('предупреждение о другой версии содержания; класс и идентификатор', async () => {
    const txt = await page.innerText('body'); ok(txt.includes('Версия содержания отчёта (0.9.0)'), 'версия'); ok(txt.includes('Предупреждения'));
  });

  await t('«Классы и ученики»: итог по уроку — среднее лучшей и последней; превышение времени и потолок', async () => {
    await page.click('[data-act=tab][data-v=classes]');
    const txt = await page.innerText('body'); ok(txt.includes('Анна Тестова') && txt.includes('Борис Тестов'));
    await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
    const html = await page.innerHTML('body'); ok(html.includes('среднее лучшей и последней'), 'строка итога');
    const sm = await page.evaluate(() => KAP.scoring.summarize(KAP.teacher.reports().filter(r => r.student.name === 'Анна Тестова').map(KAP.teacher.eff)));
    eq(sm.length, 1); eq(sm[0].attemptsCounted, 2);
    await page.selectOption('#clsel', '8Б');
    await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
    ok((await page.innerText('body')).includes('потолок 84%'), 'потолок виден учителю');
  });

  await t('«Уроки и цели»: дескрипторы, поднавыки, типичные ошибки, уровни мышления', async () => {
    await page.click('[data-act=tab][data-v=lessons]'); await page.selectOption('#clsel', '6А'); await page.selectOption('#lsel', 'demo-math-6-frac-L01');
    const txt = await page.innerText('body'); ok(txt.includes('Цели и дескрипторы') && txt.includes('Освоение поднавыков') && txt.includes('Типичные ошибки класса') && txt.includes('Уровни мышления') && txt.includes('Трудность заданий'));
  });

  await t('проверка открытых ответов: оценка меняет показатели, исходный отчёт не меняется', async () => {
    await page.click('[data-act=tab][data-v=review]');
    const inp = page.locator('[data-rev]').first(); const rid = (await inp.getAttribute('data-rev')).split('|')[0];
    const before = await page.evaluate((id) => KAP.teacher.reports().find(r => r.reportId === id).metrics.mark10, rid);
    await inp.fill('1'); await inp.dispatchEvent('change');
    const after = await page.evaluate((id) => { const r = KAP.teacher.reports().find(x => x.reportId === id), e = KAP.teacher.eff(r); return { raw: r.metrics.mark10, eff: e.metrics.mark10, src: e.metrics.metricSources.mark10, rev: e.tasks.filter(t => t.teacherReview).length, left: e.tasks.filter(t => t.status === 'pending_review').length }; }, rid);
    eq(after.raw, before); eq(after.src, 'teacher_manual'); eq(after.rev, 1); ok(after.eff >= before, 'отметка не снизилась после полного балла');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=saveReviews]')]);
    const j = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); eq(j.reportType, 'teacher_review'); eq(j.reviews.length, 1);
    // повторный импорт наложения восстанавливает оценки
    await page.evaluate(() => { KAP.teacher.state.reviews = {}; KAP.teacher.state.cache = {}; });
    await page.setInputFiles('#files', []).catch(() => {});
    await page.click('[data-act=tab][data-v=upload]'); const f = path.join(TMP, 'review.json'); fs.writeFileSync(f, JSON.stringify(j)); await page.setInputFiles('#files', [f]);
    await page.waitForFunction(() => Object.keys(KAP.teacher.state.reviews).length === 1);
  });

  await t('протокол: исходные варианты, воспроизведение по seed; вредный HTML обезврежен', async () => {
    await page.click('[data-act=tab][data-v=protocol]');
    const evilId = 'evil-1'; await page.selectOption('#rsel', evilId);
    eq(await page.evaluate(() => window.__pwn), undefined, 'скрипт из отчёта не должен выполняться');
    eq(await page.$$eval('table img, table script', e => e.length), 0);
    await page.selectOption('#rsel', await page.evaluate(() => KAP.teacher.reports()[0].reportId));
    const txt = await page.innerText('body'); ok(txt.includes('совпадает') && txt.includes('seed'), 'воспроизведение');
    ok(txt.includes('Основание') && txt.includes('Время: рабочее'), 'время и основание');
  });

  // ---------- бумажный комплект ----------
  await t('конструктор: комплект на 2 варианта проходит проверку; печать даёт нужное число страниц', async () => {
    await page.click('[data-act=mode][data-v=paper]');
    await page.selectOption('#pw', 'sor'); await page.fill('#pcl', '8'); await page.fill('#pvar', '2'); await page.fill('#ptn', '8'); await page.fill('#pseed', '4242');
    await page.click('[data-act=buildKit]'); await page.waitForSelector('.print-area .print-page');
    ok((await page.innerText('body')).includes('Проверка комплекта пройдена'), 'проверка пройдена');
    eq(await page.$$eval('.print-area svg.omr', e => e.length), 4, 'по два бланка на вариант');
    const k1 = await page.evaluate(() => KAP.teacher.paper.kit.keyHash);
    await page.click('[data-act=buildKit]'); eq(await page.evaluate(() => KAP.teacher.paper.kit.keyHash), k1, 'тот же код воспроизведения даёт тот же комплект');
    await page.emulateMedia({ media: 'print' });
    ok(!(await page.isVisible('[data-act=buildKit]')), 'при печати конструктор скрыт'); ok(await page.isVisible('.print-area'));
    const pdf = await page.pdf({ format: 'A4' }); const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(pages >= 5, 'страниц при печати: ' + pages);
    await page.emulateMedia({ media: 'screen' });
    const el = await page.$('.print-area svg.omr'); await el.screenshot({ path: path.join(TMP, 'omr.png') });
  });

  await t('сохранение комплекта в файл и повторная загрузка', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=saveKit]')]);
    const j = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); eq(j.reportType, 'paper_kit'); eq(j.variants.length, 2); ok(j.omrTemplate.markers.sizeMm === 6);
    eq(await page.evaluate(() => KAP.legacy.detect(JSON.parse(JSON.stringify(KAP.teacher.paper.kit)))), 'paper_kit');
  });

  await t('ручной ввод результатов бумаги попадает в анализ', async () => {
    await page.fill('#pstud', 'Иванов Иван\nПетрова Анна'); await page.click('[data-act=makeGrid]'); await page.waitForSelector('table.entry');
    const kit = await page.evaluate(() => { const k = KAP.teacher.paper.kit; return k.variants[0].tasks.map(t => ({ pos: t.position, type: t.taskType, cp: t.correctOptionPosition, max: t.maxScore })); });
    for (const tk of kit) {
      if (tk.type === 'single_choice') { await page.selectOption(`[data-e="0|${tk.pos}|c"]`, String(tk.cp)); await page.selectOption(`[data-e="1|${tk.pos}|c"]`, String((tk.cp + 1) % 4)); }
      else { await page.fill(`[data-e="0|${tk.pos}|s"]`, String(tk.max)); await page.fill(`[data-e="1|${tk.pos}|s"]`, '0'); }
    }
    await page.fill('#pstud', 'Иванов Иван\nПетрова Анна');
    await page.click('[data-act=entryToAnalysis]'); await page.waitForSelector('text=Результаты бумажной работы добавлены');
    const rows = await page.evaluate(() => KAP.teacher.reports().filter(r => r.source === 'paper_manual').map(r => [r.student.name, r.metrics.mark10, r.scoring.markBasis]));
    eq(rows, [['Иванов Иван', 10, 'control_work'], ['Петрова Анна', 0, 'control_work']]);
    await page.selectOption('#clsel', '8'); await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); ok((await page.innerText('body')).includes('paper_manual'), 'источник paper_manual виден в таблице');
  });

  await t('отчёт CSV выгружается', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=csv]')]);
    const txt = fs.readFileSync(await dl.path(), 'utf8'); ok(txt.includes('Класс;Ученик;Урок') && txt.includes('Иванов Иван'));
  });

  await t('ошибок JavaScript и внешних запросов за весь сеанс нет', async () => { eq(T.errors, []); eq(T.external, []); eq(await page.evaluate(() => window.__pwn), undefined); });
  await T.ctx.close();

  for (const wd of [360, 430]) {
    await t('ширина ' + wd + ' px: без горизонтальной прокрутки (загрузка, бумажный комплект)', async () => {
      const X = await L.open(browser, 'teacher_console.html', { width: wd }); const p = X.page; await p.waitForSelector('#files'); ok(await L.noHScroll(p), 'загрузка');
      await p.setInputFiles('#files', files); await p.waitForFunction(() => KAP.teacher.reports().length === 5); ok(await L.noHScroll(p), 'после загрузки');
      await p.click('[data-act=mode][data-v=paper]'); ok(await L.noHScroll(p), 'конструктор'); await p.click('[data-act=buildKit]'); await p.waitForSelector('.print-area'); ok(await L.noHScroll(p), 'комплект');
      eq(X.errors, []); await X.ctx.close();
    });
  }
  console.log('  снимок бланка: ' + path.join(TMP, 'omr.png'));
  await browser.close();
  const r = L.summary(); console.log('\nУчитель (браузер): пройдено ' + r.passed + ', не пройдено ' + r.failed); r.failures.forEach(f => console.log('  ✗ ' + f)); process.exit(r.failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
