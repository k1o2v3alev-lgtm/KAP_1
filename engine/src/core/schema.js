/* KAP engine · schema: построение lesson_report v1.0 (Приложение A), проверка, дубликаты, пакет. */
(function (root) {
  'use strict';
  var K = root.KAP = root.KAP || {};
  var U = K.util, S = K.scoring;
  var SCHEMA_VERSION = '1.0';

  function producer() { return K.PRODUCER || { materialId: 'unknown', engineVersion: '0.0.0', contentVersion: '0.0.0', contentHash: '' }; }
  function nameNorm(s) { return K.norm.normText(s || '', 'default'); }
  function dedupeKey(student, lessonId, attemptNumber, startedAt) {
    return [nameNorm(student.class), nameNorm(student.name), lessonId, attemptNumber, startedAt].join('|');
  }
  function sec(a, b) { var x = Date.parse(a), y = Date.parse(b); return (isNaN(x) || isNaN(y)) ? null : Math.max(0, Math.round((y - x) / 1000)); }

  /** Запись задания для отчёта (только то, что нужно учителю; без служебных полей интерфейса). */
  function taskForReport(t) {
    return {
      taskId: t.taskId, stage: t.stageId, mode: t.mode || 'CORE', taskType: t.taskType, cognitiveLevel: t.cognitiveLevel,
      goalCode: t.goalCode || null, subskillId: t.subskillId || null, descriptorIds: t.descriptorIds || [],
      generator: t.generator, variantFingerprint: t.fingerprint,
      presentedCondition: t.condition,
      presentedOptions: t.options ? t.options.map(function (o) { return o.text; }) : (t.items ? t.items.map(function (o) { return o.text; }) : []),
      presentedOptionOrder: t.optionOrder || [],
      correctOptionPosition: t.correctOptionPosition != null ? t.correctOptionPosition : null,
      expectedAnswer: t.expectedAnswer, evaluationRule: t.rule, distractorMap: t.distractorMap || {},
      studentAnswer: t.studentAnswer == null ? null : t.studentAnswer, normalizedAnswer: t.normalizedAnswer == null ? null : t.normalizedAnswer,
      status: t.closed ? (t.skipped ? 'not_done' : t.status) : 'not_done',
      score: t.score == null ? null : t.score, maxScore: t.maxScore,
      attempts: (t.attempts || []).map(function (a) { return { n: a.n, answer: a.answer, at: a.at, status: a.status, score: a.score }; }),
      hintsUsed: t.hintsUsed || 0, hintLevelsShown: t.hintLevelsShown || [],
      presentedAt: t.presentedAt || null, answeredAt: t.answeredAt || null, responseTimeSec: t.responseTimeSec == null ? null : t.responseTimeSec,
      answeredAfterLimit: !!t.answeredAfterLimit, answerChanges: t.answerChanges || 0, openedCount: t.openedCount || 1,
      errorType: t.errorType || null, errorTags: t.errorTags || [], autoGraded: t.status !== 'pending_review',
      skipped: !!t.skipped, solutionShown: !!t.solutionShown, loop: !!t.loop, teacherReview: t.teacherReview || null
    };
  }

  /** attempt → lesson_report (без поля integrity.reportHash; оно ставится при экспорте). */
  function buildLessonReport(o) {
    var lesson = o.lesson, at = o.attempt, st = o.student, P = producer(), now = o.now || U.nowIso();
    var limit = lesson.timeLimitSec && lesson.timeLimitSec.final ? lesson.timeLimitSec.final : null;
    var finalStage = (lesson.stages || []).filter(function (sg) { return sg.group === 'final'; })[0];
    var finalState = (finalStage && at.stageState && at.stageState[finalStage.id]) || {};
    var c = S.computeMetrics({ tasks: at.tasks, stagePlan: at.stagePlan, lesson: lesson, instruction: at.instruction || null, finalTime: { limitSec: limit, activeSec: finalState.activeSec || 0 } });
    var fixedAt = at.fixedAt || now;
    var loops = (at.loops || []).map(function (l) { return { loopId: l.loopId, subskillId: l.subskillId, errorType: l.errorType || null, route: l.route, tasksPresented: l.tasksPresented || 0, outcome: l.outcome === 'pending' ? 'no_progress' : l.outcome, startedAt: l.startedAt }; });
    var stages = (lesson.stages || []).map(function (sg) {
      var ss = (at.stageState && at.stageState[sg.id]) || {}, ts = at.tasks.filter(function (t) { return t.stageId === sg.id && !t.loop; });
      var ev = ts.filter(S.evaluated);
      return {
        stageId: sg.id, name: sg.title, group: sg.group || (sg.type === 'reflection' ? 'reflection' : 'learning'),
        mode: sg.deliveryMode || 'digital', status: ss.status || 'not_started', startedAt: ss.startedAt || null, finishedAt: ss.finishedAt || null,
        earned: U.round2(U.sum(ev.map(function (t) { return t.score || 0; }))), max: U.sum(ev.map(function (t) { return t.maxScore; })), activeSec: ss.activeSec || 0
      };
    });
    var strengths = [], difficulties = [], recs = [], toReview = [];
    c.subskills.forEach(function (s) {
      var def = (lesson.subskills || []).filter(function (x) { return x.id === s.subskillId; })[0] || {};
      if (s.presented >= 2 && s.pct >= 80) strengths.push(s.text);
      else if (s.presented >= 1 && !s.mastery.mastered) { difficulties.push(s.text); recs.push(def.recommend || ('Повторить: ' + s.text)); }
    });
    at.tasks.forEach(function (t) { if (t.closed && !t.loop && (t.status === 'incorrect' || t.status === 'partial' || t.skipped)) toReview.push({ taskId: t.taskId, subskillId: t.subskillId || null, reason: t.skipped ? 'skipped' : (t.errorType || t.status) }); });

    var r = {
      schemaVersion: SCHEMA_VERSION, reportType: 'lesson_report', reportId: U.uuid(),
      dedupeKey: dedupeKey(st, lesson.lessonId, at.attemptNumber, at.startedAt),
      source: 'digital', legacy: false,
      producer: { materialId: P.materialId, engineVersion: P.engineVersion, contentVersion: P.contentVersion, contentHash: P.contentHash },
      student: { studentId: st.studentId, name: st.name, class: st.class },
      context: {
        subject: lesson.subject, language: lesson.language || 'ru', section: lesson.section || null,
        series: lesson.series || null, lessonId: lesson.lessonId, moduleId: lesson.moduleId || lesson.lessonId, lessonTitle: lesson.title,
        assessmentType: lesson.assessmentType || 'formative', assessmentLabel: lesson.assessmentLabel || null, checkKind: lesson.checkKind || 'learning'
      },
      objectives: { learningObjectives: lesson.objectives || [], lessonObjectives: lesson.lessonObjectives || [] },
      attempt: { attemptNumber: at.attemptNumber, countsForMark: at.countsForMark !== false, startedAt: at.startedAt, lastActivityAt: at.lastActivityAt || fixedAt, fixedAt: fixedAt, completionReason: at.status === 'completed' ? 'completed' : (at.stopReason || 'student_stopped') },
      time: {
        timeLimitSec: limit, elapsedWallTimeSec: sec(at.startedAt, fixedAt), activeTimeSec: Math.round(at.activeSec || 0), activeTimeMethod: 'events_idle120',
        sessions: (at.sessions || []).map(function (s) { return { startedAt: s.startedAt, endedAt: s.endedAt, activeSec: Math.round(s.activeSec || 0) }; }),
        timeExceeded: c.timeExceeded, overtimeSec: c.overtimeSec, pageLeaves: at.pageLeaves || 0
      },
      scoring: c.scoring,
      metrics: c.metrics,
      coreResult: c.coreResult, extensionResult: c.extensionResult,
      criteriaResults: c.criteriaResults, descriptorResults: c.descriptorResults, subskills: c.subskills,
      correctionLoops: loops, toReview: toReview,
      stages: stages, tasks: at.tasks.map(taskForReport),
      retrievalResults: [], reflection: at.reflection || null,
      strengths: strengths, difficulties: difficulties, recommendations: recs,
      accessibilityAdaptationsUsed: at.adaptations || [],
      paper: null, integrity: { reportHash: null, algorithm: null, warnings: [] }
    };
    return r;
  }

  /** Подпись отчёта (SHA-256 при наличии, иначе cyrb53). Возвращает Promise<report>. */
  function seal(r) {
    var copy = U.clone(r); copy.integrity.reportHash = null; copy.integrity.algorithm = null; copy.reportId = null;
    return U.sha256Hex(U.canonical(copy)).then(function (h) { r.integrity.reportHash = h.hash; r.integrity.algorithm = h.algorithm; return r; });
  }

  var ENUM = {
    source: ['digital', 'paper_manual', 'paper_omr'],
    status: ['correct', 'partial', 'incorrect', 'not_done', 'pending_review'],
    markBasis: ['with_control', 'formative_without_control', 'control_work', 'none'],
    completionReason: ['completed', 'student_stopped', 'time_expired'],
    weightsSource: ['instruction', 'KSP', 'default', 'legacy'],
    weightsProfile: ['learning', 'final', 'custom', 'legacy']
  };
  function inEnum(v, a) { return a.indexOf(v) >= 0; }

  /** Проверка отчёта v1.0. Возвращает массив проблем. */
  function validateReport(r) {
    var p = [];
    if (!r || typeof r !== 'object') return ['не объект'];
    if (r.reportType !== 'lesson_report') p.push('reportType');
    if (!/^1\./.test(String(r.schemaVersion))) p.push('schemaVersion: ' + r.schemaVersion);
    ['reportId', 'dedupeKey', 'source', 'producer', 'student', 'context', 'attempt', 'time', 'scoring', 'metrics', 'tasks', 'stages'].forEach(function (k) { if (r[k] == null) p.push('нет поля ' + k); });
    if (p.length) return p;
    if (!inEnum(r.source, ENUM.source)) p.push('source');
    if (!r.student.name) p.push('student.name');
    if (!r.context.lessonId) p.push('context.lessonId');
    if (!inEnum(r.attempt.completionReason, ENUM.completionReason)) p.push('attempt.completionReason');
    if (!inEnum(r.scoring.markBasis, ENUM.markBasis)) p.push('scoring.markBasis');
    if (!inEnum(r.scoring.weightsSource, ENUM.weightsSource)) p.push('scoring.weightsSource');
    if (!inEnum(r.scoring.weightsProfile, ENUM.weightsProfile)) p.push('scoring.weightsProfile');
    ['completionPct', 'accuracyPct', 'achievementPct', 'mark10'].forEach(function (k) {
      var v = r.metrics[k]; if (v != null && (typeof v !== 'number' || v < 0 || v > (k === 'mark10' ? 10 : 100))) p.push('metrics.' + k + ' вне диапазона');
    });
    if (!Array.isArray(r.tasks)) p.push('tasks'); else r.tasks.forEach(function (t, i) {
      if (!t.taskId) p.push('tasks[' + i + '].taskId');
      if (!inEnum(t.status, ENUM.status)) p.push('tasks[' + i + '].status');
      if (t.score != null && (t.score < 0 || t.score > t.maxScore + 1e-9)) p.push('tasks[' + i + '].score вне диапазона');
    });
    return p;
  }

  function packageReport(reports) {
    return { schemaVersion: SCHEMA_VERSION, reportType: 'package_report', packageId: U.uuid(), createdAt: U.nowIso(), reports: reports, lessonSummaries: S.summarize(reports) };
  }

  K.schema = { SCHEMA_VERSION: SCHEMA_VERSION, dedupeKey: dedupeKey, buildLessonReport: buildLessonReport, taskForReport: taskForReport, seal: seal, validateReport: validateReport, packageReport: packageReport, ENUM: ENUM, producer: producer };
})(typeof window !== 'undefined' ? window : globalThis);
