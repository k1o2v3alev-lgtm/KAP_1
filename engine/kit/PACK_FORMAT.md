# Формат содержания `pack.js`

`pack.js` — единственный файл, который пишется для нового продукта. Ядро не меняется. Файл описывает **уроки из КСП** и **генераторы заданий**. Из него собираются два HTML: ученический и кабинет учителя.

Проверка: `node kap-engine.js check pack.js` · сборка: `node kap-engine.js build pack.js out` · всё сразу и браузерное испытание: `node kap-engine.js all pack.js out`.

Образец — `example-pack.js` (два предмета: математика 6 и информатика 8; демонстрационное содержание, не КСП).

## Каркас файла

```js
(function (root) {
  'use strict';
  var K = root.KAP = root.KAP || {};
  var N = K.norm;            // N.rat(n, d) — точная дробь, N.ratToStr(r)
  // 1. генераторы
  K.gen.register({ id: '...', version: '1.0', taskType: '...', subskill: '...', cognitiveLevel: '...', profiles: {...}, generate: function (rng, P) { ... } });
  // 2. содержание
  K.PACK = { materialId: '...', contentVersion: '1.0.0', title: '...', language: 'ru', errorLabels: {...}, lessons: [ ... ] };
})(typeof window !== 'undefined' ? window : globalThis);
```

Файл выполняется и в Node (проверка), и в браузере. Нельзя использовать `eval`, `new Function`, внешние адреса, `require`, `fetch`, `Math.random()` (только `rng` из генератора).

## `K.PACK`

| Поле | Обязательно | Смысл |
|---|---|---|
| `materialId` | да | Стабильный идентификатор набора: `{предмет}-{класс}-{серия}`, например `inf-8-numsys` |
| `contentVersion` | да | Версия содержания `x.y.z`; повышай при любом изменении |
| `title` | да | Название набора (экран выбора ученика) |
| `language` | да | `ru` или `kk` (язык интерфейса и заданий) |
| `notice` | нет | Заметка на экранах (например, «демонстрация»); для настоящего продукта не задавай |
| `errorLabels` | рекомендуется | Объяснения типов ошибок для ученика: `{ тип_ошибки: 'Спокойное объяснение, что не так' }` |
| `lessons` | да | Массив уроков (по одному на КСП) в порядке КСП |

## Урок (`lessons[i]`)

| Поле | Обяз. | Смысл |
|---|---|---|
| `lessonId` | да | Уникальный, без пробелов. Рекомендуется `{предмет}-{класс}-{серия}-L{номер}` |
| `moduleId`, `title`, `subject`, `class`, `language`, `section` | да (кроме moduleId, section) | Из КСП |
| `series` | нет | `{ seriesId, lessonIndex, lessonsTotal }` |
| `assessmentType` | да | `formative`, `intermediate` (ПО), `SOR`, `SOCH`, `practical`, `project`, `control`, `other` — как в КСП. Для ПО/СОР/СОЧ контрольная часть даёт основной результат, действует потолок 84% при превышении времени |
| `assessmentLabel` | нет | Термин из КСП («СОР №1») |
| `checkKind` | нет | `learning` (по умолчанию), `quarter_final`, `year_final`, `residual`. Любое значение, кроме `learning`, включает итоговый профиль весов 20/30/50 |
| `finalReview` | нет | `true` — тоже итоговый профиль (последнее занятие раздела) |
| `weights` | нет | Веса из КСП `{ diagnostic, learning, final }`. Если не заданы, применяется профиль по умолчанию: обучение 20/50/30, итоговый 20/30/50 |
| `timeLimitSec` | нет | `{ final: секунды }` — лимит итоговой/контрольной части из КСП. Время фиксируется, работа не останавливается |
| `objectives` | да | `[{ code, text }]` — цели обучения с кодами из базы целей |
| `lessonObjectives` | да | Конкретные цели урока из КСП `[{ code, text }]` |
| `programMap` | рекомендуется | Карта пререквизитов: `{ current[], confirmed[], notYet[], forbidden[], forbiddenTerms[] }`. `forbiddenTerms` — слова и фразы будущего материала: проверка ищет их в условиях, подсказках, карточках и считает ошибкой |
| `criteria` | да | `[{ criterionId, text, descriptors: [{ descriptorId, text }] }]` из КСП |
| `subskills` | да | `[{ id, text, recommend, ruleCard: { title, html }, example: { html } }]` — то, что проверяют задания; `ruleCard` показывается при возврате к правилу |
| `stages` | да | Этапы урока (см. ниже) |

## Этапы (`stages`)

Порядок единый для всех предметов: `entry` → `diagnostic` → `open` → `train` → `practice` → `final` → `club` → `reflect`. Ненужные этапы можно опустить. Первый — `entry`, последний — `reflection`.

| Поле | Смысл |
|---|---|
| `id`, `title` | Уникальный id и название этапа |
| `type` | `entry` (поле `can: ['Я смогу…', …]`), `cards` (`cards: [{ title, html }]`), `tasks` (`plan`), `reflection` (`prompt`) |
| `group` | `entry`, `diagnostic`, `learning`, `final`, `club`, `reflection`. От группы зависит вес в отметке: `diagnostic`, `learning` (тренировка и практика), `final` |
| `plan` | Для `tasks`: `[{ gen: 'id_генератора', profile: 'basic|standard|advanced', count: 1–12, descriptors: ['d1.1'] }]`. `descriptors` связывают задания с критериями КСП |
| `hints` | `false` для `diagnostic` и `final` (обязательно); `true` в обучающих этапах |
| `maxAttempts` | Попыток на задание: 1 для `diagnostic` и `final`; 2–3 в тренировке и практике |
| `feedback` | `immediate` (по умолчанию), `neutral` (диагностика), `deferred` (итоговая проверка: разбор после завершения) |
| `timed` | `true` для итоговой проверки: время фиксируется |
| `mode` | `'CLUB'` для необязательного этапа расширения (не влияет на отметку) |
| `ordered` | `true`, если порядок заданий этапа не перемешивать |

## Генератор

```js
K.gen.register({
  id: 'frac_add_same',          // уникальный, латиницей
  version: '1.0',               // повышай при изменении логики
  taskType: 'number',           // см. таблицу типов
  subskill: 'm_add',            // id из subskills урока
  cognitiveLevel: 'reproduction',   // recognition | reproduction | understanding | transfer | investigation | generalization
  maxScore: 1,                  // по умолчанию 1
  mode: 'CORE',                 // 'CLUB' для расширения
  profiles: { basic: { dMin: 3, dMax: 10 }, standard: { dMin: 4, dMax: 12 } },   // параметры по уровням ВНУТРИ программы
  minUnique: { basic: 90, standard: 100 },   // сколько различимых вариантов должно получаться (число или по профилям)
  generate: function (rng, P) { /* вернуть объект, вычисляя ответ из параметров */ },
  validate: function (task) { return []; }   // необязательно: дополнительные проверки, массив текстов проблем
});
```

`rng`: `rng.int(a, b)`, `rng.pick(массив)`, `rng.chance(p)`, `rng.shuffle(массив)`, `rng.next()`. Только он, никакого `Math.random()`: по `seed` учитель воспроизводит вариант.

### Что возвращает `generate` для каждого типа

Всегда: `condition` (HTML-строка условия), `parameters` (объект со **всеми** параметрами, определяющими задание), `hints` (массив из двух подсказок: принцип, затем промежуточный шаг), `explanation` (разбор). Допустимы теги `span i b strong em sub sup br p div ul ol li`, классы `fr` (дробь: `<span class="fr"><i>числитель</i><b>знаменатель</b></span>`) и `bars`/`bar on` (полоса частей).

| `taskType` | Дополнительные поля |
|---|---|
| `single_choice` | `correct` (текст верного), `distractors: [{ text, errorType }]` (2–4 правдоподобные ошибки). Вариантов ответа не меньше 4, тексты сопоставимы по длине |
| `multi_choice` | `options: [{ text, correct: true/false, errorType }]` |
| `number` | `value: K.norm.rat(n, d)` (точная дробь), `display` (как показать ответ), `requireIrreducible` (нужна сокращённая дробь), `requireForm` (`integer` / `decimal` / `fraction` / `mixed`), `tolerance`, `wrongValues: [{ value: rat, errorType }]` |
| `base` | `base` (2–36), `value` (целое), `display` (верная запись) |
| `text` | `accepted: ['вариант', …]`, `mode` (`default` — регистр и похожие кириллица/латиница не важны; `orthography` — буквы ә, қ, ү строго; `exact`), `wrongAnswers: [{ text, errorType }]` |
| `expression` | `expected: 'x^2+3'` — проверяется эквивалентность записей |
| `ordering` | `items: [{ id, text }]` **в верном порядке** (перемешивается автоматически; минимум 3) |
| `matching` | `left: [{ id, text }]`, `right: [{ id, text }]`, `pairs: { leftId: rightId }` |
| `open` | `rubric` (текст для учителя). Не оценивается автоматически, уходит учителю; банк формулировок не меньше 3 |

### Правила качества (проверяются командой `check`)

1. **Правильный ответ вычисляется из параметров**, а не задаётся отдельно.
2. Дистракторы моделируют типичные ошибки (`errorType` обязателен), не совпадают между собой и с верным ответом по значению.
3. Условие однозначно; нет деления на ноль, противоречивых данных, лишних корней.
4. Диапазоны чисел выбираются методически и **не выходят за изученное** (проценты, отрицательные числа, степени и т. д. — только если уже изучены).
5. Вариативность структурная, а не только числа: разные контексты, формулировки, обратные постановки, «найди ошибку».
6. Не меньше 100 различимых вариантов на профиль (кроме банков открытых заданий и заведомо ограниченных тем; для них снижай `minUnique` осознанно).
7. Позиция верного ответа в выборе распределена равномерно, верный ответ не бывает систематически самым длинным или крайним по числу.
8. Тексты для ученика: живой язык учителя, без служебных слов (seed, генератор, валидатор, JSON).

## `errorLabels`

```js
errorLabels: {
  denominator_added: 'Знаменатель при сложении не складывают: размер долей не меняется.',
  reversed_order: 'Порядок цифр обратный: остатки читают снизу вверх.'
}
```
Общие типы (`calc`, `format`, `concept`, `order`, `match`, `multi_extra`, `multi_miss`, `not_reduced`, `form`, `skipped`) уже есть в ядре. Для остальных типов ошибок из дистракторов тексты нужно задать здесь.

## Минимальный пример

```js
(function (root) {
  'use strict'; var K = root.KAP = root.KAP || {}, N = K.norm;
  K.gen.register({
    id: 'add_two', version: '1.0', taskType: 'number', subskill: 's_add', cognitiveLevel: 'reproduction', minUnique: 90,
    profiles: { standard: { lo: 10, hi: 99 } },
    generate: function (rng, P) {
      var a = rng.int(P.lo, P.hi), b = rng.int(P.lo, P.hi);
      return { parameters: { a: a, b: b }, condition: 'Вычисли: ' + a + ' + ' + b, value: N.rat(a + b, 1), display: String(a + b),
        wrongValues: [{ value: N.rat(a - b, 1), errorType: 'subtracted' }], hints: ['Сложи единицы, потом десятки.', 'Десятки: ' + Math.floor(a / 10) + ' и ' + Math.floor(b / 10) + '.'], explanation: a + ' + ' + b + ' = ' + (a + b) };
    }
  });
  K.PACK = { materialId: 'demo-1', contentVersion: '1.0.0', title: 'Пример', language: 'ru', errorLabels: { subtracted: 'Здесь числа вычли, а нужно сложить.' }, lessons: [{
    lessonId: 'demo-1-L01', title: 'Сложение', subject: 'Математика', class: '3', assessmentType: 'formative', timeLimitSec: { final: 300 },
    objectives: [{ code: '3.1.1.1', text: 'Складывать двузначные числа' }], lessonObjectives: [{ code: '3.1.1.1.1', text: 'Выполнять сложение' }],
    programMap: { current: ['сложение'], confirmed: ['числа до 100'], notYet: ['умножение'], forbidden: ['умножение'], forbiddenTerms: ['умножен'] },
    criteria: [{ criterionId: 'c1', text: 'Складывает числа', descriptors: [{ descriptorId: 'd1', text: 'Вычисляет сумму' }] }],
    subskills: [{ id: 's_add', text: 'Складывать числа', recommend: 'Повтори сложение по разрядам.', ruleCard: { title: 'Сложение', html: '<p>Складывай единицы с единицами, десятки с десятками.</p>' } }],
    stages: [
      { id: 'entry', type: 'entry', group: 'entry', title: 'Вход', can: ['Я смогу складывать двузначные числа'] },
      { id: 'train', type: 'tasks', group: 'learning', title: 'Тренировка', hints: true, maxAttempts: 3, plan: [{ gen: 'add_two', count: 4, descriptors: ['d1'] }] },
      { id: 'final', type: 'tasks', group: 'final', title: 'Итоговая проверка', hints: false, maxAttempts: 1, feedback: 'deferred', timed: true, plan: [{ gen: 'add_two', count: 3, descriptors: ['d1'] }] },
      { id: 'reflect', type: 'reflection', group: 'reflection', title: 'Рефлексия', prompt: 'Что получилось легко?' }
    ] }] };
})(typeof window !== 'undefined' ? window : globalThis);
```

(Этот минимум пройдёт структурную проверку; полноценный урок должен содержать диагностику, открытие, практику с заданием на перенос и поиск ошибки — см. `example-pack.js` и раздел 25 промта.)
