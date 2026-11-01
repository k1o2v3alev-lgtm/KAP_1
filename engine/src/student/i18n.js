/* KAP engine · i18n: все строки интерфейса ученика в словаре (раздел 23.6). Технических терминов здесь нет (п. 25.3).
   Казахские строки — рабочий вариант, требуют проверки носителем языка. Отсутствующая строка берётся из русского словаря. */
(function (root) {
  'use strict';
  var K = root.KAP = root.KAP || {};

  var ru = {
    'app.title': 'Мои уроки',
    'storage.warn': 'В этом браузере прогресс не сохраняется: после закрытия страницы он пропадёт. Сохраняй результат в файл.',
    'profile.who': 'Кто занимается?', 'profile.new': 'Новый ученик', 'profile.name': 'Имя и фамилия', 'profile.class': 'Класс',
    'profile.start': 'Начать', 'profile.nameRequired': 'Напиши имя и фамилию.', 'profile.classRequired': 'Укажи класс (число от 1 до 11, можно с буквой).',
    'profile.hint': 'Мы запоминаем только имя и класс.', 'profile.choose': 'Выбери себя',
    'home.lessons': 'Мои уроки', 'home.total': 'Уроков', 'home.done': 'Завершено', 'home.progress': 'В процессе', 'home.new': 'Не начато',
    'home.passing': 'Пройдено', 'home.passingNote': 'Это только прохождение набора уроков, а не отметка.',
    'home.saveAll': 'Сохранить все результаты (файл для учителя)', 'home.switch': 'Сменить ученика', 'home.search': 'Найти урок',
    'status.0': 'Не начат', 'status.1': 'В процессе', 'status.2': 'Завершён',
    'lesson.start': 'Начать урок', 'lesson.continue': 'Продолжить', 'lesson.newAttempt': 'Новая попытка', 'lesson.attempts': 'Мои попытки',
    'lesson.back': 'К урокам', 'lesson.objectives': 'Чему я научусь', 'lesson.attempt': 'Попытка', 'lesson.open': 'Смотреть итог', 'lesson.mark': 'Отметка',
    'stage.next': 'Дальше', 'stage.prev': 'Назад', 'stage.begin': 'Начать', 'stage.stopToday': 'Закончить на сегодня',
    'stage.saved': 'Всё сохранено. Можно продолжить позже с того же места.', 'stage.whatICan': 'Что я смогу',
    'stage.finalTitle': 'Итоговая проверка — по желанию', 'stage.finalInfo': 'Здесь нет подсказок, ответ даётся один раз. Время записывается, но работа не останавливается.',
    'stage.skipFinal': 'Пропустить и перейти к итогам', 'stage.clubTitle': 'Клуб — по желанию', 'stage.clubInfo': 'Задачи на размышление. Они не влияют на отметку.', 'stage.skipClub': 'Пропустить',
    'stage.diagInfo': 'Короткая проверка того, что ты уже знаешь. Подсказок нет, это не страшно: так мы поймём, с чего начать.',
    'stage.of': 'из',
    'task.check': 'Проверить', 'task.hint': 'Подсказка', 'task.solution': 'Показать разбор', 'task.skip': 'Пропустить', 'task.next': 'Дальше', 'task.retry': 'Попробовать ещё',
    'task.rule': 'Посмотреть правило', 'task.empty': 'Сначала дай ответ.', 'task.placeholder': 'Твой ответ', 'task.accepted': 'Ответ принят.',
    'task.openSaved': 'Ответ сохранён. Его посмотрит учитель.', 'task.confirmSolution': 'Показать разбор? За это задание можно будет получить не больше 40% баллов.',
    'task.attemptsLeft': 'Осталось попыток', 'task.openLabel': 'Напиши ответ', 'task.up': 'Выше', 'task.down': 'Ниже', 'task.pick': 'выбери', 'task.hintsLeft': 'Подсказок больше нет.',
    'fb.right': 'Верно!', 'fb.partly': 'Почти получилось', 'fb.notYet': 'Пока не получилось',
    'fb.rightClean': 'Верно, и без подсказок.', 'fb.rightHint': 'Верно. В следующий раз попробуй без подсказки.', 'fb.rightRetry': 'Верно: ошибка исправлена.',
    'fb.whatRight': 'Что уже верно', 'fb.whatWrong': 'Где ошибка', 'fb.tryNext': 'Что попробовать', 'fb.explain': 'Разбор', 'fb.yourAnswer': 'Твой ответ', 'fb.correctAnswer': 'Верный ответ',
    'fb.tried': 'Ты нашёл(ла) способ и довёл(а) решение до ответа — теперь осталось проверить ход.', 'fb.partOk': 'Часть ответа верна.', 'fb.general': 'Давай разберём ход решения.',
    'err.calc': 'Ответ не совпал с верным. Проверь вычисления по шагам.', 'err.format': 'Ответ записан в непонятной форме. Запиши число, дробь или слово.',
    'err.concept': 'Здесь стоит вспомнить правило.', 'err.order': 'Порядок шагов не совпал.', 'err.match': 'Не все пары соединены верно.',
    'err.multi_extra': 'Среди выбранных есть лишние ответы.', 'err.multi_miss': 'Выбраны не все верные ответы.',
    'err.not_reduced': 'Значение верное, но дробь нужно записать сокращённой.', 'err.form': 'Значение верное, но запись не такая, как просили.', 'err.skipped': 'Задание пропущено.',
    'series.title': 'Потренируем слабые места', 'series.text': 'Вот что пока даётся труднее. Несколько новых заданий помогут закрепить.',
    'series.start': 'Потренировать', 'series.skip': 'Не сейчас', 'series.refer': 'Если снова не получится, спроси учителя или одноклассника — это нормально.',
    'series.done': 'Серия закончена', 'series.mastered': 'Получается', 'series.improved': 'Стало лучше', 'series.same': 'Пока трудно',
    'rule.title': 'Правило', 'common.close': 'Закрыть', 'common.ok': 'Хорошо', 'common.save': 'Сохранить',
    'reflect.title': 'Подведём итог', 'reflect.feel': 'Как у тебя получилось?', 'reflect.e1': 'Всё понятно', 'reflect.e2': 'Почти всё понятно', 'reflect.e3': 'Нужно повторить',
    'reflect.phrase': 'Закончи фразу: «Сегодня мне удалось…»', 'reflect.scale': 'Насколько понятна тема (от 1 до 5)?', 'reflect.comment': 'Что было трудно, а что получилось легко?',
    'reflect.next': 'Что дальше?', 'reflect.n1': 'Повторю правила и примеры', 'reflect.n2': 'Потренирую трудные задания', 'reflect.n3': 'Пройду урок ещё раз', 'reflect.n4': 'Спрошу учителя или одноклассника',
    'reflect.finish': 'Завершить урок', 'reflect.chooseOne': 'Выбери один из вариантов.',
    'report.title': 'Итог урока', 'report.completed': 'Урок завершён', 'report.byLearning': 'Урок завершён по обучающей части', 'report.inProgress': 'Урок не закончен',
    'report.time': 'Время', 'report.active': 'Рабочее время', 'report.calendar': 'От начала до конца', 'report.completion': 'Выполнено', 'report.accuracy': 'Точность',
    'report.achievement': 'Цели урока', 'report.mark': 'Отметка', 'report.independence': 'Без подсказок',
    'report.basis.formative_without_control': 'Отметка за пройденную часть урока (итоговая проверка не выполнялась).',
    'report.basis.with_control': 'Отметка за урок вместе с итоговой проверкой.', 'report.basis.control_work': 'Результат контрольной работы.', 'report.basis.none': 'Отметки пока нет: ещё не было оценённых заданий.',
    'report.strengths': 'Получается', 'report.difficulties': 'Нужно повторить', 'report.recs': 'Что делать дальше', 'report.criteria': 'Цели и критерии',
    'report.summary': 'Итог по уроку из нескольких попыток', 'report.summaryRule': 'Среднее лучшей и последней попыток.',
    'report.save': 'Сохранить результат (файл для учителя)', 'report.review': 'Разбор ответов', 'report.saved': 'Файл сохранён. Отправь его учителю.',
    'report.cap': 'Время превысило лимит: за контрольную работу можно получить не больше 84%. Скорость тоже развивается тренировкой.',
    'report.pending': 'Есть ответы, которые посмотрит учитель', 'report.club': 'Клуб (не влияет на отметку)',
    'timer.label': 'Время', 'timer.over': 'Время по плану вышло. Продолжай: работа не останавливается, время записывается.'
  };

  var kk = {
    'app.title': 'Менің сабақтарым', 'home.lessons': 'Менің сабақтарым', 'status.0': 'Басталмаған', 'status.1': 'Орындалуда', 'status.2': 'Аяқталды',
    'profile.who': 'Кім жұмыс істейді?', 'profile.name': 'Аты-жөнің', 'profile.class': 'Сынып', 'profile.start': 'Бастау',
    'lesson.start': 'Сабақты бастау', 'lesson.continue': 'Жалғастыру', 'lesson.newAttempt': 'Жаңа әрекет', 'lesson.back': 'Сабақтарға',
    'stage.next': 'Әрі қарай', 'stage.begin': 'Бастау', 'stage.stopToday': 'Бүгінгі жұмысты аяқтау',
    'task.check': 'Тексеру', 'task.hint': 'Кеңес', 'task.skip': 'Өткізу', 'task.next': 'Әрі қарай', 'task.retry': 'Тағы байқап көру',
    'fb.right': 'Дұрыс!', 'fb.notYet': 'Әзірге болмады',
    'reflect.title': 'Қорытынды жасайық', 'reflect.finish': 'Сабақты аяқтау', 'report.title': 'Сабақ қорытындысы', 'report.mark': 'Баға', 'common.close': 'Жабу'
  };

  var I = { lang: 'ru', STR: { ru: ru, kk: kk } };
  I.t = function (key, vars) {
    var s = (I.STR[I.lang] && I.STR[I.lang][key]) || ru[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  };
  I.setLang = function (l) { I.lang = I.STR[l] ? l : 'ru'; };
  K.i18n = I;
})(typeof window !== 'undefined' ? window : globalThis);
