/* KAP engine · student app: профили, «Мои уроки», этапы урока, подсказки, коррекционный цикл, отчёт, экспорт. */
(function (root) {
  'use strict';
  var K = root.KAP, U = K.util, S = K.scoring, I = K.i18n, esc = U.esc;
  var T = function (k, v) { return I.t(k, v); };
  var PACK = K.PACK, LESSONS = PACK.lessons;
  I.setLang(PACK.language || 'ru');
  var STORE_KEY = 'kap:' + K.PRODUCER.materialId;
  var PAGE_ID = U.hashHex(String(Date.now()) + Math.random());
  var appEl = document.getElementById('app');
  var memOnly = false;
  var FORBIDDEN_UI = ['seed', 'генератор', 'валидатор', 'json', 'fingerprint', 'парсер', 'движок'];

  // ================= хранилище =================
  function emptyState() { return { v: 1, profiles: {}, current: null }; }
  function load() {
    try { var raw = root.localStorage.getItem(STORE_KEY); if (raw) { var s = JSON.parse(raw); if (s && s.profiles) return s; } }
    catch (e) { memOnly = true; }
    return emptyState();
  }
  var state = load();
  var saveTimer = null;
  function save() { try { root.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { memOnly = true; } }
  function saveSoon() { if (saveTimer) return; saveTimer = setTimeout(function () { saveTimer = null; save(); }, 300); }
  (function probe() { try { root.localStorage.setItem(STORE_KEY + ':probe', '1'); root.localStorage.removeItem(STORE_KEY + ':probe'); } catch (e) { memOnly = true; } })();

  var ui = { view: 'home', lessonId: null, draft: null, modal: null, hideFb: null, reportNo: null, filter: '', msg: null, seriesInfo: null };

  function P() { return state.profiles[state.current] || null; }
  function lessonById(id) { return LESSONS.filter(function (l) { return l.lessonId === id; })[0]; }
  function LS(id) { var p = P(); p.lessons = p.lessons || {}; return (p.lessons[id] = p.lessons[id] || { attempts: [], seen: [] }); }
  function curAttempt() {
    if (!P() || !ui.lessonId) return null;
    var a = LS(ui.lessonId).attempts; return a.length ? a[a.length - 1] : null;
  }
  function activeAttempt() { var a = curAttempt(); return a && a.status === 'in_progress' ? a : null; }
  function bandClass(cls) { var n = parseInt(cls, 10); if (!n) return 'age-5-6'; return n <= 2 ? 'age-1-2' : n <= 4 ? 'age-3-4' : n <= 6 ? 'age-5-6' : n <= 9 ? 'age-7-9' : 'age-10-11'; }
  function pctText(x) { return x == null ? '—' : String(x).replace('.', ',') + '%'; }
  function markText(x) { return x == null ? '—' : String(x).replace('.', ',') + ' из 10'; }
  function fmtSec(s) { s = Math.max(0, Math.round(s || 0)); var m = Math.floor(s / 60), r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; }

  // ================= учёт времени =================
  var lastEv = 0;
  function stageStateOf(at, id) { return at.stageState[id] || (at.stageState[id] = { status: 'not_started', activeSec: 0 }); }
  function curStage() { var at = activeAttempt(), L = ui.lessonId && lessonById(ui.lessonId); return at && L ? L.stages[at.stageIdx] : null; }
  function touch() {
    var at = activeAttempt(); if (!at || ui.view !== 'runner') { lastEv = 0; return; }
    var now = Date.now();
    if (lastEv) {
      var gap = (now - lastEv) / 1000, ses = at.sessions[at.sessions.length - 1];
      if (gap <= 120) {
        at.activeSec += gap; if (ses) ses.activeSec += gap;
        var st = curStage(); if (st) stageStateOf(at, st.id).activeSec = (stageStateOf(at, st.id).activeSec || 0) + gap;
      } else if (gap > 1800) { if (ses) ses.endedAt = at.lastActivityAt; at.sessions.push({ startedAt: U.nowIso(), endedAt: null, activeSec: 0, pageId: PAGE_ID }); }
    }
    lastEv = now; at.lastActivityAt = U.nowIso(); saveSoon();
  }
  ['pointerdown', 'keydown', 'input'].forEach(function (ev) { document.addEventListener(ev, touch, true); });
  document.addEventListener('visibilitychange', function () {
    var at = activeAttempt();
    if (document.hidden) { if (at && ui.view === 'runner') { at.pageLeaves = (at.pageLeaves || 0) + 1; } lastEv = 0; save(); }
  });
  root.addEventListener('beforeunload', function () { var at = activeAttempt(); if (at) { var ses = at.sessions[at.sessions.length - 1]; if (ses) ses.endedAt = U.nowIso(); } save(); });
  function ensureSession(at) {
    var ses = at.sessions[at.sessions.length - 1];
    if (!ses || ses.pageId !== PAGE_ID) { if (ses && !ses.endedAt) ses.endedAt = at.lastActivityAt; at.sessions.push({ startedAt: U.nowIso(), endedAt: null, activeSec: 0, pageId: PAGE_ID }); }
  }

  // ================= попытки и задания =================
  function defaultProfile(def, item) { return item.profile || (def.profiles.standard ? 'standard' : Object.keys(def.profiles)[0]); }
  function planStages(L) {
    return L.stages.filter(function (s) { return s.type === 'tasks'; }).map(function (s) {
      var max = 0; s.plan.forEach(function (it) { max += it.count * (K.gen.get(it.gen).maxScore || 1); });
      return { stageId: s.id, group: s.group, mode: s.mode || 'CORE', plannedMax: max };
    });
  }
  function newAttempt(L) {
    var ls = LS(L.lessonId), at = {
      attemptNumber: ls.attempts.length + 1, countsForMark: true, seed: U.randomSeed(), startedAt: U.nowIso(), lastActivityAt: U.nowIso(), fixedAt: null,
      status: 'in_progress', stopReason: null, stageIdx: 0, taskIdx: 0, tasks: [], stagePlan: planStages(L), stageState: {},
      sessions: [{ startedAt: U.nowIso(), endedAt: null, activeSec: 0, pageId: PAGE_ID }], activeSec: 0, loops: [], series: null, reflection: null, pageLeaves: 0, adaptations: [], instruction: null
    };
    ls.attempts.push(at); enterStage(at, L, L.stages[0]); save(); return at;
  }
  function toRecord(t, stage, item, L, id) {
    t.taskId = id; t.stageId = stage.id; t.group = stage.group; t.mode = stage.mode || t.mode || 'CORE';
    t.descriptorIds = item.descriptors || t.descriptorIds || []; t.goalCode = (L.objectives[0] || {}).code || null;
    t.closed = false; t.status = null; t.score = null; t.attempts = []; t.hintsUsed = 0; t.hintLevelsShown = []; t.solutionShown = false; t.skipped = false;
    t.answerChanges = 0; t.openedCount = 0; t.presentedAt = null; t.answeredAt = null; t.responseTimeSec = null; t.errorType = null; t.errorTags = [];
    t.studentAnswer = null; t.normalizedAnswer = null; t.loop = false; t.maxAttempts = stage.maxAttempts || 1; t.hintsAllowed = stage.hints !== false;
    return t;
  }
  function seenSet(at, L) { var s = new Set(LS(L.lessonId).seen); at.tasks.forEach(function (t) { s.add(t.fingerprint); }); return s; }
  function buildStageTasks(at, L, stage) {
    var ctx = { seen: seenSet(at, L) }, made = [];
    stage.plan.forEach(function (item, pi) {
      var def = K.gen.get(item.gen), prof = defaultProfile(def, item);
      for (var i = 0; i < item.count; i++) {
        var t = K.gen.make(item.gen, prof, U.deriveSeed(at.seed, stage.id + ':' + pi + ':' + i), ctx);
        made.push(toRecord(t, stage, item, L, null));
      }
    });
    var rng = U.makeRng(U.deriveSeed(at.seed, stage.id + ':order')), ordered = stage.ordered ? made : rng.shuffle(made);
    ordered.forEach(function (t, i) { t.taskId = L.lessonId + '#' + stage.id + '#' + (i + 1); at.tasks.push(t); });
  }
  function hasIntro(stage) { return stage.type === 'tasks' && (stage.group === 'diagnostic' || stage.group === 'final' || stage.group === 'club'); }
  function enterStage(at, L, stage) {
    var ss = stageStateOf(at, stage.id);
    if (ss.status === 'not_started' || !ss.startedAt) ss.startedAt = U.nowIso();
    if (stage.type === 'tasks' && hasIntro(stage)) { ss.status = 'not_started'; return; }
    ss.status = 'in_progress';
    if (stage.type === 'tasks' && !at.tasks.some(function (t) { return t.stageId === stage.id; })) buildStageTasks(at, L, stage);
  }
  function beginStage(at, L, stage) {
    var ss = stageStateOf(at, stage.id); ss.status = 'in_progress'; ss.startedAt = U.nowIso();
    if (!at.tasks.some(function (t) { return t.stageId === stage.id; })) buildStageTasks(at, L, stage);
    at.taskIdx = 0;
  }
  function stageTasks(at, stage) {
    if (at.series) return at.tasks.filter(function (t) { return t.seriesId === at.series.id; });
    return at.tasks.filter(function (t) { return t.stageId === stage.id && !t.loop; });
  }

  function limitOver(at, L) {
    var lim = L.timeLimitSec && L.timeLimitSec.final, fs = L.stages.filter(function (s) { return s.group === 'final'; })[0];
    return !!(lim && fs && (stageStateOf(at, fs.id).activeSec || 0) > lim);
  }

  /** Фиксирует ответ. Возвращает результат проверки. Общая логика для интерфейса и автопрохождения. */
  function answerTask(at, L, stage, task, answer) {
    var res = K.check(task, answer);
    if (res.status === 'empty') return res;
    var n = task.attempts.length + 1, now = U.nowIso();
    task.studentAnswer = answer; task.normalizedAnswer = res.normalized; task.errorType = res.errorType;
    var coef = S.coefficient(task.hintsUsed, n, task.solutionShown);
    task.attempts.push({ n: n, answer: answer, at: now, status: res.status, fraction: res.fraction, score: U.round2(task.maxScore * res.fraction * coef) });
    var closing = res.status === 'correct' || res.status === 'pending_review' || n >= task.maxAttempts;
    if (closing) {
      task.closed = true; task.status = res.status; task.answeredAt = now;
      task.responseTimeSec = task.presentedAt ? Math.max(0, Math.round((Date.parse(now) - Date.parse(task.presentedAt)) / 1000)) : null;
      task.answeredAfterLimit = stage.timed ? limitOver(at, L) : false;
      S.finalizeScore(task);
      noteLoopOutcome(at, task);
    }
    saveSoon();
    return res;
  }
  function skipTask(at, L, stage, task) {
    var now = U.nowIso();
    task.closed = true; task.skipped = true; task.status = 'incorrect'; task.score = 0; task.answeredAt = now; task.errorType = 'skipped';
    task.responseTimeSec = task.presentedAt ? Math.max(0, Math.round((Date.parse(now) - Date.parse(task.presentedAt)) / 1000)) : null;
    saveSoon();
  }
  function noteLoopOutcome(at, task) {
    (at.loops || []).forEach(function (l) { if (l.route === 'rule_card' && l.outcome === 'pending' && l.subskillId === task.subskillId && l.afterTask !== task.taskId) l.outcome = task.status === 'correct' ? 'improved' : 'no_progress'; });
  }

  // ================= коррекционный цикл (раздел 26) =================
  function weakSubskills(at, L) {
    return (L.subskills || []).filter(function (s) {
      var ts = at.tasks.filter(function (t) { return t.subskillId === s.id && t.mode !== 'CLUB' && t.closed && t.group !== 'diagnostic' && t.status !== 'pending_review'; });
      var bad = ts.some(function (t) { return t.status === 'incorrect' || t.status === 'partial' || t.skipped; });
      var loops = at.loops.filter(function (l) { return l.subskillId === s.id && l.route === 'targeted_series'; }).length;
      return bad && !S.masteryOf(at.tasks.filter(function (t) { return t.subskillId === s.id && t.mode !== 'CLUB'; })).mastered && loops < 2 && seriesGenerator(L, s.id);
    });
  }
  function seriesGenerator(L, sid) {
    for (var i = 0; i < L.stages.length; i++) {
      var st = L.stages[i]; if (st.type !== 'tasks' || st.mode === 'CLUB') continue;
      for (var j = 0; j < st.plan.length; j++) {
        var def = K.gen.get(st.plan[j].gen);
        if (def.subskill === sid && def.taskType !== 'open' && (def.mode || 'CORE') !== 'CLUB') return { item: st.plan[j], def: def };
      }
    }
    return null;
  }
  function startSeries(at, L, stage, weak) {
    var per = Math.max(1, Math.min(3, Math.floor(5 / weak.length))), id = 'series-' + (at.loops.length + 1), ctx = { seen: seenSet(at, L) }, made = 0;
    weak.forEach(function (s, si) {
      var g = seriesGenerator(L, s.id), prof = g.item.profile ? g.item.profile : (g.def.profiles.basic ? 'basic' : defaultProfile(g.def, g.item));
      var errs = {}; at.tasks.forEach(function (t) { if (t.subskillId === s.id && t.errorType) errs[t.errorType] = (errs[t.errorType] || 0) + 1; });
      var et = Object.keys(errs).sort(function (a, b) { return errs[b] - errs[a]; })[0] || null;
      var before = S.masteryOf(at.tasks.filter(function (t) { return t.subskillId === s.id && t.mode !== 'CLUB'; })).windowAvg;
      at.loops.push({ loopId: id + '-' + s.id, subskillId: s.id, errorType: et, route: 'targeted_series', tasksPresented: per, outcome: 'pending', startedAt: U.nowIso(), before: before, seriesId: id });
      for (var i = 0; i < per; i++) {
        var t = K.gen.make(g.item.gen, prof, U.deriveSeed(at.seed, id + ':' + s.id + ':' + i), ctx);
        toRecord(t, stage, g.item, L, L.lessonId + '#' + id + '#' + (++made));
        t.loop = true; t.seriesId = id; t.maxAttempts = 3; t.hintsAllowed = true; at.tasks.push(t);
      }
    });
    at.series = { id: id, subskills: weak.map(function (s) { return s.id; }) }; at.taskIdx = 0;
  }
  function finishSeries(at, L) {
    var info = [];
    at.loops.filter(function (l) { return l.seriesId === at.series.id; }).forEach(function (l) {
      var m = S.masteryOf(at.tasks.filter(function (t) { return t.subskillId === l.subskillId && t.mode !== 'CLUB'; }));
      l.outcome = m.mastered ? 'mastered' : (m.windowAvg > (l.before || 0) ? 'improved' : 'no_progress');
      var done = at.loops.filter(function (x) { return x.subskillId === l.subskillId && x.route === 'targeted_series'; }).length;
      if (!m.mastered && done >= 2) { at.loops.push({ loopId: 'teacher-' + l.subskillId, subskillId: l.subskillId, errorType: l.errorType, route: 'teacher', tasksPresented: 0, outcome: 'referred_to_teacher', startedAt: U.nowIso() }); }
      var sk = (L.subskills || []).filter(function (s) { return s.id === l.subskillId; })[0];
      info.push({ text: sk ? sk.text : l.subskillId, outcome: l.outcome, refer: !m.mastered && done >= 2 });
    });
    ui.seriesInfo = info; at.series = null; at.taskIdx = 0;
  }

  // ================= переходы =================
  function advance() {
    var at = activeAttempt(), L = lessonById(ui.lessonId); if (!at) return;
    var st = L.stages[at.stageIdx], ss = stageStateOf(at, st.id);
    if (ss.status !== 'skipped') ss.status = 'completed'; ss.finishedAt = U.nowIso();
    at.stageIdx++; at.taskIdx = 0; at.series = null; ui.draft = null; ui.hideFb = null;
    var next = L.stages[at.stageIdx];
    if (!next) { completeAttempt(at, L); return; }
    enterStage(at, L, next); save();
  }
  function completeAttempt(at, L) {
    var ses = at.sessions[at.sessions.length - 1]; if (ses) ses.endedAt = U.nowIso();
    at.status = 'completed'; at.fixedAt = U.nowIso(); at.lastActivityAt = at.fixedAt;
    var ls = LS(L.lessonId), seen = new Set(ls.seen); at.tasks.forEach(function (t) { seen.add(t.fingerprint); }); ls.seen = Array.from(seen).slice(-3000);
    ui.view = 'report'; ui.reportNo = at.attemptNumber; save();
  }
  function stopToday() {
    var at = activeAttempt(); if (!at) return;
    var ses = at.sessions[at.sessions.length - 1]; if (ses) ses.endedAt = U.nowIso();
    at.status = 'stopped'; at.stopReason = 'student_stopped'; at.fixedAt = U.nowIso(); save();
    ui.view = 'home'; ui.msg = T('stage.saved');
  }

  // ================= отчёты и выгрузка =================
  function studentInfo() { var p = P(); return { studentId: p.studentId, name: p.name, class: p['class'] }; }
  function reportOf(at, L) { return K.schema.buildLessonReport({ lesson: L, attempt: at, student: studentInfo() }); }
  function allReports(lessonId) {
    var out = [];
    LESSONS.forEach(function (L) { if (lessonId && L.lessonId !== lessonId) return; if (!P().lessons || !P().lessons[L.lessonId]) return; P().lessons[L.lessonId].attempts.forEach(function (at) { out.push(reportOf(at, L)); }); });
    return out;
  }
  function download(name, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  var TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i' };
  function safeName(s) { return Array.from(String(s)).map(function (ch) { var l = ch.toLowerCase(); return TR[l] != null ? TR[l] : ch; }).join('').replace(/[^A-Za-z0-9.\-]+/g, '_'); }
  function exportReport(at, L) {
    var r = reportOf(at, L);
    return K.schema.seal(r).then(function (sealed) {
      download(safeName(P()['class'] + '_' + L.lessonId + '_p' + at.attemptNumber + '_' + sealed.attempt.fixedAt.slice(0, 10)) + '.json', sealed);
      ui.msg = T('report.saved'); render(); return sealed;
    });
  }
  function exportAll() {
    var reps = allReports(); if (!reps.length) return;
    Promise.all(reps.map(K.schema.seal)).then(function (sealed) {
      download(safeName('paket_' + P()['class'] + '_' + U.nowIso().slice(0, 10)) + '.json', K.schema.packageReport(sealed));
      ui.msg = T('report.saved'); render();
    });
  }

  // ================= представления =================
  function lessonStatus(L) {
    var ls = P().lessons && P().lessons[L.lessonId]; if (!ls || !ls.attempts.length) return 0;
    var last = ls.attempts[ls.attempts.length - 1];
    if (last.status === 'completed') return 2; return 1;
  }
  function lessonProgress(L) {
    var ls = P().lessons && P().lessons[L.lessonId]; if (!ls || !ls.attempts.length) return 0;
    var at = ls.attempts[ls.attempts.length - 1]; if (at.status === 'completed') return 100;
    return reportOf(at, L).metrics.completionPct || 0;
  }
  function lessonMarkText(L) {
    var ls = P().lessons && P().lessons[L.lessonId]; if (!ls || !ls.attempts.length) return '';
    var reps = ls.attempts.map(function (a) { return reportOf(a, L); }), sm = S.summarize(reps), r = reps[reps.length - 1];
    if (sm.length) return markText(sm[0].mark10);
    return r.metrics.mark10 != null ? markText(r.metrics.mark10) : '';
  }

  function viewProfile() {
    var ps = Object.keys(state.profiles).map(function (k) { return state.profiles[k]; });
    var h = '<h1>' + esc(PACK.title) + '</h1>';
    if (PACK.notice) h += '<div class="note warn">' + esc(PACK.notice) + '</div>';
    if (ps.length) {
      h += '<div class="card"><h2>' + T('profile.choose') + '</h2><div class="grid">';
      ps.forEach(function (p) { h += '<button class="lesson-card" data-act="selectProfile" data-v="' + esc(p.studentId) + '"><b>' + esc(p.name) + '</b><div class="muted small">' + esc(p['class']) + '</div></button>'; });
      h += '</div></div>';
    }
    h += '<div class="card"><h2>' + T('profile.new') + '</h2><label for="pname">' + T('profile.name') + '</label><input type="text" id="pname" autocomplete="off">' +
      '<label for="pclass">' + T('profile.class') + '</label><input type="text" id="pclass" autocomplete="off" placeholder="6А" maxlength="4">' +
      '<p class="muted small">' + T('profile.hint') + '</p><div id="perr" class="note bad" style="display:none"></div><p><button class="btn" data-act="createProfile">' + T('profile.start') + '</button></p></div>';
    return h;
  }

  function viewHome() {
    var p = P(), n = LESSONS.length, st = LESSONS.map(lessonStatus), done = st.filter(function (x) { return x === 2; }).length, prog = st.filter(function (x) { return x === 1; }).length;
    var total = LESSONS.length ? Math.round(U.sum(LESSONS.map(lessonProgress)) / LESSONS.length) : 0;
    var h = '<div class="row sb"><h1>' + T('home.lessons') + '</h1><div class="small muted">' + esc(p.name) + ' · ' + esc(p['class']) + '</div></div>';
    if (memOnly) h += '<div class="banner">' + T('storage.warn') + '</div>';
    if (ui.msg) { h += '<div class="note ok">' + esc(ui.msg) + '</div>'; ui.msg = null; }
    if (PACK.notice) h += '<div class="note warn small">' + esc(PACK.notice) + '</div>';
    h += '<div class="card"><div class="panel-total"><div><b>' + n + '</b>' + T('home.total') + '</div><div><b>' + done + '</b>' + T('home.done') + '</div><div><b>' + prog + '</b>' + T('home.progress') + '</div><div><b>' + (n - done - prog) + '</b>' + T('home.new') + '</div></div>' +
      '<p class="small muted" style="margin-top:10px">' + T('home.passing') + ': ' + total + '%. ' + T('home.passingNote') + '</p></div>';
    var list = LESSONS;
    if (n > 15) { h += '<input type="search" data-act-input="filter" id="flt" value="' + esc(ui.filter) + '" placeholder="' + T('home.search') + '">'; list = LESSONS.filter(function (L) { return (L.title + ' ' + (L.section || '')).toLowerCase().indexOf(ui.filter.toLowerCase()) >= 0; }); }
    h += '<div class="' + (n > 6 ? 'lesson-list' : 'grid') + '">';
    list.forEach(function (L) {
      var s = lessonStatus(L), sym = ['○', '◐', '✓'][s], pr = lessonProgress(L), mk = lessonMarkText(L);
      h += '<button class="lesson-card" data-act="openLesson" data-v="' + esc(L.lessonId) + '"><div class="small muted">' + (LESSONS.indexOf(L) + 1) + ' · ' + esc(L.subject) + '</div>' +
        '<div><span class="status s' + s + '" aria-hidden="true">' + sym + '</span><b>' + esc(L.title) + '</b></div>' +
        '<div class="small muted">' + T('status.' + s) + (mk ? ' · ' + T('lesson.mark') + ': ' + mk : '') + '</div>' +
        '<div class="bar-track" style="margin-top:8px"><div class="bar-fill" style="width:' + pr + '%"></div></div></button>';
    });
    h += '</div><p class="row" style="margin-top:16px"><button class="btn quiet" data-act="exportAll">' + T('home.saveAll') + '</button><button class="btn ghost" data-act="switchProfile">' + T('home.switch') + '</button></p>';
    return h;
  }

  function viewLesson() {
    var L = lessonById(ui.lessonId), ls = LS(L.lessonId), last = ls.attempts[ls.attempts.length - 1], open = last && last.status !== 'completed';
    var h = '<p><button class="btn ghost" data-act="home">← ' + T('lesson.back') + '</button></p><h1>' + esc(L.title) + '</h1><p class="muted">' + esc(L.subject) + ' · ' + esc(L.assessmentLabel || '') + '</p>';
    h += '<div class="card"><h2>' + T('lesson.objectives') + '</h2><ul>' + L.objectives.concat(L.lessonObjectives || []).map(function (o) { return '<li>' + esc(o.text) + '</li>'; }).join('') + '</ul>';
    h += '<p>' + (open ? '<button class="btn" data-act="continue">' + T('lesson.continue') + '</button>' : '<button class="btn" data-act="start">' + (ls.attempts.length ? T('lesson.newAttempt') : T('lesson.start')) + '</button>') + '</p></div>';
    if (ls.attempts.length) {
      var sm = S.summarize(ls.attempts.map(function (a) { return reportOf(a, L); }));
      h += '<div class="card"><h2>' + T('lesson.attempts') + '</h2>';
      if (sm.length) h += '<div class="note ok small"><b>' + T('report.summary') + ': ' + markText(sm[0].mark10) + '</b> · ' + T('report.summaryRule') + '</div>';
      ls.attempts.forEach(function (a) {
        var r = reportOf(a, L);
        h += '<div class="row sb" style="padding:6px 0;border-top:1px solid var(--line)"><span>' + T('lesson.attempt') + ' ' + a.attemptNumber + ' · ' + T(a.status === 'completed' ? 'status.2' : 'status.1') + ' · ' + markText(r.metrics.mark10) + '</span>' +
          (a.status === 'completed' ? '<button class="btn quiet" data-act="viewReport" data-v="' + a.attemptNumber + '">' + T('lesson.open') + '</button>' : '') + '</div>';
      });
      h += '</div>';
    }
    return h;
  }

  function dotsFor(at, tasks, idx) {
    return '<div class="dots" aria-hidden="true">' + tasks.map(function (t, i) {
      var c = 'dot' + (i === idx ? ' cur' : '') + (t.closed ? ' done' : ''); return '<span class="' + c + '"></span>';
    }).join('') + '</div>';
  }

  function viewRunner() {
    var at = activeAttempt(), L = lessonById(ui.lessonId);
    if (!at) { ui.view = 'lesson'; return viewLesson(); }
    ensureSession(at);
    var stage = L.stages[at.stageIdx], ss = stageStateOf(at, stage.id), body = '';
    var head = '<div class="runner-head"><div class="row sb"><div><b>' + esc(L.title) + '</b><div class="small muted">' + esc(stage.title) + '</div></div>' +
      '<button class="btn quiet" data-act="stopToday">' + T('stage.stopToday') + '</button></div>' + '<div id="timerBox"></div></div>';
    if (ui.modal) body += viewModal(at, L, stage);
    if (stage.type === 'entry') body += viewEntry(L, stage);
    else if (stage.type === 'cards') body += viewCards(at, stage);
    else if (stage.type === 'reflection') body += viewReflection(at, L, stage);
    else if (ss.status === 'not_started') body += viewIntro(L, stage);
    else if (ui.seriesInfo) body += viewSeriesDone();
    else body += viewTask(at, L, stage);
    return head + body;
  }

  function viewEntry(L, stage) {
    return '<div class="card"><h2>' + T('stage.whatICan') + '</h2><ul>' + (stage.can || []).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul><p><button class="btn" data-act="advance">' + T('stage.begin') + '</button></p></div>';
  }
  function viewCards(at, stage) {
    var i = Math.min(at.taskIdx, stage.cards.length - 1), c = stage.cards[i];
    return '<div class="card"><div class="small muted">' + (i + 1) + ' ' + T('stage.of') + ' ' + stage.cards.length + '</div><h2>' + esc(c.title) + '</h2><div>' + c.html + '</div><p class="row">' +
      (i > 0 ? '<button class="btn quiet" data-act="cardPrev">' + T('stage.prev') + '</button>' : '') +
      (i < stage.cards.length - 1 ? '<button class="btn" data-act="cardNext">' + T('stage.next') + '</button>' : '<button class="btn" data-act="advance">' + T('stage.next') + '</button>') + '</p></div>';
  }
  function viewIntro(L, stage) {
    var title = stage.title, info = '', skip = '';
    if (stage.group === 'diagnostic') info = T('stage.diagInfo');
    else if (stage.group === 'final') { title = T('stage.finalTitle'); info = T('stage.finalInfo') + (L.timeLimitSec && L.timeLimitSec.final ? ' ' + T('timer.label') + ': ' + Math.round(L.timeLimitSec.final / 60) + ' мин.' : ''); skip = '<button class="btn quiet" data-act="skipStage">' + T('stage.skipFinal') + '</button>'; }
    else if (stage.group === 'club') { title = T('stage.clubTitle'); info = T('stage.clubInfo'); skip = '<button class="btn quiet" data-act="skipStage">' + T('stage.skipClub') + '</button>'; }
    return '<div class="card"><h2>' + esc(title) + '</h2><p>' + esc(info) + '</p><p class="row"><button class="btn" data-act="beginStage">' + T('stage.begin') + '</button>' + skip + '</p></div>';
  }
  function viewSeriesDone() {
    var h = '<div class="card"><h2>' + T('series.done') + '</h2>';
    ui.seriesInfo.forEach(function (x) { h += '<p><span class="chip ' + (x.outcome === 'mastered' ? 'ok' : x.outcome === 'improved' ? 'warn' : 'bad') + '">' + T(x.outcome === 'mastered' ? 'series.mastered' : x.outcome === 'improved' ? 'series.improved' : 'series.same') + '</span> ' + esc(x.text) + '</p>' + (x.refer ? '<p class="note">' + T('series.refer') + '</p>' : ''); });
    return h + '<p><button class="btn" data-act="seriesContinue">' + T('stage.next') + '</button></p></div>';
  }

  function errorLabel(task) {
    var et = task.errorType, L = PACK.errorLabels || {};
    if (et && L[et]) return L[et];
    var k = 'err.' + et; var s = T(k); return s === k ? T('fb.general') : s;
  }
  function fbFor(task, stage) {
    var last = task.attempts[task.attempts.length - 1]; if (!last) return null;
    if (task.taskType === 'open' || last.status === 'pending_review') return { kind: 'neutral', title: T('task.accepted'), lines: [T('task.openSaved')] };
    var mode = stage.feedback || 'immediate';
    if (mode !== 'immediate') return { kind: 'neutral', title: T('task.accepted'), lines: [] };
    if (last.status === 'correct') {
      var t = task.attempts.length > 1 ? T('fb.rightRetry') : (task.hintsUsed ? T('fb.rightHint') : T('fb.rightClean'));
      return { kind: 'ok', title: T('fb.right') + ' ' + t, lines: [], explain: true };
    }
    var lines = [];
    if (last.status === 'partial') lines.push('<b>' + T('fb.whatRight') + ':</b> ' + T('fb.partOk'));
    lines.push('<b>' + T('fb.whatWrong') + ':</b> ' + esc(errorLabel(task)));
    var left = task.maxAttempts - task.attempts.length;
    lines.push('<b>' + T('fb.tryNext') + ':</b> ' + (left > 0 ? (task.hintsAllowed ? T('fb.general') + ' ' + T('task.hint') + '.' : T('fb.general')) : T('fb.explain') + ' ↓'));
    return { kind: last.status === 'partial' ? 'part' : 'bad', title: last.status === 'partial' ? T('fb.partly') : T('fb.notYet'), lines: lines, explain: left <= 0, html: true };
  }

  function answerWidget(task, locked) {
    var d = ui.draft, dis = locked ? ' disabled' : '', h = '';
    switch (task.taskType) {
      case 'single_choice':
        h = '<div class="opts" role="group">' + task.options.map(function (o) {
          var cls = 'opt' + (d === o.id ? ' sel' : '');
          if (locked && task.rule.correctId === o.id && (task.status === 'correct' || task.attempts.length >= task.maxAttempts) && showKey(task)) cls += ' right';
          return '<button class="' + cls + '" data-act="pick" data-v="' + o.id + '" aria-pressed="' + (d === o.id) + '"' + dis + '>' + esc(o.text) + '</button>';
        }).join('') + '</div>'; break;
      case 'multi_choice':
        d = Array.isArray(d) ? d : [];
        h = '<div class="opts" role="group">' + task.options.map(function (o) { var on = d.indexOf(o.id) >= 0; return '<button class="opt' + (on ? ' sel' : '') + '" data-act="toggle" data-v="' + o.id + '" aria-pressed="' + on + '"' + dis + '>' + (on ? '☑ ' : '☐ ') + esc(o.text) + '</button>'; }).join('') + '</div>'; break;
      case 'ordering':
        d = Array.isArray(d) ? d : task.items.map(function (x) { return x.id; });
        h = '<ul class="ord">' + d.map(function (id, i) { var it = task.items.filter(function (x) { return x.id === id; })[0]; return '<li><span class="t">' + (i + 1) + '. ' + esc(it.text) + '</span><button class="btn quiet" data-act="move" data-v="' + i + ':-1" aria-label="' + T('task.up') + '"' + dis + '>↑</button><button class="btn quiet" data-act="move" data-v="' + i + ':1" aria-label="' + T('task.down') + '"' + dis + '>↓</button></li>'; }).join('') + '</ul>'; break;
      case 'matching':
        d = d && typeof d === 'object' && !Array.isArray(d) ? d : {};
        h = task.left.map(function (l) {
          return '<div class="match-row"><span>' + esc(l.text) + '</span><select data-match="' + l.id + '"' + dis + '><option value="">— ' + T('task.pick') + ' —</option>' + task.right.map(function (r) { return '<option value="' + r.id + '"' + (d[l.id] === r.id ? ' selected' : '') + '>' + esc(r.text) + '</option>'; }).join('') + '</select></div>';
        }).join(''); break;
      case 'open':
        h = '<label for="ans">' + T('task.openLabel') + '</label><textarea id="ans"' + dis + '>' + esc(d || '') + '</textarea>'; break;
      default:
        h = '<input type="text" id="ans" autocomplete="off" autocapitalize="off" inputmode="text" placeholder="' + T('task.placeholder') + '" value="' + esc(d || '') + '"' + dis + '>';
    }
    return h;
  }
  function showKey(task) { return true; }

  function viewTask(at, L, stage) {
    var tasks = stageTasks(at, stage), idx = Math.min(at.taskIdx, tasks.length - 1), task = tasks[idx];
    if (!task) { return '<div class="card"><p><button class="btn" data-act="afterTasks">' + T('stage.next') + '</button></p></div>'; }
    if (!task.presentedAt) { task.presentedAt = U.nowIso(); task.openedCount = 1; saveSoon(); }
    if (ui.draft === null) ui.draft = task.studentAnswer != null && !task.closed ? task.studentAnswer : null;
    var fb = (ui.hideFb === task.taskId) ? null : fbFor(task, stage), locked = task.closed;
    var h = '<div class="card"><div class="row sb"><span class="small muted">' + (at.series ? T('series.title') + ' · ' : '') + (idx + 1) + ' ' + T('stage.of') + ' ' + tasks.length + '</span>' + dotsFor(at, tasks, idx) + '</div>';
    h += '<div class="task-cond">' + task.condition + '</div>';
    for (var i = 0; i < task.hintsUsed; i++) if (task.hints[i]) h += '<div class="hint">💡 ' + esc(task.hints[i]) + '</div>';
    h += answerWidget(task, locked);
    if (fb) {
      h += '<div class="fb ' + fb.kind + '"><h3>' + esc(fb.title) + '</h3>' + fb.lines.map(function (l) { return '<div class="line">' + (fb.html ? l : esc(l)) + '</div>'; }).join('');
      if (fb.explain && task.explanation) h += '<details' + (fb.kind === 'ok' ? '' : ' open') + '><summary>' + T('fb.explain') + '</summary><div>' + task.explanation + '</div></details>';
      if (!task.closed && stage.maxAttempts > 1) h += '<div class="small muted">' + T('task.attemptsLeft') + ': ' + (task.maxAttempts - task.attempts.length) + '</div>';
      h += '</div>';
    }
    h += '<p class="row">';
    if (!locked) {
      var retry = fb && !task.closed && task.attempts.length && ui.hideFb !== task.taskId;
      h += retry ? '<button class="btn" data-act="retry">' + T('task.retry') + '</button>' : '<button class="btn" data-act="check">' + T('task.check') + '</button>';
      if (task.hintsAllowed && task.hintsUsed < Math.min(2, task.hints.length)) h += '<button class="btn quiet" data-act="hint">' + T('task.hint') + '</button>';
      if (task.hintsAllowed && task.attempts.length && !task.solutionShown && task.explanation) h += '<button class="btn quiet" data-act="solution">' + T('task.solution') + '</button>';
      if (retry && stageHasRule(L, task) && task.attempts.length) h += '<button class="btn quiet" data-act="rule">' + T('task.rule') + '</button>';
      h += '<button class="btn ghost" data-act="skip">' + T('task.skip') + '</button>';
    } else {
      if (task.status !== 'correct' && stageHasRule(L, task) && (stage.feedback || 'immediate') === 'immediate' && task.hintsAllowed) h += '<button class="btn quiet" data-act="rule">' + T('task.rule') + '</button>';
      h += '<button class="btn" data-act="nextTask">' + T('task.next') + '</button>';
    }
    h += '</p>';
    if (task.solutionShown && task.explanation && !task.closed) h += '<div class="note"><b>' + T('fb.explain') + ':</b> ' + task.explanation + '</div>';
    if (ui.msg) { h += '<div class="note bad">' + esc(ui.msg) + '</div>'; ui.msg = null; }
    return h + '</div>';
  }
  function stageHasRule(L, task) { var s = (L.subskills || []).filter(function (x) { return x.id === task.subskillId; })[0]; return !!(s && s.ruleCard); }

  function viewModal(at, L, stage) {
    var m = ui.modal, c = '';
    if (m.type === 'rule') { var s = (L.subskills || []).filter(function (x) { return x.id === m.subskillId; })[0]; c = '<h2>' + esc(s.ruleCard.title) + '</h2>' + s.ruleCard.html; }
    if (m.type === 'confirmSolution') c = '<p>' + T('task.confirmSolution') + '</p><p class="row"><button class="btn" data-act="solutionYes">' + T('task.solution') + '</button><button class="btn quiet" data-act="closeModal">' + T('common.close') + '</button></p>';
    if (m.type === 'series') {
      c = '<h2>' + T('series.title') + '</h2><p>' + T('series.text') + '</p><ul>' + m.weak.map(function (s) { return '<li>' + esc(s.text) + '</li>'; }).join('') + '</ul><p class="row"><button class="btn" data-act="seriesYes">' + T('series.start') + '</button><button class="btn quiet" data-act="seriesNo">' + T('series.skip') + '</button></p>';
    }
    return '<div class="modal-back" role="dialog" aria-modal="true"><div class="modal">' + c + (m.type === 'rule' ? '<p><button class="btn" data-act="closeModal">' + T('common.close') + '</button></p>' : '') + '</div></div>';
  }

  function viewReflection(at, L, stage) {
    var n = parseInt(P()['class'], 10) || 6, form = n <= 2 ? 'emoji' : n <= 4 ? 'choice_text' : n <= 9 ? 'scale_comment' : 'text';
    var h = '<div class="card"><h2>' + T('reflect.title') + '</h2><p>' + esc(stage.prompt || '') + '</p>';
    if (form === 'emoji') h += '<p>' + T('reflect.feel') + '</p><div class="emoji-row" id="rf">' + ['😀', '🙂', '🤔'].map(function (e, i) { return '<button class="btn quiet" data-act="rfEmoji" data-v="' + (i + 1) + '" aria-label="' + T('reflect.e' + (i + 1)) + '">' + e + '</button>'; }).join('') + '</div>';
    if (form === 'choice_text') h += '<p>' + T('reflect.feel') + '</p><div class="opts">' + [1, 2, 3].map(function (i) { return '<button class="opt" data-act="rfChoice" data-v="' + i + '" aria-pressed="false">' + T('reflect.e' + i) + '</button>'; }).join('') + '</div><label for="rtext">' + T('reflect.phrase') + '</label><input type="text" id="rtext">';
    if (form === 'scale_comment') h += '<label for="rscale">' + T('reflect.scale') + '</label><select id="rscale">' + [1, 2, 3, 4, 5].map(function (i) { return '<option value="' + i + '">' + i + '</option>'; }).join('') + '</select><label for="rtext">' + T('reflect.comment') + '</label><textarea id="rtext"></textarea>';
    if (form === 'text') h += '<label for="rscale">' + T('reflect.scale') + '</label><select id="rscale">' + [1, 2, 3, 4, 5].map(function (i) { return '<option value="' + i + '">' + i + '</option>'; }).join('') + '</select><label for="rtext">' + T('reflect.comment') + '</label><textarea id="rtext"></textarea>';
    h += '<h3>' + T('reflect.next') + '</h3><div class="opts" id="rnext">' + [1, 2, 3, 4].map(function (i) { return '<button class="opt" data-act="rfNext" data-v="' + i + '" aria-pressed="false">' + T('reflect.n' + i) + '</button>'; }).join('') + '</div>';
    h += '<div id="rerr" class="note bad" style="display:none"></div><p><button class="btn" data-act="finish" data-form="' + form + '">' + T('reflect.finish') + '</button></p></div>';
    return h;
  }

  function levelNames() { return { recognition: 'Узнавание', reproduction: 'Воспроизведение', understanding: 'Понимание', transfer: 'Перенос', investigation: 'Исследование', generalization: 'Обобщение' }; }
  function viewReport() {
    var L = lessonById(ui.lessonId), ls = LS(L.lessonId), at = ls.attempts.filter(function (a) { return a.attemptNumber === ui.reportNo; })[0] || ls.attempts[ls.attempts.length - 1];
    var r = reportOf(at, L), m = r.metrics, sc = r.scoring, sm = S.summarize(ls.attempts.map(function (a) { return reportOf(a, L); }));
    var statusKey = sc.markBasis === 'formative_without_control' ? 'report.byLearning' : 'report.completed';
    var h = '<p><button class="btn ghost" data-act="home">← ' + T('lesson.back') + '</button></p><h1>' + T('report.title') + '</h1>';
    if (ui.msg) { h += '<div class="note ok">' + esc(ui.msg) + '</div>'; ui.msg = null; }
    h += '<div class="card"><h2>' + esc(L.title) + '</h2><p class="muted">' + esc(r.student.name) + ' · ' + esc(r.student['class']) + ' · ' + T('lesson.attempt') + ' ' + at.attemptNumber + '</p><p><span class="chip ok">' + T(statusKey) + '</span></p>';
    h += '<div class="kv"><div><b>' + markText(m.mark10) + '</b>' + T('report.mark') + '</div><div><b>' + pctText(m.completionPct) + '</b>' + T('report.completion') + '</div><div><b>' + pctText(m.accuracyPct) + '</b>' + T('report.accuracy') + '</div><div><b>' + pctText(m.achievementPct) + '</b>' + T('report.achievement') + '</div><div><b>' + pctText(m.independencePct) + '</b>' + T('report.independence') + '</div></div>';
    h += '<p class="small muted">' + T('report.basis.' + sc.markBasis) + '</p>';
    if (sc.scoreCap.applied) h += '<div class="note warn">' + T('report.cap') + '</div>';
    h += '<p class="small muted">' + T('report.active') + ': ' + fmtSec(r.time.activeTimeSec) + ' · ' + T('report.calendar') + ': ' + fmtSec(r.time.elapsedWallTimeSec) + '</p></div>';
    if (sm.length) h += '<div class="card"><h3>' + T('report.summary') + '</h3><p><b>' + markText(sm[0].mark10) + '</b> <span class="muted small">(' + sm[0].bestMark10 + ' / ' + sm[0].lastMark10 + ' — ' + T('report.summaryRule') + ')</span></p></div>';
    if (r.criteriaResults.length) {
      h += '<div class="card"><h3>' + T('report.criteria') + '</h3>';
      r.criteriaResults.forEach(function (c) { h += '<div class="crit">' + esc(c.text) + ': ' + pctText(c.pct) + '<div class="bar-track"><div class="bar-fill" style="width:' + (c.pct || 0) + '%"></div></div></div>'; });
      h += '</div>';
    }
    if (r.strengths.length) h += '<div class="card"><h3>' + T('report.strengths') + '</h3><ul>' + r.strengths.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    if (r.difficulties.length) h += '<div class="card"><h3>' + T('report.difficulties') + '</h3><ul>' + r.difficulties.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><h3>' + T('report.recs') + '</h3><ul>' + r.recommendations.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    var pend = at.tasks.filter(function (t) { return t.status === 'pending_review'; }).length;
    if (pend) h += '<div class="note">' + T('report.pending') + ': ' + pend + '</div>';
    if (r.extensionResult) h += '<div class="card"><h3>' + T('report.club') + '</h3><p>' + T('report.accuracy') + ': ' + pctText(r.extensionResult.accuracyPct) + '</p></div>';
    var finals = at.tasks.filter(function (t) { return t.group === 'final' && t.closed; });
    if (finals.length) {
      h += '<details class="card"><summary>' + T('report.review') + '</summary>' + finals.map(function (t, i) {
        return '<div style="margin:10px 0"><div class="small muted">' + (i + 1) + '</div><div>' + t.condition + '</div><div class="small"><b>' + T('fb.yourAnswer') + ':</b> ' + esc(Array.isArray(t.studentAnswer) ? t.studentAnswer.join(', ') : typeof t.studentAnswer === 'object' && t.studentAnswer ? JSON.stringify(t.studentAnswer) : t.studentAnswer == null ? '—' : t.studentAnswer) + ' · <b>' + T('fb.correctAnswer') + ':</b> ' + esc(Array.isArray(t.expectedAnswer) ? t.expectedAnswer.join(' → ') : t.expectedAnswer) + '</div>' + (t.explanation ? '<div class="small muted">' + t.explanation + '</div>' : '') + '</div>';
      }).join('') + '</details>';
    }
    h += '<p class="row"><button class="btn" data-act="saveReport" data-v="' + at.attemptNumber + '">' + T('report.save') + '</button><button class="btn quiet" data-act="start">' + T('lesson.newAttempt') + '</button></p>';
    return h;
  }

  // ================= самопроверка (#selftest) =================
  function viewSelftest() {
    return '<h1>Самопроверка</h1><p class="muted small">Служебный режим. Для учеников не предназначен.</p><p><button class="btn" data-act="runSelftest">Запустить</button> <button class="btn ghost" data-act="home">Закрыть</button></p><div id="stOut" class="selftest scroll"></div>';
  }
  function runSelftest(n) {
    var out = document.getElementById('stOut'); if (!out) return;
    var rows = [], defs = K.gen.list(), list = [];
    defs.forEach(function (d) { Object.keys(d.profiles).forEach(function (p) { list.push([d, p]); }); });
    out.innerHTML = '<p>Идёт проверка…</p>';
    var i = 0;
    (function step() {
      if (i < list.length) {
        var d = list[i][0], p = list[i][1], st = K.gen.test(d.id, n || 300, { profile: p });
        rows.push('<tr><td>' + esc(d.id) + '</td><td>' + esc(d.version) + '</td><td>' + p + '</td><td>' + st.tried + '</td><td>' + st.accepted + '</td><td>' + st.rejected + '</td><td>' + st.uniqueVariants + '</td><td class="' + (st.verdict.ok ? 'ok' : 'bad') + '">' + (st.verdict.ok ? 'OK' : esc(st.verdict.problems.join('; '))) + '</td></tr>');
        i++; setTimeout(step, 0); return;
      }
      var jarg = Object.keys(I.STR.ru).filter(function (k) { return FORBIDDEN_UI.some(function (w) { return String(I.STR.ru[k]).toLowerCase().indexOf(w) >= 0; }); });
      var storage = !memOnly;
      out.innerHTML = '<table><tr><th>Генератор</th><th>Версия</th><th>Профиль</th><th>Проверено</th><th>Успешно</th><th>Отклонено</th><th>Различимых</th><th>Итог</th></tr>' + rows.join('') + '</table>' +
        '<p>Хранилище браузера: <b class="' + (storage ? 'ok' : 'bad') + '">' + (storage ? 'работает' : 'недоступно') + '</b></p><p>Служебные слова на экранах ученика: <b class="' + (jarg.length ? 'bad' : 'ok') + '">' + (jarg.length ? esc(jarg.join(', ')) : 'нет') + '</b></p><p>Версии: ядро ' + esc(K.PRODUCER.engineVersion) + ', содержание ' + esc(K.PRODUCER.contentVersion) + ', контрольная сумма ' + esc(K.PRODUCER.contentHash) + '</p>';
      out.setAttribute('data-done', '1');
    })();
  }

  // ================= отрисовка и события =================
  function render() {
    var p = P();
    document.documentElement.className = p ? bandClass(p['class']) : '';
    var h;
    if (location.hash === '#selftest') h = viewSelftest();
    else if (!p) h = viewProfile();
    else if (ui.view === 'home') h = viewHome();
    else if (ui.view === 'lesson') h = viewLesson();
    else if (ui.view === 'runner') h = viewRunner();
    else if (ui.view === 'report') h = viewReport();
    else h = viewHome();
    appEl.innerHTML = h;
    var a = document.getElementById('ans'); if (a && a.tagName === 'INPUT') { /* фокус не отнимаем у пользователя */ }
    if (ui.view === 'runner') updateTimer();
    window.scrollTo(0, 0);
  }
  function updateTimer() {
    var box = document.getElementById('timerBox'); if (!box) return;
    var at = activeAttempt(), L = lessonById(ui.lessonId), st = curStage(); if (!at || !st || !st.timed || stageStateOf(at, st.id).status !== 'in_progress') { box.innerHTML = ''; return; }
    var ss = stageStateOf(at, st.id), extra = (lastEv && Date.now() - lastEv <= 120000) ? (Date.now() - lastEv) / 1000 : 0, el = (ss.activeSec || 0) + extra, lim = L.timeLimitSec && L.timeLimitSec.final;
    box.innerHTML = '<div class="small timer muted">' + T('timer.label') + ': ' + fmtSec(el) + (lim ? ' / ' + fmtSec(lim) : '') + '</div>' + (lim && el > lim ? '<div class="note small">' + T('timer.over') + '</div>' : '');
  }
  setInterval(updateTimer, 1000);

  function readDraft(task) {
    var t = task.taskType;
    if (t === 'matching') { var d = {}; appEl.querySelectorAll('select[data-match]').forEach(function (s) { if (s.value) d[s.getAttribute('data-match')] = s.value; }); return Object.keys(d).length ? d : null; }
    if (t === 'single_choice' || t === 'multi_choice' || t === 'ordering') return ui.draft;
    var el = document.getElementById('ans'); return el ? el.value : ui.draft;
  }
  function currentTaskObj() {
    var at = activeAttempt(), L = lessonById(ui.lessonId); if (!at) return null;
    var stage = L.stages[at.stageIdx], tasks = stageTasks(at, stage); return { at: at, L: L, stage: stage, task: tasks[Math.min(at.taskIdx, tasks.length - 1)], tasks: tasks };
  }
  function afterTasks() {
    var c = currentTaskObj();
    if (c.at.series) { finishSeries(c.at, c.L); render(); return; }
    var learningHints = c.stage.group === 'learning' && c.stage.hints !== false && (c.stage.maxAttempts || 1) > 1;
    if (learningHints) { var weak = weakSubskills(c.at, c.L); if (weak.length) { ui.modal = { type: 'series', weak: weak }; render(); return; } }
    advance(); render();
  }

  appEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act'), v = b.getAttribute('data-v'), c;
    switch (act) {
      case 'createProfile': {
        var name = document.getElementById('pname').value.trim(), cls = document.getElementById('pclass').value.trim(), er = document.getElementById('perr');
        if (name.length < 2) { er.style.display = 'block'; er.textContent = T('profile.nameRequired'); return; }
        var n = parseInt(cls, 10); if (!(n >= 1 && n <= 11)) { er.style.display = 'block'; er.textContent = T('profile.classRequired'); return; }
        var id = 'p' + U.hashHex(name + cls + Date.now()).slice(0, 8);
        state.profiles[id] = { studentId: id, name: name, 'class': cls, createdAt: U.nowIso(), lessons: {} }; state.current = id; ui.view = 'home'; save(); render(); return;
      }
      case 'selectProfile': state.current = v; ui.view = 'home'; save(); render(); return;
      case 'switchProfile': state.current = null; ui.view = 'home'; save(); render(); return;
      case 'home': ui.view = 'home'; ui.modal = null; ui.seriesInfo = null; location.hash = ''; render(); return;
      case 'openLesson': ui.lessonId = v; ui.view = 'lesson'; render(); return;
      case 'start': { var L = lessonById(ui.lessonId); newAttempt(L); ui.view = 'runner'; ui.draft = null; ui.seriesInfo = null; lastEv = 0; render(); return; }
      case 'continue': { var a = curAttempt(); if (a) { a.status = 'in_progress'; a.fixedAt = null; ensureSession(a); } ui.view = 'runner'; ui.draft = null; lastEv = 0; save(); render(); return; }
      case 'viewReport': ui.reportNo = +v; ui.view = 'report'; render(); return;
      case 'exportAll': exportAll(); return;
      case 'saveReport': { var L2 = lessonById(ui.lessonId), at2 = LS(L2.lessonId).attempts.filter(function (x) { return x.attemptNumber === +v; })[0]; exportReport(at2, L2); return; }
      case 'stopToday': stopToday(); render(); return;
      case 'advance': advance(); render(); return;
      case 'cardNext': { var at3 = activeAttempt(); at3.taskIdx++; save(); render(); return; }
      case 'cardPrev': { var at4 = activeAttempt(); at4.taskIdx = Math.max(0, at4.taskIdx - 1); save(); render(); return; }
      case 'beginStage': { c = currentTaskObj(); beginStage(c.at, c.L, c.stage); ui.draft = null; save(); render(); return; }
      case 'skipStage': { c = currentTaskObj(); stageStateOf(c.at, c.stage.id).status = 'skipped'; advance(); render(); return; }
      case 'seriesContinue': ui.seriesInfo = null; advance(); render(); return;
      case 'pick': { c = currentTaskObj(); if (ui.draft !== v && ui.draft != null) c.task.answerChanges++; ui.draft = v; render(); return; }
      case 'toggle': { c = currentTaskObj(); var arr = Array.isArray(ui.draft) ? ui.draft.slice() : [], ix = arr.indexOf(v); if (ix >= 0) arr.splice(ix, 1); else arr.push(v); c.task.answerChanges++; ui.draft = arr; render(); return; }
      case 'move': {
        c = currentTaskObj(); var p2 = v.split(':'), i = +p2[0], dlt = +p2[1], arr2 = Array.isArray(ui.draft) ? ui.draft.slice() : c.task.items.map(function (x) { return x.id; });
        if (i + dlt >= 0 && i + dlt < arr2.length) { var t = arr2[i]; arr2[i] = arr2[i + dlt]; arr2[i + dlt] = t; c.task.answerChanges++; } ui.draft = arr2; render(); return;
      }
      case 'check': {
        c = currentTaskObj(); var ans = readDraft(c.task); ui.draft = ans;
        if (c.task.taskType === 'ordering' && !Array.isArray(ans)) ans = c.task.items.map(function (x) { return x.id; });
        var res = answerTask(c.at, c.L, c.stage, c.task, ans);
        if (res.status === 'empty') { ui.msg = T('task.empty'); } else { ui.hideFb = null; }
        render(); return;
      }
      case 'retry': { c = currentTaskObj(); ui.hideFb = c.task.taskId; render(); return; }
      case 'hint': { c = currentTaskObj(); var cur = readDraft(c.task); if (c.task.hintsUsed < Math.min(2, c.task.hints.length)) { c.task.hintLevelsShown.push(c.task.hintsUsed + 1); c.task.hintsUsed++; } ui.draft = cur; saveSoon(); render(); return; }
      case 'solution': ui.modal = { type: 'confirmSolution' }; render(); return;
      case 'solutionYes': { c = currentTaskObj(); c.task.solutionShown = true; ui.modal = null; save(); render(); return; }
      case 'rule': {
        c = currentTaskObj(); ui.modal = { type: 'rule', subskillId: c.task.subskillId };
        if (!c.at.loops.some(function (l) { return l.route === 'rule_card' && l.subskillId === c.task.subskillId && l.outcome === 'pending'; })) c.at.loops.push({ loopId: 'rule-' + (c.at.loops.length + 1), subskillId: c.task.subskillId, errorType: c.task.errorType, route: 'rule_card', tasksPresented: 0, outcome: 'pending', startedAt: U.nowIso(), afterTask: c.task.taskId });
        saveSoon(); render(); return;
      }
      case 'closeModal': ui.modal = null; render(); return;
      case 'skip': { c = currentTaskObj(); skipTask(c.at, c.L, c.stage, c.task); render(); return; }
      case 'nextTask': {
        c = currentTaskObj(); ui.draft = null; ui.hideFb = null;
        if (c.at.taskIdx + 1 >= c.tasks.length) { afterTasks(); return; }
        c.at.taskIdx++; save(); render(); return;
      }
      case 'seriesYes': { c = currentTaskObj(); var weak = ui.modal.weak; ui.modal = null; startSeries(c.at, c.L, c.stage, weak); ui.draft = null; save(); render(); return; }
      case 'seriesNo': ui.modal = null; advance(); render(); return;
      case 'rfEmoji': case 'rfChoice': { appEl.querySelectorAll('[data-act="' + act + '"]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); x.classList.remove('sel'); }); b.setAttribute('aria-pressed', 'true'); b.classList.add('sel'); b.setAttribute('data-picked', '1'); return; }
      case 'rfNext': { appEl.querySelectorAll('[data-act="rfNext"]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); x.classList.remove('sel'); x.removeAttribute('data-picked'); }); b.setAttribute('aria-pressed', 'true'); b.classList.add('sel'); b.setAttribute('data-picked', '1'); return; }
      case 'finish': {
        var form = b.getAttribute('data-form'), pick = appEl.querySelector('[data-act="rfEmoji"][data-picked],[data-act="rfChoice"][data-picked]'), nx = appEl.querySelector('[data-act="rfNext"][data-picked]'), err = document.getElementById('rerr');
        var scale = document.getElementById('rscale'), txt = document.getElementById('rtext');
        if (!nx || ((form === 'emoji' || form === 'choice_text') && !pick)) { err.style.display = 'block'; err.textContent = T('reflect.chooseOne'); return; }
        c = currentTaskObj() || { at: activeAttempt(), L: lessonById(ui.lessonId) };
        c.at.reflection = { form: form, answers: { feel: pick ? +pick.getAttribute('data-v') : null, scale: scale ? +scale.value : null, text: txt ? txt.value : null }, nextStep: +nx.getAttribute('data-v') };
        var st = c.L.stages[c.at.stageIdx]; stageStateOf(c.at, st.id).status = 'completed'; stageStateOf(c.at, st.id).finishedAt = U.nowIso();
        c.at.stageIdx++; completeAttempt(c.at, c.L); render(); return;
      }
      case 'runSelftest': runSelftest(600); return;
    }
  });
  appEl.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'ans') { ui.draft = t.value; }
    if (t.id === 'flt') { ui.filter = t.value; var pos = t.selectionStart; render(); var f = document.getElementById('flt'); if (f) { f.focus(); f.setSelectionRange(pos, pos); } }
  });
  appEl.addEventListener('change', function (e) { if (e.target.hasAttribute('data-match')) { var c = currentTaskObj(); if (c) { c.task.answerChanges++; ui.draft = readDraft(c.task); } } });
  appEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'ans' && e.target.tagName === 'INPUT') { var btn = appEl.querySelector('[data-act="check"],[data-act="retry"]'); if (btn) btn.click(); } });
  root.addEventListener('hashchange', render);

  // ================= отладочный интерфейс (для испытаний) =================
  function autoplay(lessonId, o) {
    o = o || {}; var L = lessonById(lessonId);
    if (!P()) { var id = 'ptest'; state.profiles[id] = { studentId: id, name: o.name || 'Тест Тестов', 'class': o['class'] || '6А', createdAt: U.nowIso(), lessons: {} }; state.current = id; }
    ui.lessonId = lessonId;
    var at = newAttempt(L), rng = U.makeRng(o.seed || 7);
    while (at.stageIdx < L.stages.length) {
      var stage = L.stages[at.stageIdx];
      if (stage.type === 'tasks') {
        if (stage.group === 'club' && o.skipClub !== false) { stageStateOf(at, stage.id).status = 'skipped'; at.stageIdx++; if (L.stages[at.stageIdx]) enterStage(at, L, L.stages[at.stageIdx]); continue; }
        if (stage.group === 'final' && o.skipFinal) { stageStateOf(at, stage.id).status = 'skipped'; at.stageIdx++; if (L.stages[at.stageIdx]) enterStage(at, L, L.stages[at.stageIdx]); continue; }
        beginStage(at, L, stage);
        stageTasks(at, stage).forEach(function (t) {
          t.presentedAt = U.nowIso(); t.openedCount = 1;
          var good = rng.next() < (o.accuracy != null ? o.accuracy : 0.8), n = 0;
          if (t.taskType === 'open') { answerTask(at, L, stage, t, 'Ответ ученика для проверки учителем'); return; }
          while (!t.closed && n++ < 4) {
            var ans = good ? t.correctAnswer : (t.taskType === 'single_choice' ? Object.keys(t.distractorMap)[0] : t.taskType === 'ordering' ? t.rule.order.slice().reverse() : t.taskType === 'multi_choice' ? [] .concat('o99') : t.taskType === 'matching' ? {} : 'неверно');
            if (!good && t.taskType === 'matching') ans = { x: 'y' };
            answerTask(at, L, stage, t, ans);
          }
        });
        if (stage.group === 'final') stageStateOf(at, stage.id).activeSec = o.finalActiveSec != null ? o.finalActiveSec : 60;
        var ss = stageStateOf(at, stage.id); ss.status = 'completed'; ss.finishedAt = U.nowIso();
      } else if (stage.type === 'reflection') {
        at.reflection = { form: 'text', answers: { feel: 2, scale: 4, text: 'автотест' }, nextStep: 2 };
        stageStateOf(at, stage.id).status = 'completed';
      } else { stageStateOf(at, stage.id).status = 'completed'; }
      at.stageIdx++; if (L.stages[at.stageIdx]) enterStage(at, L, L.stages[at.stageIdx]);
    }
    at.activeSec = o.activeSec != null ? o.activeSec : 300;
    completeAttempt(at, L); return reportOf(at, L);
  }

  K.app = {
    state: function () { return state; }, ui: ui, render: render,
    debug: {
      autoplay: autoplay, reset: function () { state = emptyState(); save(); ui.view = 'home'; render(); },
      setFinalLimit: function (id, sec) { var L = lessonById(id); L.timeLimitSec = L.timeLimitSec || {}; L.timeLimitSec.final = sec; render(); },
      report: function () { var at = curAttempt(), L = lessonById(ui.lessonId); return at && L ? reportOf(at, L) : null; },
      setActiveSec: function (stageId, sec) { var at = curAttempt(); if (at) { stageStateOf(at, stageId).activeSec = sec; save(); } },
      lessons: function () { return LESSONS; }, forbiddenUi: FORBIDDEN_UI
    }
  };
  render();
})(typeof window !== 'undefined' ? window : globalThis);
