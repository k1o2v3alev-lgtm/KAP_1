# -*- coding: utf-8 -*-
import sys, os, json, re, html, base64, collections, datetime
sys.path.insert(0, os.path.dirname(__file__))
import content3 as C
from content3 import *
import figs
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUT = '/home/user/KAP_1/work/out'
FD = '/usr/share/fonts/truetype/dejavu/'
pdfmetrics.registerFont(TTFont('DV', FD + 'DejaVuSans.ttf')); pdfmetrics.registerFont(TTFont('DVB', FD + 'DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DVI', FD + 'DejaVuSans.ttf'))
pdfmetrics.registerFontFamily('DV', normal='DV', bold='DVB', italic='DVI', boldItalic='DVB')

COL = {'R0': '#2e7d32', 'R1': '#00838f', 'R2': '#b26a00', 'R3': '#c62828', 'R4': '#6a1b9a', 'FIXED': '#1565c0'}
ORDER = ['R0', 'R1', 'R2', 'R3', 'R4']
RANGES = {'SOR-6-1': (146, 334), 'SOR-6-2': (334, 456), 'SOR-6-3': (456, 615), 'SOR-6-4': (615, 779)}

# ---------------------------------------------------------------- сборка данных
works = [sor1(), sor2(), sor3(), sor4(), soch1(), soch2()]
for w in works:
    w['pages'] = PG[w['id']]
    if w['id'] in RANGES:
        a, b = RANGES[w['id']]
        tb = tables(a, b)
        w['info_table'] = tb[0]; w['points_table'] = tb[1]
        w['desc_table'] = next(t for t in tb if t[0][0].startswith('Критерий') and '№' in t[0][1])
        w['rubric'] = next(t for t in tb if any('Уровень учебных' in c for c in t[0]))
        tot = 0
        for r in w['desc_table']:
            if r[-1].isdigit() and not r[0].startswith(('Итого', 'Всего')) and len(r) >= 3: tot += int(r[-1])
        assert tot == w['max'], (w['id'], tot)
        for v in w['variants']:
            assert sum(t['pts'] for t in v['tasks']) == w['max'], (w['id'], v['n'])
    else:
        for v in w['variants']:
            assert sum(t['pts'] for t in v['tasks']) == w['max'], (w['id'], v['n'])

import verify
VER = verify.run(works)
assert all(x['result']=='PASS' for x in VER), [x for x in VER if x['result']!='PASS']
# --- дополнительные записи журнала
for n, v in enumerate(works[0]['variants'], 1):
    f = v['tasks'][3]['fig']
    L('SOR-6-1', n, 4, 'рисунок (карта для измерений)', 'R3', 'рисунок (карта) утрачен; сохранилось условие: «Выполните необходимые измерения… расстояние от %s до %s, масштаб 1:%s 000 000»' % (f['c1'], f['c2'], f['scale']),
      'схематическая карта 1:%s 000 000 с пунктами %s и %s; расстояние на карте ≈ %s см; ключ ≈ %d км' % (f['scale'], f['c1'], f['c2'], str(f['cm']).replace('.', ','), f['km']),
      'Оригинал — фрагмент карты Казахстана (не восстановим). Построена новая схема в точном масштабе (координаты городов по широте/долготе, равнопромежуточная проекция), печатать только в масштабе 100 %. Допуск ответа ±0,1 см на карте. Требует решения учителя о замене на печатную карту из атласа (R4 по желанию).')
L('SOR-6-1', 4, 1, 'условие', 'FIXED', '«Найдите количество, какого канцелярского товара Света положила…»', '«…Аня положила…»', 'В 4 варианте героиня задачи — Аня; имя Света — перенос из 3 варианта.')
L('SOR-6-1', 4, 4, 'условие', 'FIXED', '«Выполните необходимые измерения и запишите результаты.»', '«…запишите результаты, округлив до целых.»', 'В вариантах 1–3 есть требование округлить до целых; в 4 варианте опущено — выровнено.')
for w in works:
    pass
L('SOR-6-4', 3, 2, 'условие 2a, 2b', 'R0', 'пункты a) и b) 3 варианта дословно совпадают с 1 вариантом', '—', 'Не ошибка, но снижает различимость вариантов (пп. 2a–2b совпадают в 1 и 3 вариантах). Рекомендация экспертизе: изменить параметры.')

# --- уровни по компонентам
def agg(steps):
    m = 0
    for s in steps:
        k = {'R0': 0, 'R1': 1, 'FIXED': 1, 'R2': 2, 'R3': 3, 'R4': 4}[s]
        m = max(m, k)
    return ORDER[m]
comps = []
for w in works:
    for v in w['variants']:
        for t in v['tasks']:
            comps.append((w['id'], v['n'], t['no'], 'условие', t['status']))
            if 'fig' in t: comps.append((w['id'], v['n'], t['no'], 'рисунок', 'R3' if t['fig']['kind'] == 'map' else 'R1'))
            if 'scheme' in t:
                comps.append((w['id'], v['n'], t['no'], 'схема баллов', agg([s['src'] for s in t['scheme']])))
            else:
                comps.append((w['id'], v['n'], t['no'], 'ключ (вычислен)', 'R3' if t['status'] == 'R3' else 'R1'))
    comps.append((w['id'], 0, 0, 'спецификация / таблицы критериев', 'R0'))
    if w['id'] in RANGES: comps.append((w['id'], 0, 0, 'рубрика для родителей', 'R0'))
count = collections.Counter(c[4] for c in comps)
bywork = {w['id']: collections.Counter(c[4] for c in comps if c[0] == w['id']) for w in works}

# ---------------------------------------------------------------- противоречия / замечания
CONTRA = [
 dict(work='SOCH-6-Q2', text='Спецификация перечисляет 7 заданий (№ 1,5,2,4,3,6,7; баллы 1,5,3,2,1,5,3), в вариантах 6 заданий с баллами 1,2,3,3,6,5. Суммы по разделам (6А = 6; 6В = 14) и общая сумма 20 совпадают — рассогласована нумерация и разбивка баллов по целям. Нормативный максимум 20 не менялся.'),
 dict(work='SOCH-6-Q2', text='Во всех вариантах схема содержит «[[OLE]]» (пустые объекты) там, где должны быть формулы шагов; шаги заново вычислены из восстановленных условий (R3).'),
 dict(work='SOCH-6-Q1', text='Схема 1 варианта (задание 5): «|4 − 10| = 4» противоречит условию |2 − 6| и ответу А(2), В(6). Исправлено на |2 − 6| = 4 (FIXED).'),
 dict(work='SOR-6-3', text='Задание 3 в исходнике пронумеровано «1., 2., 4.» (нумерация автосписком нарушена). Восстановлена нумерация 1–4 по таблице баллов и дескрипторам.'),
 dict(work='SOR-6-2', text='Формулировка «координатный луч» для точек с отрицательными координатами некорректна (в дескрипторе: «координатная прямая»). Текст сохранён как в источнике, зафиксировано для математической экспертизы; в восстановленном тексте использовано «координатная прямая».'),
 dict(work='SOR-6-4', text='Пункты 2a и 2b в вариантах 1 и 3 совпадают дословно; в 2–4 вариантах пропущен номер задания 2 (нумерация автосписком). Баллы 2+6+6 = 14 соответствуют таблице и дескрипторам.'),
 dict(work='SOR-6-1', text='Различие вида зависимости: 1 вариант — прямая пропорциональность, 2–4 — обратная; в 2 варианте ответ 4,125 мин (менее «круглый», чем в 3–4 вариантах). Сопоставимость вариантов проверяется на этапе математической экспертизы.'),
 dict(work='SOR-6-2', text='Сложность задания 4: в 1 и 4 вариантах расстояние находится сложением модулей (6,9 и 5,9), во 2 и 3 вариантах — вычитанием (0,5 и 0,8). Сопоставимость вариантов проверяется на этапе математической экспертизы.'),
 dict(work='ALL', text='Исходный файл — .docx (не PDF): все 97 вложений MathType (Equation.3) пусты (OLE без потока Equation Native), все 37 WMF-превью размером ≤1,5 КБ (пустые). Уцелели только формулы Word OMath (68 шт.), текст и таблицы. Страницы исходника приведены по рендеру LibreOffice (150 стр.), номера ориентировочные.'),
]
NOTE_TXT = ('Документ реконструирован, а не является точной копией оригинала: содержит элементы R2 и R3. Приоритет источников: сохранившийся текст → схема баллов/дескрипторы → '
            'спецификация → структура задания. Все реконструированные элементы отмечены в журнале.')

# ---------------------------------------------------------------- картинки
os.makedirs(OUT + '/figures', exist_ok=True)
for w in works:
    for v in w['variants']:
        for t in v['tasks']:
            f = t.get('fig')
            if not f: continue
            p = '%s/figures/%s_v%d_t%d.png' % (OUT, w['id'], v['n'], t['no'])
            if f['kind'] == 'map':
                W, H = figs.draw_map(f['c1'], f['c2'], f['scale'], p, CITY, proj); f['w_cm'] = W; f['h_cm'] = H
            else:
                figs.numline(f['a'], f['b'], p); f['w_cm'] = 11; f['h_cm'] = 2.2
            f['path'] = p

# ---------------------------------------------------------------- JSON
def clean_json(o):
    if isinstance(o, dict): return {k: clean_json(v) for k, v in o.items() if k != 'path'}
    if isinstance(o, list): return [clean_json(x) for x in o]
    if isinstance(o, F): return str(o)
    return o
data = dict(meta=dict(title='Восстановленный сборник СОР/СОЧ, математика 6 класс, 1 полугодие (1–2 четверти)', source='0a5d00b7-__-______06-fix.docx', generated=datetime.date.today().isoformat(),
                     note=NOTE_TXT, status_legend={'R0': 'оригинал сохранён', 'R1': 'достоверная реконструкция', 'R2': 'обоснованная реконструкция', 'R3': 'замещающее задание', 'R4': 'решение учителя', 'FIXED': 'исправленная ошибка/опечатка'},
                     counts=dict(count), counts_by_work={k: dict(v) for k, v in bywork.items()}),
            works=clean_json([{k: v for k, v in w.items()} for w in works]), log=LOG, contradictions=CONTRA, verification=VER)
json.dump(data, open(OUT + '/Restored_Source_Data.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)

# ---------------------------------------------------------------- PDF
st = lambda n, **k: ParagraphStyle(n, fontName=k.pop('fontName', 'DV'), **k)
S = dict(body=st('b', fontSize=9.2, leading=13), small=st('s', fontSize=7.4, leading=9.6), h0=st('h0', fontName='DVB', fontSize=17, leading=21, spaceAfter=8),
         h1=st('h1', fontName='DVB', fontSize=13, leading=16, spaceBefore=4, spaceAfter=6, textColor=colors.HexColor('#222222')),
         h2=st('h2', fontName='DVB', fontSize=11, leading=14, spaceBefore=8, spaceAfter=4, textColor=colors.HexColor('#0b3d6b')),
         task=st('t', fontSize=9.4, leading=13.5, leftIndent=14, firstLineIndent=-14, spaceAfter=4), key=st('k', fontSize=8.2, leading=11.2, leftIndent=10, textColor=colors.HexColor('#333333')),
         cell=st('c', fontSize=7.8, leading=10), cellb=st('cb', fontName='DVB', fontSize=7.8, leading=10))
FS = 10.8

def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def rich(text, fs=FS):
    parts = text.split('$'); out = []
    for i, p in enumerate(parts):
        if i % 2 == 0: out.append(esc(p).replace('\n', '<br/>'))
        else:
            path, w, h = figs.math_img(p, fs=fs)
            out.append('<img src="%s" width="%.1f" height="%.1f" valign="middle"/>' % (path, w, h))
    return ''.join(out)
def badge(s): return ' <font name="DVB" size="7" color="%s">[%s]</font>' % (COL[s], s)
def P(t, style='body'):
    r = rich(t)
    for a_, b_ in (('&lt;b&gt;', '<b>'), ('&lt;/b&gt;', '</b>')): r = r.replace(a_, b_)
    return Paragraph(r, S[style])

def tbl(rows, widths=None, head=True, fs='cell'):
    data_ = [[Paragraph(rich(c, 8.4).replace('⟦утрачено⟧', '<font color="#c62828">⟦утрачено⟧</font>') if True else '', S['cellb'] if (head and i == 0) else S[fs]) for c in r] for i, r in enumerate(rows)]
    n = max(len(r) for r in data_)
    for r in data_:
        while len(r) < n: r.append(Paragraph('', S['cell']))
    t = Table(data_, colWidths=widths, repeatRows=1 if head else 0)
    t.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#999999')), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                           ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eef2f6') if head else colors.white), ('LEFTPADDING', (0, 0), (-1, -1), 3), ('RIGHTPADDING', (0, 0), (-1, -1), 3), ('TOPPADDING', (0, 0), (-1, -1), 2), ('BOTTOMPADDING', (0, 0), (-1, -1), 2)]))
    return t

story = []
def page_deco(c, d):
    c.saveState(); c.setFont('DV', 7); c.setFillColor(colors.HexColor('#666666'))
    c.drawString(1.8 * cm, 1.0 * cm, 'Restored_Source — РЕКОНСТРУКЦИЯ (не точная копия оригинала; см. статусы R0–R3)')
    c.drawRightString(A4[0] - 1.8 * cm, 1.0 * cm, 'стр. %d' % d.page); c.restoreState()

story += [P('Восстановленный сборник суммативного оценивания', 'h0'), P('Математика, 6 класс · 1 полугодие (1 и 2 четверти): СОР «Отношения и пропорции», «Рациональные числа и действия над ними», «Действия над рациональными числами», «Алгебраические выражения», СОЧ за 1 и 2 четверти', 'body'),
          Spacer(1, 6), P('<b>Важно.</b> ' + NOTE_TXT, 'body'), Spacer(1, 6),
          tbl([['Статус', 'Значение', 'Компонентов']] + [[k, v, str(count.get(k, 0))] for k, v in [('R0', 'оригинал сохранён'), ('R1', 'достоверная реконструкция'), ('R2', 'обоснованная реконструкция'), ('R3', 'замещающее задание/фрагмент'), ('R4', 'требуется решение учителя')]], [2 * cm, 9 * cm, 3 * cm]),
          Spacer(1, 6), P('Пометки [R0]–[R3] в тексте указывают на статус условия; в ключах и схемах баллов статус показан в журнале (Reconstruction_Audit.html). Страницы исходника указаны по рендеру исходного .docx и ориентировочны.', 'small'), PageBreak()]

def keytext(t):
    return t['answer']
for w in works:
    story.append(P(w['title'].upper(), 'h1'))
    for tb in (w.get('info_table'), w.get('points_table')):
        if tb:
            story.append(tbl(tb, [3.5 * cm, 13.5 * cm] if len(tb[0]) == 2 else None, head=False)); story.append(Spacer(1, 4))
    if w['id'].startswith('SOCH'):
        for tb in w['tables']:
            story.append(tbl(tb, None, head=True)); story.append(Spacer(1, 4))
    story.append(P('Максимальный балл: %d. Время: %s' % (w['max'], '40 минут' if w['id'].startswith('SOCH') else ('25 минут' if w['id'] in ('SOR-6-1', 'SOR-6-2') else '20 минут')), 'small'))
    for v in w['variants']:
        hdr = [P('%d ВАРИАНТ  (стр. исходника ≈ %d)' % (v['n'], w['pages'][v['n']]), 'h2')]
        tp = [['№ задания'] + [str(t['no']) for t in v['tasks']], ['Баллы'] + [str(t['pts']) for t in v['tasks']] + []]
        hdr += [tbl(tp, [3 * cm] + [1.1 * cm] * len(v['tasks'])), Spacer(1, 4)]
        first = True
        for t in v['tasks']:
            para = Paragraph('<b>%d.</b> ' % t['no'] + rich(t['text']) + badge(t['status']) + ' <font size="7.4" color="#555555">(%d б.)</font>' % t['pts'], S['task'])
            if first: story.append(KeepTogether(hdr + [para])); first = False
            else: story.append(para)
            if t.get('fig'):
                f = t['fig']
                story.append(Image(f['path'], width=f['w_cm'] * cm, height=f['h_cm'] * cm, hAlign='LEFT')); story.append(Spacer(1, 3))
        if 'scheme' in v['tasks'][0]:
            rows = [['№', 'Ответ / шаг решения', 'Балл', 'Доп. информация', 'Статус']]
            for t in v['tasks']:
                for i, s in enumerate(t['scheme']):
                    rows.append([str(t['no']) if i == 0 else '', s['text'], str(s['pts']), s.get('info', ''), s['src']])
            story.append(P('<b>Схема выставления баллов</b> (восстановлена)', 'body'))
            story.append(tbl(rows, [0.9 * cm, 9.6 * cm, 1.2 * cm, 4.2 * cm, 1.4 * cm]))
        else:
            story.append(P('<b>Восстановленный ключ</b> (в исходнике ключей к СОР нет; вычислен программно, см. журнал)', 'body'))
            for t in v['tasks']:
                story.append(Paragraph('<b>%d.</b> ' % t['no'] + rich(t['answer']), S['key']))
    if w['id'] in RANGES:
        story.append(P('<b>Критерии оценивания и дескрипторы</b> (оригинал, R0)', 'h2')); story.append(tbl(w['desc_table'], [4.4 * cm, 1.4 * cm, 9.7 * cm, 1.2 * cm]))
        story.append(P('<b>Рубрика для родителей</b> (оригинал, R0)', 'h2')); story.append(tbl(w['rubric'], [3.4 * cm, 4.4 * cm, 4.8 * cm, 4.6 * cm]))
    story.append(PageBreak())
doc = SimpleDocTemplate(OUT + '/Restored_Source.pdf', pagesize=A4, leftMargin=1.8 * cm, rightMargin=1.8 * cm, topMargin=1.6 * cm, bottomMargin=1.7 * cm, title='Restored_Source: СОР/СОЧ 6 кл., 1 полугодие', author='reconstruction')
doc.build(story, onFirstPage=page_deco, onLaterPages=page_deco)

# ---------------------------------------------------------------- HTML
def hrich(text, fs=FS):
    parts = text.split('$'); out = []
    for i, p in enumerate(parts):
        if i % 2 == 0: out.append(html.escape(p).replace('\n', '<br>'))
        else:
            path, w, h = figs.math_img(p, fs=fs)
            out.append('<img class="m" alt="%s" src="data:image/png;base64,%s" style="height:%.1fpx">' % (html.escape(p), base64.b64encode(open(path, 'rb').read()).decode(), h * 1.33))
    return ''.join(out)
rows = []
for e in LOG:
    rows.append('<tr data-s="%s" data-w="%s"><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td><span class="b" style="background:%s">%s</span></td><td>%s</td><td>%s</td><td>%s</td></tr>' % (
        e['status'], e['work'], e['work'], e['variant'], e['task'], html.escape(e['part']), COL[e['status']], e['status'], html.escape(e['source']), hrich(e['restored']), html.escape(e['rationale'])))
cnt_rows = ''.join('<tr><td>%s</td>%s<td><b>%d</b></td></tr>' % (w['id'], ''.join('<td>%d</td>' % bywork[w['id']].get(k, 0) for k in ORDER), sum(bywork[w['id']].values())) for w in works)
cnt_rows += '<tr><th>Всего</th>%s<th>%d</th></tr>' % (''.join('<th>%d</th>' % count.get(k, 0) for k in ORDER), sum(count.values()))
HT = '''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reconstruction_Audit — 6 класс, 1 полугодие</title>
<style>body{font:14px/1.45 system-ui,Segoe UI,Arial;margin:16px;color:#1b1b1b}h1{font-size:20px}h2{font-size:16px;margin-top:22px}table{border-collapse:collapse;width:100%%;font-size:12.5px}td,th{border:1px solid #bbb;padding:4px 6px;vertical-align:top}th{background:#eef2f6;text-align:left}
.b{color:#fff;padding:1px 7px;border-radius:9px;font-weight:600}img.m{vertical-align:middle}.note{background:#fff7e0;border:1px solid #e6c36a;padding:8px 12px;border-radius:6px}.f button{margin:2px;padding:3px 10px;cursor:pointer}ul{padding-left:18px}
@media print{.f{display:none}}</style></head><body>
<h1>Журнал реконструкции: СОР/СОЧ 6 класс, 1 полугодие</h1>
<p>Источник: <code>0a5d00b7-__-______06-fix.docx</code> (150 стр. по рендеру). Дата: %s.</p><div class="note">%s</div>
<h2>Сводка по уровням достоверности (компонентов)</h2><table style="max-width:560px"><tr><th>Работа</th><th>R0</th><th>R1</th><th>R2</th><th>R3</th><th>R4</th><th>Всего</th></tr>%s</table>
<p>Компонент = условие задания / рисунок / схема баллов (или вычисленный ключ) / таблицы спецификации и критериев. R4 (решение учителя) — нет; рекомендуется выборочная проверка всех R2/R3.</p>
<h2>Машинная проверка</h2><p>%d независимых проверок (пересчёт оригинальных ключей СОЧ по условиям, решение уравнений sympy, суммы баллов): <b>все PASS</b>. Подробности — в <code>Restored_Source_Data.json</code> (поле verification).</p><h2>Повреждения исходника (общие)</h2><ul>%s</ul>
<h2>Противоречия и замечания</h2><ul>%s</ul>
<h2>Журнал: исходный фрагмент → восстановленный элемент → обоснование</h2>
<div class="f">Фильтр: <button onclick="fl('')">все</button>%s</div>
<table id="t"><tr><th>Работа</th><th>Вар.</th><th>Зад.</th><th>Элемент</th><th>Статус</th><th>Исходный фрагмент</th><th>Восстановлено</th><th>Математическое обоснование</th></tr>%s</table>
<script>function fl(s){document.querySelectorAll('#t tr[data-s]').forEach(function(r){r.style.display=(!s||r.dataset.s==s)?'':'none'})}</script></body></html>'''
dmg = ['MathType (Equation.3): 97 объектов, все OLE-вложения пусты, превью WMF ≤1,5 КБ — формулы утрачены полностью.',
       'Изображения/рисунки: числовые прямые (СОЧ-1, задание 5), карты (СОР-1, задание 4) и формулы-картинки (СОЧ-1, задание 8; СОЧ-2, задание 6 вар. 4) утрачены.',
       'Уцелели: Word-формулы OMath (68), текст условий, таблицы спецификаций, баллов, дескрипторов, рубрики, ответы к заданиям 1–7 СОЧ-1, часть схемы СОЧ-2 (ответы 1, 3, 5).']
HTML = HT % (datetime.date.today().isoformat(), html.escape(NOTE_TXT), cnt_rows, len(VER), ''.join('<li>%s</li>' % html.escape(x) for x in dmg),
             ''.join('<li><b>%s:</b> %s</li>' % (c['work'], html.escape(c['text'])) for c in CONTRA),
             ''.join('<button onclick="fl(\'%s\')" style="background:%s;color:#fff">%s</button>' % (k, COL[k], k) for k in ['R0', 'R1', 'R2', 'R3', 'R4', 'FIXED']), ''.join(rows))
open(OUT + '/Reconstruction_Audit.html', 'w', encoding='utf8').write(HTML)
print('OK', dict(count), len(LOG))
