/* KAP engine · legacy: адаптеры прежних схем (Приложение C).
   Формат определяется по набору ключей, а не по schemaVersion (он совпадает у разных схем).
   Ничего не вычисляется «по догадке»: если показателя нет в источнике, он null. */
(function (root) {
  'use strict';
  var K = root.KAP = root.KAP || {};
  var U = K.util;

  function has(o) { for (var i = 1; i < arguments.length; i++) if (!o || !(arguments[i] in o)) return false; return true; }
  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : (typeof x === 'string' && x.trim() !== '' && isFinite(+x) ? +x : null); }
  function str(x) { return x == null ? null : String(x); }
  function secBetween(a, b) { var x = Date.parse(a), y = Date.parse(b); return (isNaN(x) || isNaN(y)) ? null : Math.max(0, Math.round((y - x) / 1000)); }
  function optList(x) {
    if (Array.isArray(x)) return x.map(function (o) { return o && typeof o === 'object' ? (o.text != null ? o.text : (o.label != null ? o.label : JSON.stringify(o))) : o; });
    if (x && typeof x === 'object') return Object.keys(x).map(function (k) { var v = x[k]; return typeof v === 'object' ? JSON.stringify(v) : String(v); });
    return [];
  }
  function typeOfTask(t) { return ({ single: 'single_choice', 'single-choice': 'single_choice', choice: 'single_choice', mc: 'single_choice', MC: 'single_choice' })[t] || t || 'unknown'; }

  /** Определение формата. Порядок проверок важен (Приложение C.2). */
  function detect(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    if (o.reportType === 'lesson_report') return 'v1';
    if (o.reportType === 'package_report') return 'v1_package';
    if (o.reportType === 'paper_kit') return 'paper_kit';
    if (o.reportType === 'teacher_review') return 'teacher_review';
    if (o.reportType === 'session_snapshot') return 'session_snapshot';
    if (o.type === 'bundle' && Array.isArray(o.reports)) return 'bundle';
    if (o.kind === 'package-report' && Array.isArray(o.lessons)) return 'package_b09';
    if (o.schema === 'edu-trainer-report') return 'F4';
    if (typeof o['схема'] === 'string' && o['схема'].indexOf('сор-результат') === 0) return 'F6';
    if (typeof o['схема'] === 'string' && o['схема'].indexOf('соч-тренажёр') === 0) return 'F7';
    if (o.kind === 'lesson-report' && o.metrics) return 'F5';
    if (has(o, 'accuracyPercent', 'grade10')) return 'F8';
    if (has(o, 'fio', 'klass', 'questions', 'app')) return 'F3';
    if (Array.isArray(o.attempts) && o.attempts[0] && o.attempts[0].attemptId && has(o, 'moduleKind')) return 'F2';
    if (has(o, 'materialVersion', 'programMap') && Array.isArray(o.tasks)) return 'F1';
    if (has(o, 'omr_template', 'works')) return 'omr_db';
    return null;
  }

  function mkTask(o) {
    var st = o.status || 'not_done';
    return {
      taskId: str(o.taskId) || 't' + Math.random().toString(36).slice(2, 8), stage: o.stage || null, mode: o.mode || 'CORE', taskType: typeOfTask(o.taskType), cognitiveLevel: o.cognitiveLevel || null,
      goalCode: o.goalCode || null, subskillId: o.subskillId || null, descriptorIds: o.descriptorIds || [], generator: o.generator || null, variantFingerprint: o.fingerprint || null,
      presentedCondition: o.condition == null ? null : o.condition, presentedOptions: o.options || [], presentedOptionOrder: o.optionOrder || [], correctOptionPosition: null,
      expectedAnswer: o.expected == null ? null : o.expected, evaluationRule: o.rule == null ? null : o.rule, distractorMap: {},
      studentAnswer: o.answer == null ? null : o.answer, normalizedAnswer: o.normalized == null ? null : o.normalized,
      status: st, score: num(o.score), maxScore: num(o.maxScore) == null ? 1 : num(o.maxScore),
      attempts: typeof o.attempts === 'number' ? new Array(o.attempts).fill(0).map(function (_, i) { return { n: i + 1, answer: null, at: null, status: null, score: null }; }) : (o.attempts || []),
      hintsUsed: o.hintsUsed || 0, hintLevelsShown: [], presentedAt: o.presentedAt || null, answeredAt: o.answeredAt || null, responseTimeSec: num(o.responseTimeSec),
      answeredAfterLimit: false, answerChanges: o.answerChanges || 0, openedCount: o.openedCount || 1, errorType: o.errorType || null, errorTags: [],
      autoGraded: st !== 'pending_review', skipped: !!o.skipped, solutionShown: !!o.solutionShown, loop: false, teacherReview: o.teacherReview || null
    };
  }

  function skeleton(fam, o) {
    var P = (K.PRODUCER || {});
    var student = { studentId: o.studentId || null, name: o.name || 'Без имени', 'class': String(o['class'] == null ? '' : o['class']) };
    var startedAt = o.startedAt || null;
    var rid = o.reportId || ('legacy-' + U.hashHex(U.canonical(o.raw || o)));
    var wall = o.wallSec != null ? o.wallSec : (o.startedAt && o.fixedAt ? secBetween(o.startedAt, o.fixedAt) : null);
    var mark = num(o.mark10);
    var basis = o.markBasis || (mark == null ? 'none' : 'formative_without_control');
    return {
      schemaVersion: '1.0', reportType: 'lesson_report', reportId: rid,
      dedupeKey: K.schema.dedupeKey(student, o.lessonId, o.attemptNumber || 1, startedAt),
      source: 'digital', legacy: true, legacyFamily: fam,
      producer: { materialId: o.materialId || null, engineVersion: 'legacy-' + fam, contentVersion: o.contentVersion || 'legacy', contentHash: '' },
      student: student,
      context: { subject: o.subject || null, language: 'ru', section: o.section || null, series: null, lessonId: o.lessonId || 'unknown', moduleId: o.moduleId || o.lessonId || 'unknown', lessonTitle: o.title || null,
        assessmentType: o.assessmentType || 'formative', assessmentLabel: o.assessmentLabel || null, checkKind: 'learning' },
      objectives: { learningObjectives: o.objectives || [], lessonObjectives: [] },
      attempt: { attemptNumber: o.attemptNumber || 1, countsForMark: o.countsForMark !== false, startedAt: startedAt, lastActivityAt: o.lastActivityAt || o.fixedAt || null, fixedAt: o.fixedAt || null, completionReason: o.completionReason || 'completed' },
      time: { timeLimitSec: num(o.timeLimitSec), elapsedWallTimeSec: wall, activeTimeSec: num(o.activeSec), activeTimeMethod: 'unknown_legacy', sessions: [], timeExceeded: !!o.timeExceeded, overtimeSec: o.overtimeSec || 0, pageLeaves: o.pageLeaves || 0 },
      scoring: { weightsSource: 'legacy', weightsProfile: 'legacy', weights: o.weights || null, coefficients: o.coefficients || null, markBasis: basis, scoreCap: { applied: false, capPct: 84, reason: null, uncappedAchievementPct: null, uncappedMark10: null } },
      metrics: { completionPct: num(o.completionPct), accuracyPct: num(o.accuracyPct), achievementPct: num(o.achievementPct), independencePct: null, diagnosticPct: num(o.diagnosticPct), finalPct: num(o.finalPct),
        deltaDiagnosticToFinal: null, skillsCoveragePct: null, descriptorCoveragePct: null, levelsProfile: null, mark10: mark, formativeMark10: null, metricSources: { mark10: 'legacy_import' } },
      coreResult: { completionPct: num(o.completionPct), accuracyPct: num(o.accuracyPct), achievementPct: num(o.achievementPct), mark10: mark }, extensionResult: o.extensionResult || null,
      criteriaResults: o.criteriaResults || [], descriptorResults: o.descriptorResults || [], subskills: o.subskills || [], correctionLoops: [], toReview: o.toReview || [],
      stages: o.stages || [], tasks: o.tasks || [], retrievalResults: [], reflection: o.reflection || null,
      strengths: o.strengths || [], difficulties: o.difficulties || [], recommendations: o.recommendations || [], accessibilityAdaptationsUsed: o.adaptations || [],
      paper: null, integrity: { reportHash: null, algorithm: null, warnings: (o.warnings || []).concat(['Импорт из прежней схемы ' + fam + ': показатели взяты из файла как есть']) },
      legacyRaw: o.raw
    };
  }

  function statusFromScore(score, max, pend) {
    if (pend) return 'pending_review'; if (score == null || max == null) return 'not_done';
    return score >= max - 1e-9 ? 'correct' : (score > 0 ? 'partial' : 'incorrect');
  }
  function groupOfStage(t) { t = String(t || '').toLowerCase(); return t.indexOf('diag') >= 0 ? 'diagnostic' : (t === 'final' || t === 'control') ? 'final' : 'learning'; }

  // ---------- F1: Б02, Б08 ----------
  function f1(o) {
    var stg = {}; (o.stages || []).forEach(function (s) { stg[s.stageId] = s; });
    var mapSt = { correct: 'correct', partial: 'partial', incorrect: 'incorrect', saved: 'pending_review', submitted: 'pending_review' };
    var tasks = (o.tasks || []).map(function (t) {
      return mkTask({ taskId: t.taskId, stage: t.stageId, taskType: t.taskType, subskillId: t.subskill, condition: t.presentedCondition, options: optList(t.presentedOptions), optionOrder: [], expected: t.expectedAnswer, rule: t.evaluationRule,
        answer: t.studentAnswer, normalized: t.normalizedAnswer, status: mapSt[t.status] || 'not_done', score: t.score, maxScore: t.maxScore, attempts: t.attempts, hintsUsed: t.hintsUsed, presentedAt: t.presentedAt, answeredAt: t.answeredAt, responseTimeSec: t.responseTime,
        errorType: t.errorType, descriptorIds: t.descriptors, solutionShown: t.revealed, generator: t.generatorId ? { generatorId: t.generatorId, generatorVersion: String(t.generatorVersion), profile: null, seed: t.seed, parameters: t.generationParameters || {} } : null });
    });
    var hasCtl = (o.stages || []).some(function (s) { return s.control && s.itemsDone > 0; });
    var at = Array.isArray(o.assessmentType) ? o.assessmentType[0] : o.assessmentType;
    return skeleton('F1', { raw: o, name: typeof o.student === 'string' ? o.student : (o.student && (o.student.name || o.student.fio)), studentId: o.studentId, 'class': o['class'], subject: o.subject, section: o.section, lessonId: o.lessonId, moduleId: o.moduleId, title: o.lessonTitle,
      materialId: o.materialId, contentVersion: o.materialVersion, assessmentType: at || 'formative', attemptNumber: o.attemptNumber, startedAt: o.startedAt, lastActivityAt: o.lastActivityAt, fixedAt: o.fixedAt,
      completionReason: o.completionReason === 'completed' ? 'completed' : 'student_stopped', activeSec: num(o.duration), timeLimitSec: o.timeLimit, completionPct: o.completionPct, accuracyPct: o.accuracyPct, achievementPct: o.achievementPct, mark10: o.mark10,
      markBasis: num(o.mark10) == null ? 'none' : (hasCtl ? 'with_control' : 'formative_without_control'), tasks: tasks, objectives: (o.learningObjectives || []).map(function (c) { return { code: String(c), text: String(c) }; }),
      stages: (o.stages || []).map(function (s) { return { stageId: s.stageId, name: s.title, group: groupOfStage(s.type), mode: 'digital', status: s.itemsDone >= s.itemsTotal ? 'completed' : 'in_progress', startedAt: null, finishedAt: null, earned: null, max: null, activeSec: null }; }),
      strengths: o.strengths, difficulties: o.difficulties, recommendations: o.recommendations, reflection: o.reflection, adaptations: o.accessibilityAdaptationsUsed, warnings: (String(o['class']) !== String(o.grade) && o.grade != null) ? ['class и grade расходятся: ' + o['class'] + ' / ' + o.grade] : [] });
  }

  // ---------- F2: Б05-Б (каждая попытка — отдельный отчёт) ----------
  function f2(o) {
    var typeMap = { 'СОР': 'SOR', 'СОЧ': 'SOCH' };
    return (o.attempts || []).map(function (a) {
      var tasks = (a.tasks || []).map(function (t) {
        return mkTask({ taskId: t.taskId, stage: t.stage, taskType: t.taskType, goalCode: t.objective, condition: t.presentedCondition, options: optList(t.presentedOptions), expected: t.expectedAnswer, rule: t.evaluationRule,
          answer: t.studentAnswer, normalized: t.normalizedAnswer, status: ({ correct: 'correct', partial: 'partial', incorrect: 'incorrect' })[t.status] || 'not_done', score: t.score, maxScore: t.maxScore, attempts: typeof t.attempts === 'number' ? t.attempts : (t.attempts || []), hintsUsed: t.hintsUsed,
          presentedAt: t.presentedAt, answeredAt: t.answeredAt, responseTimeSec: t.responseTime, errorType: t.errorType, generator: { generatorId: t.generatorId, generatorVersion: String(t.generatorVersion), profile: null, seed: t.seed, parameters: {} } });
      });
      var ctl = (o.moduleKind === 'СОР' || o.moduleKind === 'СОЧ') && a.kind !== 'training';
      return skeleton('F2', { raw: a, reportId: a.attemptId ? 'legacy-' + o.materialId + '-' + a.attemptId : null, name: o.student && o.student.name, studentId: o.student && o.student.id, 'class': o.student && o.student['class'], subject: o.subject, section: o.section, lessonId: o.lessonId, moduleId: o.moduleId,
        title: o.materialTitle, materialId: o.materialId, contentVersion: o.appVersion, assessmentType: typeMap[o.moduleKind] || o.assessmentType || 'formative', assessmentLabel: o.moduleKind, attemptNumber: a.attemptNumber, countsForMark: a.countsForMark, startedAt: a.startedAt, lastActivityAt: a.lastActivityAt, fixedAt: a.fixedAt || o.exportedAt,
        completionReason: a.completionReason === 'completed' ? 'completed' : 'student_stopped', activeSec: num(a.duration), timeLimitSec: a.timeLimit, completionPct: a.completionPct, accuracyPct: a.accuracyPct, achievementPct: a.achievementPct, mark10: a.mark10,
        markBasis: num(a.mark10) == null ? 'none' : (ctl ? 'control_work' : 'formative_without_control'), tasks: tasks, reflection: a.reflection, adaptations: a.accessibilityAdaptationsUsed, warnings: a.status !== 'completed' ? ['Попытка не завершена'] : [] });
    });
  }

  // ---------- F3: Б06 (старое тестовое приложение) ----------
  function f3(o) {
    var tasks = (o.questions || []).map(function (q) {
      var ok = q.result === 'ok' || q.result === 'correct' || q.result === 'right', bad = q.result === 'wrong';
      return mkTask({ taskId: 'q' + q.n, taskType: 'number', condition: q.text, expected: q.correct_answer, answer: q.final_answer, status: ok ? 'correct' : (bad ? 'incorrect' : 'not_done'), score: ok ? 1 : (bad ? 0 : null), maxScore: 1,
        attempts: (q.attempts || []).map(function (a, i) { return { n: i + 1, answer: a.v, at: null, status: a.ok ? 'correct' : 'incorrect', score: a.ok ? 1 : 0 }; }), hintsUsed: q.hints_shown, responseTimeSec: (q.attempts && q.attempts.length) ? q.attempts[q.attempts.length - 1].t_sec : null });
    });
    var r = skeleton('F3', { raw: o, name: o.fio, 'class': o.klass, subject: 'Информатика', lessonId: o.app, moduleId: o.app, title: o.topic, materialId: o.app, contentVersion: String(o.version), objectives: o.goal ? [{ code: o.goal, text: o.goal }] : [],
      startedAt: o.date, fixedAt: o.date, completionReason: 'completed', activeSec: num(o.time_spent_sec), timeLimitSec: o.time_limit_sec, completionPct: tasks.length ? 100 : 0, accuracyPct: o.percent, mark10: null, markBasis: 'none', tasks: tasks, warnings: ['Формат старого тестового приложения: поле mark сохранено как legacyMark, не как mark10'] });
    r.legacyMark = o.mark; return r;
  }

  // ---------- F4: Б07-А ----------
  function f4(o) {
    var s = o.summary || {}, at = o.attempt || {}, mod = o.module || {}, tr = o.trainer || {};
    var tasks = (o.items || []).map(function (i) {
      var pend = i.needsTeacherReview; var st = pend ? 'pending_review' : (({ correct: 'correct', partial: 'partial', incorrect: 'incorrect' })[i.verdict] || 'not_done');
      return mkTask({ taskId: i.itemId, stage: i.stageId, taskType: i.type, subskillId: (i.subskills || [])[0], condition: i.prompt, expected: i.correctAnswer, answer: i.studentAnswer, normalized: i.normalizedAnswer, status: st, score: i.score, maxScore: i.maxScore,
        attempts: i.attempts, hintsUsed: i.hintsUsed, solutionShown: i.solutionShown, responseTimeSec: i.timeSec, presentedAt: i.presentedAt, answeredAt: i.answeredAt, errorType: (i.errorTypes || [])[0], skipped: i.status === 'skipped' });
    });
    var stg = []; Object.keys(o.stages || {}).forEach(function (k) { var x = o.stages[k]; if (!x) return; stg.push({ stageId: x.stageId || k, name: x.title || k, group: groupOfStage(k === 'learning' || k === 'practice' ? 'learning' : k), mode: 'digital', status: x.completed ? 'completed' : 'in_progress', startedAt: x.startedAt || null, finishedAt: x.endedAt || null, earned: num(x.earned), max: num(x.max), activeSec: null }); });
    var subs = (o.subskills || []).map(function (x) { return typeof x === 'object' ? x : { subskillId: String(x), text: String(x) }; });
    return skeleton('F4', { raw: o, reportId: o.reportId, name: o.student && o.student.name, 'class': o.student && o.student['class'], subject: tr.subject, section: mod.section, lessonId: (tr.id || 'f4') + ':' + (mod.id || mod.number), moduleId: mod.id, title: mod.topic, materialId: tr.id, contentVersion: tr.version,
      objectives: mod.goalCode ? [{ code: mod.goalCode, text: mod.goalText || mod.goalCode }] : [], attemptNumber: at.number, startedAt: at.startedAt, lastActivityAt: at.lastActionAt, fixedAt: at.committedAt || o.generatedAt, completionReason: at.endReason === 'completed' ? 'completed' : (at.endReason === 'time_expired' ? 'time_expired' : 'student_stopped'),
      activeSec: num(at.durationSec), wallSec: num(at.wallClockSec), timeLimitSec: at.timeLimitSec, completionPct: s.completionPct, accuracyPct: s.accuracyPct, achievementPct: s.achievementPct, mark10: s.score10, diagnosticPct: s.diagnosticPct, finalPct: s.finalPct,
      markBasis: num(s.score10) == null ? 'none' : (s.finalPct != null ? 'with_control' : 'formative_without_control'), tasks: tasks, stages: stg, subskills: [], strengths: o.strengths, recommendations: o.recommendations, reflection: o.reflection,
      weights: o.scoring && o.scoring.stageWeights ? o.scoring.stageWeights : null, coefficients: o.scoring ? { hint: o.scoring.hintCoefficients, attempt: o.scoring.attemptCoefficients, solutionCap: o.scoring.solutionCoefficient, source: 'legacy' } : null,
      toReview: (o.toReviewIds || []).map(function (id) { return { taskId: id, subskillId: null, reason: 'legacy' }; }), warnings: s.achievementIsPreliminary ? ['Достижение предварительное'] : [] });
  }

  // ---------- F5: Б09, урок серии ----------
  function f5(o) {
    var m = o.metrics || {}, a = o.attempt || {}, les = o.lesson || {}, pk = o.package || {};
    var tasks = (o.tasks || []).map(function (t) {
      var pend = (t.openAnswers || []).length > 0 && !t.closed; var st = !t.closed ? 'not_done' : (pend ? 'pending_review' : (t.correct ? 'correct' : ((t.evaluation && t.evaluation.raw > 0) ? 'partial' : 'incorrect')));
      return mkTask({ taskId: t.taskId, stage: t.stageId, taskType: t.category, subskillId: t.subskill, condition: t.presentedCondition && t.presentedCondition.text, options: (t.presentedCondition && t.presentedCondition.options) || [], expected: t.expectedAnswer, answer: t.studentAnswer,
        status: st, score: t.evaluation ? t.evaluation.bestRaw : null, maxScore: 1, attempts: (t.attemptsHistory || []).map(function (h, i) { return { n: i + 1, answer: null, at: null, status: h.full ? 'correct' : 'incorrect', score: h.raw }; }), hintsUsed: t.hintsUsed, solutionShown: t.answerShown,
        presentedAt: t.openedAt, answeredAt: t.closedAt, responseTimeSec: t.spentSec, errorType: (t.errorTypes || [])[0], mode: /club|клуб/i.test(String(t.category)) ? 'CLUB' : 'CORE', generator: t.generator ? { generatorId: t.generator.id, generatorVersion: String(t.generator.version), profile: null, seed: t.seed, parameters: t.generationParameters || {} } : null });
    });
    var crit = [], desc = []; (o.criteria || []).forEach(function (c) { crit.push({ criterionId: c.id, text: c.text, earned: null, max: null, pct: null }); (c.descriptors || []).forEach(function (d) { var p = d.masteryPct; desc.push({ descriptorId: d.id, criterionId: c.id, text: d.text, earned: null, max: null, status: p == null ? 'not_shown' : (p >= 80 ? 'achieved' : (p >= 40 ? 'partially' : 'not_yet')) }); }); });
    return skeleton('F5', { raw: o, reportId: o.reportId, name: o.student && o.student.fio, 'class': o.student && o.student['class'], subject: pk.subject, section: pk.section, lessonId: les.lessonId, moduleId: les.moduleId, title: les.title, materialId: pk.packageId, contentVersion: pk.version,
      objectives: (les.learningObjectives || []).map(function (c) { return { code: String(c), text: String(c) }; }), attemptNumber: a.number, startedAt: a.startedAt, lastActivityAt: a.updatedAt, fixedAt: a.finishedAt || o.createdAt, completionReason: a.status === 'completed' ? 'completed' : 'student_stopped',
      activeSec: num(a.activeSeconds), completionPct: m.completionPct, accuracyPct: m.accuracyPct, achievementPct: m.achievementPct, mark10: m.mark10, markBasis: num(m.mark10) == null ? 'none' : 'formative_without_control', tasks: tasks, criteriaResults: crit, descriptorResults: desc,
      extensionResult: m.club ? { completionPct: m.club.tasksTotal ? Math.round(100 * m.club.tasksClosed / m.club.tasksTotal) : null, accuracyPct: null, achievementPct: m.club.achievementPct == null ? null : m.club.achievementPct, mark10: null } : null,
      reflection: (o.reflections && Object.keys(o.reflections).length) ? o.reflections : null, warnings: m.markProvisional ? ['Отметка предварительная (есть ответы для проверки учителем)'] : [] });
  }

  // ---------- F6/F7: Б09 СОР и СОЧ (русскоязычные ключи) ----------
  function f67(o, fam) {
    var ta = (o['задания'] || []).map(function (t, i) {
      var ds = t['дескрипторы'] || [], e = 0, m = 0, pend = false; ds.forEach(function (d) { m += d['макс'] || 0; e += d['итог'] || 0; if (d['требует_проверки']) pend = true; });
      return mkTask({ taskId: 'z' + (t['номер'] != null ? t['номер'] : i + 1), stage: 'work', taskType: t['форма'], goalCode: t['цель_обучения'], cognitiveLevel: null, subskillId: t['критерий'], answer: t['ответ_текстом'] || t['ответ'], status: statusFromScore(e, m, pend), score: pend ? null : e, maxScore: m || 1,
        responseTimeSec: t['время_сек'], answerChanges: t['изменений_ответа'], openedCount: t['открывалось_раз'], descriptorIds: ds.map(function (d) { return d.id; }) });
    });
    var it = o['итог'] || {}, who = o['учащийся'] || {}, expired = o['завершено'] === 'таймер';
    var r = skeleton(fam, { raw: o, name: who['ФИО'], 'class': who['класс'], subject: o['предмет'], section: o['раздел'] || (o['четверть'] != null ? 'Четверть ' + o['четверть'] : null), lessonId: o['сор_id'] || o['соч_id'], title: o['сор_id'] || o['соч_id'], materialId: o['сор_id'] || o['соч_id'],
      assessmentType: fam === 'F6' ? 'SOR' : 'SOCH', assessmentLabel: fam === 'F6' ? 'СОР' : 'СОЧ (тренажёр)', startedAt: o['начало'], fixedAt: o['окончание'], completionReason: expired ? 'time_expired' : 'completed', wallSec: secBetween(o['начало'], o['окончание']), activeSec: num(o['длительность_сек']),
      timeLimitSec: o['лимит_мин'] ? o['лимит_мин'] * 60 : null, pageLeaves: o['уходы_со_страницы'], accuracyPct: it['процент'], completionPct: ta.length ? 100 : 0, mark10: null, markBasis: 'none', tasks: ta,
      warnings: [it['примечание'] || (fam === 'F6' ? 'Отметка /10 в источнике не указана' : 'Тренажёр: не официальная отметка')].concat(it['ожидают_проверки_учителем'] ? ['Ожидают проверки учителем: ' + it['ожидают_проверки_учителем']] : []) });
    var crit = o['по_критериям'] || {}; r.criteriaResults = Object.keys(crit).map(function (k) { return { criterionId: k, text: k, earned: crit[k].ball, max: crit[k].max, pct: crit[k].procent }; });
    r.legacyScore = { balls: it['балл'], max: it['макс'], level: it['уровень'] };
    return r;
  }

  // ---------- F8: Б11 ----------
  function f8(o) {
    var tasks = (o.tasks || []).map(function (t) {
      var credit = num(t.credit); var st = t.correct ? 'correct' : (credit > 0 ? 'partial' : 'incorrect');
      return mkTask({ taskId: t.questionId, stage: t.stage, taskType: 'expression', subskillId: t.skill, cognitiveLevel: null, condition: t.prompt, expected: t.correctAnswer, answer: t.studentAnswer, status: st, score: t.correct ? 1 : (credit > 0 ? credit / 100 : 0), maxScore: 1, attempts: t.attempts, hintsUsed: t.hints, solutionShown: t.viewedSolution, responseTimeSec: t.timeSec, errorType: t.error });
    });
    var sr = o.stageResults || {};
    var subs = o.subskills ? Object.keys(o.subskills).map(function (k) { var x = o.subskills[k]; return { subskillId: k, text: k, presented: x.done, correct: x.correct, pct: x.percent, hintsUsed: 0, mastery: { mastered: x.percent >= 80, windowSize: 5, windowAvg: null, tasksInWindow: x.done } }; }) : [];
    return skeleton('F8', { raw: o, reportId: o.reportId, name: o.studentName, studentId: o.studentId, 'class': o.className, subject: 'Математика', lessonId: 'derivative-' + o.lessonNumber, moduleId: 'derivative-' + o.lessonNumber, title: o.lessonTitle, materialId: 'derivative-trainer-11', contentVersion: o.appVersion,
      objectives: o.goalCode ? [{ code: o.goalCode, text: o.goalText || o.goalCode }] : [], attemptNumber: o.attemptNumber, startedAt: o.startedAt, lastActivityAt: o.lastActionAt, fixedAt: o.fixedAt, completionReason: o.status === 'Завершён' ? 'completed' : 'student_stopped',
      wallSec: num(o.timeSeconds), completionPct: o.completionPercent, accuracyPct: o.accuracyPercent, achievementPct: o.achievedPercent, mark10: o.grade10, diagnosticPct: sr.diagnostic, finalPct: sr.final, markBasis: num(o.grade10) == null ? 'none' : (sr.final != null ? 'with_control' : 'formative_without_control'),
      tasks: tasks, subskills: subs, warnings: ['timeSeconds в источнике — календарный интервал, активное время неизвестно'] });
  }

  var FAMILIES = { F1: f1, F2: f2, F3: f3, F4: f4, F5: f5, F8: f8 };

  /** Приводит файл к списку lesson_report. Возвращает { family, reports, notes, extra }. */
  function toReports(o) {
    var fam = detect(o), notes = [], reports = [], extra = null;
    try {
      if (fam === 'v1') reports = [o];
      else if (fam === 'v1_package' || fam === 'bundle') { fam = fam === 'bundle' ? 'bundle' : 'v1_package'; (o.reports || []).forEach(function (r) { var sub = toReports(r); reports = reports.concat(sub.reports); notes = notes.concat(sub.notes); }); }
      else if (fam === 'package_b09') (o.lessons || []).forEach(function (r) { var sub = toReports(r); reports = reports.concat(sub.reports); });
      else if (fam === 'F6' || fam === 'F7') reports = [f67(o, fam)];
      else if (FAMILIES[fam]) { var out = FAMILIES[fam](o); reports = Array.isArray(out) ? out : [out]; }
      else if (fam === 'omr_db' || fam === 'paper_kit' || fam === 'teacher_review' || fam === 'session_snapshot') { extra = o; notes.push('Это не отчёт ученика: ' + fam); }
      else notes.push('Формат не распознан');
    } catch (e) { notes.push('Ошибка разбора (' + fam + '): ' + (e && e.message)); reports = []; }
    return { family: fam, reports: reports, notes: notes, extra: extra };
  }

  K.legacy = { detect: detect, toReports: toReports };
})(typeof window !== 'undefined' ? window : globalThis);
