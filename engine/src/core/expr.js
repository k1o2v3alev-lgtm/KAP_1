/* KAP engine · expr: безопасный разбор алгебраических выражений (AST) без eval и new Function.
   Проверка эквивалентности записей по набору контрольных точек. */
(function (root) {
  'use strict';
  var K = root.KAP = root.KAP || {};

  function tokenize(src) {
    var s = String(src == null ? '' : src)
      .replace(/[−–—]/g, '-').replace(/[·×∙⋅]/g, '*').replace(/÷/g, '/')
      .replace(/²/g, '^2').replace(/³/g, '^3').replace(/[хХ]/g, 'x').replace(/\s+/g, '').toLowerCase();
    var toks = [], i = 0, m;
    while (i < s.length) {
      var c = s[i];
      if ((m = /^\d+(?:[.,]\d+)?/.exec(s.slice(i)))) { toks.push({ t: 'n', v: parseFloat(m[0].replace(',', '.')) }); i += m[0].length; }
      else if (/[a-z]/.test(c)) { toks.push({ t: 'v', v: c }); i++; }
      else if ('+-*/^()'.indexOf(c) >= 0) { toks.push({ t: c }); i++; }
      else throw new Error('bad char ' + c);
    }
    return toks;
  }

  function parse(src) {
    var toks = tokenize(src), p = 0;
    function peek() { return toks[p]; }
    function startsFactor(t) { return t && (t.t === 'n' || t.t === 'v' || t.t === '('); }
    function expr() {
      var a = term();
      while (peek() && (peek().t === '+' || peek().t === '-')) { var op = toks[p++].t; a = { t: 'bin', op: op, a: a, b: term() }; }
      return a;
    }
    function term() {
      var a = unary();
      for (;;) {
        var k = peek();
        if (k && (k.t === '*' || k.t === '/')) { p++; a = { t: 'bin', op: k.t, a: a, b: unary() }; }
        else if (startsFactor(k)) { a = { t: 'bin', op: '*', a: a, b: unary() }; }
        else break;
      }
      return a;
    }
    function unary() {
      var k = peek();
      if (k && k.t === '-') { p++; return { t: 'neg', a: unary() }; }
      if (k && k.t === '+') { p++; return unary(); }
      return power();
    }
    function power() {
      var a = atom();
      if (peek() && peek().t === '^') { p++; return { t: 'bin', op: '^', a: a, b: unary() }; }
      return a;
    }
    function atom() {
      var k = toks[p++];
      if (!k) throw new Error('unexpected end');
      if (k.t === 'n') return { t: 'n', v: k.v };
      if (k.t === 'v') return { t: 'v', v: k.v };
      if (k.t === '(') { var e = expr(); if (!peek() || peek().t !== ')') throw new Error('missing )'); p++; return e; }
      throw new Error('unexpected ' + k.t);
    }
    var tree = expr();
    if (p !== toks.length) throw new Error('trailing tokens');
    return tree;
  }

  function evalNode(n, env) {
    switch (n.t) {
      case 'n': return n.v;
      case 'v': if (!(n.v in env)) throw new Error('free var ' + n.v); return env[n.v];
      case 'neg': return -evalNode(n.a, env);
      default:
        var a = evalNode(n.a, env), b = evalNode(n.b, env);
        if (n.op === '+') return a + b;
        if (n.op === '-') return a - b;
        if (n.op === '*') return a * b;
        if (n.op === '/') return a / b;
        return Math.pow(a, b);
    }
  }
  function vars(n, acc) {
    acc = acc || {};
    if (n.t === 'v') acc[n.v] = 1; else { if (n.a) vars(n.a, acc); if (n.b) vars(n.b, acc); }
    return acc;
  }

  var POINTS = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5, 0.7, 1.3, 4.25];
  /** Эквивалентны ли записи a и b как функции. Ошибка разбора → false. */
  function equivalent(a, b) {
    var ta, tb;
    try { ta = parse(a); tb = parse(b); } catch (e) { return false; }
    var names = Object.keys(Object.assign({}, vars(ta), vars(tb))).sort(), ok = 0;
    for (var i = 0; i < POINTS.length; i++) {
      var env = {};
      names.forEach(function (nm, j) { env[nm] = POINTS[(i + 3 * j) % POINTS.length] + j * 0.37; });
      var va, vb;
      try { va = evalNode(ta, env); vb = evalNode(tb, env); } catch (e) { return false; }
      if (!isFinite(va) || !isFinite(vb)) continue;
      if (Math.abs(va - vb) > 1e-9 * Math.max(1, Math.abs(va), Math.abs(vb))) return false;
      ok++;
    }
    return ok >= 5;
  }

  K.expr = { parse: parse, equivalent: equivalent };
})(typeof window !== 'undefined' ? window : globalThis);
