/* ДЕМОНСТРАЦИОННОЕ СОДЕРЖАНИЕ для проверки ядра. Не является КСП и не привязано к программе РК.
   Показывает, как один и тот же движок работает с разными предметами: математика 6 и информатика 8. */
(function (root) {
  'use strict';
  var K = root.KAP = root.KAP || {};
  var N = K.norm, U = K.util;

  // ---------- вспомогательное ----------
  function fr(n, d) { return '<span class="fr"><i>' + n + '</i><b>' + d + '</b></span>'; }
  var SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  function sup(n) { return String(n).split('').map(function (c) { return SUP[+c]; }).join(''); }
  function sub2(s) { return s + '₂'; }
  function bin(n) { return n.toString(2); }
  function rev(s) { return s.split('').reverse().join(''); }
  function reduced(n, d) { return N.rat(n, d); }
  // Выбор формулировок дистракторов так, чтобы верный ответ не был систематически самым длинным.
  function pickBalanced(rng, correct, slots) {
    var chosen = slots.map(function (arr) { return rng.pick(arr); });
    var maxLen = Math.max.apply(null, chosen.map(function (c) { return c.length; }));
    if (correct.length > maxLen && rng.chance(0.85)) {
      var i = rng.int(0, slots.length - 1), longer = slots[i].filter(function (x) { return x.length >= correct.length; });
      chosen[i] = longer.length ? rng.pick(longer) : slots[i].slice().sort(function (a, b) { return b.length - a.length; })[0];
    }
    return chosen;
  }

  // =====================  МАТЕМАТИКА · дроби  =====================
  var READ_TPL = [
    function (d, a) { return 'Полоса разделена на ' + d + ' равных частей, закрашено ' + a + '. Какая дробь показывает закрашенную часть?'; },
    function (d, a) { return 'Шоколадка состоит из ' + d + ' одинаковых долек, съели ' + a + '. Какая дробь показывает съеденную часть?'; },
    function (d, a) { return 'Забор состоит из ' + d + ' одинаковых досок, покрашено ' + a + '. Какая дробь показывает покрашенную часть?'; }
  ];
  K.gen.register({
    id: 'frac_read_part', version: '1.1', taskType: 'single_choice', subskill: 'm_read', cognitiveLevel: 'recognition', minUnique: 100,
    profiles: { standard: { dMin: 3, dMax: 14 } },
    generate: function (rng, P) {
      var d = rng.int(P.dMin, P.dMax), a = rng.int(1, d - 1), t = rng.int(0, READ_TPL.length - 1), bars = '';
      for (var i = 0; i < d; i++) bars += '<span class="bar' + (i < a ? ' on' : '') + '"></span>';
      return {
        parameters: { a: a, d: d, t: t },
        condition: READ_TPL[t](d, a) + '<div class="bars">' + bars + '</div>',
        correct: a + '/' + d,
        distractors: [{ text: d + '/' + a, errorType: 'inverted' }, { text: (d - a) + '/' + d, errorType: 'complement' }, { text: a + '/' + (d - a), errorType: 'part_to_part' }, { text: a + '/' + (d + 1), errorType: 'miscount' }].filter(function (x) { return x.text !== a + '/' + d; }).slice(0, 3),
        hints: ['Знаменатель показывает, на сколько равных частей разделено целое.', 'Числитель показывает, сколько частей закрашено.'],
        explanation: 'Всего частей — ' + d + ', выделено — ' + a + '. Значит, это ' + fr(a, d) + '.'
      };
    }
  });

  K.gen.register({
    id: 'frac_add_same', version: '1.0', taskType: 'number', subskill: 'm_add', cognitiveLevel: 'reproduction',
    profiles: { basic: { dMin: 3, dMax: 10, improper: false, reducible: false }, standard: { dMin: 4, dMax: 12, improper: true, reducible: false }, advanced: { dMin: 6, dMax: 16, improper: true, reducible: true } },
    minUnique: { basic: 90, standard: 100, advanced: 100 },
    generate: function (rng, P) {
      for (var g = 0; g < 200; g++) {
        var d = rng.int(P.dMin, P.dMax), a = rng.int(1, d - 1), b = rng.int(1, d - 1), s = a + b;
        if (!P.improper && s >= d) continue;
        if (P.reducible && N.rat(s, d).d === d) continue;
        if (!P.reducible && P.improper === false && N.rat(s, d).d !== d) { /* допускаем */ }
        return {
          parameters: { a: a, b: b, d: d, red: !!P.reducible },
          condition: 'Вычисли: ' + fr(a, d) + ' + ' + fr(b, d) + (P.reducible ? ' (ответ запиши сокращённой дробью)' : ''),
          value: N.rat(s, d), requireIrreducible: !!P.reducible, display: s + '/' + d,
          wrongValues: [{ value: reduced(s, 2 * d), errorType: 'denominator_added' }, { value: reduced(a * b, d), errorType: 'numerators_multiplied' }],
          hints: ['Доли одного размера: знаменатель показывает размер доли, он не меняется.', 'Сложи только числители: ' + a + ' + ' + b + '.'],
          explanation: fr(a, d) + ' + ' + fr(b, d) + ' = ' + fr(a + '+' + b, d) + ' = ' + fr(s, d) + (P.reducible ? ' = ' + fr(N.rat(s, d).n, N.rat(s, d).d) : '') + '. Знаменатель остаётся ' + d + '.'
        };
      }
      throw new Error('нет параметров');
    }
  });

  var CONTEXTS = [
    'Из пирога сначала съели %A%, потом ещё %B% пирога. Какую часть пирога съели?',
    'Турист в первый день прошёл %A% маршрута, во второй день ещё %B% маршрута. Какую часть маршрута он прошёл?',
    'В бассейн налили %A% его объёма, затем долили ещё %B% объёма. Какая часть бассейна заполнена?',
    'Огородник вскопал %A% участка утром и %B% участка днём. Какую часть участка вскопали?',
    'От ленты отрезали %A% её длины, а потом ещё %B% длины. Какую часть ленты отрезали?',
    'Книгу читали два вечера: %A% книги в первый вечер и %B% книги во второй. Какую часть книги прочитали?'
  ];
  K.gen.register({
    id: 'frac_add_choice', version: '1.0', taskType: 'single_choice', subskill: 'm_add', cognitiveLevel: 'understanding',
    profiles: { standard: { dMin: 5, dMax: 12 } },
    generate: function (rng, P) {
      var d = rng.int(P.dMin, P.dMax), a = rng.int(1, d - 2), b = rng.int(1, d - 1 - a), s = a + b, ci = rng.int(0, CONTEXTS.length - 1);
      var pool = [{ text: s + '/' + (2 * d), errorType: 'denominator_added' }, { text: String(s), errorType: 'denominator_dropped' }, { text: (a * b) + '/' + d, errorType: 'numerators_multiplied' }, { text: Math.abs(a - b) + '/' + d, errorType: 'subtracted' }, { text: s + '/' + (d + 1), errorType: 'denominator_changed' }];
      var picked = rng.shuffle(pool).slice(0, 3);
      return {
        parameters: { a: a, b: b, d: d, ctx: ci },
        condition: CONTEXTS[ci].replace('%A%', fr(a, d)).replace('%B%', fr(b, d)),
        correct: s + '/' + d, distractors: picked,
        hints: ['Это сложение долей одного размера.', 'Размер доли (знаменатель) не меняется: ' + d + '.'],
        explanation: fr(a, d) + ' + ' + fr(b, d) + ' = ' + fr(s, d) + '.'
      };
    }
  });

  K.gen.register({
    id: 'frac_find_error', version: '1.1', taskType: 'single_choice', subskill: 'm_rule', cognitiveLevel: 'understanding',
    profiles: { standard: { dMin: 5, dMax: 12 } },
    generate: function (rng, P) {
      var d = rng.int(P.dMin, P.dMax), a = rng.int(1, d - 2), b = rng.int(1, d - 1 - a), kind = rng.int(0, 1), s = a + b, cond, correct, dis, d2 = Math.max(2, d - 1);
      if (kind === 0) {
        cond = 'Ученик решил так: ' + fr(a, d) + ' + ' + fr(b, d) + ' = ' + fr(s, 2 * d) + '. В чём ошибка?';
        correct = rng.pick(['Знаменатель нельзя складывать: он остаётся ' + d, 'При сложении долей одного размера знаменатель не меняется: он остаётся равным ' + d, 'Доли одного размера, поэтому знаменатель остаётся ' + d, 'Знаменатель нужно оставить прежним, ' + d + ', а складывать только числители']);
        var p0 = pickBalanced(rng, correct, [
          ['Числители нужно было перемножить, а не сложить', 'Нужно было вычесть меньший числитель из большего, а не складывать', 'Складывать нужно не числители, а только знаменатели', 'Числители следовало перемножить'],
          ['Ответ нужно записать целым числом без дроби', 'Дроби нужно было сначала привести к знаменателю ' + d2 + ', а потом складывать', 'Нужно было сократить обе дроби до сложения', 'Сначала следует перевернуть вторую дробь'],
          ['Ошибки нет: так складывают любые дроби', 'Ошибки нет: знаменатели при сложении тоже складывают, это правильно', 'Всё верно, знаменатели складывают так же, как числители', 'Ошибки нет, это правило сложения дробей']]);
        dis = [{ text: p0[0], errorType: 'operation' }, { text: p0[1], errorType: 'format' }, { text: p0[2], errorType: 'concept' }];
      } else {
        cond = 'Ученик решил так: ' + fr(a, d) + ' + ' + fr(b, d) + ' = ' + fr(a * b, d) + '. В чём ошибка?';
        correct = rng.pick(['Числители нужно складывать, а не перемножать', 'Нужно сложить числители: ' + a + ' + ' + b + ', а не умножать их', 'При сложении долей одного размера числители складывают', 'Умножать числители нельзя, их складывают, а знаменатель оставляют']);
        var p1 = pickBalanced(rng, correct, [
          ['Знаменатели нужно было сложить: ' + d + ' + ' + d, 'Нужно было умножить знаменатель на два', 'Знаменатель следовало заменить на ' + (d + 1) + ' при сложении', 'Складывать нужно только знаменатели'],
          ['Дробь следовало перевернуть перед сложением', 'Нужно было вычесть числители друг из друга и оставить знаменатель', 'Сначала нужно обе дроби превратить в целые числа', 'Числитель и знаменатель надо поменять местами'],
          ['Ошибки нет: так складывают любые дроби', 'Ошибки нет: числители при сложении перемножают, это правильно', 'Всё верно, числители при сложении дробей перемножают', 'Ошибки нет, это правило сложения дробей']]);
        dis = [{ text: p1[0], errorType: 'denominator_added' }, { text: p1[1], errorType: 'operation' }, { text: p1[2], errorType: 'concept' }];
      }
      return { parameters: { a: a, b: b, d: d, kind: kind }, condition: cond, correct: correct, distractors: dis,
        hints: ['Проверь, как менялся знаменатель и что произошло с числителями.', 'Что показывает знаменатель? Складываем ли мы размеры долей?'],
        explanation: 'Верно: ' + fr(a, d) + ' + ' + fr(b, d) + ' = ' + fr(s, d) + '.' };
    }
  });

  K.gen.register({
    id: 'frac_word_transfer', version: '1.0', taskType: 'number', subskill: 'm_apply', cognitiveLevel: 'transfer', minUnique: 80,
    profiles: { standard: { dMin: 6, dMax: 14 } },
    generate: function (rng, P) {
      var d = rng.int(P.dMin, P.dMax), b = rng.int(1, d - 3), c = rng.int(1, d - 1 - b), left = d - b - c, who = rng.pick(['Турист', 'Велосипедист', 'Лыжник']);
      return {
        parameters: { d: d, b: b, c: c, who: who },
        condition: 'Путь разделён на ' + d + ' равных частей. ' + who + ' прошёл ' + b + ' частей утром и ещё ' + c + ' частей днём. Какую часть пути ему осталось пройти? Запиши дробью.',
        value: N.rat(left, d), display: left + '/' + d,
        wrongValues: [{ value: N.rat(b + c, d), errorType: 'asked_done_not_left' }],
        hints: ['Сначала узнай, какая часть пути уже пройдена.', 'Весь путь — это ' + d + ' частей из ' + d + '. Что останется?'],
        explanation: 'Пройдено ' + (b + c) + ' частей из ' + d + '. Осталось ' + d + ' − ' + (b + c) + ' = ' + left + ' частей, то есть ' + fr(left, d) + ' пути.'
      };
    }
  });

  K.gen.register({
    id: 'frac_order_steps', version: '1.0', taskType: 'ordering', subskill: 'm_rule', cognitiveLevel: 'understanding',
    profiles: { standard: { dMin: 4, dMax: 14 } },
    generate: function (rng, P) {
      var d = rng.int(P.dMin, P.dMax), a = rng.int(1, d - 2), b = rng.int(1, d - 1 - a), s = a + b;
      return {
        parameters: { a: a, b: b, d: d },
        condition: 'Расставь шаги сложения ' + fr(a, d) + ' + ' + fr(b, d) + ' по порядку.',
        items: [{ id: 'i1', text: 'Видим одинаковые знаменатели: ' + d + ' и ' + d }, { id: 'i2', text: 'Складываем числители: ' + a + ' + ' + b + ' = ' + s },
          { id: 'i3', text: 'Знаменатель оставляем прежним: ' + d }, { id: 'i4', text: 'Записываем ответ: ' + s + '/' + d }],
        hints: ['Сначала посмотри, какие знаменатели.', 'Запись ответа — последний шаг.'],
        explanation: 'Порядок: сравнить знаменатели, сложить числители, оставить знаменатель, записать ответ.'
      };
    }
  });

  var WHY = [
    'Объясни своими словами, почему при сложении дробей с одинаковыми знаменателями знаменатель не складывают.',
    'Придумай свою жизненную задачу, где нужно сложить две дроби с одинаковыми знаменателями, и реши её.',
    'Чем отличается сложение ' + '1/4 + 1/4' + ' от сложения «1 яблоко + 1 яблоко»? Что общего?'
  ];
  K.gen.register({
    id: 'frac_open_explain', version: '1.0', taskType: 'open', subskill: 'm_rule', cognitiveLevel: 'understanding', minUnique: 3,
    profiles: { standard: {} },
    generate: function (rng) {
      var i = rng.int(0, WHY.length - 1);
      return { parameters: { i: i }, condition: WHY[i], rubric: 'Ответ ученика сохранён для просмотра учителем.', hints: ['Вспомни, что показывает знаменатель.'], explanation: '' };
    }
  });

  K.gen.register({
    id: 'frac_club_missing', version: '1.0', taskType: 'number', subskill: 'm_apply', cognitiveLevel: 'investigation', mode: 'CLUB', minUnique: 60,
    profiles: { standard: { dMin: 6, dMax: 16 } },
    generate: function (rng, P) {
      var d = rng.int(P.dMin, P.dMax), c = rng.int(3, d - 1), a = rng.int(1, c - 1), x = c - a;
      return {
        parameters: { a: a, c: c, d: d },
        condition: 'Две дроби с одинаковым знаменателем ' + d + ' в сумме дают ' + fr(c, d) + '. Одна из них равна ' + fr(a, d) + '. Найди вторую. Подумай, как проверить свой ответ.',
        value: N.rat(x, d), display: x + '/' + d, wrongValues: [{ value: N.rat(c + a, d), errorType: 'added_instead' }],
        hints: ['Что нужно сложить с ' + a + ', чтобы получить ' + c + '?'], explanation: 'Нужно ' + c + ' − ' + a + ' = ' + x + ', то есть ' + fr(x, d) + '. Проверка: ' + a + ' + ' + x + ' = ' + c + '.'
      };
    }
  });

  // =====================  ИНФОРМАТИКА · двоичная система  =====================
  K.gen.register({
    id: 'dec_place_value', version: '1.0', taskType: 'single_choice', subskill: 'i_place', cognitiveLevel: 'recognition', minUnique: 100,
    profiles: { standard: {} },
    generate: function (rng) {
      var names = ['единиц', 'десятков', 'сотен', 'тысяч', 'десятков тысяч'], digs, n, pos, digit, cnt;
      for (var g = 0; g < 100; g++) {
        digs = [rng.int(1, 9), rng.int(0, 9), rng.int(0, 9), rng.int(0, 9), rng.int(0, 9)].slice(0, rng.int(4, 5));
        pos = rng.int(0, digs.length - 1); digit = digs[pos]; cnt = digs.filter(function (x) { return x === digit; }).length;
        if (cnt === 1) break;
      }
      n = digs.join(''); var idx = digs.length - 1 - pos;
      var others = [0, 1, 2, 3, 4].filter(function (i) { return i !== idx && i < digs.length + 1; });
      var dis = rng.shuffle(others).slice(0, 3).map(function (i) { return { text: names[i], errorType: 'place_confusion' }; });
      return {
        parameters: { n: n, pos: pos }, condition: 'В числе ' + n + ' цифра ' + digit + ' стоит в разряде…',
        correct: names[idx], distractors: dis,
        hints: ['Считай разряды справа налево: единицы, десятки, сотни…'], explanation: 'Справа налево: ' + n.split('').reverse().map(function (c, i) { return c + ' — ' + names[i]; }).join('; ') + '.'
      };
    }
  });

  var TPL = ['Переведи число {N} из десятичной системы счисления в двоичную.', 'Запиши число {N} в двоичной системе счисления.', 'Найди двоичную запись десятичного числа {N}.'];
  K.gen.register({
    id: 'bin_dec_to_bin', version: '1.0', taskType: 'base', subskill: 'i_d2b', cognitiveLevel: 'reproduction',
    profiles: { basic: { lo: 1, hi: 31 }, standard: { lo: 8, hi: 63 }, advanced: { lo: 32, hi: 127 } },
    minUnique: { basic: 90, standard: 100, advanced: 100 },
    generate: function (rng, P) {
      var n = rng.int(P.lo, P.hi), t = rng.int(0, TPL.length - 1);
      return {
        parameters: { n: n, t: t }, condition: TPL[t].replace('{N}', n), base: 2, value: n, display: bin(n),
        hints: ['Дели число на 2 с остатком, пока частное не станет равным 0.', 'Остатки читай снизу вверх: последний остаток — первая цифра.'],
        explanation: n + ' в двоичной системе: ' + sub2(bin(n)) + '. (Делим на 2, остатки читаем снизу вверх.)'
      };
    }
  });

  K.gen.register({
    id: 'bin_to_dec', version: '1.0', taskType: 'number', subskill: 'i_b2d', cognitiveLevel: 'reproduction',
    profiles: { basic: { lo: 3, hi: 5 }, standard: { lo: 4, hi: 6 }, advanced: { lo: 6, hi: 8 } },
    minUnique: { basic: 80, standard: 100, advanced: 100 },
    generate: function (rng, P) {
      var len = rng.int(P.lo, P.hi), s = '1', t = rng.int(0, 2);
      for (var i = 1; i < len; i++) s += rng.int(0, 1);
      var v = parseInt(s, 2), wrong = [];
      var rv = parseInt(rev(s), 2); if (rv !== v) wrong.push({ value: N.rat(rv, 1), errorType: 'reversed_order' });
      if (+s !== v && +s < 1e9) wrong.push({ value: N.rat(+s, 1), errorType: 'decimal_reading' });
      var q = ['Переведи двоичное число {X} в десятичную систему.', 'Найди десятичное значение двоичного числа {X}.', 'Чему равно двоичное число {X} в десятичной записи?'][t].replace('{X}', sub2(s));
      return { parameters: { s: s, t: t }, condition: q, value: N.rat(v, 1), display: String(v), wrongValues: wrong,
        hints: ['Каждая цифра — это степень двойки: справа налево 1, 2, 4, 8…', 'Сложи степени двойки там, где стоит 1.'],
        explanation: sub2(s) + ' = ' + s.split('').map(function (c, i) { return c === '1' ? Math.pow(2, s.length - 1 - i) : null; }).filter(function (x) { return x !== null; }).join(' + ') + ' = ' + v + '.' };
    }
  });

  K.gen.register({
    id: 'bin_choice', version: '1.1', taskType: 'single_choice', subskill: 'i_d2b', cognitiveLevel: 'understanding', minUnique: 100,
    profiles: { standard: { lo: 9, hi: 127 } },
    generate: function (rng, P) {
      var n = rng.int(P.lo, P.hi), c = bin(n), t = rng.int(0, 1), pool = [], seen = {};
      seen[c] = 1;
      function add(text, err) { if (!seen[text] && text && text[0] === '1') { seen[text] = 1; pool.push({ text: text, errorType: err }); } }
      add(rev(c), 'reversed_order'); add(bin(n + 1), 'off_by_one'); add(bin(n - 1), 'off_by_one');
      for (var i = 1; i < c.length; i++) add(c.slice(0, i) + (c[i] === '1' ? '0' : '1') + c.slice(i + 1), 'bit_error');
      if (pool.length < 3) throw new Error('мало различных дистракторов');
      var dis = rng.shuffle(pool).slice(0, 3);
      return { parameters: { n: n, t: t }, condition: t ? 'Выбери двоичную запись десятичного числа ' + n + '.' : 'Какая запись соответствует десятичному числу ' + n + ' в двоичной системе?', correct: c, distractors: dis,
        hints: ['Раздели число на 2 с остатком и запиши остатки.', 'Проверь: сумма степеней двойки должна дать ' + n + '.'], explanation: n + ' = ' + sub2(c) + '.' };
    }
  });

  var LAMPS = ['Сигнал передают с помощью {k} лампочек: каждая горит или не горит. Сколько различных сигналов можно получить?',
    'На панели {k} переключателей, каждый включён или выключен. Сколько различных комбинаций можно составить?',
    'Для кода используют {k} двоичных разрядов. Сколько различных чисел можно записать?'];
  K.gen.register({
    id: 'bin_count_bits', version: '1.2', taskType: 'number', subskill: 'i_bits', cognitiveLevel: 'transfer', minUnique: 40,
    profiles: { standard: { lo: 3, hi: 12 } },
    generate: function (rng, P) {
      var dir = rng.int(0, 1), t = rng.int(0, LAMPS.length - 1), k;
      if (dir === 0) {
        do { k = rng.int(P.lo, P.hi); } while (k === 4);
        var v = Math.pow(2, k);
        return { parameters: { dir: 0, k: k, t: t }, condition: LAMPS[t].replace('{k}', k), value: N.rat(v, 1), display: String(v),
          wrongValues: [{ value: N.rat(k * k, 1), errorType: 'square_confusion' }, { value: N.rat(2 * k, 1), errorType: 'multiplication_confusion' }],
          hints: ['Одна лампочка даёт 2 варианта. Что будет, если добавить вторую?', 'Каждая новая лампочка удваивает число вариантов.'],
          explanation: 'Каждый разряд удваивает число вариантов: 2 × 2 × … (' + k + ' раз) = 2' + sup(k) + ' = ' + v + '.' };
      }
      var m = rng.int(3, 10), V = Math.pow(2, m);
      return { parameters: { dir: 1, m: m, t: t }, condition: ['Нужно различать ' + V + ' разных сигналов с помощью лампочек (горит или не горит). Какое наименьшее число лампочек нужно?', 'Нужно закодировать ' + V + ' различных значений двоичными разрядами. Сколько разрядов потребуется как минимум?', 'Чтобы пронумеровать ' + V + ' предметов двоичными числами одинаковой длины, сколько разрядов нужно как минимум?'][t],
        value: N.rat(m, 1), display: String(m), wrongValues: [{ value: N.rat(V, 1), errorType: 'value_instead' }, { value: N.rat(V / 2, 1), errorType: 'half' }],
        hints: ['Сколько значений дают 2 разряда? 3 разряда? Когда дойдёшь до ' + V + '?', 'Ищи степень двойки, равную ' + V + '.'], explanation: V + ' = 2' + sup(m) + ', поэтому нужно ' + m + ' разрядов.' };
    }
  });

  K.gen.register({
    id: 'bin_algorithm_order', version: '1.0', taskType: 'ordering', subskill: 'i_d2b', cognitiveLevel: 'understanding',
    profiles: { standard: { lo: 5, hi: 120 } },
    generate: function (rng, P) {
      var n = rng.int(P.lo, P.hi), q = Math.floor(n / 2), r = n % 2;
      return { parameters: { n: n }, condition: 'Расставь шаги перевода числа ' + n + ' в двоичную систему по порядку.',
        items: [{ id: 'i1', text: 'Делим ' + n + ' на 2: частное ' + q + ', остаток ' + r }, { id: 'i2', text: 'Частное ' + q + ' снова делим на 2 и записываем остаток' },
          { id: 'i3', text: 'Повторяем деление, пока частное не станет равным 0' }, { id: 'i4', text: 'Читаем остатки снизу вверх: ' + bin(n) }],
        hints: ['Сначала делим, потом читаем.', 'Чтение остатков снизу вверх — последний шаг.'], explanation: 'Деление → остаток → повтор до нуля → чтение остатков снизу вверх.' };
    }
  });

  K.gen.register({
    id: 'bin_match_powers', version: '1.0', taskType: 'matching', subskill: 'i_b2d', cognitiveLevel: 'recognition', minUnique: 100,
    profiles: { standard: {} },
    generate: function (rng) {
      var ks = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).slice(0, 4).sort(function (a, b) { return a - b; }), pairs = {}, left = [], right = [];
      ks.forEach(function (k) { left.push({ id: 'l' + k, text: '2' + sup(k) }); right.push({ id: 'r' + k, text: String(Math.pow(2, k)) }); pairs['l' + k] = 'r' + k; });
      return { parameters: { ks: ks }, condition: 'Соедини степень двойки с её значением.', left: left, right: right, pairs: pairs,
        hints: ['2¹ = 2, каждая следующая степень вдвое больше.'], explanation: ks.map(function (k) { return '2' + sup(k) + ' = ' + Math.pow(2, k); }).join('; ') + '.' };
    }
  });

  K.gen.register({
    id: 'bin_multi_select', version: '1.0', taskType: 'multi_choice', subskill: 'i_digits', cognitiveLevel: 'recognition', minUnique: 100,
    profiles: { standard: {} },
    generate: function (rng) {
      function b(len) { var s = ''; for (var i = 0; i < len; i++) s += rng.int(0, 1); return s; }
      function bad(len) { var s = b(len), p = rng.int(0, len - 1); return s.slice(0, p) + rng.int(2, 9) + s.slice(p + 1); }
      var good = [], wrong = [], guard = 0;
      while (good.length < 3 && guard++ < 50) { var x = b(rng.int(3, 5)); if (good.indexOf(x) < 0) good.push(x); }
      guard = 0; while (wrong.length < 2 && guard++ < 50) { var y = bad(rng.int(3, 5)); if (wrong.indexOf(y) < 0) wrong.push(y); }
      var opts = good.map(function (t) { return { text: t, correct: true }; }).concat(wrong.map(function (t) { return { text: t, correct: false, errorType: 'digit_out_of_range' }; }));
      return { parameters: { good: good, wrong: wrong }, condition: 'Выбери все записи, которые могут быть двоичными числами.', options: opts,
        hints: ['В двоичной системе только две цифры.'], explanation: 'Двоичные числа состоят только из цифр 0 и 1: ' + good.join(', ') + '.' };
    }
  });

  var WHYB = ['Объясни, почему компьютер хранит информацию с помощью двух цифр, 0 и 1.', 'Приведи пример из жизни, где есть только два состояния (как 0 и 1).', 'Как ты проверишь, что перевод числа в двоичную систему выполнен верно?'];
  K.gen.register({
    id: 'bin_open_why', version: '1.0', taskType: 'open', subskill: 'i_bits', cognitiveLevel: 'understanding', minUnique: 3,
    profiles: { standard: {} },
    generate: function (rng) { var i = rng.int(0, WHYB.length - 1); return { parameters: { i: i }, condition: WHYB[i], rubric: 'Ответ сохранён для просмотра учителем.', hints: ['Подумай о лампочке: горит или не горит.'], explanation: '' }; }
  });

  K.gen.register({
    id: 'bin_club_ones', version: '1.0', taskType: 'number', subskill: 'i_bits', cognitiveLevel: 'investigation', mode: 'CLUB', minUnique: 20,
    profiles: { standard: { lo: 3, hi: 14 } },
    generate: function (rng, P) {
      var k = rng.int(P.lo, P.hi), v = rng.int(0, 1);
      return { parameters: { k: k, v: v }, condition: v ? 'Сколько единиц в двоичной записи числа 2' + sup(k) + ' − 1? Проверь на маленьких k и найди закономерность.' : 'Сколько нулей в двоичной записи числа 2' + sup(k) + '? Проверь на маленьких k и найди закономерность.',
        value: N.rat(v ? k : k, 1), display: String(k), hints: ['Запиши 2² − 1, 2³ − 1, 2⁴ − 1 в двоичной системе и сравни.'], explanation: v ? '2' + sup(k) + ' − 1 в двоичной записи — это ' + k + ' единиц подряд.' : '2' + sup(k) + ' — единица и ' + k + ' нулей.' };
    }
  });

  // =====================  УРОКИ  =====================
  var STEP_ENTRY = function (can) { return { id: 'entry', type: 'entry', title: 'Вход', group: 'entry', can: can }; };

  var LESSON_FRAC = {
    lessonId: 'demo-math-6-frac-L01', moduleId: 'demo-m1', title: 'Сложение дробей с одинаковыми знаменателями', subject: 'Математика', class: '6', language: 'ru',
    section: 'Демонстрация · дроби', series: { seriesId: 'demo-frac', lessonIndex: 1, lessonsTotal: 1 },
    assessmentType: 'formative', assessmentLabel: 'Формативное оценивание (демо)', checkKind: 'learning', weights: null, timeLimitSec: { final: 480 },
    objectives: [{ code: 'DEMO-M-1', text: 'Складывать дроби с одинаковыми знаменателями' }], lessonObjectives: [{ code: 'DEMO-M-1.1', text: 'Выполнять сложение и объяснять правило' }],
    programMap: { current: ['сложение дробей с одинаковыми знаменателями'], confirmed: ['понятие дроби', 'сравнение частей и целого'], notYet: ['сложение дробей с разными знаменателями'], forbidden: ['приведение к общему знаменателю'], forbiddenTerms: ['общий знаменатель', 'общему знаменателю', 'разными знаменателями'] },
    criteria: [
      { criterionId: 'c0', text: 'Читает дробь', descriptors: [{ descriptorId: 'd0.1', text: 'Определяет дробь по рисунку' }] },
      { criterionId: 'c1', text: 'Складывает дроби', descriptors: [{ descriptorId: 'd1.1', text: 'Вычисляет сумму' }, { descriptorId: 'd1.2', text: 'Объясняет правило' }] },
      { criterionId: 'c2', text: 'Применяет в задачах', descriptors: [{ descriptorId: 'd2.1', text: 'Решает текстовую задачу' }] }
    ],
    subskills: [
      { id: 'm_read', text: 'Читать дробь по рисунку', recommend: 'Повторить: что показывают числитель и знаменатель.', ruleCard: { title: 'Что показывает дробь', html: '<p>Знаменатель — на сколько равных частей разделили целое. Числитель — сколько частей взяли.</p>' } },
      { id: 'm_add', text: 'Складывать дроби с одинаковыми знаменателями', recommend: 'Повторить правило: числители складываем, знаменатель остаётся.', ruleCard: { title: 'Правило сложения', html: '<p>Доли одного размера складываем как предметы: считаем, сколько долей получилось вместе.</p><p>' + fr('2', '7') + ' + ' + fr('3', '7') + ' = ' + fr('5', '7') + '</p>' }, example: { html: '<p>Знаменатель показывает размер доли — он не меняется.</p>' } },
      { id: 'm_rule', text: 'Объяснять правило сложения', recommend: 'Попробуй объяснить правило на примере с пирогом.', ruleCard: { title: 'Почему знаменатель не меняется', html: '<p>Мы складываем <b>количество</b> долей, а размер доли остаётся тем же: 2 седьмых + 3 седьмых = 5 седьмых.</p>' } },
      { id: 'm_apply', text: 'Применять сложение в задачах', recommend: 'Решай задачи по шагам: что известно, что найти.', ruleCard: { title: 'Как решать задачу', html: '<p>Выпиши, что известно и что нужно найти. Потом выбери действие.</p>' } }
    ],
    stages: [
      STEP_ENTRY(['Я смогу определить дробь по рисунку', 'Я смогу сложить дроби с одинаковыми знаменателями', 'Я смогу объяснить, почему знаменатель не меняется']),
      { id: 'diagnostic', type: 'tasks', group: 'diagnostic', title: 'Входная диагностика', hints: false, maxAttempts: 1, feedback: 'neutral', plan: [{ gen: 'frac_read_part', count: 4, descriptors: ['d0.1'] }] },
      { id: 'open', type: 'cards', group: 'learning', title: 'Открытие', cards: [
        { title: 'Складываем доли', html: '<p>Пирог разрезан на 7 равных частей. Взяли 2 части, потом ещё 3.</p><p>' + fr(2, 7) + ' + ' + fr(3, 7) + ' = ?</p><p>Сколько седьмых получилось вместе? Подумай, прежде чем листать дальше.</p>' },
        { title: 'Правило', html: '<p>Размер доли (знаменатель) не меняется. Складываем только числители.</p><p>' + fr(2, 7) + ' + ' + fr(3, 7) + ' = ' + fr(5, 7) + '</p>' }] },
      { id: 'train', type: 'tasks', group: 'learning', title: 'Тренировка', hints: true, maxAttempts: 3, plan: [
        { gen: 'frac_add_same', profile: 'basic', count: 3, descriptors: ['d1.1'] }, { gen: 'frac_add_same', profile: 'standard', count: 2, descriptors: ['d1.1'] }, { gen: 'frac_add_choice', count: 2, descriptors: ['d1.1'] }] },
      { id: 'practice', type: 'tasks', group: 'learning', title: 'Практика', hints: true, maxAttempts: 2, plan: [
        { gen: 'frac_find_error', count: 1, descriptors: ['d1.2'] }, { gen: 'frac_order_steps', count: 1, descriptors: ['d1.2'] }, { gen: 'frac_word_transfer', count: 2, descriptors: ['d2.1'] }, { gen: 'frac_open_explain', count: 1, descriptors: ['d1.2'] }] },
      { id: 'final', type: 'tasks', group: 'final', title: 'Итоговая проверка (по желанию)', hints: false, maxAttempts: 1, feedback: 'deferred', timed: true, plan: [
        { gen: 'frac_add_same', profile: 'standard', count: 2, descriptors: ['d1.1'] }, { gen: 'frac_add_choice', count: 1, descriptors: ['d1.1'] }, { gen: 'frac_find_error', count: 1, descriptors: ['d1.2'] }, { gen: 'frac_word_transfer', count: 2, descriptors: ['d2.1'] }] },
      { id: 'club', type: 'tasks', group: 'club', title: 'Клуб (по желанию)', mode: 'CLUB', hints: true, maxAttempts: 3, plan: [{ gen: 'frac_club_missing', count: 2 }] },
      { id: 'reflect', type: 'reflection', group: 'reflection', title: 'Рефлексия', prompt: 'Что тебе было понятно сегодня, а что стоит повторить?' }
    ]
  };

  var INF_SUBS = [
    { id: 'i_place', text: 'Различать разряды числа', recommend: 'Повторить разряды: единицы, десятки, сотни.', ruleCard: { title: 'Разряды', html: '<p>Разряды считаем справа налево: единицы, десятки, сотни, тысячи.</p>' } },
    { id: 'i_d2b', text: 'Переводить из десятичной в двоичную', recommend: 'Повторить деление на 2 и чтение остатков снизу вверх.', ruleCard: { title: 'Перевод 10 → 2', html: '<p>Делим число на 2 с остатком, пока частное не станет 0. Остатки читаем <b>снизу вверх</b>.</p><p>13 → 1101₂</p>' } },
    { id: 'i_b2d', text: 'Переводить из двоичной в десятичную', recommend: 'Повторить степени двойки: 1, 2, 4, 8, 16…', ruleCard: { title: 'Перевод 2 → 10', html: '<p>Справа налево разряды равны 1, 2, 4, 8… Складываем те, где стоит 1.</p><p>1101₂ = 8 + 4 + 1 = 13</p>' } },
    { id: 'i_bits', text: 'Считать число значений', recommend: 'Повторить: каждый разряд удваивает число вариантов.', ruleCard: { title: 'Сколько значений', html: '<p>Один разряд даёт 2 значения. Каждый новый разряд удваивает их число: 2 × 2 × 2 …</p>' } },
    { id: 'i_digits', text: 'Знать двоичные цифры', recommend: 'Повторить: в двоичной системе только цифры 0 и 1.', ruleCard: { title: 'Двоичные цифры', html: '<p>В двоичной системе используются только 0 и 1.</p>' } }
  ];
  var LESSON_BIN = {
    lessonId: 'demo-inf-8-bin-L01', moduleId: 'demo-m2', title: 'Двоичная система счисления', subject: 'Информатика', class: '8', language: 'ru',
    section: 'Демонстрация · системы счисления', series: { seriesId: 'demo-bin', lessonIndex: 1, lessonsTotal: 2 },
    assessmentType: 'formative', assessmentLabel: 'Формативное оценивание (демо)', checkKind: 'learning', weights: null, timeLimitSec: { final: 600 },
    objectives: [{ code: 'DEMO-I-1', text: 'Переводить числа между десятичной и двоичной системами' }], lessonObjectives: [{ code: 'DEMO-I-1.1', text: 'Переводить небольшие числа и считать число значений' }],
    programMap: { current: ['перевод 10↔2'], confirmed: ['десятичная система, разряды'], notYet: ['восьмеричная и шестнадцатеричная системы'], forbidden: ['арифметика в двоичной системе'], forbiddenTerms: ['шестнадцатерич', 'восьмерич', 'двоичное сложение'] },
    criteria: [
      { criterionId: 'c0', text: 'Знает разряды', descriptors: [{ descriptorId: 'd0.1', text: 'Определяет разряд цифры' }] },
      { criterionId: 'c1', text: 'Переводит числа', descriptors: [{ descriptorId: 'd1.1', text: 'Переводит из десятичной в двоичную' }, { descriptorId: 'd1.2', text: 'Переводит из двоичной в десятичную' }] },
      { criterionId: 'c2', text: 'Применяет и объясняет', descriptors: [{ descriptorId: 'd2.1', text: 'Считает число значений' }, { descriptorId: 'd2.2', text: 'Объясняет' }] }
    ],
    subskills: INF_SUBS,
    stages: [
      STEP_ENTRY(['Я смогу перевести число из десятичной системы в двоичную', 'Я смогу перевести двоичное число в десятичное', 'Я смогу посчитать, сколько значений даёт несколько разрядов']),
      { id: 'diagnostic', type: 'tasks', group: 'diagnostic', title: 'Входная диагностика', hints: false, maxAttempts: 1, feedback: 'neutral', plan: [{ gen: 'dec_place_value', count: 4, descriptors: ['d0.1'] }] },
      { id: 'open', type: 'cards', group: 'learning', title: 'Открытие', cards: [
        { title: 'Две цифры', html: '<p>Лампочка горит (1) или не горит (0). Из таких состояний компьютер строит числа.</p><p>Как ты думаешь, сколько разных сигналов дадут две лампочки?</p>' },
        { title: 'Перевод 10 → 2', html: '<p>Делим число на 2 с остатком, пока частное не станет 0. Остатки читаем снизу вверх.</p><p>13 = 1101₂</p>' }] },
      { id: 'train', type: 'tasks', group: 'learning', title: 'Тренировка', hints: true, maxAttempts: 3, plan: [
        { gen: 'bin_dec_to_bin', profile: 'basic', count: 3, descriptors: ['d1.1'] }, { gen: 'bin_to_dec', profile: 'basic', count: 2, descriptors: ['d1.2'] }, { gen: 'bin_choice', count: 2, descriptors: ['d1.1'] }] },
      { id: 'practice', type: 'tasks', group: 'learning', title: 'Практика', hints: true, maxAttempts: 2, plan: [
        { gen: 'bin_dec_to_bin', profile: 'standard', count: 2, descriptors: ['d1.1'] }, { gen: 'bin_algorithm_order', count: 1, descriptors: ['d1.1'] }, { gen: 'bin_match_powers', count: 1, descriptors: ['d1.2'] },
        { gen: 'bin_multi_select', count: 1, descriptors: ['d2.2'] }, { gen: 'bin_count_bits', count: 1, descriptors: ['d2.1'] }, { gen: 'bin_open_why', count: 1, descriptors: ['d2.2'] }] },
      { id: 'final', type: 'tasks', group: 'final', title: 'Итоговая проверка (по желанию)', hints: false, maxAttempts: 1, feedback: 'deferred', timed: true, plan: [
        { gen: 'bin_dec_to_bin', profile: 'standard', count: 2, descriptors: ['d1.1'] }, { gen: 'bin_to_dec', profile: 'standard', count: 2, descriptors: ['d1.2'] }, { gen: 'bin_choice', count: 1, descriptors: ['d1.1'] }, { gen: 'bin_count_bits', count: 1, descriptors: ['d2.1'] }] },
      { id: 'club', type: 'tasks', group: 'club', title: 'Клуб (по желанию)', mode: 'CLUB', hints: true, maxAttempts: 3, plan: [{ gen: 'bin_club_ones', count: 2 }] },
      { id: 'reflect', type: 'reflection', group: 'reflection', title: 'Рефлексия', prompt: 'Что получилось легко, а что стоит повторить?' }
    ]
  };

  // Тренировка к СОР (контрольная работа: подсказок нет, время фиксируется, потолок 84% при превышении)
  var LESSON_SOR = {
    lessonId: 'demo-inf-8-bin-SOR', moduleId: 'demo-m3', title: 'Тренировка к СОР · двоичная система', subject: 'Информатика', class: '8', language: 'ru',
    section: 'Демонстрация · системы счисления', series: { seriesId: 'demo-bin', lessonIndex: 2, lessonsTotal: 2 },
    assessmentType: 'SOR', assessmentLabel: 'СОР (тренировочный аналог, демо)', checkKind: 'learning', weights: null, timeLimitSec: { final: 300 },
    objectives: LESSON_BIN.objectives, lessonObjectives: LESSON_BIN.lessonObjectives, programMap: LESSON_BIN.programMap,
    criteria: [{ criterionId: 'c1', text: 'Переводит числа', descriptors: [{ descriptorId: 'd1.1', text: 'Из десятичной в двоичную' }, { descriptorId: 'd1.2', text: 'Из двоичной в десятичную' }] },
      { criterionId: 'c2', text: 'Применяет', descriptors: [{ descriptorId: 'd2.1', text: 'Считает число значений' }] }],
    subskills: INF_SUBS,
    stages: [
      STEP_ENTRY(['Это тренировочная работа: подсказок нет, время фиксируется']),
      { id: 'train', type: 'tasks', group: 'learning', title: 'Повторение', hints: true, maxAttempts: 3, plan: [{ gen: 'bin_dec_to_bin', profile: 'basic', count: 2, descriptors: ['d1.1'] }, { gen: 'bin_to_dec', profile: 'basic', count: 2, descriptors: ['d1.2'] }] },
      { id: 'final', type: 'tasks', group: 'final', title: 'Контрольная часть', hints: false, maxAttempts: 1, feedback: 'deferred', timed: true, plan: [
        { gen: 'bin_dec_to_bin', profile: 'standard', count: 2, descriptors: ['d1.1'] }, { gen: 'bin_to_dec', profile: 'standard', count: 2, descriptors: ['d1.2'] }, { gen: 'bin_choice', count: 1, descriptors: ['d1.1'] }, { gen: 'bin_count_bits', count: 1, descriptors: ['d2.1'] }] },
      { id: 'reflect', type: 'reflection', group: 'reflection', title: 'Рефлексия', prompt: 'Что стоит повторить перед настоящей работой?' }
    ]
  };

  // Подсказки об ошибках, привязанные к типам ошибок дистракторов (текст для ученика).
  var ERROR_LABELS = {
    inverted: 'Числитель и знаменатель перепутаны местами: знаменатель — на сколько частей разделили целое.',
    complement: 'Здесь указана незакрашенная часть, а нужна закрашенная.',
    part_to_part: 'Дробь сравнивает часть с целым, а не часть с другой частью.',
    miscount: 'Пересчитай части ещё раз: знаменатель равен числу всех частей.',
    denominator_added: 'Знаменатель при сложении не складывают: размер долей не меняется.',
    numerators_multiplied: 'Числители складывают, а не умножают.',
    denominator_dropped: 'Ответ — это не просто число: нужно записать дробью, указав размер долей.',
    subtracted: 'Здесь числители вычитали, а в задаче доли соединяют вместе.',
    denominator_changed: 'Размер доли остаётся прежним: знаменатель не меняется.',
    operation: 'Выбрано не то действие. Подумай, что происходит с долями.',
    format: 'Ответ записан не в том виде, который нужен.',
    asked_done_not_left: 'Найдена пройденная часть, а в задаче спрашивают, сколько осталось.',
    added_instead: 'Нужно найти недостающую часть, а не сложить числа ещё раз.',
    place_confusion: 'Разряды считают справа налево: единицы, десятки, сотни.',
    reversed_order: 'Порядок цифр обратный: остатки читают снизу вверх, а цифры двоичного числа — слева направо по степеням.',
    decimal_reading: 'Число записано двоичными цифрами, его нельзя читать как десятичное.',
    off_by_one: 'Ответ отличается на единицу. Проверь последнее действие.',
    bit_error: 'В одной цифре ошибка. Проверь перевод по степеням двойки.',
    square_confusion: 'Каждый разряд удваивает число вариантов, а не возводит в квадрат.',
    multiplication_confusion: 'Число вариантов удваивается с каждым разрядом: нужны степени двойки.',
    value_instead: 'Нужно найти число разрядов, а не число значений.',
    half: 'Проверь: сколько значений дают найденные разряды?',
    digit_out_of_range: 'В двоичной системе есть только цифры 0 и 1.'
  };

  K.PACK = {
    errorLabels: ERROR_LABELS,
    materialId: 'demo-core-check', contentVersion: '1.0.0', title: 'Демонстрация ядра ЦОМ', language: 'ru',
    notice: 'Демонстрационное содержание для проверки ядра. Не является КСП и не привязано к программе РК.',
    lessons: [LESSON_FRAC, LESSON_BIN, LESSON_SOR]
  };
})(typeof window !== 'undefined' ? window : globalThis);
