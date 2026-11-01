/* KAP engine · generators: реестр, сборка задания, валидатор, воспроизведение по seed, массовые тесты.
   Конвейер: ПАРАМЕТРЫ → УСЛОВИЕ → ОТВЕТ → ДИСТРАКТОРЫ → ВАЛИДАЦИЯ → ПЕРЕМЕШИВАНИЕ → ПРЕДЪЯВЛЕНИЕ. */
(function (root) {
  'use strict';
  var K = root.KAP = root.KAP || {};
  var U = K.util, N = K.norm;
  var registry = {};

  function register(def) {
    ['id', 'version', 'taskType', 'subskill', 'cognitiveLevel', 'generate'].forEach(function (k) { if (!def[k]) throw new Error('generator ' + (def.id || '?') + ': нет поля ' + k); });
    if (!def.profiles) def.profiles = { standard: {} };
    registry[def.id] = def;
    return def;
  }
  function get(id) { var d = registry[id]; if (!d) throw new Error('неизвестный генератор: ' + id); return d; }
  function list() { return Object.keys(registry).map(function (k) { return registry[k]; }); }
  function clear() { registry = {}; }

  /** Сборка: перемешивание и упаковка «сырого» результата generate(). */
  function assemble(def, profile, rng, raw) {
    var t = {
      taskType: def.taskType, condition: raw.condition, explanation: raw.explanation || '', hints: raw.hints || [],
      maxScore: def.maxScore || 1, cognitiveLevel: raw.cognitiveLevel || def.cognitiveLevel, subskillId: def.subskill,
      goalCode: def.goalCode || null, descriptorIds: def.descriptors || [], mode: def.mode || 'CORE',
      generator: { generatorId: def.id, generatorVersion: def.version, profile: profile, seed: null, parameters: raw.parameters || {} },
      options: null, optionOrder: null, correctOptionPosition: null, distractorMap: {}, rule: null, expectedAnswer: null, correctAnswer: null
    };
    var i, order;
    switch (def.taskType) {
      case 'single_choice': {
        var all = [{ text: raw.correct, errorType: null }].concat(raw.distractors || []);
        order = rng.shuffle(all.map(function (_, ix) { return ix; }));
        t.options = order.map(function (ix) { return { id: 'o' + ix, text: all[ix].text }; });
        t.optionOrder = order; t.correctOptionPosition = order.indexOf(0);
        all.forEach(function (o, ix) { if (ix > 0) t.distractorMap['o' + ix] = o.errorType || 'concept'; });
        t.rule = { type: 'choice', correctId: 'o0' }; t.correctAnswer = 'o0'; t.expectedAnswer = raw.correct;
        break;
      }
      case 'multi_choice': {
        var opts = raw.options;
        order = rng.shuffle(opts.map(function (_, ix) { return ix; }));
        t.options = order.map(function (ix) { return { id: 'o' + ix, text: opts[ix].text }; });
        t.optionOrder = order;
        var ids = opts.map(function (o, ix) { return o.correct ? 'o' + ix : null; }).filter(Boolean);
        t.rule = { type: 'multi', correctIds: ids }; t.correctAnswer = ids; t.expectedAnswer = ids.map(function (id) { return opts[+id.slice(1)].text; });
        opts.forEach(function (o, ix) { if (!o.correct) t.distractorMap['o' + ix] = o.errorType || 'concept'; });
        break;
      }
      case 'number':
        t.rule = { type: 'number', value: raw.value, requireIrreducible: !!raw.requireIrreducible, requireForm: raw.requireForm || null, tolerance: raw.tolerance || 0, wrongValues: raw.wrongValues || [] };
        t.correctAnswer = N.ratToStr(raw.value); t.expectedAnswer = raw.display || N.ratToStr(raw.value); break;
      case 'text':
        t.rule = { type: 'text', accepted: raw.accepted, mode: raw.mode || 'default', wrongAnswers: raw.wrongAnswers || [] };
        t.correctAnswer = raw.accepted[0]; t.expectedAnswer = raw.accepted.join(' / '); break;
      case 'expression':
        t.rule = { type: 'expression', expected: raw.expected }; t.correctAnswer = raw.expected; t.expectedAnswer = raw.expected; break;
      case 'base':
        t.rule = { type: 'base', base: raw.base, value: raw.value }; t.correctAnswer = raw.display || raw.value.toString(raw.base); t.expectedAnswer = t.correctAnswer; break;
      case 'ordering': {
        var correct = raw.items, shuffled = rng.shuffle(correct);
        for (i = 0; i < 20 && shuffled.every(function (x, ix) { return x.id === correct[ix].id; }); i++) shuffled = rng.shuffle(correct);
        t.items = shuffled; t.optionOrder = shuffled.map(function (x) { return correct.indexOf(x); });
        t.rule = { type: 'ordering', order: correct.map(function (x) { return x.id; }) };
        t.correctAnswer = t.rule.order; t.expectedAnswer = correct.map(function (x) { return x.text; }); break;
      }
      case 'matching': {
        var right = rng.shuffle(raw.right);
        t.left = raw.left; t.right = right; t.rule = { type: 'matching', pairs: raw.pairs };
        t.correctAnswer = raw.pairs; t.expectedAnswer = raw.left.map(function (l) { var r = raw.right.filter(function (x) { return x.id === raw.pairs[l.id]; })[0]; return l.text + ' → ' + r.text; });
        break;
      }
      case 'open':
        t.rule = { type: 'open', rubric: raw.rubric || '' }; t.expectedAnswer = raw.rubric || ''; t.correctAnswer = null; break;
      default: throw new Error('неизвестный тип задания: ' + def.taskType);
    }
    t.fingerprint = U.hashHex(U.canonical({ g: def.id, p: raw.parameters || {} }));
    return t;
  }

  /** Валидатор задания: возвращает массив проблем (пустой — задание принято). */
  function validateTask(t, def, minOptions) {
    var p = [], i;
    if (!t.condition || !String(t.condition).trim()) p.push('пустое условие');
    var rule = t.rule;
    if (t.taskType === 'single_choice') {
      var min = minOptions || def.minOptions || 3, seen = {};
      if (t.options.length < min) p.push('мало вариантов ответа');
      t.options.forEach(function (o) { var k = N.normText(o.text, 'default'); if (seen[k]) p.push('совпадающие варианты: ' + o.text); seen[k] = 1; });
      var cn = N.parseNumber(String(t.expectedAnswer));
      if (cn) t.options.forEach(function (o) { var v = N.parseNumber(o.text); if (v && o.id !== 'o0' && N.ratEq(v, cn)) p.push('дистрактор равен правильному ответу по значению'); });
    }
    if (t.taskType === 'multi_choice' && (!rule.correctIds.length || rule.correctIds.length === t.options.length)) p.push('нет различимых верных и неверных вариантов');
    if (t.taskType === 'number') {
      if (!rule.value || !rule.value.d) p.push('нет значения ответа');
      else (rule.wrongValues || []).forEach(function (w) { if (N.ratEq(w.value, rule.value)) p.push('wrongValue равен ответу'); });
    }
    if (t.taskType === 'ordering' && t.rule.order.length < 3) p.push('мало элементов последовательности');
    if (def.validate) { var extra = def.validate(t) || []; extra.forEach(function (m) { p.push(m); }); }
    // Самопроверка ключа: ответ из ключа должен быть засчитан, дистракторы — нет.
    if (t.taskType !== 'open') {
      var r1 = K.check(t, t.correctAnswer);
      if (r1.status !== 'correct') p.push('ключ не засчитывается: ' + r1.status);
      if (t.taskType === 'single_choice') Object.keys(t.distractorMap).forEach(function (id) { if (K.check(t, id).status === 'correct') p.push('дистрактор засчитан: ' + id); });
    }
    return p;
  }

  function tryOne(def, profile, seed) {
    var rng = U.makeRng(seed);
    var P = def.profiles[profile] || def.profiles.standard || {};
    var raw = def.generate(rng, P, profile);
    var t = assemble(def, profile, rng, raw);
    t.generator.seed = seed;
    return t;
  }

  /** Создаёт принятое задание. ctx: { seen:Set, stats:{} }. Возвращает задание с generator.seed (эффективным). */
  function make(genId, profile, seed, ctx) {
    ctx = ctx || {};
    var def = get(genId), stats = ctx.stats, lastValid = null;
    for (var k = 0; k < 80; k++) {
      var s = k === 0 ? (seed >>> 0) : U.deriveSeed(seed, 'retry' + k), t;
      try { t = tryOne(def, profile, s); } catch (e) { if (stats) { stats.exceptions++; (stats.errors = stats.errors || []).push(String(e && e.message)); } continue; }
      var probs = validateTask(t, def);
      if (probs.length) { if (stats) { stats.rejected++; probs.forEach(function (m) { stats.reasons[m] = (stats.reasons[m] || 0) + 1; }); } continue; }
      if (ctx.seen && ctx.seen.has(t.fingerprint)) { lastValid = t; if (stats) stats.duplicates++; continue; }
      if (ctx.seen) ctx.seen.add(t.fingerprint);
      if (stats) stats.accepted++;
      return t;
    }
    if (lastValid) { lastValid.repeat = true; return lastValid; }
    throw new Error('генератор ' + genId + ' не дал корректного задания');
  }

  /** Воспроизведение задания по записи отчёта: тот же seed, тот же профиль. */
  function reproduce(genId, profile, seed) { return tryOne(get(genId), profile, seed); }

  /** Массовое тестирование генератора (раздел 20.1–20.2). */
  function test(genId, n, opts) {
    opts = opts || {};
    var def = get(genId), prof = opts.profile || Object.keys(def.profiles)[0];
    var st = { generatorId: def.id, generatorVersion: def.version, profile: prof, tried: n, accepted: 0, rejected: 0, duplicates: 0, exceptions: 0, reasons: {}, errors: [] };
    var fps = {}, pos = {}, k = null, longest = 0, extreme = 0, choiceN = 0, optCounts = {};
    for (var i = 0; i < n; i++) {
      var seed = U.deriveSeed('selftest:' + def.id + ':' + prof, i), t;
      try { t = tryOne(def, prof, seed); } catch (e) { st.exceptions++; if (st.errors.length < 3) st.errors.push(String(e && e.message)); continue; }
      var probs = validateTask(t, def);
      if (probs.length) { st.rejected++; probs.forEach(function (m) { st.reasons[m] = (st.reasons[m] || 0) + 1; }); continue; }
      st.accepted++; fps[t.fingerprint] = 1;
      if (t.taskType === 'single_choice') {
        choiceN++; k = t.options.length; optCounts[k] = (optCounts[k] || 0) + 1;
        pos[t.correctOptionPosition] = (pos[t.correctOptionPosition] || 0) + 1;
        var len = t.options.map(function (o) { return String(o.text).length; }), cl = String(t.expectedAnswer).length, mx = Math.max.apply(null, len);
        if (cl === mx && len.filter(function (x) { return x === mx; }).length === 1) longest++;
        var nums = t.options.map(function (o) { return N.parseNumber(o.text); });
        if (nums.every(Boolean)) {
          var vals = nums.map(function (r) { return r.n / r.d; }), cv = N.parseNumber(String(t.expectedAnswer)); cv = cv.n / cv.d;
          if (cv === Math.max.apply(null, vals) || cv === Math.min.apply(null, vals)) extreme++;
        }
      }
    }
    st.uniqueVariants = Object.keys(fps).length;
    st.choiceCount = choiceN;
    st.positionPct = {}; Object.keys(pos).forEach(function (p) { st.positionPct[p] = U.round1(100 * pos[p] / choiceN); });
    st.longestCorrectPct = choiceN ? U.round1(100 * longest / choiceN) : null;
    st.extremeCorrectPct = choiceN ? U.round1(100 * extreme / choiceN) : null;
    st.optionCountMode = Object.keys(optCounts).sort(function (a, b) { return optCounts[b] - optCounts[a]; })[0] || null;
    st.verdict = verdict(st, def, opts);
    return st;
  }

  /** Критерии приёмки: ошибок нет; уникальность; позиция правильного ответа ≈ равномерна; нет перекоса «самый длинный». */
  function verdict(st, def, opts) {
    var problems = [], mu = opts.minUnique != null ? opts.minUnique : def.minUnique, need = (mu && typeof mu === 'object') ? (mu[st.profile] != null ? mu[st.profile] : 100) : (mu != null ? mu : 100);
    if (st.exceptions) problems.push('исключения: ' + st.exceptions);
    if (st.rejected > st.tried * 0.5) problems.push('слишком много отбракованных (' + st.rejected + ')');
    if (st.accepted < st.tried * 0.5) problems.push('принято менее половины');
    if (st.uniqueVariants < Math.min(need, st.accepted)) problems.push('мало различимых вариантов: ' + st.uniqueVariants + ' < ' + need);
    if (st.choiceCount >= 100 && st.optionCountMode) {
      var k = +st.optionCountMode, lo = 0.6 * 100 / k, hi = 1.4 * 100 / k;
      for (var p = 0; p < k; p++) { var v = st.positionPct[p] || 0; if (v < lo || v > hi) problems.push('позиция ' + p + ' правильного ответа: ' + v + '% вне [' + lo.toFixed(0) + '; ' + hi.toFixed(0) + ']'); }
      if (st.longestCorrectPct > hi) problems.push('правильный ответ слишком часто самый длинный: ' + st.longestCorrectPct + '%');
      if (st.extremeCorrectPct != null && k === 4 && st.extremeCorrectPct > 70) problems.push('правильное число слишком часто крайнее: ' + st.extremeCorrectPct + '%');
    }
    return { ok: problems.length === 0, problems: problems };
  }

  K.gen = { register: register, get: get, list: list, clear: clear, assemble: assemble, validateTask: validateTask, make: make, reproduce: reproduce, test: test, verdict: verdict };
})(typeof window !== 'undefined' ? window : globalThis);
