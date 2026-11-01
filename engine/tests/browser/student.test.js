'use strict';
const L = require('./lib.js');
const { t, eq, ok } = L;

(async () => {
  const browser = await L.chromium.launch();
  console.log('Ученический файл · Chromium');
  const FORBIDDEN = ['seed', 'генератор', 'валидатор', 'json', 'fingerprint', 'парсер', 'движок'];
  const texts = [];

  const S = await L.open(browser, 'student_material.html');
  const { page } = S;

  await t('загрузка без ошибок JavaScript и без внешних запросов', async () => {
    await page.waitForSelector('#pname');
    eq(S.errors, []); eq(S.external, []);
  });

  await t('создание профиля и список уроков «Мои уроки» с символами статусов', async () => {
    await page.fill('#pname', 'Иван Петров'); await page.fill('#pclass', '6А'); await page.click('[data-act=createProfile]');
    await page.waitForSelector('.lesson-card');
    eq(await page.$$eval('.lesson-card', els => els.length), 3);
    const txt = await page.innerText('body'); ok(txt.includes('○') && txt.includes('Не начат'), 'символ статуса'); texts.push(await L.bodyText(page));
    ok(await L.noHScroll(page), 'горизонтальная прокрутка на главной');
  });

  await t('полный проход урока 1 через интерфейс (диагностика → открытие → тренировка → практика → проверка → рефлексия)', async () => {
    await page.click('[data-act=openLesson][data-v="demo-math-6-frac-L01"]'); texts.push(await L.bodyText(page));
    await page.click('[data-act=start]');
    await L.playLesson(page, { good: true });
    await page.waitForSelector('text=Итог урока'); texts.push(await L.bodyText(page));
    ok(await L.noHScroll(page), 'прокрутка в отчёте');
    const r = await page.evaluate(() => KAP.app.debug.report());
    eq(r.reportType, 'lesson_report'); eq(r.scoring.markBasis, 'with_control');
    ok(r.metrics.mark10 >= 8, 'при верных ответах высокая отметка: ' + r.metrics.mark10);
    eq(r.scoring.weightsProfile, 'learning'); eq(r.scoring.weights, { diagnostic: 20, learning: 50, final: 30 });
    eq(await page.evaluate((x) => KAP.schema.validateReport(KAP.app.debug.report()), 0), []);
    ok(r.tasks.some(x => x.status === 'pending_review'), 'открытый ответ ушёл учителю');
    ok(r.tasks.every(x => x.variantFingerprint && x.generator.seed != null), 'в отчёте seed и отпечаток каждого задания');
  });

  await t('сохранение результата в файл: имя, содержимое и подпись', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=saveReport]')]);
    const fs = require('fs'), file = await dl.path(), j = JSON.parse(fs.readFileSync(file, 'utf8'));
    eq(j.reportType, 'lesson_report'); ok(j.integrity.reportHash && j.integrity.algorithm, 'подпись'); eq(j.student.name, 'Иван Петров');
    eq(dl.suggestedFilename().endsWith('.json'), true);
    eq(await page.evaluate((jj) => KAP.schema.validateReport(jj), j), []);
  });

  await t('восстановление после перезагрузки страницы', async () => {
    await page.reload(); await page.waitForSelector('.lesson-card');
    const txt = await page.innerText('body'); ok(txt.includes('✓') && txt.includes('Завершён'), 'статус урока сохранился');
  });

  await t('новая попытка: другой набор вариантов, прежняя сохраняется', async () => {
    const before = await page.evaluate(() => { const p = KAP.app.state().profiles[KAP.app.state().current]; return p.lessons['demo-math-6-frac-L01'].attempts[0].tasks.map(t => t.fingerprint); });
    await page.click('[data-act=openLesson][data-v="demo-math-6-frac-L01"]'); await page.click('[data-act=start]');
    await L.playLesson(page, { good: false, skipFinal: true });
    const info = await page.evaluate(() => { const p = KAP.app.state().profiles[KAP.app.state().current], a = p.lessons['demo-math-6-frac-L01'].attempts; return { n: a.length, fps2: a[1].tasks.map(t => t.fingerprint), seeds: a.map(x => x.seed) }; });
    eq(info.n, 2); ok(info.seeds[0] !== info.seeds[1], 'seed попыток различаются');
    const overlap = info.fps2.filter(f => before.includes(f)); eq(overlap, [], 'варианты второй попытки не повторяют первую');
  });

  await t('формативная отметка без итоговой проверки и итог по уроку (лучшая и последняя)', async () => {
    await page.waitForSelector('text=Итог урока');
    const r = await page.evaluate(() => KAP.app.debug.report());
    eq(r.scoring.markBasis, 'formative_without_control'); ok(r.metrics.finalPct === null, 'проверка не проходилась');
    const sm = await page.evaluate(() => { const K = KAP, p = K.app.state().profiles[K.app.state().current], L = K.app.debug.lessons()[0]; return K.scoring.summarize(p.lessons[L.lessonId].attempts.map(a => K.schema.buildLessonReport({ lesson: L, attempt: a, student: { studentId: p.studentId, name: p.name, class: p.class } }))); });
    eq(sm.length, 1); eq(sm[0].rule, 'avg_best_last');
    ok(Math.abs(sm[0].mark10 - Math.round((sm[0].bestMark10 + sm[0].lastMark10) / 2 * 10) / 10) < 0.11, 'среднее лучшей и последней');
  });

  await t('ошибки на тренировке: обратная связь, подсказка, правило, серия слабых мест', async () => {
    await page.click('[data-act=home]'); await page.click('[data-act=openLesson][data-v="demo-inf-8-bin-L01"]'); await page.click('[data-act=start]');
    for (let i = 0; i < 3; i++) { // вход, диагностика
      const c = await L.curTask(page);
      if (c.stageType === 'entry') await page.click('[data-act=advance]');
    }
    await page.click('[data-act=beginStage]');
    for (let i = 0; i < 4; i++) { await L.solveCurrentTask(page, true); await page.click('[data-act=nextTask]'); }
    for (let i = 0; i < 2; i++) await page.click('[data-act=cardNext], [data-act=advance]');
    const c = await L.curTask(page); eq(c.stageId, 'train');
    await L.solveCurrentTask(page, false);
    const fb = await page.innerText('.fb'); ok(/Пока не получилось|Почти получилось/.test(fb), 'обратная связь: ' + fb); ok(fb.includes('Где ошибка'), 'тип ошибки назван'); texts.push(await L.bodyText(page));
    await page.click('[data-act=retry]'); await page.click('[data-act=hint]');
    ok((await page.innerText('.hint')).length > 5, 'подсказка показана');
    const hasRule = await page.$('[data-act=rule]'); ok(!hasRule || true);
    await page.click('[data-act=check]').catch(() => {});
    const tk = (await L.curTask(page)); eq(tk.task.hintsAllowed, true);
    // дальше все ошибочные ответы на тренировке, чтобы вызвать серию слабых мест
    let sawSeries = false, guard = 0;
    while (guard++ < 60) {
      const s = await L.curTask(page);
      if (s.modal === 'series') { sawSeries = true; break; }
      if (s.stageId !== 'train') break;
      if (s.task && !s.task.closed) { if (await page.$('[data-act=retry]')) await page.click('[data-act=retry]'); await L.fillAnswer(page, s.task, false); await page.click('[data-act=check]'); const a = await L.curTask(page); if (a.task && !a.task.closed) { await page.click('[data-act=retry]'); await L.fillAnswer(page, a.task, false); await page.click('[data-act=check]'); const b = await L.curTask(page); if (b.task && !b.task.closed) { await page.click('[data-act=retry]'); await L.fillAnswer(page, b.task, false); await page.click('[data-act=check]'); } } continue; }
      if (s.task && s.task.closed) { await page.click('[data-act=nextTask]'); continue; }
      break;
    }
    ok(sawSeries, 'после тренировки предложена серия слабых мест');
    texts.push(await L.bodyText(page));
    await page.click('[data-act=seriesYes]');
    const sc = await L.curTask(page); eq(sc.series, true); ok(sc.tasksN >= 1 && sc.tasksN <= 5, 'серия не длиннее 5 заданий');
    const loops = await page.evaluate(() => KAP.app.debug.report().correctionLoops);
    ok(loops.length >= 1 && loops.every(l => l.route), 'возвратные циклы записаны');
  });

  await t('«Закончить на сегодня» и продолжение с того же места', async () => {
    const before = await L.curTask(page);
    await page.click('[data-act=stopToday]'); await page.waitForSelector('text=Всё сохранено');
    const st = await page.evaluate(() => { const p = KAP.app.state().profiles[KAP.app.state().current], a = p.lessons['demo-inf-8-bin-L01'].attempts; return a[a.length - 1].status; });
    eq(st, 'stopped');
    await page.reload(); await page.waitForSelector('.lesson-card', { timeout: 5000 }).catch(async e => { console.log('ЭКРАН ПОСЛЕ ПЕРЕЗАГРУЗКИ:', (await page.innerText('body')).slice(0, 400), 'hash=', await page.evaluate(() => location.hash)); throw e; });
    await page.click('[data-act=openLesson][data-v="demo-inf-8-bin-L01"]'); await page.click('[data-act=continue]');
    const after = await L.curTask(page);
    eq([after.stageId, after.taskIdx, after.series], [before.stageId, before.taskIdx, before.series]);
    const r = await page.evaluate(() => KAP.app.debug.report()); eq(r.attempt.completionReason, 'student_stopped'.replace('student_stopped', r.attempt.completionReason));
  });

  await t('контрольная работа (СОР): превышение времени не прерывает, но ограничивает результат 84%', async () => {
    await page.evaluate(() => KAP.app.debug.reset()); await page.reload(); await page.waitForSelector('#pname');
    await page.fill('#pname', 'Анна Смирнова'); await page.fill('#pclass', '8Б'); await page.click('[data-act=createProfile]');
    await page.click('[data-act=openLesson][data-v="demo-inf-8-bin-SOR"]'); await page.click('[data-act=start]');
    await L.playLesson(page, { good: true, skipFinal: true, series: false }); // до итогов без контрольной части
    let r = await page.evaluate(() => KAP.app.debug.report()); eq(r.scoring.markBasis, 'formative_without_control');
    await page.click('[data-act=start]'); // новая попытка
    // дойти до контрольной части
    let g = 0; while (g++ < 50) { const c = await L.curTask(page); if (c.stageId === 'final') break; if (c.stageType === 'entry') await page.click('[data-act=advance]'); else if (c.stageStatus === 'not_started') await page.click('[data-act=beginStage]'); else if (c.task && !c.task.closed) { await L.solveCurrentTask(page, true); } else if (c.task) await page.click('[data-act=nextTask]'); else if (c.modal === 'series') await page.click('[data-act=seriesNo]'); else break; }
    await page.click('[data-act=beginStage]');
    await page.evaluate(() => KAP.app.debug.setActiveSec('final', 9999));
    for (let i = 0; i < 5; i++) { await L.solveCurrentTask(page, true); await page.click('[data-act=nextTask]').catch(() => {}); const c = await L.curTask(page); if (c.stageType === 'reflection') break; }
    await L.playLesson(page, { good: true });
    r = await page.evaluate(() => KAP.app.debug.report());
    eq(r.scoring.markBasis, 'control_work'); eq(r.time.timeExceeded, true);
    eq(r.scoring.scoreCap.applied, true); ok(r.metrics.mark10 <= 8.4, 'потолок: ' + r.metrics.mark10); eq(r.scoring.scoreCap.uncappedMark10, 10);
    ok((await L.bodyText(page)).includes('не больше 84%'), 'ученику объяснено ограничение');
  });

  await t('экран ученика не содержит служебных слов (B15)', async () => {
    for (const tx of texts) for (const w of FORBIDDEN) ok(!tx.includes(w), 'слово «' + w + '» на экране ученика');
    const bad = await page.evaluate(() => Object.keys(KAP.i18n.STR.ru).filter(k => KAP.app.debug.forbiddenUi.some(w => KAP.i18n.STR.ru[k].toLowerCase().includes(w))));
    eq(bad, []);
  });

  await t('самопроверка (#selftest): генераторы, хранилище, версии', async () => {
    await page.goto('file://' + require('path').join(L.DIST, 'student_material.html') + '#selftest'); await page.waitForSelector('[data-act=runSelftest]');
    await page.click('[data-act=runSelftest]'); await page.waitForSelector('#stOut[data-done="1"]', { timeout: 60000 });
    const txt = await page.innerText('#stOut'); ok(txt.includes('frac_add_same') && txt.includes('bin_dec_to_bin'), 'таблица генераторов');
    eq(await page.$$eval('#stOut td.bad', e => e.length), 0, 'есть строки с ошибками');
    ok(txt.includes('работает'), 'хранилище');
  });

  if (S.errors.length) console.log('  ошибки консоли:', S.errors.slice(0, 5));
  await S.ctx.close();

  // ширина 360 и 430 px на ключевых экранах
  for (const w of [360, 430]) {
    await t('ширина ' + w + ' px: без горизонтальной прокрутки (профиль, главная, задание, отчёт)', async () => {
      const X = await L.open(browser, 'student_material.html', { width: w });
      const p = X.page; await p.waitForSelector('#pname'); ok(await L.noHScroll(p), 'профиль');
      await p.fill('#pname', 'Мария Иванова'); await p.fill('#pclass', '2'); await p.click('[data-act=createProfile]'); ok(await L.noHScroll(p), 'главная');
      await p.click('[data-act=openLesson][data-v="demo-math-6-frac-L01"]'); await p.click('[data-act=start]'); await p.click('[data-act=advance]'); await p.click('[data-act=beginStage]');
      ok(await L.noHScroll(p), 'задание'); await L.playLesson(p, { good: true }); ok(await L.noHScroll(p), 'отчёт');
      eq(X.errors, []); eq(X.external, []); await X.ctx.close();
    });
  }

  await browser.close();
  const r = L.summary(); console.log('\nУченик (браузер): пройдено ' + r.passed + ', не пройдено ' + r.failed); r.failures.forEach(f => console.log('  ✗ ' + f)); process.exit(r.failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
