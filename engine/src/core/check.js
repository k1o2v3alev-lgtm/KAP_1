/* KAP engine · check: проверка ответов по типу правила. Без eval/new Function. */
(function (root) {
  'use strict';
  var K = root.KAP = root.KAP || {};
  var N = K.norm;

  function res(status, fraction, normalized, errorType) {
    return { status: status, fraction: fraction, normalized: normalized == null ? null : normalized, errorType: errorType || null };
  }
  function isEmpty(a) {
    if (a == null) return true;
    if (typeof a === 'string') return a.trim() === '';
    if (Array.isArray(a)) return a.length === 0;
    if (typeof a === 'object') return Object.keys(a).length === 0;
    return false;
  }

  /** task.rule: см. раздел «Типы заданий» README. Возвращает {status, fraction, normalized, errorType}. */
  function check(task, ans) {
    var r = task.rule || task.evaluationRule || {};
    if (r.type === 'open') return isEmpty(ans) ? res('empty', 0) : res('pending_review', 0, String(ans).trim());
    if (isEmpty(ans)) return res('empty', 0);
    var i, hit;
    switch (r.type) {
      case 'choice':
        if (ans === r.correctId) return res('correct', 1, ans);
        return res('incorrect', 0, ans, (task.distractorMap && task.distractorMap[ans]) || 'concept');

      case 'multi': {
        var ids = Array.isArray(ans) ? ans : [], want = r.correctIds || [];
        var hits = ids.filter(function (x) { return want.indexOf(x) >= 0; }).length;
        var wrong = ids.length - hits, f = Math.max(0, (hits - wrong) / want.length);
        var norm = ids.slice().sort();
        if (hits === want.length && wrong === 0) return res('correct', 1, norm);
        return res(f > 0 ? 'partial' : 'incorrect', f, norm, wrong > 0 ? 'multi_extra' : 'multi_miss');
      }

      case 'number': {
        var v = N.parseNumber(ans);
        if (!v) return res('incorrect', 0, String(ans).trim(), 'format');
        var norm1 = N.ratToStr(v);
        if (r.tolerance) {
          var diff = Math.abs(v.n / v.d - r.value.n / r.value.d);
          if (diff <= r.tolerance) return res('correct', 1, norm1);
        } else if (N.ratEq(v, r.value)) {
          if (r.requireForm && v.form !== r.requireForm && !(r.requireForm === 'integer' && v.d === 1)) return res('partial', 0.5, norm1, 'form');
          if (r.requireIrreducible && !v.reduced) return res('partial', 0.5, norm1, 'not_reduced');
          return res('correct', 1, norm1);
        }
        var known = (r.wrongValues || []).filter(function (w) { return N.ratEq(v, w.value); })[0];
        return res('incorrect', 0, norm1, known ? known.errorType : 'calc');
      }

      case 'text': {
        var mode = r.mode || 'default', a = N.normText(ans, mode);
        for (i = 0; i < r.accepted.length; i++) if (N.normText(r.accepted[i], mode) === a) return res('correct', 1, a);
        hit = (r.wrongAnswers || []).filter(function (w) { return N.normText(w.text, mode) === a; })[0];
        return res('incorrect', 0, a, hit ? hit.errorType : 'concept');
      }

      case 'expression':
        return K.expr.equivalent(String(ans), r.expected) ? res('correct', 1, String(ans).replace(/\s+/g, ''))
          : res('incorrect', 0, String(ans).replace(/\s+/g, ''), 'calc');

      case 'base': {
        var val = N.parseInBase(ans, r.base);
        if (val == null) return res('incorrect', 0, String(ans).trim(), 'format');
        return val === r.value ? res('correct', 1, String(val)) : res('incorrect', 0, String(val), 'calc');
      }

      case 'ordering': {
        var o = Array.isArray(ans) ? ans : [], same = 0;
        for (i = 0; i < r.order.length; i++) if (o[i] === r.order[i]) same++;
        var fo = same / r.order.length;
        if (same === r.order.length) return res('correct', 1, o);
        return res(fo >= 0.5 ? 'partial' : 'incorrect', fo >= 0.5 ? fo : 0, o, 'order');
      }

      case 'matching': {
        var keys = Object.keys(r.pairs), ok = 0;
        keys.forEach(function (k) { if (ans[k] === r.pairs[k]) ok++; });
        var fm = ok / keys.length;
        if (ok === keys.length) return res('correct', 1, ans);
        return res(ok > 0 ? 'partial' : 'incorrect', fm, ans, 'match');
      }
      default:
        throw new Error('unknown rule type: ' + r.type);
    }
  }

  K.check = check;
})(typeof window !== 'undefined' ? window : globalThis);
