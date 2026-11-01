'use strict';
const K = globalThis.KAP, U = K.util, N = K.norm, S = K.scoring;

// ---------- ГСЧ и хеши ----------
test('ГСЧ воспроизводим по seed', () => {
  const a = U.makeRng(42), b = U.makeRng(42);
  eq([a.int(0, 99), a.int(0, 99), a.int(0, 99)], [b.int(0, 99), b.int(0, 99), b.int(0, 99)]);
  eq(U.makeRng(7).shuffle([1, 2, 3, 4, 5]), U.makeRng(7).shuffle([1, 2, 3, 4, 5]));
  ok(U.makeRng(1).next() !== U.makeRng(2).next());
});
test('канонический JSON не зависит от порядка ключей', () => {
  eq(U.canonical({ b: 1, a: [2, { d: 1, c: 2 }] }), U.canonical({ a: [2, { c: 2, d: 1 }], b: 1 }));
});

// ---------- нормализация ----------
test('B14: латинские двойники принимаются, орфография строгая', () => {
  eq(N.normText('Хлеб', 'default'), N.normText('xлеб', 'default'));
  ok(N.normText('қала', 'orthography') !== N.normText('кала', 'orthography'), 'қ ≠ к');
  ok(N.normText('ән', 'orthography') !== N.normText('ан', 'orthography'), 'ә ≠ а');
  ok(N.normText('үй', 'orthography') !== N.normText('уй', 'orthography'), 'ү ≠ у');
});
test('разбор чисел', () => {
  eq(N.parseNumber('1,5'), { n: 3, d: 2, form: 'decimal', reduced: true });
  eq(N.ratToStr(N.parseNumber('0.75')), '3/4');
  eq(N.ratToStr(N.parseNumber('1 1/2')), '3/2');
  eq(N.ratToStr(N.parseNumber('−2')), '-2');
  eq(N.parseNumber('1/0'), null);
  eq(N.parseNumber('abc'), null);
});

// ---------- проверка ответов ----------
const numTask = (value, extra) => ({ rule: Object.assign({ type: 'number', value }, extra || {}) });
test('эквивалентные записи числа принимаются', () => {
  const t = numTask({ n: 1, d: 2 });
  ['1/2', '0,5', '0.5', '2/4', ' 1 / 2 '].forEach(a => eq(K.check(t, a).status, 'correct', a));
  eq(K.check(t, '1/3').status, 'incorrect');
});
test('несокращённая дробь при требовании сокращения — частично', () => {
  const t = numTask({ n: 1, d: 2 }, { requireIrreducible: true });
  eq(K.check(t, '2/4').status, 'partial');
  eq(K.check(t, '1/2').status, 'correct');
});
test('B1: эквивалентные алгебраические записи', () => {
  const t = { rule: { type: 'expression', expected: '21x^2+3' } };
  ['21x^2+3', '21·x^2 + 3', '21*x² +3', '21х^2+3', '3+21x^2'].forEach(a => eq(K.check(t, a).status, 'correct', a));
  ['21x^2-3', '12x^2+3', '21x+3', 'x^2'].forEach(a => eq(K.check(t, a).status, 'incorrect', a));
  ok(!K.expr.equivalent('2(', 'x'), 'ошибка разбора → false');
  ok(K.expr.equivalent('-x^2', '-(x*x)'));
  ok(!K.expr.equivalent('1/x', 'x'));
});
test('B2: системы счисления и допустимые записи', () => {
  const t = { rule: { type: 'text', accepted: ['F', '15'], mode: 'default' } };
  ['F', 'f', ' 15 '].forEach(a => eq(K.check(t, a).status, 'correct', a));
  eq(K.check(t, '16').status, 'incorrect');
  const b = { rule: { type: 'base', base: 2, value: 10 } };
  ['1010', '0b1010', '10 10', '0000 1010'].forEach(a => eq(K.check(b, a).status, 'correct', a));
  eq(K.check(b, '1011').status, 'incorrect'); eq(K.check(b, '1012').status, 'incorrect');
  eq(K.parseHex === undefined ? N.parseInBase('0x0F', 16) : 15, 15);
});
test('B5: открытый ответ уходит учителю, а не «неверно»', () => {
  eq(K.check({ rule: { type: 'open' } }, 'любой верный текст').status, 'pending_review');
  eq(K.check({ rule: { type: 'open' } }, '').status, 'empty');
});
test('составные типы: выбор, множественный, порядок, соответствия', () => {
  eq(K.check({ rule: { type: 'choice', correctId: 'o0' }, distractorMap: { o1: 'rule' } }, 'o1').errorType, 'rule');
  const m = { rule: { type: 'multi', correctIds: ['o0', 'o2'] } };
  eq(K.check(m, ['o0', 'o2']).status, 'correct'); eq(K.check(m, ['o0']).status, 'partial'); eq(K.check(m, ['o1']).status, 'incorrect');
  const o = { rule: { type: 'ordering', order: ['a', 'b', 'c', 'd'] } };
  eq(K.check(o, ['a', 'b', 'c', 'd']).status, 'correct'); eq(K.check(o, ['a', 'b', 'd', 'c']).status, 'partial'); eq(K.check(o, ['d', 'c', 'b', 'a']).status, 'incorrect');
  const mt = { rule: { type: 'matching', pairs: { l1: 'r1', l2: 'r2' } } };
  eq(K.check(mt, { l1: 'r1', l2: 'r2' }).status, 'correct'); eq(K.check(mt, { l1: 'r1', l2: 'r1' }).status, 'partial');
});

// ---------- оценивание ----------
test('B22: совмещение коэффициентов подсказок и попыток', () => {
  eq(S.coefficient(1, 2, false), 0.75);
  eq(S.coefficient(0, 3, true), 0.4);
  eq(S.coefficient(2, 1, false), 0.4);
  eq(S.coefficient(0, 1, false), 1);
  eq(S.coefficient(0, 2, false), 0.85);
  eq(S.coefficient(0, 5, false), 0.7);
});
test('B21: выбор профиля и приоритет источников весов', () => {
  const r1 = S.resolveWeights({ assessmentType: 'formative', checkKind: 'learning' });
  eq([r1.profile, r1.source, r1.weights], ['learning', 'default', { diagnostic: 20, learning: 50, final: 30 }]);
  const r2 = S.resolveWeights({ checkKind: 'residual' });
  eq([r2.profile, r2.weights], ['final', { diagnostic: 20, learning: 30, final: 50 }]);
  eq(S.resolveWeights({ assessmentType: 'SOCH' }).profile, 'final');
  const r3 = S.resolveWeights({ lessonWeights: { diagnostic: 10, learning: 40, final: 50 }, checkKind: 'learning' });
  eq([r3.source, r3.profile, r3.weights.final], ['KSP', 'custom', 50]);
  const r4 = S.resolveWeights({ instruction: { final: 60 }, lessonWeights: { final: 50 } });
  eq([r4.source, r4.weights.final, r4.weights.learning], ['instruction', 60, 50]);
});

let tid = 0;
function T(group, subskillId, score, extra) {
  return Object.assign({ taskId: 't' + (++tid), stageId: group, group, mode: 'CORE', closed: true, status: score >= 1 ? 'correct' : (score > 0 ? 'partial' : 'incorrect'), score, maxScore: 1,
    attempts: [{ n: 1, fraction: score }], hintsUsed: 0, subskillId, descriptorIds: ['d1'], cognitiveLevel: 'reproduction' }, extra || {});
}
const LESSON = {
  lessonId: 'L', assessmentType: 'formative', checkKind: 'learning', weights: null,
  criteria: [{ criterionId: 'c1', text: 'К1', descriptors: [{ descriptorId: 'd1', text: 'Д1' }, { descriptorId: 'd2', text: 'Д2' }] }],
  subskills: [{ id: 's1', text: 'Поднавык 1' }, { id: 's2', text: 'Поднавык 2' }]
};
const PLAN = [{ stageId: 'diagnostic', group: 'diagnostic', plannedMax: 4 }, { stageId: 'learning', group: 'learning', plannedMax: 10 }, { stageId: 'final', group: 'final', plannedMax: 6 }];

test('формативная отметка без итоговой проверки: веса 20:50, охват виден', () => {
  const tasks = [T('diagnostic', 's1', 1), T('diagnostic', 's1', 0), T('learning', 's1', 1), T('learning', 's2', 1)];
  const c = S.computeMetrics({ tasks, stagePlan: PLAN, lesson: LESSON });
  eq(c.scoring.markBasis, 'formative_without_control');
  eq(c.metrics.mark10, Math.round(10 * (20 * 0.5 + 50 * 1) / 70 * 10) / 10);   // 8,6
  eq(c.metrics.completionPct, 20);                                                // 4 из 20
  eq(c.metrics.diagnosticPct, 50);
});
test('с итоговой проверкой: профиль learning 20/50/30', () => {
  const tasks = [T('diagnostic', 's1', 1), T('learning', 's1', 1), T('learning', 's2', 0), T('final', 's1', 1)];
  const c = S.computeMetrics({ tasks, stagePlan: PLAN, lesson: LESSON });
  eq(c.scoring.markBasis, 'with_control');
  eq(c.metrics.mark10, Math.round(10 * (20 * 1 + 50 * 0.5 + 30 * 1) / 100 * 10) / 10);  // 7,5
});
test('профиль final: 20/30/50 и потолок 84% при превышении времени', () => {
  const lesson = Object.assign({}, LESSON, { checkKind: 'quarter_final' });
  const tasks = [T('diagnostic', 's1', 1), T('learning', 's1', 1), T('final', 's1', 1), T('final', 's2', 1)];
  const ok1 = S.computeMetrics({ tasks, stagePlan: PLAN, lesson, finalTime: { limitSec: 600, activeSec: 500 } });
  eq(ok1.metrics.mark10, 10); eq(ok1.scoring.scoreCap.applied, false);
  const over = S.computeMetrics({ tasks, stagePlan: PLAN, lesson, finalTime: { limitSec: 600, activeSec: 900 } });
  eq(over.metrics.mark10, 8.4); eq(over.scoring.scoreCap.applied, true); eq(over.scoring.scoreCap.uncappedMark10, 10);
  eq(over.timeExceeded, true); eq(over.overtimeSec, 300);
  eq(over.metrics.achievementPct <= 84, true);
});
test('контрольная работа (СОР): отметка по контролю, формативная отдельно; потолок', () => {
  const lesson = Object.assign({}, LESSON, { assessmentType: 'SOR' });
  const tasks = [T('diagnostic', 's1', 1), T('learning', 's1', 0.5), T('final', 's1', 1), T('final', 's2', 1)];
  const c = S.computeMetrics({ tasks, stagePlan: PLAN, lesson, finalTime: { limitSec: 1500, activeSec: 2400 } });
  eq(c.scoring.markBasis, 'control_work'); eq(c.metrics.mark10, 8.4); eq(c.metrics.formativeMark10 !== null, true);
  const noOver = S.computeMetrics({ tasks, stagePlan: PLAN, lesson, finalTime: { limitSec: 1500, activeSec: 1000 } });
  eq(noOver.metrics.mark10, 10);
});
test('формативный урок: превышение времени не наказывается', () => {
  const tasks = [T('diagnostic', 's1', 1), T('learning', 's1', 1), T('final', 's1', 1)];
  const c = S.computeMetrics({ tasks, stagePlan: PLAN, lesson: LESSON, finalTime: { limitSec: 600, activeSec: 5000 } });
  eq(c.metrics.mark10, 10); eq(c.scoring.scoreCap.applied, false); eq(c.timeExceeded, true);
});
test('B24: окно 5, минимум 3 задания, средняя ≥ 0,8', () => {
  const m = (...s) => S.masteryOf(s.map(x => T('learning', 's1', x)));
  eq(m(1, 1).mastered, false);                    // меньше 3 заданий
  eq(m(1, 1, 0.5).mastered, true);                // средняя 0,83
  eq(m(1, 1, 1).mastered, true);
  eq(m(0, 0, 0, 1, 1, 1, 1, 1).mastered, true);   // в окне только последние 5
  eq(m(1, 0, 1, 0, 1).mastered, false);
});
test('B24: дескрипторы 80% / 40% / не предъявлялся / проверка учителя', () => {
  const tasks = [T('learning', 's1', 1, { descriptorIds: ['d1'] }), T('learning', 's1', 0, { descriptorIds: ['d1'] }), T('learning', 's1', 1, { descriptorIds: ['d1'] }),
    T('learning', 's1', 1, { descriptorIds: ['d1'] }), T('learning', 's1', 1, { descriptorIds: ['d1'] })];
  let c = S.computeMetrics({ tasks, stagePlan: PLAN, lesson: LESSON });
  eq(c.descriptorResults.map(d => d.status), ['achieved', 'not_shown']);
  const lessonT = Object.assign({}, LESSON);
  const t2 = [T('learning', 's1', 0, { descriptorIds: ['d1'] }), T('learning', 's1', 1, { descriptorIds: ['d1'] }), T('learning', 's1', 0, { descriptorIds: ['d1'] }), T('learning', 's1', 0.5, { descriptorIds: ['d2'], status: 'pending_review', score: null })];
  c = S.computeMetrics({ tasks: t2, stagePlan: PLAN, lesson: lessonT });
  eq(c.descriptorResults[0].status, 'not_yet');   // 1 из 3 = 33%
  eq(c.descriptorResults[1].status, 'teacher_review');
});
test('возвратные задания не меняют отметку, но влияют на освоение', () => {
  const base = [T('learning', 's1', 0), T('learning', 's1', 0)];
  const loops = [T('learning', 's1', 1, { loop: true }), T('learning', 's1', 1, { loop: true }), T('learning', 's1', 1, { loop: true })];
  const c = S.computeMetrics({ tasks: base.concat(loops), stagePlan: PLAN, lesson: LESSON });
  eq(c.metrics.accuracyPct, 0);
  eq(c.subskills[0].mastery.tasksInWindow, 5);
});
test('B25: итог по уроку — среднее лучшей и последней', () => {
  const rep = (n, mark, extra) => Object.assign({
    student: { name: 'Иван', class: '6А' }, context: { lessonId: 'L1' },
    attempt: { attemptNumber: n, completionReason: 'completed', countsForMark: true },
    scoring: { weightsProfile: 'learning', markBasis: 'with_control' },
    metrics: { mark10: mark, completionPct: 100, accuracyPct: mark * 10, achievementPct: mark * 10 }
  }, extra || {});
  const one = S.summarize([rep(1, 7)]); eq(one[0].mark10, 7);
  eq(S.summarize([rep(1, 6), rep(2, 8)])[0].mark10, 8);
  eq(S.summarize([rep(1, 8), rep(2, 6)])[0].mark10, 7);
  eq(S.summarize([rep(1, 7), rep(2, 9), rep(3, 8)])[0].mark10, 8.5);
  // без проверки не сравнивается с попытками с проверкой
  const mixed = S.summarize([rep(1, 9), rep(2, 4, { scoring: { weightsProfile: 'learning', markBasis: 'formative_without_control' } })]);
  eq(mixed[0].mark10, 9);
  // разные профили не усредняются
  const prof = S.summarize([rep(1, 9), rep(2, 5, { scoring: { weightsProfile: 'final', markBasis: 'with_control' } })]);
  eq(prof.length, 2);
  // исключённая учителем попытка не участвует
  eq(S.summarize([rep(1, 6), rep(2, 10, { attempt: { attemptNumber: 2, completionReason: 'completed', countsForMark: false } })])[0].mark10, 6);
  // незавершённые не участвуют
  eq(S.summarize([rep(1, 6), rep(2, 10, { attempt: { attemptNumber: 2, completionReason: 'student_stopped', countsForMark: true } })])[0].mark10, 6);
});
