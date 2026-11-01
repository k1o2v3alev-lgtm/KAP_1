/* KAP engine · scoring: коэффициенты, веса, отметка, освоение, потолок по времени, итог по уроку. */
(function (root) {
  'use strict';
  var K = root.KAP = root.KAP || {};
  var U = K.util;

  var DEFAULTS = {
    hint: [1, 0.75, 0.4],
    attempt: [1, 0.85, 0.7],
    solutionCap: 0.4,
    mastery: { window: 5, minTasks: 3, avg: 0.8 },
    descriptor: { achieved: 80, partially: 40 },
    overtimeCapPct: 84,
    skillsMinTasks: 2,
    profiles: {
      learning: { diagnostic: 20, learning: 50, final: 30 },
      final: { diagnostic: 20, learning: 30, final: 50 }
    },
    controlTypes: ['intermediate', 'SOR', 'SOCH'],
    finalCheckKinds: ['quarter_final', 'year_final', 'residual']
  };

  /** Итоговый коэффициент задания: минимум из коэффициента подсказок и попыток; разбор — не выше solutionCap. */
  function coefficient(hints, attempts, solutionShown, c) {
    c = c || DEFAULTS;
    var h = c.hint[Math.min(hints || 0, c.hint.length - 1)];
    var a = c.attempt[Math.min(Math.max((attempts || 1) - 1, 0), c.attempt.length - 1)];
    var v = Math.min(h, a);
    if (solutionShown) v = Math.min(v, c.solutionCap);
    return v;
  }

  /** Закрывает задание: считает score по последней попытке. t.attempts[последняя].fraction в [0,1]. */
  function finalizeScore(t, c) {
    if (t.skipped) { t.score = 0; return t.score; }
    if (t.status === 'pending_review') { t.score = null; return null; }
    var last = t.attempts[t.attempts.length - 1];
    var f = last ? last.fraction : 0;
    t.score = U.round2(t.maxScore * f * coefficient(t.hintsUsed, t.attempts.length, t.solutionShown, c));
    return t.score;
  }

  function resolveWeights(o) {
    o = o || {};
    var finalMode = DEFAULTS.finalCheckKinds.indexOf(o.checkKind) >= 0 || o.assessmentType === 'SOCH' || o.finalReview === true;
    var base = DEFAULTS.profiles[finalMode ? 'final' : 'learning'];
    var src = o.instruction ? 'instruction' : (o.lessonWeights ? 'KSP' : 'default');
    var given = o.instruction || o.lessonWeights || null;
    var w = { diagnostic: base.diagnostic, learning: base.learning, final: base.final };
    if (given) ['diagnostic', 'learning', 'final'].forEach(function (k) { if (given[k] != null) w[k] = given[k]; });
    return { weights: w, source: src, profile: given ? 'custom' : (finalMode ? 'final' : 'learning') };
  }

  function evaluated(t) { return t.closed && t.status !== 'pending_review'; }
  function pct(a, b) { return b > 0 ? U.round1(100 * a / b) : null; }

  function masteryOf(tasks, m) {
    m = m || DEFAULTS.mastery;
    var ev = tasks.filter(function (t) { return evaluated(t) && t.group !== 'diagnostic'; }).slice(-m.window);
    var avg = ev.length ? U.sum(ev.map(function (t) { return t.maxScore ? (t.score || 0) / t.maxScore : 0; })) / ev.length : 0;
    return { mastered: ev.length >= m.minTasks && avg >= m.avg, windowSize: m.window, windowAvg: U.round2(avg), tasksInWindow: ev.length };
  }

  /**
   * a: { tasks[], stagePlan[{stageId,group,mode,plannedMax}], lesson, instruction, finalTime:{limitSec,activeSec} }
   * Возвращает все показатели отчёта.
   */
  function computeMetrics(a) {
    var lesson = a.lesson, tasks = a.tasks || [];
    var main = tasks.filter(function (t) { return !t.loop && t.mode !== 'CLUB'; });
    var ev = main.filter(evaluated);
    var groups = ['diagnostic', 'learning', 'final'], agg = {};
    groups.forEach(function (g) {
      var list = ev.filter(function (t) { return t.group === g; });
      agg[g] = { n: list.length, earned: U.sum(list.map(function (t) { return t.score || 0; })), max: U.sum(list.map(function (t) { return t.maxScore; })) };
      agg[g].a = agg[g].max > 0 ? agg[g].earned / agg[g].max : null;
    });

    var plannedMax = U.sum((a.stagePlan || []).filter(function (s) { return s.mode !== 'CLUB' && groups.indexOf(s.group) >= 0; }).map(function (s) { return s.plannedMax; }));
    var doneMax = U.sum(main.filter(function (t) { return t.closed; }).map(function (t) { return t.maxScore; }));
    var completionPct = plannedMax > 0 ? Math.min(100, U.round1(100 * doneMax / plannedMax)) : 0;
    var accuracyPct = pct(U.sum(ev.map(function (t) { return t.score || 0; })), U.sum(ev.map(function (t) { return t.maxScore; })));

    // дескрипторы и критерии
    var descriptorResults = [], criteriaResults = [], totE = 0, totM = 0;
    (lesson.criteria || []).forEach(function (cr) {
      var ce = 0, cm = 0;
      cr.descriptors.forEach(function (d) {
        var ts = ev.filter(function (t) { return (t.descriptorIds || []).indexOf(d.descriptorId) >= 0; });
        var pend = main.filter(function (t) { return t.closed && t.status === 'pending_review' && (t.descriptorIds || []).indexOf(d.descriptorId) >= 0; }).length;
        var e = U.sum(ts.map(function (t) { return t.score || 0; })), m = U.sum(ts.map(function (t) { return t.maxScore; }));
        var p = pct(e, m), st;
        if (m === 0) st = pend > 0 ? 'teacher_review' : 'not_shown';
        else st = p >= DEFAULTS.descriptor.achieved ? 'achieved' : (p >= DEFAULTS.descriptor.partially ? 'partially' : 'not_yet');
        descriptorResults.push({ descriptorId: d.descriptorId, criterionId: cr.criterionId, text: d.text, earned: U.round2(e), max: m, status: st });
        ce += e; cm += m;
      });
      criteriaResults.push({ criterionId: cr.criterionId, text: cr.text, earned: U.round2(ce), max: cm, pct: pct(ce, cm) });
      totE += ce; totM += cm;
    });
    var achievementPct = totM > 0 ? U.round1(100 * totE / totM) : null;
    var touched = descriptorResults.filter(function (d) { return d.max > 0; }).length;
    var descriptorCoveragePct = descriptorResults.length ? U.round1(100 * touched / descriptorResults.length) : null;

    // поднавыки и освоение (возвратные задания учитываются)
    var allCore = tasks.filter(function (t) { return t.mode !== 'CLUB'; });
    var subskills = (lesson.subskills || []).map(function (s) {
      var ts = allCore.filter(function (t) { return t.subskillId === s.id && evaluated(t); });
      return {
        subskillId: s.id, text: s.text, presented: ts.length,
        correct: ts.filter(function (t) { return t.status === 'correct'; }).length,
        pct: pct(U.sum(ts.map(function (t) { return t.score || 0; })), U.sum(ts.map(function (t) { return t.maxScore; }))),
        hintsUsed: U.sum(ts.map(function (t) { return t.hintsUsed || 0; })),
        mastery: masteryOf(allCore.filter(function (t) { return t.subskillId === s.id; }))
      };
    });
    var covered = subskills.filter(function (s) { return s.presented >= DEFAULTS.skillsMinTasks; }).length;
    var skillsCoveragePct = subskills.length ? U.round1(100 * covered / subskills.length) : null;

    var levels = {};
    ['recognition', 'reproduction', 'understanding', 'transfer', 'investigation', 'generalization'].forEach(function (l) { levels[l] = { presented: 0, correct: 0 }; });
    ev.forEach(function (t) { var l = levels[t.cognitiveLevel]; if (l) { l.presented++; if (t.status === 'correct') l.correct++; } });

    var indep = ev.length ? U.round1(100 * ev.filter(function (t) { return t.status === 'correct' && t.attempts.length === 1 && !t.hintsUsed && !t.solutionShown; }).length / ev.length) : null;
    var diagnosticPct = agg.diagnostic.max ? pct(agg.diagnostic.earned, agg.diagnostic.max) : null;
    var finalPct = agg.final.max ? pct(agg.final.earned, agg.final.max) : null;

    // веса и отметка
    var W = resolveWeights({ instruction: a.instruction, lessonWeights: lesson.weights, checkKind: lesson.checkKind, assessmentType: lesson.assessmentType, finalReview: lesson.finalReview });
    function weighted(list) {
      var present = list.filter(function (g) { return agg[g].a != null; });
      if (!present.length) return null;
      var wsum = U.sum(present.map(function (g) { return W.weights[g]; }));
      return U.round1(10 * U.sum(present.map(function (g) { return W.weights[g] * agg[g].a; })) / wsum);
    }
    var control = DEFAULTS.controlTypes.indexOf(lesson.assessmentType) >= 0;
    var formativeMark10 = weighted(['diagnostic', 'learning']);
    var hasFinal = agg.final.a != null, basis = 'none', mark = null;
    if (ev.length) {
      if (control && hasFinal) { basis = 'control_work'; mark = U.round1(10 * agg.final.a); }
      else if (hasFinal) { basis = 'with_control'; mark = weighted(groups); }
      else { basis = 'formative_without_control'; mark = formativeMark10; }
    }

    // потолок по времени (раздел 14.4)
    var ft = a.finalTime || {}, over = !!(ft.limitSec && ft.activeSec > ft.limitSec);
    var cap = { applied: false, capPct: DEFAULTS.overtimeCapPct, reason: null, uncappedAchievementPct: null, uncappedMark10: null };
    var capEligible = hasFinal && (basis === 'control_work' || W.profile === 'final');
    var ach = achievementPct;
    if (over && capEligible) {
      var capMark = DEFAULTS.overtimeCapPct / 10;
      if ((mark != null && mark > capMark) || (ach != null && ach > DEFAULTS.overtimeCapPct)) {
        cap = { applied: true, capPct: DEFAULTS.overtimeCapPct, reason: 'time_limit_exceeded', uncappedAchievementPct: ach, uncappedMark10: mark };
        if (mark != null) mark = Math.min(mark, capMark);
        if (ach != null) ach = Math.min(ach, DEFAULTS.overtimeCapPct);
      }
    }

    // CLUB отдельно
    var club = tasks.filter(function (t) { return t.mode === 'CLUB'; }), clubEv = club.filter(evaluated);
    var extensionResult = club.length ? {
      completionPct: pct(club.filter(function (t) { return t.closed; }).length, club.length),
      accuracyPct: pct(U.sum(clubEv.map(function (t) { return t.score || 0; })), U.sum(clubEv.map(function (t) { return t.maxScore; }))),
      achievementPct: null, mark10: null
    } : null;

    return {
      metrics: {
        completionPct: completionPct, accuracyPct: accuracyPct, achievementPct: ach,
        independencePct: indep, diagnosticPct: diagnosticPct, finalPct: finalPct,
        deltaDiagnosticToFinal: (diagnosticPct != null && finalPct != null) ? U.round1(finalPct - diagnosticPct) : null,
        skillsCoveragePct: skillsCoveragePct, descriptorCoveragePct: descriptorCoveragePct,
        levelsProfile: levels, mark10: mark, formativeMark10: formativeMark10, metricSources: { mark10: 'auto', achievementPct: 'auto', accuracyPct: 'auto' }
      },
      scoring: { weightsSource: W.source, weightsProfile: W.profile, weights: W.weights, coefficients: { hint: DEFAULTS.hint, attempt: DEFAULTS.attempt, solutionCap: DEFAULTS.solutionCap, source: 'default' }, markBasis: basis, scoreCap: cap },
      coreResult: { completionPct: completionPct, accuracyPct: accuracyPct, achievementPct: ach, mark10: mark },
      extensionResult: extensionResult,
      criteriaResults: criteriaResults, descriptorResults: descriptorResults, subskills: subskills,
      timeExceeded: over, overtimeSec: over ? Math.round(ft.activeSec - ft.limitSec) : 0,
      stageAgg: agg
    };
  }

  // ---- итог по уроку из нескольких попыток (раздел 14.8) ----
  function studentKey(r) { return String((r.student && r.student.class) || '') + '|' + K.norm.normText((r.student && r.student.name) || '', 'default'); }

  function summarize(reports) {
    var groups = {};
    reports.forEach(function (r) {
      if (!r || !r.metrics || r.metrics.mark10 == null) return;
      if (r.attempt && r.attempt.completionReason !== 'completed') return;
      if (r.attempt && r.attempt.countsForMark === false) return;
      var prof = (r.scoring && r.scoring.weightsProfile) || 'learning';
      var key = studentKey(r) + '||' + r.context.lessonId + '||' + prof;
      (groups[key] = groups[key] || { list: [], prof: prof }).list.push(r);
    });
    return Object.keys(groups).map(function (k) {
      var g = groups[k], list = g.list;
      var withControl = list.filter(function (r) { var b = r.scoring.markBasis; return b === 'with_control' || b === 'control_work'; });
      if (withControl.length) list = withControl; else list = list.filter(function (r) { return r.scoring.markBasis === 'formative_without_control'; });
      if (!list.length) return null;
      var best = list[0], last = list[0];
      list.forEach(function (r) {
        if (r.metrics.mark10 > best.metrics.mark10 || (r.metrics.mark10 === best.metrics.mark10 && r.attempt.attemptNumber > best.attempt.attemptNumber)) best = r;
        if (r.attempt.attemptNumber > last.attempt.attemptNumber) last = r;
      });
      function avg(f) { var x = best.metrics[f], y = last.metrics[f]; return (x == null || y == null) ? (x != null ? x : y) : U.round1((x + y) / 2); }
      return {
        studentKey: k.split('||')[0], student: best.student, lessonId: best.context.lessonId, weightsProfile: g.prof, markBasis: best.scoring.markBasis,
        rule: 'avg_best_last', attemptsCounted: list.length, bestAttemptNumber: best.attempt.attemptNumber, lastAttemptNumber: last.attempt.attemptNumber,
        bestMark10: best.metrics.mark10, lastMark10: last.metrics.mark10, mark10: U.round1((best.metrics.mark10 + last.metrics.mark10) / 2),
        completionPct: avg('completionPct'), accuracyPct: avg('accuracyPct'), achievementPct: avg('achievementPct'), overriddenByTeacher: false
      };
    }).filter(Boolean);
  }

  K.scoring = { DEFAULTS: DEFAULTS, coefficient: coefficient, finalizeScore: finalizeScore, resolveWeights: resolveWeights, masteryOf: masteryOf, computeMetrics: computeMetrics, summarize: summarize, evaluated: evaluated };
})(typeof window !== 'undefined' ? window : globalThis);
