'use strict';
/* Общие помощники браузерных испытаний (Playwright, Chromium). */
const path = require('path');
const { chromium } = require('playwright');
const DIST = path.join(__dirname, '..', '..', 'dist', 'demo');

let passed = 0, failed = 0; const failures = [];
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; failures.push(name + ': ' + (e && e.message)); console.log('  ✗ ' + name + ' — ' + (e && e.message)); }
}
function eq(a, b, m) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error((m || 'eq') + ' · получено ' + x + ', ожидалось ' + y); }
function ok(c, m) { if (!c) throw new Error(m || 'ok'); }

async function open(browser, file, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width: opts.width || 390, height: opts.height || 800 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [], external = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('request', r => { const u = r.url(); if (!/^(file:|data:|blob:|about:)/.test(u)) external.push(u); });
  await page.goto('file://' + path.join(DIST, file));
  return { ctx, page, errors, external };
}

async function curTask(page) {
  return page.evaluate(() => {
    const K = KAP, ui = K.app.ui, s = K.app.state(), p = s.profiles[s.current]; if (!p || !ui.lessonId) return null;
    const ls = p.lessons[ui.lessonId], at = ls.attempts[ls.attempts.length - 1], L = K.app.debug.lessons().find(l => l.lessonId === ui.lessonId);
    if (!at || at.status !== 'in_progress') return { view: ui.view };
    const stage = L.stages[at.stageIdx], ss = at.stageState[stage.id] || {};
    const tasks = at.series ? at.tasks.filter(t => t.seriesId === at.series.id) : at.tasks.filter(t => t.stageId === stage.id && !t.loop);
    const tk = tasks[Math.min(at.taskIdx, tasks.length - 1)];
    return { view: ui.view, stageType: stage.type, stageId: stage.id, group: stage.group, stageStatus: ss.status, modal: ui.modal && ui.modal.type, seriesInfo: !!ui.seriesInfo, series: !!at.series, taskIdx: at.taskIdx, tasksN: tasks.length,
      task: tk && stage.type === 'tasks' ? { id: tk.taskId, type: tk.taskType, correct: tk.correctAnswer, closed: tk.closed, order: tk.rule.order, items: tk.items && tk.items.map(x => x.id), left: tk.left && tk.left.map(x => x.id), pairs: tk.rule.pairs, distractors: Object.keys(tk.distractorMap || {}), hints: tk.hints.length, attempts: tk.attempts.length, maxAttempts: tk.maxAttempts, correctIds: tk.rule.correctIds, hintsAllowed: tk.hintsAllowed } : null };
  });
}

async function fillAnswer(page, tk, good) {
  switch (tk.type) {
    case 'single_choice': await page.click(`[data-act=pick][data-v="${good ? tk.correct : tk.distractors[0]}"]`); break;
    case 'multi_choice': {
      const ids = good ? tk.correctIds : ['o_none'];
      for (const id of ids) { const sel = `[data-act=toggle][data-v="${id}"]`; if (await page.$(sel)) await page.click(sel); }
      if (!good) { const first = await page.$('[data-act=toggle]'); await first.click(); }
      break;
    }
    case 'ordering': {
      let cur = tk.items.slice(); const want = good ? tk.order : tk.order.slice().reverse();
      for (let i = 0; i < want.length; i++) {
        let j = cur.indexOf(want[i]);
        while (j > i) { await page.click(`[data-act=move][data-v="${j}:-1"]`); const x = cur[j]; cur[j] = cur[j - 1]; cur[j - 1] = x; j--; }
      }
      break;
    }
    case 'matching':
      for (const l of tk.left) await page.selectOption(`select[data-match="${l}"]`, good ? tk.pairs[l] : tk.pairs[tk.left[0]]);
      break;
    case 'open': await page.fill('#ans', 'Мой ответ для проверки учителем'); break;
    default: await page.fill('#ans', good ? String(tk.correct) : 'неверно');
  }
}

/** Проходит все задания текущего этапа. opts: {good, wrongFirst} */
async function solveCurrentTask(page, good) {
  const c = await curTask(page); const tk = c.task;
  await fillAnswer(page, tk, good);
  await page.click('[data-act=check]');
  return c;
}

async function playLesson(page, o) {
  o = o || {}; let guard = 0;
  while (guard++ < 400) {
    const c = await curTask(page);
    if (!c || c.view === 'report') return;
    if (c.modal === 'series') { await page.click(o.series === false ? '[data-act=seriesNo]' : '[data-act=seriesYes]'); continue; }
    if (c.seriesInfo) { await page.click('[data-act=seriesContinue]'); continue; }
    if (c.stageType === 'entry') { await page.click('[data-act=advance]'); continue; }
    if (c.stageType === 'cards') { const nx = await page.$('[data-act=cardNext]'); await page.click(nx ? '[data-act=cardNext]' : '[data-act=advance]'); continue; }
    if (c.stageType === 'reflection') {
      if (await page.$('[data-act=rfEmoji]')) await page.click('[data-act=rfEmoji][data-v="2"]');
      if (await page.$('[data-act=rfChoice]')) await page.click('[data-act=rfChoice][data-v="2"]');
      await page.click('[data-act=rfNext][data-v="2"]'); await page.click('[data-act=finish]'); continue;
    }
    if (c.stageStatus === 'not_started') {
      const skip = (c.group === 'final' && o.skipFinal) || (c.group === 'club' && o.club !== true);
      await page.click(skip ? '[data-act=skipStage]' : '[data-act=beginStage]'); continue;
    }
    if (!c.task) { await page.click('[data-act=afterTasks]'); continue; }
    if (!c.task.closed) {
      const good = o.goodFn ? o.goodFn(c) : (o.good !== false);
      await solveCurrentTask(page, good);
      const after = await curTask(page);
      if (after.task && !after.task.closed) { // можно повторить: правильный ответ со второй попытки
        if (o.onWrong) await o.onWrong(page, after);
        if (await page.$('[data-act=retry]')) await page.click('[data-act=retry]');
        const again = await curTask(page);
        if (again.task && !again.task.closed) { await fillAnswer(page, again.task, true); await page.click('[data-act=check]'); }
      }
      continue;
    }
    await page.click('[data-act=nextTask]');
  }
  throw new Error('прохождение не завершилось');
}

async function bodyText(page) { return (await page.evaluate(() => document.body.innerText)).toLowerCase(); }
async function noHScroll(page) { return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); }

module.exports = { chromium, DIST, t, eq, ok, open, curTask, fillAnswer, solveCurrentTask, playLesson, bodyText, noHScroll, summary() { return { passed, failed, failures }; } };
