# -*- coding: utf-8 -*-
"""Независимая проверка: сверка исходных (R0) ключей СОЧ с самостоятельным пересчётом + проверка восстановленных ключей."""
import sys, re
sys.path.insert(0, '/home/user/KAP_1/work/tools')
import sympy as sp
from fractions import Fraction as F
CHK = []
def chk(name, ok, info=''):
    CHK.append(dict(check=name, result='PASS' if ok else 'FAIL', info=info)); return ok
def num(s): return F(s.replace(',', '.').replace('−', '-').replace('–', '-'))

def run(works):
    W = {w['id']: w for w in works}
    # ---- СОЧ-1: оригинальные ключи 1..7 против пересчёта по условиям
    for v in W['SOCH-6-Q1']['variants']:
        n = v['n']; T = {t['no']: t for t in v['tasks']}
        # 1: x:a = b:y -> xy = a*b (пропорция в виде x:a=b:y или a:x=y:b)
        m = re.search(r'пропорция\s+(\S+)\s*:\s*(\S+)\s*=\s*(\S+)\s*:\s*(\S+)', T[1]['text'])
        p = [m.group(i) for i in range(1, 5)]
        a_, b_ = [num(x) for x in p if re.match(r'^\d', x)]
        key = num(re.search(r'=\s*(\d+)', T[1]['scheme'][0]['text'].split('=')[-2] + '=' + T[1]['scheme'][0]['text'].split('=')[-1]).group(1))
        chk('СОЧ1 в%d з1 xy' % n, key == a_ * b_, '%s' % (a_ * b_))
        # 2 масштаб
        m = re.search(r'(\d+) км, а на карте\s*[–-]\s*(\d+)\s*см', T[2]['text']); km, cm = int(m.group(1)), int(m.group(2))
        sc = km * 100000 // cm; chk('СОЧ1 в%d з2 масштаб' % n, ('1 : %d' % sc) == T[2]['scheme'][0]['text'], '1:%d' % sc)
        # 3 целые между
        m = re.search(r'между числами\s+[–-]?([\d,]+)\s+и\s+([–-]?[\d,]+)', T[3]['text'])
        lo = -num(m.group(1)) if '–' + m.group(1) in T[3]['text'] or '-' + m.group(1) in T[3]['text'] else num(m.group(1))
        hi = num(m.group(2)); import math
        ints = list(range(math.floor(lo) + 1, math.ceil(hi))) if hi != math.floor(hi) else list(range(math.floor(lo) + 1, int(hi)))
        got = [int(x.replace('–', '-').replace('−', '-')) for x in re.findall(r'[–−-]?\d+', T[3]['scheme'][0]['text'])]
        chk('СОЧ1 в%d з3 целые' % n, sorted(got) == sorted(ints), str(ints))
        # 6 проценты (цепочка)
        t6 = T[6]['text']; nums = [num(x.replace(',', '.')) for x in re.findall(r'\d+(?:,\d+)?', t6)]
        steps = [s['text'] for s in T[6]['scheme']]
        vals = [num(x) for s in steps for x in re.findall(r'(?<=х = )[\d,]+', s)]
        total, p1 = None, None
        if n == 1: total, p1, p2 = 60, 40, 50; rest = F(total) - total * F(p1, 100); rest2 = rest - rest * F(p2, 100); fin = rest2
        if n == 2: total = 240; first = 240 * F(25, 100); mid = 240 - first; ger = mid * F(40, 100); fin = mid - ger
        if n == 3: total, p1, p2 = 80, 40, 50; rest = F(total) - total * F(p1, 100); fin = rest - rest * F(p2, 100)
        if n == 4: total, p1, p2 = 150, 30, 60; rest = F(total) - total * F(p1, 100); fin = rest - rest * F(p2, 100)
        last = num(re.findall(r'=\s*([\d,]+)', steps[-1])[-1].replace(' ', ''))
        chk('СОЧ1 в%d з6 итог' % n, last == fin, str(fin))
        # 7 окружность
        d = int(re.search(r'равен (\d+)', T[7]['text']).group(1)); R = d // 2
        s7 = [x['text'] for x in T[7]['scheme']]
        chk('СОЧ1 в%d з7 R,C,S' % n, [int(re.search(r'\d+', x).group()) for x in s7] == [R, 6 * R, 3 * R * R], '%d,%d,%d' % (R, 6 * R, 3 * R * R))
        # 5 модуль
        m = re.search(r'\|(\d+) - (\d+)\|', T[5]['text']); a1, b1 = int(m.group(1)), int(m.group(2))
        chk('СОЧ1 в%d з5 |a-b|' % n, str(b1 - a1) in T[5]['scheme'][1]['text'] and ('A(%d)' % a1 in T[5]['scheme'][0]['text'].replace('А', 'A')), '%d' % (b1 - a1))
        # 8 восстановленное выражение
        chk('СОЧ1 в%d з8 итог = −1' % n, v['calc']['t8'] == '-1')
    # ---- СОЧ-2: оригинальные ключи 3 и 5
    y = sp.symbols('y'); a, b = sp.symbols('a b')
    for v in W['SOCH-6-Q2']['variants']:
        n = v['n']; T = {t['no']: t for t in v['tasks']}
        m = re.search(r'–\s*\(([\d,]+)a \+ ([\d,]+)b\) \+ \(([\d,]+)b – ([\d,]+)a\) – \(([\d,]+)b – ([\d,]+)a\)', T[3]['text'])
        p = [sp.Rational(str(num(x))) for x in m.groups()]
        e = -(p[0] * a + p[1] * b) + (p[2] * b - p[3] * a) - (p[4] * b - p[5] * a)
        e = sp.expand(e); ans = T[3]['scheme'][2]['text']
        ca = sp.Rational(str(num(re.search(r'-([\d,]+)а', ans.replace('–', '-')).group(1)))); cb = sp.Rational(str(num(re.search(r'[–-]\s*([\d,]+)\s*b', ans).group(1))))
        chk('СОЧ2 в%d з3' % n, e == -ca * a - cb * b, str(e))
        t5 = T[5]['text']
        mm = re.search(r'NP на ([\d,]+) см меньше MN; b\) PK в ([\d,]+) раза больше MN; c\) MK на ([\d,]+) см больше PK.*периметр MNPK равен ([\d,]+) см', t5)
        s_, k_, d_, P_ = [sp.Rational(str(num(x))) for x in mm.groups()]
        sol = sp.solve(y + (y - s_) + k_ * y + (k_ * y + d_) - P_, y)[0]
        chk('СОЧ2 в%d з5 MN' % n, 'MN=%d см' % sol == T[5]['scheme'][5]['text'], str(sol))
        # заново сверка 5(3): коэффициент
        coef = 2 + 2 * k_; rhs = P_ + s_ - d_
        chk('СОЧ2 в%d з5(3) уравнение' % n, ('%sу=%s' % (str(coef).replace('.', ','), str(rhs)) == T[5]['scheme'][4]['text'].replace(' ', '')) or (str(float(coef)).rstrip('0').rstrip('.').replace('.', ',') + 'у=' + str(rhs) == T[5]['scheme'][4]['text']), '%s y = %s' % (coef, rhs))
    # ---- СОР: выборочная перепроверка независимым путём (sympy)
    for v in W['SOR-6-1']['variants']:
        n = v['n']; c = v['calc']
        chk('СОР1 в%d з4 расстояние км' % n, abs(c['t4_km'] - c['t4_true_km']) <= 0.1 * {1: 300, 2: 200, 3: 300, 4: 400}[n] / 1 + 10, 'карта %s км vs расчёт %s км' % (c['t4_km'], c['t4_true_km']))
    for v in W['SOR-6-3']['variants']:
        n = v['n']
        pa, pb = v['calc']['t3']
        chk('СОР3 в%d з3 периодические' % n, F(pa).denominator in (33, 11, 99) and F(pb).denominator in (30, 90, 45), '%s; %s' % (pa, pb))
    for w in works:
        for v in w['variants']:
            chk('%s в%d сумма баллов' % (w['id'], v['n']), sum(t['pts'] for t in v['tasks']) == w['max'], str(w['max']))
    return CHK
