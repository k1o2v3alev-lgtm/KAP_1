/* Проверка адаптеров прежних схем на реальном корпусе (Приложение B: B18, B20).
   Запуск: node engine/tests/corpus.js <папка_с_json>
   Корпус содержит персональные данные и в репозиторий не кладётся; скрипт печатает только счётчики. */
'use strict';
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
if (!dir) { console.error('Укажи папку с JSON-файлами'); process.exit(2); }
globalThis.KAP = {}; require('../build/order.js').core.forEach(f => require(path.join(__dirname, '..', 'src', f)));
const K = KAP;
function walk(d, out) { let list = []; try { list = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return out; } list.forEach(e => { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.json')) out.push(p); }); return out; }
const files = walk(dir, []);
const fam = {}, unknown = [], problems = [], byId = new Map(), keyOwner = new Map();
let total = 0, dupExact = 0, dupKey = 0, bytes = new Map(), byteDup = 0;
files.forEach(f => {
  const raw = fs.readFileSync(f); const h = K.util.hashHex(raw.toString('utf8'));
  if (bytes.has(h)) byteDup++; else bytes.set(h, f);
  let o; try { o = JSON.parse(raw.toString('utf8').replace(/^﻿/, '')); } catch (e) { unknown.push('не JSON'); return; }
  const r = K.legacy.toReports(o); fam[r.family] = (fam[r.family] || 0) + 1;
  if (!r.family || (!r.reports.length && !r.extra)) unknown.push(r.family + ' ' + r.notes.join(';'));
  r.reports.forEach(rep => {
    total++;
    const p = [];
    if (!rep.student || !rep.student.name || rep.student.name === 'Без имени') p.push('нет имени');
    if (!rep.context.lessonId || rep.context.lessonId === 'unknown') p.push('нет lessonId');
    if (!rep.attempt.startedAt) p.push('нет startedAt');
    if (!Array.isArray(rep.tasks)) p.push('tasks');
    if (rep.legacy === false && K.schema.validateReport(rep).length) p.push('схема v1: ' + K.schema.validateReport(rep)[0]);
    if (rep.metrics.mark10 != null && (rep.metrics.mark10 < 0 || rep.metrics.mark10 > 10)) p.push('mark10 вне диапазона');
    if (p.length) problems.push(r.family + ': ' + p.join(', '));
    if (byId.has(rep.reportId)) dupExact++; else byId.set(rep.reportId, 1);
    if (keyOwner.has(rep.dedupeKey) && !byId.has('x' + rep.reportId)) dupKey++; else keyOwner.set(rep.dedupeKey, 1);
  });
});
console.log('Файлов:', files.length, '· отчётов получено:', total, '· побайтовых повторов файлов:', byteDup);
console.log('Семейства (файлов):', JSON.stringify(fam));
console.log('Повторы по reportId (после разворота):', dupExact, '· по dedupeKey:', dupKey);
console.log('Не распознано/не импортировано:', unknown.length, unknown.slice(0, 5));
console.log('Замечания к отчётам:', problems.length, JSON.stringify(problems.reduce((a, x) => (a[x] = (a[x] || 0) + 1, a), {})));
process.exit(unknown.length || problems.length ? 1 : 0);
