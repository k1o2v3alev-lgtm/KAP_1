# -*- coding: utf-8 -*-
"""Реконструированное содержимое СОР/СОЧ 6 кл., 1 полугодие. Все ответы вычисляются, а не вводятся вручную."""
import re, math
from fractions import Fraction as F

MARK = open('/home/user/KAP_1/work/marked.txt', encoding='utf8').read().split('\n')

def clean(s):
    s = s.replace('\t', ' ')
    s = re.sub(r'\[\[(OLE|IMG)\d+\]\]', '', s)
    return re.sub(r'\s+', ' ', s).strip()

def lines_between(a, b):
    return [clean(x) for x in MARK[a - 1:b - 1] if clean(x)]

def tables(a, b):
    """все таблицы в диапазоне строк marked.txt -> [rows[cells]]"""
    out, cur = [], None
    for ln in MARK[a - 1:b - 1]:
        if ln.startswith('<<TABLE>>'): cur = []
        elif ln.startswith('<<END>>'):
            out.append(cur); cur = None
        elif cur is not None:
            ln = ln.replace('\xa0', ' ')
            cur.append([clean(c.replace(' / ', '\n')) if False else re.sub(r'[ \t]+', ' ', re.sub(r'\[\[(OLE|IMG)\d+\]\]', '⟦утрачено⟧', c)).strip().replace(' / ', '\n') for c in ln.split(' | ')])
    return out

def fnum(x, nd=None):
    """Fraction -> строка с десятичной запятой"""
    x = F(x)
    if x.denominator == 1: return str(x.numerator).replace('-', '−')
    d = x.denominator
    while d % 2 == 0: d //= 2
    while d % 5 == 0: d //= 5
    if d != 1: return ('%d/%d' % (x.numerator, x.denominator)).replace('-', '−')
    s = ('%f' % float(x)).rstrip('0').rstrip('.')
    return s.replace('.', ',').replace('-', '−')

def dec(s):  # '2,5' -> F
    return F(str(s).replace(',', '.').replace('−', '-'))

def mix(whole, n, d, neg=False):
    return ('-' if neg else '') + r'%d\,\frac{%d}{%d}' % (whole, n, d)

def mixv(whole, n, d, neg=False):
    v = F(whole) + F(n, d)
    return -v if neg else v

def dtex(x):  # десятичное в tex с запятой
    s = fnum(x).replace('−', '-')
    return s.replace(',', '{,}')

def tex(x):  # Fraction -> tex (десятичное, если конечное)
    return dtex(x)

# ------------------------------------------------------------------ карты (СОР-1, задание 4)
CITY = {  # (широта, долгота)
 'Астана': (51.17, 71.43), 'Тараз': (42.90, 71.37), 'Караганда': (49.80, 73.10), 'Кызылорда': (44.85, 65.51),
 'Алматы': (43.24, 76.89), 'Павлодар': (52.29, 76.97), 'Шымкент': (42.32, 69.59), 'Актобе': (50.28, 57.21),
 'Костанай': (53.21, 63.63), 'Семей': (50.41, 80.26), 'Актау': (43.65, 51.15), 'Атырау': (47.11, 51.92),
 'Петропавловск': (54.87, 69.15), 'Талдыкорган': (45.02, 78.37), 'Кокшетау': (53.28, 69.38), 'Балхаш': (46.84, 74.98),
 'Уральск': (51.23, 51.37), 'Жезказган': (47.80, 67.71), 'Туркестан': (43.30, 68.25),
}
def proj(lat, lon, lat0=47.5):
    R = 6371.0
    return (R * math.cos(math.radians(lat0)) * math.radians(lon), R * math.radians(lat))
def map_dist_km(c1, c2):
    a, b = proj(*CITY[c1]), proj(*CITY[c2]); return math.hypot(a[0] - b[0], a[1] - b[1])

# ------------------------------------------------------------------ СОР-1
def sor1():
    tabs = tables(146, 160)
    V = {}
    spans = [(162, 191), (191, 219), (219, 244), (244, 270)]
    for n, (a, b) in enumerate(spans, 1):
        ls = lines_between(a + 1, b)
        ls = [l for l in ls if not l.endswith('ВАРИАНТ')]
        i2 = next(i for i, l in enumerate(ls) if l.startswith('Определите вид'))
        i3 = next(i for i, l in enumerate(ls) if l.startswith('Найдите площадь'))
        i4 = next(i for i, l in enumerate(ls) if l.startswith('Выполните необходимые'))
        V[n] = [' '.join(ls[:i2]), ' '.join(ls[i2:i3]), ' '.join(ls[i3:i4]), ' '.join(ls[i4:i4 + 3])]
    data = {}
    # исправления очевидных описок
    V[4][0] = V[4][0].replace('товара Света положила', 'товара Аня положила')
    V[4][3] = V[4][3].replace('Выполните необходимые измерения и запишите результаты.', 'Выполните необходимые измерения и запишите результаты, округлив до целых.')
    parts = {1: (3, 2, 4), 2: (3, 4, 5), 3: (3, 2, 5), 4: (2, 4, 3)}
    tot = {1: 18, 2: 24, 3: 60, 4: 72}
    names = {1: ('картофеля', 'свеклы', 'капусты'), 2: ('земляники', 'вишни', 'смородины'), 3: ('карандашей', 'фломастеров', 'ручек'), 4: ('карандашей', 'фломастеров', 'ручек')}
    unit = {1: 'кг', 2: 'кг', 3: 'шт.', 4: 'шт.'}
    t2 = {1: ('direct', F(425, 100), 50, 16), 2: ('inverse', 3, 11, 8), 3: ('inverse', 4, 9, 5), 4: ('inverse', 6, 13, 8)}
    diam = {1: (10, 'дм'), 2: (22, 'м'), 3: (30, 'см'), 4: (12, 'см')}
    maps = {1: ('Астана', 'Тараз', 30), 2: ('Караганда', 'Кызылорда', 20), 3: ('Алматы', 'Тараз', 30), 4: ('Караганда', 'Павлодар', 40)}
    variants = []
    for n in (1, 2, 3, 4):
        p = parts[n]; s = sum(p); per = F(tot[n], s); amts = [per * k for k in p]
        assert per.denominator == 1
        big = max(range(3), key=lambda i: amts[i])
        a1 = 'части: %s; на 1 часть приходится %s %s; %s — %s, %s — %s, %s — %s. Больше всего: %s (%s %s).' % (
            ' + '.join(map(str, p)) + ' = %d' % s, fnum(per), unit[n], names[n][0], fnum(amts[0]), names[n][1], fnum(amts[1]), names[n][2], fnum(amts[2]), names[n][big], fnum(amts[big]), unit[n])
        k = t2[n]
        if k[0] == 'direct':
            ans2 = k[1] * k[3] / k[2]; a2 = 'прямая пропорциональность: 50 колец — 4,25 кг, 16 колец — x кг; 50 : 16 = 4,25 : x; x = %s кг' % fnum(ans2)
        else:
            ans2 = F(k[1] * k[2], k[3]); a2 = 'обратная пропорциональность: %d труб — %d мин, %d труб — x мин; %d·%d = %d·x; x = %s мин' % (k[1], k[2], k[3], k[1], k[2], k[3], fnum(ans2))
        d, u = diam[n]; r = F(d, 2); S = r * r * F(314, 100)
        a3 = 'r = %s %s; S = πr² ≈ 3,14·%s² = %s %s²' % (fnum(r), u, fnum(r), fnum(S), u)
        c1, c2, sc = maps[n]; dk = map_dist_km(c1, c2); cm = round(dk / sc / 100 * 1 * 1, 1) if False else None
        dcm = dk / (sc * 1e6 / 1e5)  # см на карте: км -> см делим на (масштаб в км/см = sc*1e6/1e5/ ... )
        km_per_cm = sc * 1e6 / 1e5 / 1  # 1 см = sc*10^6 см = sc*10 км
        km_per_cm = sc * 10
        dcm = dk / km_per_cm
        cm_read = round(dcm, 1); ans4 = round(cm_read * km_per_cm)
        a4 = 'измерение по карте: ≈ %s см; %s см · %d км/см (1 см = %d км) ≈ %d км (допуск ±%d км при погрешности измерения ±0,1 см)' % (fnum(F(str(cm_read))), fnum(F(str(cm_read))), km_per_cm, km_per_cm, ans4, km_per_cm // 10)
        variants.append(dict(n=n, tasks=[
            dict(no=1, pts=3, text=V[n][0], answer=a1, status='R0'),
            dict(no=2, pts=4, text=V[n][1], answer=a2, status='R0'),
            dict(no=3, pts=3, text=V[n][2], answer=a3, status='R0'),
            dict(no=4, pts=4, text=V[n][3], answer=a4, status='R0', fig=dict(kind='map', c1=c1, c2=c2, scale=sc, cm=cm_read, km=ans4)),
        ], calc=dict(t1=[str(x) for x in amts], t2=str(ans2), t3=str(S), t4_cm=cm_read, t4_km=ans4, t4_true_km=round(dk))))
    return dict(id='SOR-6-1', quarter=1, title='Суммативное оценивание за раздел «Отношения и пропорции»',
                tables=tabs, variants=variants, max=14,
                desc_table=tables(270, 300)[0] if tables(270, 300) else None, rubric=tables(300, 334)[-1] if tables(300, 334) else None)

if False:
    import json
    w = sor1()
    for v in w['variants']:
        print(v['n'], v['calc'])
        for t in v['tasks']: print('  ', t['no'], t['text'][:90], '|', t['answer'][:100])
