'use strict';
const K = globalThis.KAP, P = K.paper;
const LESSONS = K.PACK.lessons.map(l => l.lessonId);

test('код бланка: кодирование и чтение для всех комплектов и вариантов', () => {
  for (let k = 0; k < 16; k++) for (let v = 0; v < 4; v++) { const d = P.decodeId(P.encodeId(k, v)); eq([d.ok, d.kitIndex, d.variantIdx], [true, k, v]); }
});
test('код бланка: одиночная ошибка в ячейке обнаруживается', () => {
  for (let k = 0; k < 16; k += 5) for (let v = 0; v < 4; v++) for (let i = 0; i < 10; i++) { const b = P.encodeId(k, v); b[i] = 1 - b[i]; ok(!P.decodeId(b).ok, 'ошибка не обнаружена: ' + [k, v, i]); }
});
test('комплект на 4 варианта: единая спецификация, равные баллы, нет повторов, воспроизводимость', () => {
  const kit = P.build({ workType: 'sor', lessonIds: [LESSONS[1]], variantsCount: 4, taskCount: 10, seed: 12345, classNum: 8, durationMin: 20 });
  const v = P.validateKit(kit); eq(v.errors, []);
  eq(kit.variants.length, 4); eq(kit.blueprint.length, 10);
  const fps = new Set(); kit.variants.forEach(x => x.tasks.forEach(t => fps.add(t.fingerprint))); eq(fps.size, 40);
  ok(kit.blueprint.filter(b => b.omr).every((b, i, a) => b.position === i + 1), 'закрытые задания идут первыми для бланка');
  const again = P.build({ workType: 'sor', lessonIds: [LESSONS[1]], variantsCount: 4, taskCount: 10, seed: 12345, classNum: 8, durationMin: 20 });
  eq([again.kitId, again.keyHash], [kit.kitId, kit.keyHash]);
});
test('B-комплект: 100 построений с разными параметрами — ошибок валидации нет', () => {
  const types = Object.keys(P.WORK); let built = 0;
  for (let i = 0; i < 100; i++) {
    const lessons = i % 3 === 0 ? LESSONS : [LESSONS[i % 3 === 1 ? 0 : 1]];
    const kit = P.build({ workType: types[i % types.length], lessonIds: lessons, variantsCount: 1 + (i % 4), taskCount: 4 + (i % 9), seed: i * 7919 + 1, classNum: 6 + (i % 4), durationMin: 15, includeOpen: i % 2 === 0 });
    const v = P.validateKit(kit); if (v.errors.length) throw new Error('комплект ' + i + ': ' + v.errors[0]);
    built++;
  }
  eq(built, 100);
});
test('ручной ввод: верные, неверные и частичные ответы дают корректные показатели', () => {
  const kit = P.build({ workType: 'sor', lessonIds: [LESSONS[1]], variantsCount: 2, taskCount: 8, seed: 99, classNum: 8, includeOpen: false });
  const v = kit.variants[0], good = {}, bad = {};
  v.tasks.forEach(t => { if (t.taskType === 'single_choice') { good[t.position] = { choice: t.correctOptionPosition }; bad[t.position] = { choice: (t.correctOptionPosition + 1) % t.options.length }; } else { good[t.position] = { score: t.maxScore }; bad[t.position] = { score: 0 }; } });
  const reps = P.reportsFromEntries(kit, v.variantCode, [{ name: 'Ученик Первый', class: '8А' }, { name: 'Ученик Второй', class: '8А' }], [good, bad]);
  eq(reps.map(r => r.metrics.mark10), [10, 0]); eq(reps[0].scoring.markBasis, 'control_work'); eq(reps[0].source, 'paper_manual'); eq(reps[0].paper.variantCode, v.variantCode);
  eq(K.schema.validateReport(reps[0]), []);
  const ind = P.build({ workType: 'independent', lessonIds: [LESSONS[0]], variantsCount: 1, taskCount: 6, seed: 5, classNum: 6, includeOpen: false });
  const r2 = P.reportsFromEntries(ind, 'V1', [{ name: 'Тест Тестов', class: '6А' }], [Object.fromEntries(ind.variants[0].tasks.map(t => [t.position, t.taskType === 'single_choice' ? { choice: t.correctOptionPosition } : { score: t.maxScore }]))]);
  eq(r2[0].scoring.markBasis, 'with_control'); eq(r2[0].metrics.mark10, 10);
});
test('типичные ошибки класса видны по выбору дистракторов', () => {
  const kit = P.build({ workType: 'po', lessonIds: [LESSONS[0]], variantsCount: 1, taskCount: 6, seed: 3, classNum: 6, includeOpen: false });
  const t = kit.variants[0].tasks.filter(x => x.taskType === 'single_choice')[0], wrong = (t.correctOptionPosition + 1) % t.options.length;
  const r = P.reportsFromEntries(kit, 'V1', [{ name: 'Тест Тестов', class: '6А' }], [{ [t.position]: { choice: wrong } }])[0];
  ok(r.tasks.some(x => x.errorType), 'тип ошибки записан');
});
test('печатные формы: бланк содержит 4 метки и 10 ячеек кода; ключ — ответы; вариант — шапку', () => {
  const kit = P.build({ workType: 'sor', lessonIds: [LESSONS[1]], variantsCount: 2, taskCount: 8, seed: 1, classNum: 8 });
  const svg = P.sheetSvg(kit, 'V2'); eq((svg.match(/<rect /g) || []).length, 1 + 4 + 10);
  const key = P.keyHtml(kit); ok(key.includes('Ключ учителя') && key.includes('Тренировочный аналог'));
  ok(P.variantHtml(kit, kit.variants[0]).includes('Вариант 1'));
  ok(!P.safeHtml('<script>alert(1)</script><b>ok</b>').includes('<script'));
});
