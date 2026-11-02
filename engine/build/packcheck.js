/* Проверка набора содержания (pack.js): структура, ссылки, запрещённый материал, массовые тесты генераторов.
   Использование: require('./packcheck.js')(KAP, { runs: 600 }) после загрузки ядра и pack.js. */
'use strict';
module.exports = function validatePack(K, opts) {
  opts = opts || {};
  const N = opts.runs || 600, errors = [], warnings = [], genRows = [];
  const err = m => errors.push(m), warn = m => warnings.push(m);
  const STAGE_TYPES = ['entry', 'cards', 'tasks', 'reflection'], GROUPS = ['entry', 'diagnostic', 'learning', 'final', 'club', 'reflection'];
  const ASSESS = ['formative', 'intermediate', 'SOR', 'SOCH', 'practical', 'project', 'control', 'other'], CHECK = ['learning', 'quarter_final', 'year_final', 'residual'];
  const GENERIC_ERR = ['calc', 'format', 'concept', 'order', 'match', 'multi_extra', 'multi_miss', 'not_reduced', 'form', 'skipped'];
  const HIGH = ['understanding', 'transfer', 'investigation', 'generalization'];
  const JARGON = ['seed', 'генератор', 'валидатор', 'json', 'fingerprint', 'парсер', 'движок'];
  const P = K.PACK;

  if (!P) { err('Не найден KAP.PACK: pack.js должен задавать K.PACK'); return { errors, warnings, genRows }; }
  ['materialId', 'contentVersion', 'title', 'language'].forEach(k => { if (!P[k]) err('PACK.' + k + ': не задано'); });
  if (P.language && ['ru', 'kk'].indexOf(P.language) < 0) warn('PACK.language = ' + P.language + ': для других языков нужен словарь строк интерфейса');
  if (!Array.isArray(P.lessons) || !P.lessons.length) { err('PACK.lessons: нужен непустой массив'); return { errors, warnings, genRows }; }
  if (!P.errorLabels) warn('PACK.errorLabels не задан: ученик увидит общие подсказки об ошибках');
  const textOf = s => String(s == null ? '' : s).replace(/<[^>]*>/g, ' ');
  const seenLesson = {}, usedGen = {}, allErrTypes = {};

  function scanText(where, text, forbidden) {
    const low = textOf(text).toLowerCase();
    (forbidden || []).forEach(t => { if (t && low.indexOf(String(t).toLowerCase()) >= 0) err(where + ': запрещённый (ещё не изученный) материал «' + t + '»'); });
    JARGON.forEach(w => { if (low.indexOf(w) >= 0) warn(where + ': служебное слово «' + w + '» в тексте для ученика (допустимо, только если это предмет изучения)'); });
  }

  P.lessons.forEach((L, li) => {
    const w = 'Урок ' + (L.lessonId || '#' + (li + 1));
    ['lessonId', 'title', 'subject', 'class', 'assessmentType'].forEach(k => { if (!L[k]) err(w + ': нет поля ' + k); });
    if (L.lessonId) { if (seenLesson[L.lessonId]) err(w + ': lessonId повторяется'); seenLesson[L.lessonId] = 1; if (/\s/.test(L.lessonId)) err(w + ': lessonId без пробелов'); }
    if (L.assessmentType && ASSESS.indexOf(L.assessmentType) < 0) err(w + ': assessmentType «' + L.assessmentType + '» не из списка ' + ASSESS.join('/'));
    if (L.checkKind && CHECK.indexOf(L.checkKind) < 0) err(w + ': checkKind «' + L.checkKind + '» не из списка ' + CHECK.join('/'));
    if (!Array.isArray(L.objectives) || !L.objectives.length) err(w + ': objectives (цели обучения с кодами) обязательны'); else L.objectives.forEach(o => { if (!o.code || !o.text) err(w + ': у цели нужны code и text'); });
    if (!Array.isArray(L.lessonObjectives)) warn(w + ': нет lessonObjectives (конкретные цели урока)');
    if (L.weights) ['diagnostic', 'learning', 'final'].forEach(k => { if (L.weights[k] != null && !(L.weights[k] >= 0 && L.weights[k] <= 100)) err(w + ': weights.' + k + ' вне 0–100'); });
    const pm = L.programMap;
    if (!pm || !['current', 'confirmed', 'notYet', 'forbidden'].every(k => Array.isArray(pm[k]))) warn(w + ': нет карты пререквизитов programMap {current, confirmed, notYet, forbidden}');
    const forbidden = (pm && pm.forbiddenTerms) || [];
    if (pm && pm.forbidden && pm.forbidden.length && !forbidden.length) warn(w + ': programMap.forbidden задан, но нет programMap.forbiddenTerms — автоматическая проверка запрещённого материала не выполняется');

    const descr = {};
    if (!Array.isArray(L.criteria) || !L.criteria.length) err(w + ': criteria (критерии и дескрипторы КСП) обязательны');
    else L.criteria.forEach(c => { if (!c.criterionId || !c.text || !Array.isArray(c.descriptors) || !c.descriptors.length) err(w + ': критерий ' + c.criterionId + ': нужны criterionId, text, descriptors[]'); else c.descriptors.forEach(d => { if (!d.descriptorId || !d.text) err(w + ': у дескриптора нужны descriptorId и text'); else { if (descr[d.descriptorId]) err(w + ': дескриптор ' + d.descriptorId + ' повторяется'); descr[d.descriptorId] = 1; } }); });
    const subs = {};
    if (!Array.isArray(L.subskills) || !L.subskills.length) err(w + ': subskills (поднавыки) обязательны'); else L.subskills.forEach(s => {
      if (!s.id || !s.text) err(w + ': у поднавыка нужны id и text'); else subs[s.id] = 1;
      if (!s.ruleCard || !s.ruleCard.html) warn(w + ': поднавык ' + s.id + ' без ruleCard — нечего показать при возврате к правилу');
      if (!s.recommend) warn(w + ': поднавык ' + s.id + ' без recommend');
      scanText(w + ' · поднавык ' + s.id, (s.ruleCard && s.ruleCard.html) + ' ' + (s.example && s.example.html), forbidden);
    });

    const stages = L.stages || [], ids = {};
    if (!stages.length || stages[0].type !== 'entry') err(w + ': первый этап должен быть type: "entry" с полем can[]');
    else if (!Array.isArray(stages[0].can) || !stages[0].can.length) warn(w + ': в этапе entry нет списка can («Что я смогу»)');
    if (stages.length && stages[stages.length - 1].type !== 'reflection') err(w + ': последний этап должен быть type: "reflection"');
    const levelCounts = { all: 0, high: 0, finalAll: 0, finalHigh: 0 }; let hasTransfer = false, finalStage = null;
    stages.forEach(st => {
      const sw = w + ' · этап ' + st.id;
      if (!st.id) { err(w + ': у этапа нет id'); return; } if (ids[st.id]) err(sw + ': id повторяется'); ids[st.id] = 1;
      if (STAGE_TYPES.indexOf(st.type) < 0) err(sw + ': type «' + st.type + '» не из списка ' + STAGE_TYPES.join('/'));
      if (GROUPS.indexOf(st.group) < 0) err(sw + ': group «' + st.group + '» не из списка ' + GROUPS.join('/'));
      if (!st.title) err(sw + ': нет title');
      if (st.type === 'cards') { if (!Array.isArray(st.cards) || !st.cards.length) err(sw + ': нужен массив cards'); else st.cards.forEach((c, i) => scanText(sw + ' карточка ' + (i + 1), c.title + ' ' + c.html, forbidden)); }
      if (st.type !== 'tasks') return;
      if (st.group === 'final') finalStage = st;
      if ((st.group === 'diagnostic' || st.group === 'final') && st.hints !== false) err(sw + ': в диагностике и итоговой проверке подсказки отключаются (hints: false)');
      if ((st.group === 'diagnostic' || st.group === 'final') && (st.maxAttempts || 1) !== 1) err(sw + ': в диагностике и итоговой проверке одна попытка (maxAttempts: 1)');
      if (st.group === 'learning' && st.hints === false) warn(sw + ': в обучающем этапе обычно нужны подсказки (hints: true)');
      if (st.group === 'final' && !st.timed) warn(sw + ': у итоговой проверки нет timed: true — время не будет фиксироваться');
      if (!Array.isArray(st.plan) || !st.plan.length) { err(sw + ': нужен plan[]'); return; }
      st.plan.forEach(it => {
        let def; try { def = K.gen.get(it.gen); } catch (e) { err(sw + ': генератор «' + it.gen + '» не зарегистрирован'); return; }
        if (!(it.count >= 1 && it.count <= 12 && it.count === Math.floor(it.count))) err(sw + ': count у ' + it.gen + ' должен быть целым 1–12');
        const prof = it.profile || (def.profiles.standard ? 'standard' : Object.keys(def.profiles)[0]);
        if (!def.profiles[prof]) err(sw + ': у генератора ' + it.gen + ' нет профиля «' + prof + '»');
        (usedGen[it.gen] = usedGen[it.gen] || {})[prof] = 1;
        if (!subs[def.subskill]) err(sw + ': поднавык «' + def.subskill + '» генератора ' + it.gen + ' не описан в subskills урока');
        (it.descriptors || []).forEach(d => { if (!descr[d]) err(sw + ': дескриптор «' + d + '» (задание ' + it.gen + ') не описан в criteria урока'); });
        if (st.group !== 'diagnostic' && st.group !== 'club' && !(it.descriptors && it.descriptors.length) && L.criteria && L.criteria.length) warn(sw + ': у ' + it.gen + ' нет descriptors — задание не войдёт в достижение по критериям');
        if (st.group !== 'diagnostic' && st.mode !== 'CLUB' && st.group !== 'club') {
          levelCounts.all += it.count; if (HIGH.indexOf(def.cognitiveLevel) >= 0) levelCounts.high += it.count; if (def.cognitiveLevel === 'transfer' || def.cognitiveLevel === 'investigation') hasTransfer = true;
          if (st.group === 'final') { levelCounts.finalAll += it.count; if (HIGH.indexOf(def.cognitiveLevel) >= 0) levelCounts.finalHigh += it.count; }
        }
        // образцы: запрещённый материал, служебные слова, типы ошибок
        for (let i = 0; i < 25; i++) {
          let t; try { t = K.gen.reproduce(it.gen, prof, K.util.deriveSeed('pc:' + it.gen + ':' + prof, i)); } catch (e) { continue; }
          scanText(sw + ' · ' + it.gen, [t.condition, (t.options || []).map(o => o.text).join(' '), (t.hints || []).join(' '), t.explanation].join(' '), forbidden);
          Object.keys(t.distractorMap || {}).forEach(k => { allErrTypes[t.distractorMap[k]] = 1; });
          ((t.rule && t.rule.wrongValues) || []).concat((t.rule && t.rule.wrongAnswers) || []).forEach(x => { if (x.errorType) allErrTypes[x.errorType] = 1; });
        }
      });
    });
    if (stages.some(s => s.type === 'reflection') === false) err(w + ': нет этапа рефлексии');
    if (['intermediate', 'SOR', 'SOCH'].indexOf(L.assessmentType) >= 0 && !finalStage) warn(w + ': вид оценивания ' + L.assessmentType + ', но нет этапа final (контрольной части)');
    if (finalStage && !(L.timeLimitSec && L.timeLimitSec.final)) warn(w + ': нет timeLimitSec.final — превышение времени не проверяется (задай лимит из КСП)');
    if (!hasTransfer) warn(w + ': нет заданий уровня transfer/investigation (раздел 25.5: нужна задача на перенос)');
    if (levelCounts.finalAll && levelCounts.finalHigh / levelCounts.finalAll < 0.25) warn(w + ': в итоговой проверке доля заданий уровней «понимание» и выше ' + Math.round(100 * levelCounts.finalHigh / levelCounts.finalAll) + '% (ориентир не меньше 25%, если КСП не задаёт иного)');
  });

  Object.keys(allErrTypes).forEach(t => { if (GENERIC_ERR.indexOf(t) < 0 && !(P.errorLabels && P.errorLabels[t])) warn('errorLabels: нет текста для типа ошибки «' + t + '»'); });
  K.gen.list().forEach(d => { if (!usedGen[d.id]) warn('Генератор ' + d.id + ' зарегистрирован, но не используется ни в одном уроке'); });

  // массовое тестирование всех используемых генераторов и профилей
  Object.keys(usedGen).forEach(id => {
    Object.keys(usedGen[id]).forEach(prof => {
      const st = K.gen.test(id, N, { profile: prof }); const ok = st.verdict.ok;
      genRows.push({ id, version: st.generatorVersion, profile: prof, tried: st.tried, accepted: st.accepted, rejected: st.rejected, unique: st.uniqueVariants, ok, problems: st.verdict.problems, reasons: st.reasons });
      if (!ok) err('Генератор ' + id + ' (' + prof + '): ' + st.verdict.problems.join('; '));
      else if (st.rejected > st.tried * 0.15) warn('Генератор ' + id + ' (' + prof + '): много отбракованных заданий (' + st.rejected + ' из ' + st.tried + '), упрости параметры');
    });
  });
  return { errors, warnings, genRows };
};
