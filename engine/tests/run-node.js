/* Запуск Node-тестов ядра: node engine/tests/run-node.js */
'use strict';
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const ORDER = require('../build/order.js');

// Загружаем ядро (без интерфейса) в общее глобальное пространство
globalThis.KAP = globalThis.KAP || {};
ORDER.core.forEach(f => require(path.join(SRC, f)));
require(path.join(__dirname, '..', 'content', 'demo', 'pack.js'));
require(path.join(SRC, 'teacher', 'paper.js'));

let passed = 0, failed = 0;
const failures = [];
globalThis.test = function (name, fn) {
  try { fn(); passed++; } catch (e) { failed++; failures.push(name + ': ' + (e && e.message)); }
};
globalThis.eq = function (a, b, msg) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error((msg || 'eq') + ' · получено ' + x + ', ожидалось ' + y);
};
globalThis.ok = function (c, msg) { if (!c) throw new Error(msg || 'ok'); };

const dir = __dirname + '/node';
fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).sort().forEach(f => require(path.join(dir, f)));

console.log('Тесты ядра: пройдено ' + passed + ', не пройдено ' + failed);
failures.forEach(f => console.log('  ✗ ' + f));
process.exit(failed ? 1 : 0);
