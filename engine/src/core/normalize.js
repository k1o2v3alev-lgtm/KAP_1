/* KAP engine · normalize: нормализация текста и чисел, точные дроби, системы счисления. */
(function (root) {
  'use strict';
  var K = root.KAP = root.KAP || {};
  var gcd = K.util.gcd;

  // Латинские двойники кириллических букв (проверка по строчным).
  var LOOK = { a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', i: 'і', k: 'к', m: 'м', t: 'т' };

  /** mode: default | orthography | exact */
  function normText(s, mode) {
    s = String(s == null ? '' : s).normalize('NFC').replace(/[   ]/g, ' ').trim().replace(/\s+/g, ' ');
    if (mode === 'exact') return s;
    s = s.toLowerCase();
    if (mode === 'orthography') return s;               // ә ≠ а, қ ≠ к, ү ≠ у
    s = s.replace(/ё/g, 'е').replace(/[.,;:!?]+$/, '');
    return s.replace(/[a-z]/g, function (c) { return LOOK[c] || c; });
  }

  // ---- рациональные числа ----
  function rat(n, d) {
    if (d === 0) return null;
    if (d < 0) { n = -n; d = -d; }
    var g = gcd(n, d) || 1;
    return { n: n / g, d: d / g };
  }
  function ratEq(a, b) { return !!a && !!b && a.n === b.n && a.d === b.d; }
  function ratAdd(a, b) { return rat(a.n * b.d + b.n * a.d, a.d * b.d); }
  function ratSub(a, b) { return rat(a.n * b.d - b.n * a.d, a.d * b.d); }
  function ratMul(a, b) { return rat(a.n * b.n, a.d * b.d); }
  function ratToStr(r) { return r.d === 1 ? String(r.n) : r.n + '/' + r.d; }

  /** Разбор числа: целое, десятичное (точка/запятая), дробь a/b, смешанное "1 1/2". Возвращает {n,d,form,reduced} либо null. */
  function parseNumber(str) {
    var s = String(str == null ? '' : str).replace(/[−–]/g, '-').replace(/[   ]/g, ' ').trim();
    if (!s) return null;
    var m, r;
    if ((m = /^([+-]?)(\d{1,9})\s+(\d{1,9})\s*\/\s*(\d{1,9})$/.exec(s))) {
      var w = +m[2], a = +m[3], b = +m[4]; if (b === 0) return null;
      r = rat((m[1] === '-' ? -1 : 1) * (w * b + a), b); r.form = 'mixed'; r.reduced = gcd(a, b) === 1; return r;
    }
    if ((m = /^([+-]?\d{1,9})\s*\/\s*(\d{1,9})$/.exec(s))) {
      var n0 = +m[1], d0 = +m[2]; if (d0 === 0) return null;
      r = rat(n0, d0); r.form = 'fraction'; r.reduced = gcd(n0, d0) === 1; return r;
    }
    if ((m = /^([+-]?)(\d{1,9})(?:[.,](\d{1,9}))?$/.exec(s))) {
      var frac = m[3] || '', den = Math.pow(10, frac.length);
      r = rat((m[1] === '-' ? -1 : 1) * (+(m[2] + frac)), den); r.form = frac ? 'decimal' : 'integer'; r.reduced = true; return r;
    }
    return null;
  }

  /** Число в системе счисления base (2..36) из строки; разделители групп и префиксы 0b/0x допускаются. */
  function parseInBase(str, base) {
    var s = String(str == null ? '' : str).trim().toLowerCase().replace(/[\s_']/g, '');
    s = s.replace(/^0b/, '').replace(/^0x/, '').replace(/^0o/, '');
    if (!s) return null;
    var digits = '0123456789abcdefghijklmnopqrstuvwxyz', v = 0;
    for (var i = 0; i < s.length; i++) {
      var d = digits.indexOf(s[i]);
      if (d < 0 || d >= base) return null;
      v = v * base + d;
      if (v > 9007199254740991) return null;
    }
    return v;
  }

  K.norm = { normText: normText, rat: rat, ratEq: ratEq, ratAdd: ratAdd, ratSub: ratSub, ratMul: ratMul, ratToStr: ratToStr, parseNumber: parseNumber, parseInBase: parseInBase };
})(typeof window !== 'undefined' ? window : globalThis);
