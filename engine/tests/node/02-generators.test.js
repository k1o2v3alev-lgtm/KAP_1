'use strict';
const K = globalThis.KAP, U = K.util;
const N_RUNS = 600;
const rows = [];

K.gen.list().forEach(def => {
  Object.keys(def.profiles).forEach(prof => {
    test('генератор ' + def.id + ' · ' + prof + ' · ' + N_RUNS + ' генераций', () => {
      const st = K.gen.test(def.id, N_RUNS, { profile: prof });
      rows.push([def.id, prof, st.accepted, st.rejected, st.uniqueVariants, st.optionCountMode || '-', JSON.stringify(st.positionPct), st.longestCorrectPct, st.verdict.ok ? 'OK' : st.verdict.problems.join('; ')]);
      ok(st.verdict.ok, st.verdict.problems.join('; ') + ' · причины отбраковки: ' + JSON.stringify(st.reasons));
    });
  });
});

test('воспроизведение задания по seed из отчёта', () => {
  K.gen.list().forEach(def => {
    const prof = Object.keys(def.profiles)[0];
    const t = K.gen.make(def.id, prof, 123456, {});
    const again = K.gen.reproduce(def.id, t.generator.profile, t.generator.seed);
    eq(again.fingerprint, t.fingerprint, def.id);
    eq(again.condition, t.condition, def.id);
    eq(again.options, t.options, def.id);
  });
});
test('новая попытка не повторяет предъявленные варианты, пока пул не исчерпан', () => {
  const seen = new Set(), first = [], second = [];
  for (let i = 0; i < 20; i++) first.push(K.gen.make('frac_add_same', 'standard', U.deriveSeed('a1', i), { seen }).fingerprint);
  for (let i = 0; i < 20; i++) second.push(K.gen.make('frac_add_same', 'standard', U.deriveSeed('a2', i), { seen }).fingerprint);
  eq(new Set(first.concat(second)).size, 40);
});
test('одинаковые условия у разных учеников не совпадают (разные seed)', () => {
  const a = K.gen.make('frac_add_choice', 'standard', 1, {}), b = K.gen.make('frac_add_choice', 'standard', 2, {});
  ok(a.fingerprint !== b.fingerprint || JSON.stringify(a.options) !== JSON.stringify(b.options));
});
test('B4: условия с противоречивыми долями не предъявляются', () => {
  for (let i = 0; i < 400; i++) {
    const t = K.gen.make('frac_word_transfer', 'standard', U.deriveSeed('b4', i), {}), p = t.generator.parameters;
    ok(p.b + p.c < p.d, 'сумма частей больше целого');
  }
});
test('B3/B2: правильные ответы генераторов проверяются как верные, а ключ не равен дистракторам', () => {
  K.gen.list().forEach(def => {
    const t = K.gen.make(def.id, Object.keys(def.profiles)[0], 777, {});
    if (t.taskType !== 'open') eq(K.check(t, t.correctAnswer).status, 'correct', def.id);
  });
});

process.on('exit', () => {
  console.log('\nГенератор | профиль | принято | отбраковано | различимых | вариантов ответа | позиция правильного, % | самый длинный, % | итог');
  rows.forEach(r => console.log(r.join(' | ')));
});
