/* KAP engine · teacher console: анализ результатов и бумажный комплект (разделы 18, 24). */
(function (root) {
  'use strict';
  var K = root.KAP, U = K.util, S = K.scoring, P = K.paper, esc = U.esc;
  var appEl = document.getElementById('app');
  var A = { reports: [], log: [], reviews: {}, kits: [], mode: 'analysis', tab: 'upload', cls: '', lessonKey: '', reportId: '', msg: null, cache: {} };
  var PP = { kit: null, check: null, variant: null, rows: null, msg: null, form: { workType: 'independent', classNum: null, durationMin: 15, variantsCount: 2, taskCount: 8, seed: '', lessonIds: null, includeOpen: true } };
  var DEBUG_NOTE = 'Распознавание бланков по фото: не проверено, отключено. Используйте ручной ввод или внешний сканер (см. README).';

  // ================= импорт =================
  function nameKey(r) { return String(r.student['class']) + '|' + K.norm.normText(r.student.name, 'default'); }
  function gradeInId(id) { var m = /[_-]g0?(\d{1,2})[_-]/.exec(id) || /-(\d{1,2})-/.exec(id); return m ? +m[1] : null; }
  function checkWarnings(r) {
    var w = r.integrity.warnings = r.integrity.warnings || [];
    if (!r.legacy && r.producer && K.PRODUCER && r.producer.materialId === K.PRODUCER.materialId && r.producer.contentVersion !== K.PRODUCER.contentVersion) w.push('Версия содержания отчёта (' + r.producer.contentVersion + ') отличается от версии кабинета (' + K.PRODUCER.contentVersion + '): результат не смешивается со статистикой текущей версии.');
    var gi = gradeInId(String(r.context.lessonId)), cn = parseInt(r.student['class'], 10);
    if (gi && cn && gi !== cn) w.push('Класс в идентификаторе урока (' + gi + ') и в отчёте (' + cn + ') расходятся.');
    if (!r.legacy && K.schema.validateReport(r).length) w.push('Отчёт не прошёл проверку схемы: ' + K.schema.validateReport(r)[0]);
  }
  function addReport(r) {
    if (A.reports.some(function (x) { return x.reportId === r.reportId; })) return 'dup';
    var k = -1; A.reports.forEach(function (x, i) { if (x.dedupeKey === r.dedupeKey) k = i; });
    if (k >= 0) { var old = A.reports[k]; if (Date.parse(r.attempt.fixedAt || 0) >= Date.parse(old.attempt.fixedAt || 0)) { checkWarnings(r); A.reports[k] = r; return 'updated'; } return 'dup'; }
    checkWarnings(r); A.reports.push(r); return 'added';
  }
  function importItems(items) {
    items.forEach(function (it) {
      var res = K.legacy.toReports(it.obj), e = { file: it.name, family: res.family || '—', n: res.reports.length, added: 0, dup: 0, updated: 0, notes: res.notes.slice() };
      if (res.family === 'paper_kit') { if (!A.kits.some(function (k) { return k.kitId === res.extra.kitId; })) A.kits.push(res.extra); e.notes.push('Комплект добавлен'); PP.kit = PP.kit || res.extra; }
      else if (res.family === 'teacher_review') { (res.extra.reviews || []).forEach(function (rv) { (A.reviews[res.extra.reportId] = A.reviews[res.extra.reportId] || {})[rv.taskId] = rv; }); e.notes.push('Оценки учителя: ' + (res.extra.reviews || []).length); }
      else res.reports.forEach(function (r) { e[addReport(r)]++; });
      A.log.push(e);
    });
    A.cache = {}; render();
  }
  function readFiles(files) {
    var list = Array.prototype.slice.call(files);
    Promise.all(list.map(function (f) { return f.text().then(function (t) { try { return { name: f.name, obj: JSON.parse(t.replace(/^﻿/, '')) }; } catch (e) { return { name: f.name, obj: null }; } }); })).then(function (items) {
      var bad = items.filter(function (i) { return !i.obj; }); bad.forEach(function (b) { A.log.push({ file: b.name, family: '—', n: 0, added: 0, dup: 0, updated: 0, notes: ['Файл не прочитан: это не JSON'] }); });
      importItems(items.filter(function (i) { return i.obj; }));
    });
  }

  // ================= проверка учителем =================
  function stageGroups(r) { var m = {}; r.stages.forEach(function (s) { m[s.stageId] = s.group; }); return m; }
  function recompute(r) {
    var sg = stageGroups(r), tasks = r.tasks.map(function (t) {
      return { taskId: t.taskId, stageId: t.stage, group: sg[t.stage] || 'learning', mode: t.mode, closed: t.status !== 'not_done' || t.skipped, status: t.skipped ? 'incorrect' : t.status, score: t.score, maxScore: t.maxScore, attempts: t.attempts || [], hintsUsed: t.hintsUsed, solutionShown: t.solutionShown, descriptorIds: t.descriptorIds, subskillId: t.subskillId, cognitiveLevel: t.cognitiveLevel, loop: t.loop, skipped: t.skipped };
    });
    var crit = {}; r.descriptorResults.forEach(function (d) { (crit[d.criterionId] = crit[d.criterionId] || []).push({ descriptorId: d.descriptorId, text: d.text }); });
    var lesson = { assessmentType: r.context.assessmentType, checkKind: r.context.checkKind, weights: r.scoring.weightsProfile === 'custom' ? r.scoring.weights : null,
      criteria: Object.keys(crit).map(function (k) { var cr = r.criteriaResults.filter(function (c) { return c.criterionId === k; })[0]; return { criterionId: k, text: cr ? cr.text : k, descriptors: crit[k] }; }), subskills: r.subskills.map(function (s) { return { id: s.subskillId, text: s.text }; }) };
    var plan = r.stages.filter(function (s) { return s.group === 'diagnostic' || s.group === 'learning' || s.group === 'final'; }).map(function (s) { return { stageId: s.stageId, group: s.group, mode: 'CORE', plannedMax: U.sum(tasks.filter(function (t) { return t.stageId === s.stageId && !t.loop; }).map(function (t) { return t.maxScore; })) }; });
    var fin = r.stages.filter(function (s) { return s.group === 'final'; })[0];
    return S.computeMetrics({ tasks: tasks, stagePlan: plan, lesson: lesson, finalTime: { limitSec: r.time.timeLimitSec, activeSec: fin ? fin.activeSec : 0 } });
  }
  function eff(r) {
    var rv = A.reviews[r.reportId]; if (!rv || !Object.keys(rv).length) return r;
    var key = r.reportId + ':' + Object.keys(rv).length + ':' + U.hashHex(U.canonical(rv)); if (A.cache[key]) return A.cache[key];
    var c = U.clone(r);
    c.tasks.forEach(function (t) {
      var x = rv[t.taskId]; if (!x) return;
      t.teacherReview = x; t.score = Math.max(0, Math.min(t.maxScore, +x.score)); t.status = t.score >= t.maxScore ? 'correct' : (t.score > 0 ? 'partial' : 'incorrect'); t.autoGraded = false;
    });
    if (!c.legacy) {
      var m = recompute(c), keep = c.metrics.completionPct; c.metrics = Object.assign({}, c.metrics, m.metrics, { completionPct: keep }); c.metrics.metricSources.mark10 = 'teacher_manual';
      c.scoring.markBasis = m.scoring.markBasis; c.scoring.scoreCap = m.scoring.scoreCap; c.descriptorResults = m.descriptorResults; c.criteriaResults = m.criteriaResults; c.subskills = m.subskills; c.coreResult = m.coreResult;
    }
    return (A.cache[key] = c);
  }
  function EF() { return A.reports.map(eff); }

  // ================= представления =================
  function fmt(x, suf) { return x == null ? '—' : String(x).replace('.', ',') + (suf || ''); }
  function secText(s) { if (s == null) return '—'; s = Math.round(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ' ч ' : '') + m + ' мин ' + (s % 60) + ' с'; }
  function basisText(b) { return ({ with_control: 'с итоговой проверкой', formative_without_control: 'по пройденной части', control_work: 'контрольная работа', none: 'нет отметки' })[b] || b; }
  function head() {
    return '<div class="row sb no-print"><h1>Кабинет учителя</h1><div class="small muted">ядро ' + esc(K.PRODUCER.engineVersion) + ' · содержание ' + esc(K.PRODUCER.contentVersion) + ' · ' + esc(K.PRODUCER.contentHash) + '</div></div>' +
      '<div class="tabs no-print"><button class="tab' + (A.mode === 'analysis' ? ' on' : '') + '" data-act="mode" data-v="analysis">Анализ результатов</button><button class="tab' + (A.mode === 'paper' ? ' on' : '') + '" data-act="mode" data-v="paper">Бумажный комплект</button></div>';
  }
  function subTabs() {
    var t = [['upload', 'Загрузка'], ['classes', 'Классы и ученики'], ['lessons', 'Уроки и цели'], ['review', 'Проверка учителем'], ['protocol', 'Протокол']];
    return '<div class="tabs sub no-print">' + t.map(function (x) { return '<button class="tab' + (A.tab === x[0] ? ' on' : '') + '" data-act="tab" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
  }

  function viewUpload() {
    var h = '<div class="card dropzone" id="dz"><h2>Загрузить результаты</h2><p>Перетащи сюда файлы или выбери их кнопкой. Можно один файл, несколько или пакет. Прежние форматы тоже читаются.</p>' +
      '<input type="file" id="files" accept=".json,application/json" multiple> <button class="btn quiet" data-act="clear">Очистить всё</button></div>';
    h += '<div class="card"><h3>Принято отчётов: ' + A.reports.length + '</h3><div class="scroll"><table><tr><th>Файл</th><th>Формат</th><th>Отчётов</th><th>Новых</th><th>Повторов</th><th>Обновлено</th><th>Замечания</th></tr>' +
      A.log.map(function (e) { return '<tr><td>' + esc(e.file) + '</td><td>' + esc(e.family) + '</td><td>' + e.n + '</td><td>' + (e.added || 0) + '</td><td>' + (e.dup || 0) + '</td><td>' + (e.updated || 0) + '</td><td>' + esc((e.notes || []).join('; ')) + '</td></tr>'; }).join('') + '</table></div></div>';
    var warn = []; A.reports.forEach(function (r) { (r.integrity.warnings || []).forEach(function (w) { if (!/Импорт из прежней/.test(w)) warn.push(r.student.name + ' · ' + r.context.lessonId + ': ' + w); }); });
    if (warn.length) h += '<div class="card"><h3>Предупреждения (' + warn.length + ')</h3><ul class="small">' + warn.slice(0, 40).map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>';
    return h;
  }

  function classes() { var s = {}; A.reports.forEach(function (r) { s[r.student['class']] = 1; }); return Object.keys(s).sort(); }
  function groupBy(list, f) { var m = {}; list.forEach(function (x) { (m[f(x)] = m[f(x)] || []).push(x); }); return m; }

  function viewClasses() {
    var cl = classes(); if (!cl.length) return '<div class="note">Сначала загрузи результаты.</div>';
    if (!A.cls || cl.indexOf(A.cls) < 0) A.cls = cl[0];
    var h = '<div class="card"><label for="clsel">Класс</label><select id="clsel" data-change="cls">' + cl.map(function (c) { return '<option' + (c === A.cls ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select> <button class="btn quiet" data-act="csv">Таблица класса (файл CSV)</button> <button class="btn quiet" data-act="print">Печать</button></div>';
    var reps = EF().filter(function (r) { return r.student['class'] === A.cls; }), byStudent = groupBy(reps, function (r) { return K.norm.normText(r.student.name, 'default'); });
    Object.keys(byStudent).sort().forEach(function (k) {
      var list = byStudent[k], name = list[0].student.name, byLesson = groupBy(list, function (r) { return r.context.lessonId; });
      h += '<details class="card"><summary><b>' + esc(name) + '</b> · работ: ' + list.length + '</summary><div class="scroll"><table><tr><th>Урок</th><th>Попытка</th><th>Статус</th><th>Выполнено</th><th>Точность</th><th>Цели</th><th>Отметка</th><th>Основание</th><th>Время (раб. / календ.)</th><th>Превышение</th><th>Источник</th></tr>';
      Object.keys(byLesson).forEach(function (lid) {
        var ls = byLesson[lid].sort(function (a, b) { return a.attempt.attemptNumber - b.attempt.attemptNumber; }), sm = S.summarize(ls);
        ls.forEach(function (r) {
          h += '<tr><td>' + esc(r.context.lessonTitle || lid) + (r.legacy ? ' <span class="chip">старый формат ' + esc(r.legacyFamily) + '</span>' : '') + '</td><td>' + r.attempt.attemptNumber + (r.attempt.countsForMark === false ? ' (не учитывается)' : '') + '</td><td>' + esc({ completed: 'завершён', student_stopped: 'не закончен', time_expired: 'по таймеру' }[r.attempt.completionReason] || r.attempt.completionReason) + '</td><td>' + fmt(r.metrics.completionPct, '%') + '</td><td>' + fmt(r.metrics.accuracyPct, '%') + '</td><td>' + fmt(r.metrics.achievementPct, '%') + '</td><td><b>' + fmt(r.metrics.mark10) + '</b></td><td>' + basisText(r.scoring.markBasis) + (r.scoring.scoreCap.applied ? ' · потолок 84% (без ограничения ' + fmt(r.scoring.scoreCap.uncappedMark10) + ')' : '') + '</td><td>' + secText(r.time.activeTimeSec) + ' / ' + secText(r.time.elapsedWallTimeSec) + '</td><td>' + (r.time.timeExceeded ? '+' + r.time.overtimeSec + ' с' : '—') + '</td><td>' + esc(r.source) + '</td></tr>';
        });
        if (sm.length) sm.forEach(function (x) { h += '<tr class="sum"><td colspan="6">Итог по уроку (среднее лучшей и последней попыток, профиль ' + esc(x.weightsProfile) + ')</td><td><b>' + fmt(x.mark10) + '</b></td><td colspan="4">лучшая ' + fmt(x.bestMark10) + ' (попытка ' + x.bestAttemptNumber + '), последняя ' + fmt(x.lastMark10) + ' (попытка ' + x.lastAttemptNumber + ')</td></tr>'; });
      });
      h += '</table></div></details>';
    });
    return h;
  }

  function viewLessons() {
    var all = EF(); if (!all.length) return '<div class="note">Сначала загрузи результаты.</div>';
    var cl = classes(); if (!A.cls || cl.indexOf(A.cls) < 0) A.cls = cl[0];
    var inCls = all.filter(function (r) { return r.student['class'] === A.cls; }), keys = {}; inCls.forEach(function (r) { keys[r.context.lessonId] = r.context.lessonTitle || r.context.lessonId; });
    var ids = Object.keys(keys); if (!A.lessonKey || ids.indexOf(A.lessonKey) < 0) A.lessonKey = ids[0];
    var reps = inCls.filter(function (r) { return r.context.lessonId === A.lessonKey && r.attempt.completionReason !== undefined; }), latest = {};
    reps.forEach(function (r) { var k = nameKey(r); if (!latest[k] || r.attempt.attemptNumber > latest[k].attempt.attemptNumber) latest[k] = r; });
    var rows = Object.keys(latest).map(function (k) { return latest[k]; });
    var h = '<div class="card row"><div><label for="clsel">Класс</label><select id="clsel" data-change="cls">' + cl.map(function (c) { return '<option' + (c === A.cls ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div><div><label for="lsel">Урок</label><select id="lsel" data-change="lesson">' + ids.map(function (i) { return '<option value="' + esc(i) + '"' + (i === A.lessonKey ? ' selected' : '') + '>' + esc(keys[i]) + '</option>'; }).join('') + '</select></div></div>';
    var marks = rows.map(function (r) { return r.metrics.mark10; }).filter(function (x) { return x != null; });
    h += '<div class="card"><h3>Класс по уроку (последние попытки)</h3><p>Учеников: ' + rows.length + '. Средняя отметка: <b>' + (marks.length ? fmt(U.round1(U.sum(marks) / marks.length)) : '—') + '</b>. Превысили время: ' + rows.filter(function (r) { return r.time.timeExceeded; }).length + '. Не закончили: ' + rows.filter(function (r) { return r.attempt.completionReason !== 'completed'; }).length + '.</p></div>';
    // дескрипторы
    var dset = {}; rows.forEach(function (r) { r.descriptorResults.forEach(function (d) { dset[d.descriptorId] = d.text; }); });
    if (Object.keys(dset).length) {
      var chip = { achieved: 'ok', partially: 'warn', not_yet: 'bad', not_shown: '', teacher_review: 'warn' }, nm = { achieved: 'достигнут', partially: 'частично', not_yet: 'не достигнут', not_shown: 'не предъявлялся', teacher_review: 'проверка учителя' };
      h += '<div class="card"><h3>Цели и дескрипторы</h3><div class="scroll"><table><tr><th>Ученик</th>' + Object.keys(dset).map(function (d) { return '<th title="' + esc(dset[d]) + '">' + esc(d) + '</th>'; }).join('') + '</tr>' +
        rows.map(function (r) { return '<tr><td>' + esc(r.student.name) + '</td>' + Object.keys(dset).map(function (d) { var x = r.descriptorResults.filter(function (y) { return y.descriptorId === d; })[0]; return '<td>' + (x ? '<span class="chip ' + chip[x.status] + '">' + nm[x.status] + '</span>' : '—') + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div><p class="small muted">' + Object.keys(dset).map(function (d) { return esc(d) + ' — ' + esc(dset[d]); }).join('; ') + '</p></div>';
    }
    // поднавыки
    var sk = {}; rows.forEach(function (r) { r.subskills.forEach(function (s) { var o = (sk[s.subskillId] = sk[s.subskillId] || { text: s.text, n: 0, m: 0 }); o.n++; if (s.mastery && s.mastery.mastered) o.m++; }); });
    if (Object.keys(sk).length) h += '<div class="card"><h3>Освоение поднавыков</h3>' + Object.keys(sk).map(function (k) { var o = sk[k], p = o.n ? Math.round(100 * o.m / o.n) : 0; return '<div class="crit">' + esc(o.text) + ': освоили ' + o.m + ' из ' + o.n + ' (' + p + '%)<div class="bar-track"><div class="bar-fill" style="width:' + p + '%"></div></div></div>'; }).join('') + '</div>';
    // типичные ошибки
    var errs = {}; rows.forEach(function (r) { r.tasks.forEach(function (t) { if (t.errorType && t.status !== 'correct') errs[t.errorType] = (errs[t.errorType] || 0) + 1; }); });
    var ek = Object.keys(errs).sort(function (a, b) { return errs[b] - errs[a]; });
    h += '<div class="card"><h3>Типичные ошибки класса</h3>' + (ek.length ? '<table><tr><th>Тип ошибки</th><th>Сколько раз</th></tr>' + ek.slice(0, 12).map(function (k) { return '<tr><td>' + esc(((K.PACK && K.PACK.errorLabels && K.PACK.errorLabels[k]) || k)) + '</td><td>' + errs[k] + '</td></tr>'; }).join('') + '</table>' : '<p class="muted">Нет данных о типах ошибок.</p>') + '</div>';
    // трудность заданий по генераторам
    var gs = {}; rows.forEach(function (r) { r.tasks.forEach(function (t) { if (!t.generator || !t.generator.generatorId || t.status === 'not_done' || t.status === 'pending_review') return; var o = (gs[t.generator.generatorId] = gs[t.generator.generatorId] || { n: 0, ok: 0, hints: 0, sec: [] }); o.n++; if (t.status === 'correct') o.ok++; o.hints += t.hintsUsed || 0; if (t.responseTimeSec != null) o.sec.push(t.responseTimeSec); }); });
    if (Object.keys(gs).length) h += '<div class="card"><h3>Трудность заданий</h3><div class="scroll"><table><tr><th>Тип задания</th><th>Предъявлено</th><th>Верно</th><th>Подсказок</th><th>Среднее время, с</th></tr>' + Object.keys(gs).sort(function (a, b) { return gs[a].ok / gs[a].n - gs[b].ok / gs[b].n; }).map(function (k) { var o = gs[k]; return '<tr><td>' + esc(k) + '</td><td>' + o.n + '</td><td>' + Math.round(100 * o.ok / o.n) + '%</td><td>' + o.hints + '</td><td>' + (o.sec.length ? Math.round(U.sum(o.sec) / o.sec.length) : '—') + '</td></tr>'; }).join('') + '</table></div></div>';
    // профиль по уровням мышления
    var lv = {}; rows.forEach(function (r) { var lp = r.metrics.levelsProfile; if (lp) Object.keys(lp).forEach(function (k) { var o = (lv[k] = lv[k] || { p: 0, c: 0 }); o.p += lp[k].presented; o.c += lp[k].correct; }); });
    var names = { recognition: 'Узнавание', reproduction: 'Воспроизведение', understanding: 'Понимание', transfer: 'Перенос', investigation: 'Исследование', generalization: 'Обобщение' };
    var lk = Object.keys(lv).filter(function (k) { return lv[k].p; });
    if (lk.length) h += '<div class="card"><h3>Уровни мышления</h3>' + lk.map(function (k) { var p = Math.round(100 * lv[k].c / lv[k].p); return '<div class="crit">' + names[k] + ': ' + lv[k].c + ' из ' + lv[k].p + ' (' + p + '%)<div class="bar-track"><div class="bar-fill" style="width:' + p + '%"></div></div></div>'; }).join('') + '<p class="small muted">Показывает характер освоения: воспроизводят ли ученики образец или переносят способ. На отметку не влияет.</p></div>';
    // возвраты
    var loops = []; rows.forEach(function (r) { (r.correctionLoops || []).forEach(function (l) { loops.push({ r: r, l: l }); }); });
    if (loops.length) h += '<div class="card"><h3>Кому куда вернуться</h3><table><tr><th>Ученик</th><th>Поднавык</th><th>Маршрут</th><th>Исход</th></tr>' + loops.map(function (x) { return '<tr><td>' + esc(x.r.student.name) + '</td><td>' + esc(x.l.subskillId) + '</td><td>' + esc(x.l.route) + '</td><td>' + esc(x.l.outcome) + '</td></tr>'; }).join('') + '</table></div>';
    return h;
  }

  function pendingTasks() {
    var out = []; EF().forEach(function (r) { r.tasks.forEach(function (t) { if (t.status === 'pending_review' || t.teacherReview) out.push({ r: r, t: t }); }); }); return out;
  }
  function viewReview() {
    var list = pendingTasks(); if (!list.length) return '<div class="note">Ответов, ожидающих проверки, нет.</div>';
    var h = '<div class="note">Оценки сохраняются в отдельный файл-наложение. Исходные отчёты не меняются.</div><p><button class="btn" data-act="saveReviews">Сохранить оценки (файл)</button></p>';
    list.forEach(function (x, i) {
      var rv = (A.reviews[x.r.reportId] || {})[x.t.taskId] || {};
      h += '<div class="card"><div class="small muted">' + esc(x.r.student.name) + ' · ' + esc(x.r.context.lessonTitle || x.r.context.lessonId) + '</div><div class="pt-cond">' + P.safeHtml(x.t.presentedCondition) + '</div><div class="note"><b>Ответ ученика:</b> ' + esc(typeof x.t.studentAnswer === 'object' ? JSON.stringify(x.t.studentAnswer) : x.t.studentAnswer == null ? '—' : x.t.studentAnswer) + '</div>' +
        '<div class="row"><label>Балл (0–' + x.t.maxScore + ')</label><input type="number" min="0" max="' + x.t.maxScore + '" step="0.5" style="width:100px" data-rev="' + esc(x.r.reportId) + '|' + esc(x.t.taskId) + '|' + x.t.maxScore + '" value="' + (rv.score != null ? rv.score : '') + '"><input type="text" placeholder="Комментарий" style="flex:1" data-revc="' + esc(x.r.reportId) + '|' + esc(x.t.taskId) + '" value="' + esc(rv.comment || '') + '"></div></div>';
    });
    return h;
  }

  function viewProtocol() {
    var reps = EF(); if (!reps.length) return '<div class="note">Сначала загрузи результаты.</div>';
    if (!A.reportId || !reps.some(function (r) { return r.reportId === A.reportId; })) A.reportId = reps[0].reportId;
    var r = reps.filter(function (x) { return x.reportId === A.reportId; })[0];
    var h = '<div class="card"><label for="rsel">Отчёт</label><select id="rsel" data-change="report">' + reps.map(function (x) { return '<option value="' + esc(x.reportId) + '"' + (x.reportId === A.reportId ? ' selected' : '') + '>' + esc(x.student['class'] + ' · ' + x.student.name + ' · ' + (x.context.lessonTitle || x.context.lessonId) + ' · попытка ' + x.attempt.attemptNumber) + '</option>'; }).join('') + '</select></div>';
    h += '<div class="card"><h2>' + esc(r.student.name) + ', ' + esc(r.student['class']) + '</h2><p class="muted">' + esc(r.context.lessonTitle || '') + ' · ' + esc(r.context.subject || '') + ' · ' + esc(r.context.assessmentLabel || r.context.assessmentType) + '</p>' +
      '<div class="kv"><div><b>' + fmt(r.metrics.mark10) + '</b>отметка /10</div><div><b>' + fmt(r.metrics.completionPct, '%') + '</b>выполнено</div><div><b>' + fmt(r.metrics.accuracyPct, '%') + '</b>точность</div><div><b>' + fmt(r.metrics.achievementPct, '%') + '</b>цели</div><div><b>' + fmt(r.metrics.independencePct, '%') + '</b>без подсказок</div></div>' +
      '<p class="small">Основание: ' + basisText(r.scoring.markBasis) + '. Профиль весов: ' + esc(r.scoring.weightsProfile) + ' (источник ' + esc(r.scoring.weightsSource) + ')' + (r.scoring.weights ? ': ' + esc(JSON.stringify(r.scoring.weights)) : '') + '. Источник отчёта: ' + esc(r.source) + '.</p>' +
      '<p class="small">Время: рабочее ' + secText(r.time.activeTimeSec) + ', от начала до конца ' + secText(r.time.elapsedWallTimeSec) + ', лимит ' + secText(r.time.timeLimitSec) + (r.time.timeExceeded ? ', превышение ' + r.time.overtimeSec + ' с' : '') + ', сессий: ' + (r.time.sessions || []).length + ', уходов со страницы: ' + (r.time.pageLeaves || 0) + '.</p>' +
      (r.scoring.scoreCap.applied ? '<div class="note warn">Применён потолок 84% за превышение времени. Результат без ограничения: ' + fmt(r.scoring.scoreCap.uncappedMark10) + ' (достижение ' + fmt(r.scoring.scoreCap.uncappedAchievementPct, '%') + ').</div>' : '') + '</div>';
    h += '<div class="card"><h3>Задания (' + r.tasks.length + ')</h3><div class="scroll"><table><tr><th>№</th><th>Условие</th><th>Варианты (в порядке предъявления)</th><th>Верный ответ</th><th>Ответ ученика</th><th>Статус</th><th>Балл</th><th>Попыток / подсказок</th><th>Воспроизведение</th></tr>';
    r.tasks.forEach(function (t, i) {
      var rep = '';
      if (t.generator && t.generator.generatorId && K.gen) { try { var again = K.gen.reproduce(t.generator.generatorId, t.generator.profile, t.generator.seed); rep = again.fingerprint === t.variantFingerprint ? '<span class="chip ok">совпадает</span>' : '<span class="chip bad">не совпадает</span>'; } catch (e) { rep = '<span class="chip">нет генератора</span>'; } }
      h += '<tr><td>' + (i + 1) + (t.loop ? '<br><span class="chip">возврат</span>' : '') + '</td><td>' + P.safeHtml(t.presentedCondition) + '</td><td>' + esc((t.presentedOptions || []).join(' | ')) + '</td><td>' + esc(Array.isArray(t.expectedAnswer) ? t.expectedAnswer.join('; ') : t.expectedAnswer) + '</td><td>' + esc(typeof t.studentAnswer === 'object' && t.studentAnswer ? JSON.stringify(t.studentAnswer) : t.studentAnswer == null ? '—' : t.studentAnswer) + (t.errorType ? '<br><span class="small muted">' + esc(t.errorType) + '</span>' : '') + '</td><td>' + esc(t.status) + (t.skipped ? ' (пропущено)' : '') + '</td><td>' + fmt(t.score) + ' / ' + t.maxScore + '</td><td>' + (Array.isArray(t.attempts) ? t.attempts.length : t.attempts) + ' / ' + (t.hintsUsed || 0) + '</td><td class="small">' + (t.generator && t.generator.seed != null ? 'seed ' + esc(t.generator.seed) + '<br>' : '') + rep + '</td></tr>';
    });
    h += '</table></div></div>';
    if (r.reflection) h += '<div class="card"><h3>Рефлексия</h3><p class="small">' + esc(JSON.stringify(r.reflection)) + '</p></div>';
    if (r.strengths.length || r.difficulties.length) h += '<div class="card"><h3>Наблюдения</h3><p><b>Получается:</b> ' + esc(r.strengths.join('; ') || '—') + '</p><p><b>Трудности:</b> ' + esc(r.difficulties.join('; ') || '—') + '</p><p><b>Рекомендации:</b> ' + esc(r.recommendations.join('; ') || '—') + '</p></div>';
    return h;
  }

  // ================= бумажный комплект =================
  function viewPaper() {
    var lessons = K.PACK.lessons;
    var F = PP.form, sel = F.lessonIds || [lessons[Math.min(1, lessons.length - 1)].lessonId];
    var h = '<div class="card no-print"><h2>Конструктор работы</h2><p class="muted small">Задания берутся из тех же генераторов, что и в ученическом файле. Печатаются задания основного курса. Сгенерированная работа — тренировочный аналог, а не официальная.</p>' +
      '<div class="grid"><div><label for="pw">Вид работы</label><select id="pw">' + Object.keys(P.WORK).map(function (k) { return '<option value="' + k + '"' + (F.workType === k ? ' selected' : '') + '>' + esc(P.WORK[k].label) + '</option>'; }).join('') + '</select></div>' +
      '<div><label for="pcl">Класс</label><input type="number" id="pcl" min="1" max="11" value="' + esc(F.classNum || lessons[0].class) + '"></div>' +
      '<div><label for="pdur">Время, мин</label><input type="number" id="pdur" min="5" max="90" value="' + F.durationMin + '"></div>' +
      '<div><label for="pvar">Вариантов (1–4)</label><input type="number" id="pvar" min="1" max="4" value="' + F.variantsCount + '"></div>' +
      '<div><label for="ptn">Заданий</label><input type="number" id="ptn" min="3" max="30" value="' + F.taskCount + '"></div>' +
      '<div><label for="pseed">Код воспроизведения (необязательно)</label><input type="text" id="pseed" placeholder="пусто — случайный" value="' + esc(F.seed) + '"></div></div>' +
      '<label>Уроки и темы</label>' + lessons.map(function (l) { return '<label style="font-weight:400"><input type="checkbox" class="plesson" value="' + esc(l.lessonId) + '"' + (sel.indexOf(l.lessonId) >= 0 ? ' checked' : '') + '> ' + esc(l.title) + ' <span class="muted small">(' + esc(l.subject) + ', ' + esc(l.class) + ' кл.)</span></label>'; }).join('') +
      '<label style="font-weight:400"><input type="checkbox" id="popen"' + (F.includeOpen ? ' checked' : '') + '> Включать открытые задания (оцениваются по рубрике)</label>' +
      '<p><button class="btn" data-act="buildKit">Составить комплект</button></p></div>';
    if (PP.msg) { h += '<div class="note bad">' + esc(PP.msg) + '</div>'; PP.msg = null; }
    if (!PP.kit) return h + '<div class="note">' + esc(DEBUG_NOTE) + '</div>';
    var kit = PP.kit, v = PP.check || P.validateKit(kit);
    h += '<div class="card no-print"><h2>Комплект ' + esc(kit.kitId) + '</h2><p>Вид: ' + esc(kit.params.workLabel) + '. Вариантов: ' + kit.variants.length + ', заданий в каждом: ' + kit.blueprint.length + ', баллов: ' + U.sum(kit.variants[0].tasks.map(function (t) { return t.maxScore; })) + '. Ожидаемое время: ' + v.estimateMin + ' мин. Код воспроизведения: <b>' + kit.params.seed + '</b>.</p>';
    if (v.errors.length) h += '<div class="note bad"><b>Ошибки проверки:</b><ul>' + v.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>'; else h += '<div class="note ok">Проверка комплекта пройдена: варианты равноценны по спецификации, повторов нет, ключи верны, все задания воспроизводятся по коду.</div>';
    if (v.warnings.length) h += '<div class="note warn"><ul>' + v.warnings.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
    if ((kit.excluded || []).length) h += '<div class="note small">Из комплекта исключены типы заданий, которые не дают достаточно различных вариантов: ' + esc(kit.excluded.join(', ')) + '.</div>';
    h += '<p class="row"><button class="btn" data-act="print">Печать (варианты, бланки, ключ)</button><button class="btn quiet" data-act="saveKit">Сохранить комплект (файл)</button></p><div class="note small">' + esc(DEBUG_NOTE) + '</div></div>';
    h += '<div class="card no-print"><h2>Ввод результатов с бумаги</h2><label for="pvsel">Вариант</label><select id="pvsel">' + kit.variants.map(function (x) { return '<option value="' + x.variantCode + '"' + (x.variantCode === PP.variant ? ' selected' : '') + '>Вариант ' + x.variantCode.replace('V', '') + '</option>'; }).join('') + '</select>' +
      '<label for="pstud">Ученики (по одному в строке: фамилия имя)</label><textarea id="pstud" placeholder="Иванов Иван&#10;Петрова Анна"></textarea><p><button class="btn quiet" data-act="makeGrid">Создать таблицу ввода</button></p>';
    if (PP.rows) {
      var variant = kit.variants.filter(function (x) { return x.variantCode === PP.variant; })[0] || kit.variants[0];
      h += '<div class="scroll"><table class="entry"><tr><th>Ученик</th>' + variant.tasks.map(function (t) { return '<th>' + t.position + '<br><span class="small muted">' + (t.taskType === 'single_choice' ? 'выбор' : 'балл 0–' + t.maxScore) + '</span></th>'; }).join('') + '</tr>' +
        PP.rows.map(function (s, si) { return '<tr><td>' + esc(s) + '</td>' + variant.tasks.map(function (t) { return '<td>' + (t.taskType === 'single_choice' ? '<select data-e="' + si + '|' + t.position + '|c"><option value="">—</option>' + t.options.map(function (o, i) { return '<option value="' + i + '">' + P.LETTERS[i] + '</option>'; }).join('') + '</select>' : '<input type="number" min="0" max="' + t.maxScore + '" step="0.5" style="width:70px" data-e="' + si + '|' + t.position + '|s">') + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div><p><button class="btn" data-act="entryToAnalysis">Добавить в анализ</button></p>';
    }
    h += '</div><div class="print-area" id="printArea">' + printHtml(kit) + '</div>';
    return h;
  }
  function printHtml(kit) {
    var h = '';
    kit.variants.forEach(function (v) { h += P.variantHtml(kit, v, true); });
    kit.variants.forEach(function (v) { h += '<section class="print-page omr-page">' + P.sheetSvg(kit, v.variantCode) + '<hr class="cut">' + P.sheetSvg(kit, v.variantCode) + '</section>'; });
    return h + P.keyHtml(kit, true);
  }

  // ================= экспорт =================
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csvCell(x) { x = x == null ? '' : String(x); return /[;"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }
  function exportCsv() {
    var rows = [['Класс', 'Ученик', 'Урок', 'Попытка', 'Основание', 'Выполнено %', 'Точность %', 'Цели %', 'Отметка', 'Итог по уроку', 'Время рабочее, с', 'Время календарное, с', 'Превышение, с', 'Источник']];
    var reps = EF().filter(function (r) { return r.student['class'] === A.cls; }), sm = S.summarize(reps);
    reps.forEach(function (r) { var s = sm.filter(function (x) { return x.studentKey === (r.student['class'] + '|' + K.norm.normText(r.student.name, 'default')) && x.lessonId === r.context.lessonId; })[0]; rows.push([r.student['class'], r.student.name, r.context.lessonTitle || r.context.lessonId, r.attempt.attemptNumber, r.scoring.markBasis, r.metrics.completionPct, r.metrics.accuracyPct, r.metrics.achievementPct, r.metrics.mark10, s ? s.mark10 : '', r.time.activeTimeSec, r.time.elapsedWallTimeSec, r.time.overtimeSec, r.source]); });
    download('klass_' + A.cls.replace(/[^\w.-]+/g, '_') + '.csv', '﻿' + rows.map(function (r) { return r.map(csvCell).join(';'); }).join('\n'), 'text/csv;charset=utf-8');
  }

  // ================= события =================
  function render() {
    var h = head();
    if (A.msg) { h += '<div class="note ok no-print">' + esc(A.msg) + '</div>'; A.msg = null; }
    if (A.mode === 'analysis') {
      h += subTabs();
      h += A.tab === 'upload' ? viewUpload() : A.tab === 'classes' ? viewClasses() : A.tab === 'lessons' ? viewLessons() : A.tab === 'review' ? viewReview() : viewProtocol();
    } else h += viewPaper();
    var keep = { x: root.scrollX, y: root.scrollY };
    appEl.innerHTML = h;
    var inp = document.getElementById('files'); if (inp) inp.addEventListener('change', function (e) { readFiles(e.target.files); });
    var dz = document.getElementById('dz');
    if (dz) { dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('over'); }); dz.addEventListener('dragleave', function () { dz.classList.remove('over'); }); dz.addEventListener('drop', function (e) { e.preventDefault(); dz.classList.remove('over'); readFiles(e.dataTransfer.files); }); }
    root.scrollTo(keep.x, keep.y);
  }
  appEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return; var act = b.getAttribute('data-act'), v = b.getAttribute('data-v');
    switch (act) {
      case 'mode': A.mode = v; render(); return;
      case 'tab': A.tab = v; render(); return;
      case 'clear': A.reports = []; A.log = []; A.reviews = {}; A.cache = {}; render(); return;
      case 'csv': exportCsv(); return;
      case 'print': root.print(); return;
      case 'saveReviews': {
        var ids = Object.keys(A.reviews); if (!ids.length) { A.msg = 'Оценок пока нет.'; return; }
        ids.forEach(function (id) { download('proverka_' + id.slice(0, 12).replace(/[^\w-]/g, '') + '.json', JSON.stringify({ schemaVersion: '1.0', reportType: 'teacher_review', reportId: id, reviews: Object.keys(A.reviews[id]).map(function (k) { return A.reviews[id][k]; }) }, null, 2)); });
        return;
      }
      case 'buildKit': {
        var lessons = Array.prototype.slice.call(document.querySelectorAll('.plesson:checked')).map(function (x) { return x.value; });
        if (!lessons.length) { PP.msg = 'Выбери хотя бы один урок.'; render(); return; }
        var seedTxt = document.getElementById('pseed').value.trim();
        PP.form = { workType: document.getElementById('pw').value, classNum: +document.getElementById('pcl').value || 6, durationMin: +document.getElementById('pdur').value || 15, variantsCount: +document.getElementById('pvar').value || 2, taskCount: +document.getElementById('ptn').value || 8, seed: seedTxt, lessonIds: lessons, includeOpen: document.getElementById('popen').checked };
        try {
          PP.kit = P.build({ workType: document.getElementById('pw').value, lessonIds: lessons, classNum: +document.getElementById('pcl').value || 6, durationMin: +document.getElementById('pdur').value || 15, variantsCount: +document.getElementById('pvar').value || 2, taskCount: +document.getElementById('ptn').value || 8, includeOpen: document.getElementById('popen').checked, seed: seedTxt ? (+seedTxt >>> 0) : undefined });
          PP.check = P.validateKit(PP.kit); PP.variant = PP.kit.variants[0].variantCode; PP.rows = null;
        } catch (err) { PP.msg = err.message; PP.kit = null; }
        render(); return;
      }
      case 'saveKit': download('komplekt_' + PP.kit.kitId + '.json', JSON.stringify(PP.kit, null, 2)); return;
      case 'makeGrid': {
        PP.variant = document.getElementById('pvsel').value;
        PP.rows = document.getElementById('pstud').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); render();
        document.getElementById('pstud').value = PP.rows.join('\n'); return;
      }
      case 'entryToAnalysis': {
        var entries = PP.rows.map(function () { return {}; });
        appEl.querySelectorAll('[data-e]').forEach(function (el) { var p = el.getAttribute('data-e').split('|'), si = +p[0], pos = +p[1], kind = p[2]; if (el.value === '') return; (entries[si][pos] = entries[si][pos] || {})[kind === 'c' ? 'choice' : 'score'] = +el.value; });
        var reps = P.reportsFromEntries(PP.kit, PP.variant, PP.rows.map(function (n) { return { name: n, 'class': PP.kit.params['class'] }; }), entries);
        var res = reps.map(addReport); A.log.push({ file: 'ручной ввод: ' + PP.kit.kitId + ' ' + PP.variant, family: 'paper_manual', n: reps.length, added: res.filter(function (x) { return x === 'added'; }).length, dup: res.filter(function (x) { return x === 'dup'; }).length, updated: res.filter(function (x) { return x === 'updated'; }).length, notes: [] });
        A.cache = {}; A.mode = 'analysis'; A.tab = 'classes'; A.cls = PP.kit.params['class']; A.msg = 'Результаты бумажной работы добавлены в анализ.'; render(); return;
      }
    }
  });
  appEl.addEventListener('change', function (e) {
    var t = e.target, c = t.getAttribute && t.getAttribute('data-change');
    if (c === 'cls') { A.cls = t.value; render(); }
    if (c === 'lesson') { A.lessonKey = t.value; render(); }
    if (c === 'report') { A.reportId = t.value; render(); }
    if (t.hasAttribute && t.hasAttribute('data-rev')) {
      var p = t.getAttribute('data-rev').split('|'); if (t.value === '') return;
      var cm = appEl.querySelector('[data-revc="' + p[0] + '|' + p[1] + '"]');
      (A.reviews[p[0]] = A.reviews[p[0]] || {})[p[1]] = { taskId: p[1], score: Math.max(0, Math.min(+p[2], +t.value)), maxScore: +p[2], comment: cm ? cm.value : '', reviewedAt: U.nowIso(), reviewerLabel: null }; A.cache = {};
    }
    if (t.hasAttribute && t.hasAttribute('data-revc')) { var q = t.getAttribute('data-revc').split('|'), r = (A.reviews[q[0]] || {})[q[1]]; if (r) r.comment = t.value; }
  });

  K.teacher = { state: A, paper: PP, importItems: importItems, eff: eff, render: render, recompute: recompute, reports: function () { return A.reports; } };
  render();
})(typeof window !== 'undefined' ? window : globalThis);
