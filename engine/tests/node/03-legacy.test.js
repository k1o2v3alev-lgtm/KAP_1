'use strict';
/* Адаптеры прежних схем на выдуманных (обезличенных) минимальных образцах. Реальный корпус: tests/corpus.js. */
const K = globalThis.KAP;
const samples = {
  F1: { schemaVersion: '1.0', materialVersion: '1.0.0', programMap: {}, assessmentType: ['formative'], subject: 'Информатика', class: '9', grade: 8, lessonId: 'g08_l005', moduleId: 'm1', materialId: 'inf08', student: 'Тест Тестов', attemptNumber: 1,
    startedAt: '2026-10-09T05:00:00Z', fixedAt: '2026-10-09T05:20:00Z', completionReason: 'completed', duration: 1013, completionPct: 100, accuracyPct: 70, achievementPct: 60, mark10: 6, stages: [{ stageId: 's1', title: 'a', type: 'learn', control: false, itemsTotal: 1, itemsDone: 1 }],
    tasks: [{ taskId: 't1', stageId: 's1', taskType: 'matching', presentedOptions: { a: 'x' }, status: 'correct', score: 1, maxScore: 1, attempts: 1, hintsUsed: 0 }, { taskId: 't2', stageId: 's1', taskType: 'open', presentedOptions: [{ id: 'a', text: 'x' }], status: 'saved', score: 0, maxScore: 1, attempts: 1 }] },
  F2: { schemaVersion: '1.0', appVersion: '1.0.0', moduleKind: 'СОР', materialId: 'm', moduleId: 'SOR-1', lessonId: 'SOR-1', subject: 'Математика', student: { id: 's1', name: 'Тест Тестов', class: '6' }, tasks: [],
    attempts: [{ attemptId: 'a1', kind: 'mock', attemptNumber: 1, startedAt: '2026-10-15T04:00:00Z', fixedAt: '2026-10-15T04:30:00Z', status: 'completed', completionReason: 'completed', mark10: 8, countsForMark: true, duration: 456, tasks: [{ taskId: 'x', stage: 'mock', taskType: 'single_choice', presentedOptions: [{ label: 'А', text: '2' }], status: 'correct', score: 1, maxScore: 1 }] },
      { attemptId: 'a2', kind: 'mock', attemptNumber: 2, startedAt: '2026-10-16T04:00:00Z', fixedAt: null, status: 'in_progress', completionReason: null, mark10: null, tasks: [] }] },
  F3: { app: 'old-app', version: 1, topic: 'Тема', goal: '7.2.1.2', fio: 'Тест Тестов', klass: '7', date: '2026-09-29T07:00:00Z', time_limit_sec: 900, time_spent_sec: 600, score: 5, total: 10, percent: 50, mark: 3, questions: [{ n: 1, text: 'q', correct_answer: 4, final_answer: 4, result: 'ok', wrong_attempts: 0, hints_shown: 0, attempts: [{ v: 4, ok: true, t_sec: 10 }] }] },
  F4: { schema: 'edu-trainer-report', formatVersion: '1.0', reportId: 'r4', generatedAt: '2026-10-08T06:35:49Z', student: { name: 'Тест Тестов', class: '8' }, trainer: { id: 'inf8', subject: 'Информатика', version: '1.0' }, module: { id: 'M2', number: 2, topic: 'T', goalCode: '8.2.1.1' },
    attempt: { number: 1, startedAt: '2026-10-08T06:20:00Z', committedAt: '2026-10-08T06:35:00Z', durationSec: 495, wallClockSec: 934, timeLimitSec: 900, endReason: 'completed' }, summary: { completionPct: 100, accuracyPct: 90, achievementPct: 95, score10: 9.5, finalPct: 80, diagnosticPct: 50 },
    items: [{ itemId: 'i1', stageId: 'final', type: 'text', prompt: 'p', verdict: 'partial', status: 'answered', score: 0.5, maxScore: 1, attempts: 2, hintsUsed: 1, needsTeacherReview: false }, { itemId: 'i2', stageId: 'final', type: 'open', prompt: 'p', verdict: 'not_done', status: 'answered', needsTeacherReview: true, maxScore: 1 }],
    stages: { diagnostic: null, learning: { stageId: 'l', title: 'L', completed: true }, final: { stageId: 'f', title: 'F', completed: true } }, scoring: { stageWeights: { learn: 0.2, practice: 0.3, final: 0.5 }, hintCoefficients: [1, 0.75, 0.4], attemptCoefficients: [1, 0.85, 0.7], solutionCoefficient: 0.4 } },
  F5: { schemaVersion: '1.0', kind: 'lesson-report', reportId: 'r5', createdAt: '2026-10-12T07:36:30Z', package: { packageId: 'p', subject: 'Информатика', class: '11' }, student: { fio: 'Тест Тестов', class: '10' },
    attempt: { number: 1, status: 'completed', startedAt: '2026-10-12T06:56:00Z', finishedAt: '2026-10-12T07:35:00Z', activeSeconds: 1775 }, lesson: { lessonId: 'l10', moduleId: 'm3', title: 'T', learningObjectives: ['11.1.2.4'] },
    metrics: { completionPct: 100, accuracyPct: 77, achievementPct: 60, mark10: 6, markProvisional: true, club: { tasksTotal: 2, tasksClosed: 1, achievementPct: 20 } }, criteria: [{ id: 'k1', text: 'K', descriptors: [{ id: 'd1', text: 'D', masteryPct: 85 }] }],
    tasks: [{ taskId: 'a', category: 'classification', correct: true, closed: true, evaluation: { raw: 1, bestRaw: 1 }, generator: { id: 'g', version: 1 }, seed: 5, attemptsHistory: [{ raw: 1, full: true }] }] },
  F6: { 'схема': 'сор-результат/1', 'длительность_сек': 1201, 'завершено': 'таймер', 'лимит_мин': 20, 'начало': '2026-10-15T08:57:18Z', 'окончание': '2026-10-15T09:17:19Z', 'предмет': 'Информатика', 'раздел': '11.1А', 'сор_id': 'СОР-1', 'уходы_со_страницы': 5,
    'учащийся': { 'ФИО': 'Тест Тестов', 'класс': '10' }, 'итог': { 'балл': 9, 'макс': 16, 'процент': 56.3, 'ожидают_проверки_учителем': 7 }, 'по_критериям': { 'К1': { ball: 6, max: 11, procent: 54.5 } },
    'задания': [{ 'номер': 1, 'форма': 'выбор', 'время_сек': 10, 'дескрипторы': [{ id: 'Д1', 'макс': 1, 'итог': 1, 'требует_проверки': false }] }, { 'номер': 2, 'форма': 'текст', 'время_сек': 50, 'дескрипторы': [{ id: 'Д2', 'макс': 2, 'итог': null, 'требует_проверки': true }] }] },
  F8: { schemaVersion: 'derivative-report-1.0', appVersion: '1.0.0', status: 'Завершён', timeSeconds: 85759, startedAt: '2026-09-03T04:24:55Z', fixedAt: '2026-09-04T04:14:14Z', attemptNumber: 1, goalCode: '10.3.1.18', lessonNumber: 1, lessonTitle: 'T', completionPercent: 100, accuracyPercent: 58, achievedPercent: 55, grade10: 5.5,
    studentName: 'Тест Тестов', studentId: 'student-1', className: '11', stageResults: { diagnostic: 50, final: 40 }, tasks: [{ questionId: 'q1', stage: 'final', correct: false, credit: 50, attempts: 2, hints: 1, timeSec: 20 }], subskills: { 'правило': { done: 2, correct: 1, percent: 50 } } }
};

test('B18: формат определяется по ключам, а не по schemaVersion', () => {
  ['F1', 'F2', 'F5'].forEach(f => { const s = samples[f]; if (f !== 'F5') s.schemaVersion = '1.0'; });
  Object.keys(samples).forEach(f => { const d = K.legacy.detect(samples[f]); if (f === 'F7') return; if (d !== f) throw new Error(f + ' определён как ' + d); });
});
test('адаптеры дают отчёты с именем, уроком и пометкой legacy', () => {
  Object.keys(samples).forEach(f => {
    const r = K.legacy.toReports(samples[f]);
    if (!r.reports.length) throw new Error(f + ': нет отчётов · ' + r.notes);
    r.reports.forEach(x => { if (!(x.legacy && x.student.name === 'Тест Тестов' && x.context.lessonId && Array.isArray(x.tasks))) throw new Error(f + ': неполный отчёт'); });
  });
});
test('F2: каждая попытка — отдельный отчёт', () => { eq(K.legacy.toReports(samples.F2).reports.length, 2); });
test('F1: class и grade расходятся — предупреждение; assessmentType-массив → строка', () => {
  const r = K.legacy.toReports(samples.F1).reports[0];
  eq(r.context.assessmentType, 'formative'); ok(r.integrity.warnings.some(w => w.indexOf('class и grade') >= 0));
  eq(r.tasks.map(t => t.status), ['correct', 'pending_review']);
});
test('F4: активное и календарное время разделены, открытые ответы — учителю', () => {
  const r = K.legacy.toReports(samples.F4).reports[0];
  eq([r.time.activeTimeSec, r.time.elapsedWallTimeSec, r.time.timeLimitSec], [495, 934, 900]); eq(r.tasks.map(t => t.status), ['partial', 'pending_review']); eq(r.scoring.markBasis, 'with_control');
});
test('F6: остановка по таймеру и ожидающие проверки; отметка /10 не выдумывается', () => {
  const r = K.legacy.toReports(samples.F6).reports[0];
  eq(r.attempt.completionReason, 'time_expired'); eq(r.metrics.mark10, null); eq(r.tasks.map(t => t.status), ['correct', 'pending_review']); eq(r.time.pageLeaves, 5);
});
test('F8: timeSeconds — календарный интервал, а не активное время', () => {
  const r = K.legacy.toReports(samples.F8).reports[0];
  eq(r.time.elapsedWallTimeSec, 85759); eq(r.time.activeTimeSec, null); eq(r.metrics.mark10, 5.5);
});
test('F3: старая оценка mark не превращается в mark10', () => {
  const r = K.legacy.toReports(samples.F3).reports[0]; eq(r.metrics.mark10, null); eq(r.legacyMark, 3);
});
test('повторный разбор того же файла даёт тот же reportId (дубликаты определяются)', () => {
  eq(K.legacy.toReports(samples.F3).reports[0].reportId, K.legacy.toReports(samples.F3).reports[0].reportId);
});
test('база OMR не принимается за отчёт; пакет разворачивается', () => {
  const r = K.legacy.toReports({ omr_template: {}, works: [] }); eq(r.family, 'omr_db'); eq(r.reports.length, 0);
  eq(K.legacy.toReports({ type: 'bundle', reports: [samples.F1, samples.F1] }).reports.length, 2);
});
