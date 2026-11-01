/* KAP engine · util: ГСЧ с seed, хеши, канонический JSON, время, экранирование. */
(function (root) {
  'use strict';
  var K = root.KAP = root.KAP || {};

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seed) {
    var f = mulberry32(seed);
    return {
      seed: seed >>> 0,
      next: f,
      int: function (a, b) { return a + Math.floor(f() * (b - a + 1)); },
      pick: function (arr) { return arr[Math.floor(f() * arr.length)]; },
      chance: function (p) { return f() < p; },
      shuffle: function (arr) {
        var x = arr.slice();
        for (var i = x.length - 1; i > 0; i--) {
          var j = Math.floor(f() * (i + 1)); var t = x[i]; x[i] = x[j]; x[j] = t;
        }
        return x;
      }
    };
  }

  function cyrb53(str, seed) {
    seed = seed || 0;
    var h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  function hashHex(str) { var s = cyrb53(String(str)).toString(16); while (s.length < 14) s = '0' + s; return s; }
  function deriveSeed(base, label) { return cyrb53(String(base) + '|' + String(label)) >>> 0; }

  function randomSeed() {
    try {
      var a = new Uint32Array(1); root.crypto.getRandomValues(a); return a[0];
    } catch (e) { return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0; }
  }
  function uuid() {
    try { if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID(); } catch (e) { /* ниже запасной */ }
    var s = '';
    for (var i = 0; i < 4; i++) { var r = (randomSeed() >>> 0).toString(16); while (r.length < 8) r = '0' + r; s += r; }
    return s.slice(0, 8) + '-' + s.slice(8, 12) + '-4' + s.slice(13, 16) + '-a' + s.slice(17, 20) + '-' + s.slice(20, 32);
  }

  function canonical(o) {
    if (o === null || typeof o !== 'object') return JSON.stringify(o === undefined ? null : o);
    if (Array.isArray(o)) return '[' + o.map(canonical).join(',') + ']';
    return '{' + Object.keys(o).sort().map(function (k) { return JSON.stringify(k) + ':' + canonical(o[k]); }).join(',') + '}';
  }

  function sha256Hex(str) {
    try {
      if (root.crypto && root.crypto.subtle) {
        return root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
          return { algorithm: 'SHA-256', hash: Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('') };
        });
      }
    } catch (e) { /* запасной вариант */ }
    return Promise.resolve({ algorithm: 'cyrb53', hash: hashHex(str) });
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function nowIso(d) {
    d = d || new Date();
    var off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-'; off = Math.abs(off);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + sign + pad(Math.floor(off / 60)) + ':' + pad(off % 60);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function round1(x) { return Math.round(x * 10) / 10; }
  function round2(x) { return Math.round(x * 100) / 100; }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; }
  function sum(arr) { var s = 0; for (var i = 0; i < arr.length; i++) s += arr[i]; return s; }

  K.util = { mulberry32: mulberry32, makeRng: makeRng, cyrb53: cyrb53, hashHex: hashHex, deriveSeed: deriveSeed, randomSeed: randomSeed, uuid: uuid, canonical: canonical, sha256Hex: sha256Hex, nowIso: nowIso, esc: esc, clone: clone, round1: round1, round2: round2, gcd: gcd, sum: sum };
})(typeof window !== 'undefined' ? window : globalThis);
