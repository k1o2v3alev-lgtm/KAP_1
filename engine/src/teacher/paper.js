/* KAP engine · paper: бумажный комплект (раздел 24): варианты по общей спецификации, проверка, бланк OMR, ключи, ручной ввод. */
(function (root) {
  'use strict';
  var K = root.KAP = root.KAP || {};
  var U = K.util, S = K.scoring, esc = U.esc;
  var LETTERS = ['А', 'Б', 'В', 'Г', 'Д'];
  var TIME = { single_choice: 40, multi_choice: 60, number: 75, text: 60, expression: 75, base: 75, ordering: 90, matching: 90, open: 240 };
  var WORK = {
    independent: { label: 'Самостоятельная работа', assessmentType: 'formative', checkKind: 'learning', official: false },
    po: { label: 'Промежуточное оценивание (ПО)', assessmentType: 'intermediate', checkKind: 'learning', official: false },
    sor: { label: 'СОР (тренировочный аналог)', assessmentType: 'SOR', checkKind: 'learning', official: false },
    soch: { label: 'СОЧ (тренировочный аналог)', assessmentType: 'SOCH', checkKind: 'quarter_final', official: false }
  };
  var LEVEL_RANK = { recognition: 1, reproduction: 2, understanding: 3, transfer: 4, investigation: 5, generalization: 6 };

  // ---------- безопасный вывод HTML из импортированных данных ----------
  var OK_TAGS = { SPAN: 1, I: 1, B: 1, STRONG: 1, EM: 1, SUB: 1, SUP: 1, BR: 1, P: 1, DIV: 1, UL: 1, OL: 1, LI: 1 };
  function safeHtml(html) {
    if (typeof DOMParser === 'undefined') return esc(String(html == null ? '' : html).replace(/<[^>]*>/g, ''));
    var doc = new DOMParser().parseFromString('<body>' + String(html == null ? '' : html) + '</body>', 'text/html');
    function walk(node) {
      var out = '';
      node.childNodes.forEach(function (n) {
        if (n.nodeType === 3) out += esc(n.nodeValue);
        else if (n.nodeType === 1) {
          if (OK_TAGS[n.tagName]) {
            var cls = (n.getAttribute('class') || '').replace(/[^a-z0-9 _-]/gi, '');
            out += '<' + n.tagName.toLowerCase() + (cls ? ' class="' + cls + '"' : '') + '>' + (n.tagName === 'BR' ? '' : walk(n) + '</' + n.tagName.toLowerCase() + '>');
          } else if (n.tagName !== 'SCRIPT' && n.tagName !== 'STYLE') out += walk(n);
        }
      });
      return out;
    }
    return walk(doc.body);
  }

  // ---------- самоидентифицирующийся код бланка (10 ячеек) ----------
  function encodeId(kitIndex, variantIdx) {
    var b = [1], i;
    for (i = 3; i >= 0; i--) b.push((kitIndex >> i) & 1);
    b.push((variantIdx >> 1) & 1, variantIdx & 1);
    var chk = (kitIndex + variantIdx) % 4; b.push((chk >> 1) & 1, chk & 1);
    b.push(U.sum(b) % 2);
    return b;
  }
  function decodeId(bits) {
    if (!bits || bits.length !== 10 || bits[0] !== 1) return { ok: false, reason: 'формат' };
    if (U.sum(bits) % 2 !== 0) return { ok: false, reason: 'чётность' };
    var kit = bits[1] * 8 + bits[2] * 4 + bits[3] * 2 + bits[4], v = bits[5] * 2 + bits[6], chk = bits[7] * 2 + bits[8];
    if (chk !== (kit + v) % 4) return { ok: false, reason: 'контрольная сумма' };
    return { ok: true, kitIndex: kit, variantIdx: v };
  }

  // ---------- построение комплекта ----------
  function collectPool(lessonIds, includeOpen) {
    var pool = [], seen = {};
    K.PACK.lessons.filter(function (l) { return lessonIds.indexOf(l.lessonId) >= 0; }).forEach(function (L) {
      L.stages.forEach(function (st) {
        if (st.type !== 'tasks' || st.mode === 'CLUB' || (st.group !== 'learning' && st.group !== 'final')) return;
        st.plan.forEach(function (it) {
          var def = K.gen.get(it.gen); if ((def.mode || 'CORE') === 'CLUB') return; if (def.taskType === 'open' && !includeOpen) return;
          var prof = it.profile || (def.profiles.standard ? 'standard' : Object.keys(def.profiles)[0]), key = it.gen + '|' + prof + '|' + (it.descriptors || []).join(',');
          if (seen[key]) return; seen[key] = 1;
          pool.push({ lessonId: L.lessonId, gen: it.gen, profile: prof, descriptors: it.descriptors || [], goalCode: (L.objectives[0] || {}).code || null, def: def });
        });
      });
    });
    return pool;
  }
  function blueprintOf(pool, n) {
    var pos = [], i;
    for (i = 0; i < n; i++) pos.push(pool[n <= pool.length ? Math.floor(i * pool.length / n) : i % pool.length]);
    pos = pos.map(function (p, ix) { return { p: p, ix: ix }; });
    pos.sort(function (a, b) { var A = a.p.def.taskType === 'single_choice' ? 0 : 1, B = b.p.def.taskType === 'single_choice' ? 0 : 1; return A - B || a.ix - b.ix; });
    return pos.map(function (x, k) {
      var d = x.p.def;
      return { position: k + 1, gen: x.p.gen, profile: x.p.profile, lessonId: x.p.lessonId, goalCode: x.p.goalCode, subskillId: d.subskill, taskType: d.taskType, difficulty: x.p.profile, cognitiveLevel: d.cognitiveLevel, maxScore: d.maxScore || 1, descriptorIds: x.p.descriptors, omr: d.taskType === 'single_choice' };
    });
  }
  function omrTemplate(blueprint) {
    var closed = blueprint.filter(function (b) { return b.omr; }).length, opts = 4;
    return {
      templateId: 'KAP-OMR-A5', templateVersion: '1', units: 'mm', sheet: { page: 'A4', sheetsPerPage: 2, printScalePct: 100, widthMm: 210, heightMm: 148.5 },
      markers: { sizeMm: 6, centers: { TL: [9, 9], TR: [201, 9], BL: [9, 139.5], BR: [201, 139.5] } },
      idCells: { sizeMm: 4, centers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (i) { return [146 + 5.5 * i, 25.5]; }), encoding: 'bit0=1; bits1-4=номер комплекта; bits5-6=вариант-1; bits7-8=(комплект+вариант-1) mod 4; bit9=чётность' },
      bubbleRadiusMm: 2.7, answerGrid: { options: LETTERS.slice(0, opts).join(''), rows: Math.min(15, Math.max(closed, 1)), columns: closed > 15 ? 2 : 1, originMm: [22, 45], columnStepMm: 90, pitchMm: [8, 6.2], closedCount: closed },
      partB: { enabled: true, filledBy: 'teacher' }
    };
  }
  function estimate(tasks, cls) {
    var f = cls <= 4 ? 1.5 : cls <= 6 ? 1.2 : 1;
    return Math.round(U.sum(tasks.map(function (t) { return (TIME[t.taskType] || 60) * f; })) / 60 * 10) / 10;
  }

  function tryBuild(P, exclude) {
    var wt = WORK[P.workType];
    var pool = collectPool(P.lessonIds || [], P.includeOpen).filter(function (x) { return !exclude[x.gen + '|' + x.profile]; });
    if (!pool.length) throw new Error('в выбранных уроках нет подходящих заданий');
    var V = Math.max(1, Math.min(8, +P.variantsCount || 1)), seed = (P.seed != null ? P.seed : U.randomSeed()) >>> 0;
    var bp = blueprintOf(pool, Math.max(3, Math.min(30, +P.taskCount || 8)));
    var kitId = 'kit-' + U.hashHex(U.canonical({ p: P, seed: seed })).slice(0, 8), kitIndex = parseInt(kitId.slice(4, 6), 16) % 16, shared = new Set(), variants = [], failGen = null;
    for (var v = 0; v < V && !failGen; v++) {
      var done = false;
      for (var salt = 0; salt < 4 && !done; salt++) {
        var tasks = [], added = [], bad = null;
        bp.forEach(function (b) {
          if (bad) return;
          var t = K.gen.make(b.gen, b.profile, U.deriveSeed(seed, 'v' + v + ':' + b.position + ':' + salt), { seen: shared });
          if (t.repeat) { bad = b; return; }
          added.push(t.fingerprint);
          t.taskId = kitId + '#V' + (v + 1) + '#' + b.position; t.position = b.position; t.stageId = 'paper'; t.group = 'final'; t.descriptorIds = b.descriptorIds; t.goalCode = b.goalCode; t.auditStatus = 'PASS'; t.auditNote = '';
          tasks.push(t);
        });
        if (!bad) { variants.push({ variantCode: 'V' + (v + 1), tasks: tasks }); done = true; }
        else { added.forEach(function (f) { shared.delete(f); }); if (salt === 3) failGen = bad.gen + '|' + bad.profile; }
      }
    }
    if (failGen) return { failGen: failGen };
    var kit = {
      schemaVersion: '1.0', reportType: 'paper_kit', kitId: kitId, createdAt: U.nowIso(), producer: K.schema.producer(),
      params: { workType: P.workType, workLabel: wt.label, title: P.title || '', subject: (K.PACK.lessons.filter(function (l) { return (P.lessonIds || []).indexOf(l.lessonId) >= 0; })[0] || {}).subject || '', 'class': String(P.classNum), language: K.PACK.language || 'ru',
        lessonIds: P.lessonIds, goalCodes: bp.map(function (b) { return b.goalCode; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }), durationMin: P.durationMin, variantsCount: V, seed: seed, official: false, gradingScale: null, includeOpen: P.includeOpen },
      blueprint: bp, variants: variants, omrTemplate: omrTemplate(bp), kitIndex: kitIndex, keyHash: null, buildErrors: [], excluded: Object.keys(exclude)
    };
    kit.keyHash = U.hashHex(U.canonical(variants.map(function (x) { return x.tasks.map(function (t) { return [t.fingerprint, t.correctAnswer]; }); })));
    return { kit: kit };
  }

  /** params: { workType, lessonIds[], durationMin, variantsCount, taskCount, seed, includeOpen, classNum, title }.
      Генератор, который не может дать достаточно различных заданий для всех вариантов, исключается из комплекта. */
  function build(params) {
    var P = Object.assign({ workType: 'independent', durationMin: 15, variantsCount: 2, taskCount: 8, includeOpen: true, classNum: 6 }, params);
    if (!WORK[P.workType]) throw new Error('неизвестный вид работы');
    if (P.seed == null) P.seed = U.randomSeed();
    var exclude = {};
    for (var k = 0; k < 8; k++) {
      var r = tryBuild(P, exclude);
      if (r.kit) return r.kit;
      exclude[r.failGen] = 1;
    }
    throw new Error('не удалось построить комплект: пул заданий исчерпан');
  }

  /** Проверка комплекта (п. 24.3). */
  function validateKit(kit) {
    var errors = (kit.buildErrors || []).slice(), warnings = [], seen = {}, sum0 = null;
    kit.variants.forEach(function (v) {
      var sum = U.sum(v.tasks.map(function (t) { return t.maxScore; }));
      if (sum0 == null) sum0 = sum; else if (sum !== sum0) errors.push('сумма баллов варианта ' + v.variantCode + ' отличается');
      if (v.tasks.length !== kit.blueprint.length) errors.push('число заданий в ' + v.variantCode + ' не равно спецификации');
      v.tasks.forEach(function (t, i) {
        var b = kit.blueprint[i];
        if (!b || t.generator.generatorId !== b.gen || t.taskType !== b.taskType || t.cognitiveLevel !== b.cognitiveLevel || t.maxScore !== b.maxScore || t.subskillId !== b.subskillId) errors.push(v.variantCode + ' №' + (i + 1) + ': не по спецификации');
        if (seen[t.fingerprint]) errors.push('одинаковые задания в разных вариантах: ' + v.variantCode + ' №' + (i + 1)); seen[t.fingerprint] = 1;
        try { var again = K.gen.reproduce(t.generator.generatorId, t.generator.profile, t.generator.seed); if (again.fingerprint !== t.fingerprint) errors.push(v.variantCode + ' №' + (i + 1) + ': задание не воспроизводится по seed'); }
        catch (e) { errors.push(v.variantCode + ' №' + (i + 1) + ': ' + e.message); }
        if (t.taskType !== 'open' && K.check(t, t.correctAnswer).status !== 'correct') errors.push(v.variantCode + ' №' + (i + 1) + ': ключ не засчитывается');
      });
      var est = estimate(v.tasks, +kit.params['class']);
      if (est > kit.params.durationMin * 1.15) warnings.push('вариант ' + v.variantCode + ': ожидаемое время ' + est + ' мин больше заданных ' + kit.params.durationMin);
      if (est < kit.params.durationMin * 0.5) warnings.push('вариант ' + v.variantCode + ': ожидаемое время ' + est + ' мин намного меньше заданных ' + kit.params.durationMin);
    });
    if (kit.params.official === false) warnings.push('Тренировочный аналог: не является официальной работой.');
    return { errors: errors, warnings: warnings, estimateMin: kit.variants.length ? estimate(kit.variants[0].tasks, +kit.params['class']) : null };
  }

  // ---------- печатные формы ----------
  function optionLetter(i) { return LETTERS[i] || String(i + 1); }
  function taskBody(t, safe) {
    var h = '<div class="pt-cond">' + (safe ? safeHtml(t.condition || t.presentedCondition) : t.condition) + '</div>';
    var opts = t.options || [];
    if (t.taskType === 'single_choice' || t.taskType === 'multi_choice') h += '<ol class="pt-opts">' + opts.map(function (o, i) { return '<li><b>' + optionLetter(i) + ')</b> ' + esc(o.text) + '</li>'; }).join('') + '</ol>';
    else if (t.taskType === 'ordering') h += '<ol class="pt-opts">' + (t.items || []).map(function (o, i) { return '<li>' + esc(o.text) + ' &nbsp; № ___</li>'; }).join('') + '</ol>';
    else if (t.taskType === 'matching') h += '<table class="pt-match">' + (t.left || []).map(function (l, i) { return '<tr><td>' + esc(l.text) + '</td><td>→ ___</td><td>' + esc(((t.right || [])[i] || {}).text || '') + '</td></tr>'; }).join('') + '</table>';
    else h += '<div class="pt-line">Ответ: ______________________________</div>';
    return h;
  }
  function variantHtml(kit, variant, safe) {
    var p = kit.params, h = '<section class="print-page"><div class="pt-head"><div><b>' + esc(p.workLabel) + '</b>' + (p.title ? ' · ' + esc(p.title) : '') + '</div><div class="pt-var">Вариант ' + esc(variant.variantCode.replace('V', '')) + '</div></div>' +
      '<div class="pt-fields">Класс: ______ &nbsp; Фамилия, имя: ______________________________ &nbsp; Дата: __________</div><div class="pt-meta">Время: ' + p.durationMin + ' мин. ' + (p.official === false ? 'Тренировочный аналог (не официальная работа).' : '') + '</div>';
    variant.tasks.forEach(function (t) { h += '<div class="pt-task"><div class="pt-num">' + t.position + '. <span class="pt-pts">(' + t.maxScore + ' б.)</span></div>' + taskBody(t, safe) + '</div>'; });
    return h + '<div class="pt-foot">' + esc(kit.kitId) + ' · ' + esc(variant.variantCode) + '</div></section>';
  }
  function keyHtml(kit, safe) {
    var h = '<section class="print-page"><h2>Ключ учителя · ' + esc(kit.params.workLabel) + '</h2><p class="small">' + esc(kit.kitId) + '. ' + (kit.params.official === false ? 'Тренировочный аналог.' : '') + '</p>';
    kit.variants.forEach(function (v) {
      h += '<h3>Вариант ' + esc(v.variantCode.replace('V', '')) + '</h3><table><tr><th>№</th><th>Верный ответ</th><th>Балл</th><th>Дескрипторы</th><th>Типичные ошибки (выбор → тип ошибки)</th><th>Статус задания</th></tr>';
      v.tasks.forEach(function (t) {
        var ans = t.taskType === 'single_choice' ? optionLetter(t.correctOptionPosition) + ') ' + t.expectedAnswer : (Array.isArray(t.expectedAnswer) ? t.expectedAnswer.join('; ') : t.expectedAnswer);
        var errs = t.taskType === 'single_choice' ? t.options.map(function (o, i) { return t.distractorMap[o.id] ? optionLetter(i) + ' → ' + t.distractorMap[o.id] : null; }).filter(Boolean).join('; ') : (t.rule && t.rule.wrongValues ? t.rule.wrongValues.map(function (w) { return K.norm.ratToStr(w.value) + ' → ' + w.errorType; }).join('; ') : '');
        h += '<tr><td>' + t.position + '</td><td>' + (safe ? safeHtml(ans) : esc(ans)) + '</td><td>' + t.maxScore + '</td><td>' + esc((t.descriptorIds || []).join(', ')) + '</td><td>' + esc(errs) + '</td><td>' + esc(t.auditStatus || '') + '</td></tr>';
      });
      h += '</table>';
    });
    return h + '</section>';
  }

  /** SVG-бланк (210 × 148,5 мм). */
  function sheetSvg(kit, variantCode) {
    var T = kit.omrTemplate, vi = kit.variants.map(function (v) { return v.variantCode; }).indexOf(variantCode), bits = encodeId(kit.kitIndex, vi), g = T.answerGrid;
    var closed = kit.blueprint.filter(function (b) { return b.omr; }), s = '';
    s += '<svg xmlns="http://www.w3.org/2000/svg" class="omr" viewBox="0 0 210 148.5" width="210mm" height="148.5mm" font-family="Arial, sans-serif">';
    s += '<rect x="0.2" y="0.2" width="209.6" height="148.1" fill="none" stroke="#888" stroke-width="0.2" stroke-dasharray="2 2"/>';
    Object.keys(T.markers.centers).forEach(function (k) { var c = T.markers.centers[k], z = T.markers.sizeMm; s += '<rect x="' + (c[0] - z / 2) + '" y="' + (c[1] - z / 2) + '" width="' + z + '" height="' + z + '" fill="#000"/>'; });
    s += '<text x="20" y="13" font-size="4.2" font-weight="bold">' + esc(kit.params.workLabel) + ' · вариант ' + esc(variantCode.replace('V', '')) + '</text>';
    s += '<text x="20" y="19" font-size="3">' + esc(kit.kitId) + '</text>';
    s += '<text x="20" y="27" font-size="3">Фамилия, имя: ____________________________ Класс: _____</text>';
    s += '<text x="146" y="20.5" font-size="2.4">Код бланка (не закрашивать)</text>';
    T.idCells.centers.forEach(function (c, i) { var z = T.idCells.sizeMm; s += '<rect x="' + (c[0] - z / 2) + '" y="' + (c[1] - z / 2) + '" width="' + z + '" height="' + z + '" fill="' + (bits[i] ? '#000' : 'none') + '" stroke="#000" stroke-width="0.3"/>'; });
    s += '<text x="20" y="38" font-size="2.6">Закрась один кружок в строке. Тёмная ручка. Номера строк совпадают с номерами заданий.</text>';
    closed.forEach(function (b, i) {
      var col = Math.floor(i / g.rows), row = i % g.rows, x0 = g.originMm[0] + col * g.columnStepMm, y = g.originMm[1] + row * g.pitchMm[1];
      s += '<text x="' + x0 + '" y="' + (y + 1) + '" font-size="3" text-anchor="end">' + b.position + '</text>';
      for (var j = 0; j < g.options.length; j++) {
        var cx = x0 + 6 + j * g.pitchMm[0];
        s += '<circle cx="' + cx + '" cy="' + y + '" r="' + T.bubbleRadiusMm + '" fill="none" stroke="#000" stroke-width="0.3"/><text x="' + cx + '" y="' + (y + 1) + '" font-size="2.6" text-anchor="middle" fill="#444">' + g.options[j] + '</text>';
      }
    });
    var open = kit.blueprint.filter(function (b) { return !b.omr; });
    if (open.length) s += '<text x="20" y="127" font-size="2.8">Часть B (заполняет учитель): ' + open.map(function (b) { return '№' + b.position + ' ___ б.'; }).join('   ') + '</text>';
    return s + '</svg>';
  }

  // ---------- ручной ввод результатов бумаги → отчёты ----------
  /** students: [{name, class}], entries: [ { [position]: {choice: index|null, score: number|null} } ] */
  function reportsFromEntries(kit, variantCode, students, entries) {
    var variant = kit.variants.filter(function (v) { return v.variantCode === variantCode; })[0], wt = WORK[kit.params.workType], now = U.nowIso();
    var lessons = K.PACK.lessons.filter(function (l) { return (kit.params.lessonIds || []).indexOf(l.lessonId) >= 0; }), L0 = lessons[0] || {};
    var subskills = []; lessons.forEach(function (l) { (l.subskills || []).forEach(function (s) { if (!subskills.some(function (x) { return x.id === s.id; })) subskills.push({ id: s.id, text: s.text }); }); });
    var lessonSpec = { lessonId: kit.kitId, assessmentType: wt.assessmentType, checkKind: wt.checkKind, weights: null, criteria: L0.criteria || [], subskills: subskills, stages: [{ id: 'paper', title: kit.params.workLabel, group: 'final', type: 'tasks' }], timeLimitSec: null };
    return students.map(function (st, si) {
      var ent = entries[si] || {}, tasks = variant.tasks.map(function (t) {
        var e = ent[t.position] || {}, status = 'not_done', score = null, answer = null, closed = false;
        if (t.taskType === 'single_choice' && e.choice != null && e.choice !== '') {
          closed = true; var opt = t.options[+e.choice]; answer = opt ? opt.text : null;
          var ok = opt && opt.id === t.rule.correctId; status = ok ? 'correct' : 'incorrect'; score = ok ? t.maxScore : 0;
        } else if (e.score != null && e.score !== '') {
          closed = true; score = Math.max(0, Math.min(t.maxScore, +e.score)); status = score >= t.maxScore ? 'correct' : (score > 0 ? 'partial' : 'incorrect');
        }
        return { taskId: t.taskId, stageId: 'paper', group: 'final', mode: 'CORE', taskType: t.taskType, cognitiveLevel: t.cognitiveLevel, goalCode: t.goalCode, subskillId: t.subskillId, descriptorIds: t.descriptorIds, generator: t.generator, fingerprint: t.fingerprint,
          condition: t.condition, options: t.options, optionOrder: t.optionOrder, correctOptionPosition: t.correctOptionPosition, expectedAnswer: t.expectedAnswer, rule: t.rule, distractorMap: t.distractorMap, maxScore: t.maxScore, closed: closed, status: closed ? status : null, score: score,
          attempts: closed ? [{ n: 1, answer: answer, at: now, status: status, fraction: t.maxScore ? score / t.maxScore : 0, score: score }] : [], hintsUsed: 0, hintLevelsShown: [], solutionShown: false, skipped: false, studentAnswer: answer, errorType: status === 'incorrect' && t.taskType === 'single_choice' && e.choice != null ? (t.distractorMap[(t.options[+e.choice] || {}).id] || null) : null, loop: false, presentedAt: null, answeredAt: null };
      });
      var at = { attemptNumber: 1, countsForMark: true, startedAt: kit.createdAt, lastActivityAt: now, fixedAt: now, status: 'completed', tasks: tasks, stagePlan: [{ stageId: 'paper', group: 'final', mode: 'CORE', plannedMax: U.sum(tasks.map(function (t) { return t.maxScore; })) }], stageState: { paper: { status: 'completed', activeSec: 0 } }, sessions: [], activeSec: 0, loops: [], reflection: null, pageLeaves: 0 };
      var r = K.schema.buildLessonReport({ lesson: Object.assign({}, lessonSpec, { title: kit.params.workLabel, subject: kit.params.subject, 'class': kit.params['class'] }), attempt: at, student: { studentId: null, name: st.name, 'class': st['class'] || kit.params['class'] }, now: now });
      r.source = 'paper_manual'; r.paper = { kitId: kit.kitId, variantCode: variantCode, sheetId: kit.kitId + '-' + variantCode + '-' + (si + 1), omrConfidence: null, flags: [] };
      r.context.lessonId = kit.kitId; r.context.moduleId = kit.kitId; r.context.lessonTitle = kit.params.workLabel + (kit.params.title ? ' · ' + kit.params.title : '');
      r.dedupeKey = K.schema.dedupeKey(r.student, r.context.lessonId, 1, kit.createdAt + '|' + variantCode);
      return r;
    });
  }

  K.paper = { WORK: WORK, LETTERS: LETTERS, safeHtml: safeHtml, encodeId: encodeId, decodeId: decodeId, collectPool: collectPool, blueprintOf: blueprintOf, build: build, validateKit: validateKit, variantHtml: variantHtml, keyHtml: keyHtml, sheetSvg: sheetSvg, reportsFromEntries: reportsFromEntries, estimate: estimate };
})(typeof window !== 'undefined' ? window : globalThis);
