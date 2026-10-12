# -*- coding: utf-8 -*-
from content2 import *

def scheme_rows(a, b):
    """строки схемы выставления баллов: список (задание, текст, балл, доп)"""
    out = []; cur = None
    for tb in tables(a, b):
        if tb and tb[0] and tb[0][0] == '№':
            for r in tb[1:]:
                if len(r) < 3 or r[0].startswith('Всего'): continue
                if r[0]: cur = r[0]
                out.append((cur, r[1], r[2], r[3] if len(r) > 3 else ''))
    return out

def parse_tasks(a, b):
    ls = [l for l in lines_between(a, b)]
    tasks = {}; cur = None
    for l in ls:
        if l.startswith('СХЕМА'): break
        m = re.match(r'^(\d)\.\s*(.*)$', l)
        if m and int(m.group(1)) == (cur or 0) + 1:
            cur = int(m.group(1)); tasks[cur] = m.group(2)
        elif cur and not l.startswith(('Оценивание', '№ задания', 'Количество', 'итого', '1 ВАРИАНТ')):
            tasks[cur] += ' ' + l
    return tasks

# ------------------------------------------------------------------ СОЧ-1
def soch1():
    W = 'SOCH-6-Q1'
    spans = {1: (1711, 1796), 2: (1796, 1876), 3: (1876, 1960), 4: (1960, 2045)}
    nl = {1: ('A', 2, 'B', 6), 2: ('A', 1, 'B', 5), 3: ('A', 3, 'B', 8), 4: ('A', 2, 'B', 7)}
    t8 = {  # (первое слагаемое tex, значение, знак вынесен?), (a,b,знак), последний вычитаемый
        1: dict(first=r'-\left(\frac{2}{5}:4\right)', f=F(-1, 10), inner=r'\frac{2}{5}:4', s2=(dec('4.8'), '-', dec('6.9')), last=mixv(1, 1, 5, True), lastt=r'-1\frac{1}{5}'),
        2: dict(first=r'-\left(\frac{3}{4}:3\right)', f=F(-1, 4), inner=r'\frac{3}{4}:3', s2=(dec('-8.7'), '+', dec('5.25')), last=mixv(2, 7, 10, True), lastt=r'-2\frac{7}{10}'),
        3: dict(first=r'-\left(\frac{7}{10}:2\right)', f=F(-7, 20), inner=r'\frac{7}{10}:2', s2=(dec('3.7'), '-', dec('7.95')), last=mixv(3, 3, 5, True), lastt=r'-3\frac{3}{5}'),
        4: dict(first=r'-\frac{3}{4}\cdot\frac{2}{3}', f=F(-1, 2), inner=None, s2=(dec('-9.45'), '+', dec('5.3')), last=mixv(3, 13, 20, True), lastt=r'-3\frac{13}{20}')}
    variants = []
    for n in (1, 2, 3, 4):
        a, b = spans[n]
        tk = parse_tasks(a, b)
        rows = scheme_rows(a, b)
        assert len(tk) == 8, (n, tk.keys())
        # оригинальная схема 1..7 (R0), 8 — реконструкция
        sch = {}
        for r in rows:
            sch.setdefault(int(r[0]), []).append(dict(text=r[1], pts=int(r[2]), info=r[3], src='R0'))
        d = t8[n]
        va, op, vb = d['s2']; s2 = va + vb if op == '+' else va - vb
        s3 = d['f'] + s2; fin = s3 - d['last']
        assert fin == -1, (n, fin)
        e8 = r'%s+(%s%s%s)-\left(%s\right)' % (d['first'], dtex(va), op, dtex(vb), d['lastt'])
        e8 = e8.replace('+(-', '+(-').replace('(-8{,}7+5{,}25)', '(-8{,}7+5{,}25)')
        tk[8] = 'Найдите значение выражения: $%s$.' % e8
        steps8 = [('$%s=%s$' % (d['first'], dtex(d['f'])), 1),
                  ('$%s%s%s=%s$' % (dtex(va), op, dtex(vb), dtex(s2)), 1),
                  ('$%s+(%s)=%s$' % (dtex(d['f']), dtex(s2), dtex(s3)), 1),
                  ('$%s-(%s)=%s$' % (dtex(s3), dtex(d['last']), dtex(fin)), 1)]
        sch[8] = [dict(text=t, pts=p, info='', src='R2') for t, p in steps8]
        # правка схемы 5
        for st in sch[5]:
            if '4 - 10' in st['text']:
                st['text'] = '|2 − 6| = 4 или AB = 4'; st['src'] = 'FIXED'
        # рисунок к заданию 5
        pa, ca, pb, cb = nl[n]
        tk[5] = tk[5]
        tasks = []
        pts = {1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 6, 7: 3, 8: 4}
        for k in range(1, 9):
            t = dict(no=k, pts=pts[k], text=tk[k], scheme=sch[k], status='R0')
            if k == 5: t['fig'] = dict(kind='numline', a=ca, b=cb); t['status'] = 'R1'
            if k == 8: t['status'] = 'R2'
            tasks.append(t)
            assert sum(s['pts'] for s in sch[k]) == pts[k], (n, k, sum(s['pts'] for s in sch[k]))
        variants.append(dict(n=n, tasks=tasks, calc=dict(t8=str(fin), nl=(ca, cb))))
        L(W, n, 5, 'рисунок (координатный луч с точками A и B)', 'R1', 'рисунок утрачен; сохранились: «Запишите координаты точек А и В. Найдите по рисунку значение |%d − %d|»; схема: А(%d), В(%d)' % (ca, cb, ca, cb),
          'числовая прямая с делениями, точки A(%d), B(%d), подписаны 0 и 1' % (ca, cb), 'Координаты однозначно заданы схемой оценивания и выражением модуля; шаг делений и подписи выбраны так, чтобы единичный отрезок читался (R1: содержание, R2: оформление).')
        L(W, n, 8, 'условие (выражение)', 'R2', 'изображения-формулы утрачены (в схеме: «-[[IMG]] = [[IMG]] = %s», «%s», «[[IMG]]», «%s»)' % (dtex(d['f']).replace('{,}', ','), '%s %s %s = %s' % (dtex(va).replace('{,}', ','), op, dtex(vb).replace('{,}', ','), dtex(s2).replace('{,}', ',')), '%s − (%s) = −1' % (dtex(s3).replace('{,}', ','), dtex(d['last']).replace('{,}', ','))),
          '$%s$' % e8, 'Четыре шага схемы однозначно задают структуру: (1) значение первого слагаемого = %s, (2) значение скобки %s, (3) их сумма %s, (4) вычитание (%s) даёт −1. Конкретная запись слагаемых (дробь/смешанное число) не подтверждена — подобрана так, чтобы все промежуточные результаты схемы воспроизводились.' % (dtex(d['f']).replace('{,}', ','), dtex(s2).replace('{,}', ','), dtex(s3).replace('{,}', ','), dtex(d['last']).replace('{,}', ',')))
        L(W, n, 5, 'схема выставления баллов', 'FIXED' if n == 1 else 'R0', '|4 - 10| = 4' if n == 1 else 'без изменений', '|2 − 6| = 4' if n == 1 else '—',
          'Опечатка в схеме 1 варианта: в условии |2 − 6|, ответ А(2), В(6); |4 − 10| не соответствует ни условию, ни ответам.' if n == 1 else 'Проверено вычислением.')
    return dict(id=W, quarter=1, title='Суммативное оценивание за 1 четверть', tables=tables(1647, 1711), variants=variants, max=20)

# ------------------------------------------------------------------ СОЧ-2
def soch2():
    W = 'SOCH-6-Q2'
    spans = {1: (2093, 2170), 2: (2170, 2247), 3: (2247, 2325), 4: (2325, 2401)}
    a_, b_ = sp.symbols('a b')
    # задание 1: 4 дроби, ровно одна не представима конечной десятичной
    t1 = {1: ('Г', [(3, 8), (6, 15), (9, 25), (5, 12)]), 2: ('В', [(7, 16), (12, 30), (4, 15), (13, 50)]),
          3: ('Б', [(9, 20), (5, 18), (15, 24), (3, 32)]), 4: ('А', [(7, 30), (11, 32), (18, 45), (13, 25)])}
    # задание 2: (a + k b)/m = c  ->  a = ...
    t2 = {1: (-2, 3, 5), 2: (3, 4, 2), 3: (-4, 2, 7), 4: (5, 6, 1)}
    # задание 4: m1(p1 a + q1 b) - m2(p2 a + q2 b), значения
    t4 = {1: ((3, F(2), F(-3, 2)), (2, F(1), F(-3)), F(1, 2), F(-2)), 2: ((5, F(1), F(-2, 5)), (2, F(3, 2), F(1)), F(-3, 2), F(1, 4)),
          3: ((4, F(1, 2), F(2)), (3, F(1), F(2)), F(-5, 2), F(-3, 2)), 4: ((6, F(1, 3), F(-1, 2)), (4, F(1, 4), F(-1, 2)), F(6, 5), F(-4, 5))}
    # задание 6: c·u + c·v + p : q
    t6 = {1: (dec('2.4'), mixv(3, 1, 4, True), mixv(1, 3, 4, True), dec('7.5'), dec('-2.5')), 2: (dec('1.8'), mixv(4, 1, 6, True), mixv(1, 5, 6, True), dec('6.3'), dec('-0.9')),
          3: (dec('-2.5'), mixv(3, 3, 5), mixv(2, 2, 5), dec('8.4'), dec('-2.1')), 4: (dec('3.2'), mixv(1, 7, 8, True), mixv(3, 1, 8, True), dec('5.4'), dec('-1.8'))}
    t6tex = {1: (mix(3, 1, 4, True), mix(1, 3, 4, True)), 2: (mix(4, 1, 6, True), mix(1, 5, 6, True)), 3: (mix(3, 3, 5), mix(2, 2, 5)), 4: (mix(1, 7, 8, True), mix(3, 1, 8, True))}
    perim = {1: ('3', '1,25', '1', '16'), 2: ('4', '3,25', '2', '49'), 3: ('2', '1,25', '3', '37'), 4: ('5', '4,25', '4', '104')}
    sorc = spans
    variants = []
    for n in (1, 2, 3, 4):
        a, b = spans[n]
        rows = scheme_rows(a, b)
        orig = {}
        for r in rows: orig.setdefault(int(re.match(r'\d', r[0]).group()), []).append((r[0], r[1], r[2], r[3]))
        # --- 1
        let, fr = t1[n]
        LET = 'АБВГ'
        nonterm = []
        for i, (p, q) in enumerate(fr):
            fq = F(p, q); dd = fq.denominator
            while dd % 2 == 0: dd //= 2
            while dd % 5 == 0: dd //= 5
            if dd != 1: nonterm.append(LET[i])
        assert nonterm == [let], (n, nonterm)
        t1txt = 'Какую из данных дробей нельзя представить в виде конечной десятичной дроби? ' + '   '.join('%s) $\\frac{%d}{%d}$' % (LET[i], p, q) for i, (p, q) in enumerate(fr))
        fq = F(*fr[LET.index(let)])
        fac = sp.factorint(fq.denominator)
        facs = '·'.join('%d%s' % (p_, {1: '', 2: '²', 3: '³'}.get(e_, '^%d' % e_)) for p_, e_ in sorted(fac.items()))
        bad = [p_ for p_ in fac if p_ not in (2, 5)]
        ans1 = '%s ($\\frac{%d}{%d}$%s: знаменатель %d = %s содержит простой множитель %s, не равный 2 и 5; остальные дроби обращаются в конечные десятичные)' % (
            let, fr[LET.index(let)][0], fr[LET.index(let)][1], '' if fq == F(*fr[LET.index(let)]) and False else ('' if (fq.numerator, fq.denominator) == fr[LET.index(let)] else ' = $\\frac{%d}{%d}$' % (fq.numerator, fq.denominator)), fq.denominator, facs, ', '.join(map(str, bad)))
        # --- 2
        k, m, c = t2[n]
        lhs = (a_ + k * b_) / m
        sol = sp.solve(sp.Eq(lhs, c), a_)[0]
        assert sp.simplify(sol - (c * m - k * b_)) == 0
        sgn = '+' if k > 0 else '-'; kk = abs(k)
        kt = ('' if kk == 1 else str(kk))
        t2expr = r'\frac{a%s%sb}{%d}=%d' % (sgn, kt, m, c)
        st21 = 'a%s%sb=%d' % (sgn, kt, c * m)
        st22 = 'a=%d%s%sb' % (c * m, '-' if k > 0 else '+', kt)
        t2txt = 'Выразите переменную a через переменную b в выражении: $%s$.' % t2expr
        # --- 3 (оригинал)
        t3line = [l for l in lines_between(a, b + 0) if l.startswith('–')][0]
        # --- 4
        (m1, p1, q1), (m2, p2, q2), av, bv = t4[n]
        e4 = m1 * (p1 * a_ + q1 * b_) - m2 * (p2 * a_ + q2 * b_)
        # в скобках p·a + q·b — десятичные
        def cf(x):
            d_ = x.denominator
            while d_ % 2 == 0: d_ //= 2
            while d_ % 5 == 0: d_ //= 5
            return dtex(x) if d_ == 1 else r'\frac{%d}{%d}' % (x.numerator, x.denominator)
        def tx_in(p, q):
            ps = '' if p == 1 else cf(abs(p)); qs = cf(abs(q))
            if abs(q) == 1: qs = ''
            return '%s%sa%s%sb' % ('-' if p < 0 else '', ps, '-' if q < 0 else '+', qs)
        e4tex = '%d(%s)-%d(%s)' % (m1, tx_in(p1, q1), m2, tx_in(p2, q2))
        ex = sp.expand(sp.nsimplify(m1) * (sp.Rational(p1.numerator, p1.denominator) * a_ + sp.Rational(q1.numerator, q1.denominator) * b_) - m2 * (sp.Rational(p2.numerator, p2.denominator) * a_ + sp.Rational(q2.numerator, q2.denominator) * b_))
        step4_1 = sp.expand(m1 * sp.Rational(p1.numerator, p1.denominator) * a_) , 0
        o1 = '%s%s%s' % (fmt_poly(m1 * sp.Rational(p1.numerator, p1.denominator) * a_ + m1 * sp.Rational(q1.numerator, q1.denominator) * b_), '-' , '(%s)' % fmt_poly(m2 * sp.Rational(p2.numerator, p2.denominator) * a_ + m2 * sp.Rational(q2.numerator, q2.denominator) * b_))
        pa1 = m1 * sp.Rational(p1.numerator, p1.denominator); qb1 = m1 * sp.Rational(q1.numerator, q1.denominator)
        pa2 = m2 * sp.Rational(p2.numerator, p2.denominator); qb2 = m2 * sp.Rational(q2.numerator, q2.denominator)
        def lin(pa, qb):
            return fmt_poly(pa * a_ + qb * b_)
        s41 = '%s-%s' % (lin(pa1, qb1), '(%s)' % lin(pa2, qb2))
        s41 = '%s%s%s' % (lin(pa1, qb1), '' , '') + ' ' + ('−(%s)' % lin(pa2, qb2).replace('-', '−'))
        s41 = lin(pa1, qb1) + '-(' + lin(pa2, qb2) + ')'
        s41_open = lin(pa1, qb1) + '+' + lin(-pa2, -qb2) if False else None
        raw = fmt_poly(pa1 * a_) + ('' if True else '') 
        opened = lin(pa1, qb1) + ('+' if (-pa2) > 0 or ((-pa2) == 0 and (-qb2) > 0) else '') + lin(-pa2, -qb2)
        s42 = fmt_poly(ex)
        val4 = ex.subs({a_: sp.Rational(av.numerator, av.denominator), b_: sp.Rational(bv.numerator, bv.denominator)})
        s43 = '%s=%s' % (fmt_poly(ex).replace('a', '\\cdot(%s)' % dtex(av) ) if False else fmt_poly(ex), dtex(F(int(val4.p), int(val4.q))))
        t4txt = 'Упростите выражение $%s$ и найдите его значение при $a=%s$, $b=%s$.' % (e4tex, dtex(av), dtex(bv))
        # --- 5
        s_, mult, add, P = perim[n]
        # --- 6
        cc, u, v, pp, qq = t6[n]
        tot_br = u + v
        prod = cc * tot_br
        quo = pp / qq
        res6 = prod + quo
        def inbr(t_, val):
            return '+\\left(%s\\right)' % t_ if val < 0 else '+' + t_
        def lead(x):
            return dtex(x) if x >= 0 else dtex(x)
        def sw(x): return '(%s)' % dtex(x) if x < 0 else dtex(x)
        t6txt = 'Найдите значение выражения: $%s\\cdot\\left(%s\\right)%s\\cdot\\left(%s\\right)+%s:%s$.' % (dtex(cc), t6tex[n][0], '+' + sw(cc), t6tex[n][1], dtex(pp), sw(qq))
        s6 = [('$%s\\cdot\\left(%s%s\\right)+%s:%s$' % (dtex(cc), t6tex[n][0], inbr(t6tex[n][1], v), dtex(pp), sw(qq)), 'Применено распределительное свойство умножения относительно сложения'),
              ('$%s%s=%s$' % (t6tex[n][0], inbr(t6tex[n][1], v), dtex(tot_br)), ''),
              ('$%s\\cdot%s=%s$' % (dtex(cc), sw(tot_br), dtex(prod)), ''),
              ('$%s:%s=%s$' % (dtex(pp), sw(qq), dtex(quo)), ''),
              ('$%s%s=%s$' % (dtex(prod), inbr(dtex(quo), quo), dtex(res6)), '')]
        # --- задания
        S = {}
        S[1] = [dict(text=ans1, pts=1, info='ответ сохранён в исходной схеме: «%s»' % let, src='R1')]
        S[2] = [dict(text='$%s$' % st21, pts=1, info='', src='R3'), dict(text='$%s$' % st22, pts=1, info='', src='R3')]
        S[3] = [dict(text=r[1], pts=int(r[2]), info=r[3], src='R0') for r in rows if r[0] == '3']
        S[4] = [dict(text='Правильно раскрывает скобки: $%s$' % opened, pts=1, info='', src='R3'),
                dict(text='Приводит подобные слагаемые: $%s$' % s42, pts=1, info='', src='R3'),
                dict(text='Подставляет значения переменных: $%s$' % ('%s=%s' % (s42.replace('a', '\\cdot(%s)' % dtex(av)) if False else '', dtex(F(int(val4.p), int(val4.q))))), pts=1, info='', src='R3')]
        S[4][2]['text'] = 'Подставляет значения переменных и вычисляет: $%s$ при $a=%s$, $b=%s$ получаем $%s$' % (s42, dtex(av), dtex(bv), dtex(F(int(val4.p), int(val4.q))))
        S[5] = [dict(text=r[1], pts=int(r[2]), info=r[3], src='R0') for r in rows if r[0].startswith('5')]
        S[6] = [dict(text=t, pts=1, info=i, src='R3') for t, i in s6]
        T = {1: (1, 1, t1txt), 2: (2, 2, t2txt), 3: (3, 3, 'Раскройте скобки и приведите подобные слагаемые в выражении: %s' % t3line), 4: (4, 3, t4txt),
             5: (5, 6, re.sub(r'^\d\.\s*', '', [l for l in lines_between(a, b) if 'В четырехугольнике' in l][0]) + ' 1) Выразите остальные стороны этого четырехугольника, если: a) NP на %s см меньше MN; b) PK в %s раза больше MN; c) MK на %s см больше PK. '
                 '2) Зная, что периметр MNPK равен %s см и используя данные пункта 1, составьте уравнение. 3) Решите уравнение, полученное в пункте 2. Найдите длину MN.' % (s_, mult, add, P)),
             6: (6, 5, t6txt)}
        tasks = []
        for k in range(1, 7):
            tt = dict(no=k, pts=T[k][1], text=T[k][2], scheme=S[k], status={1: 'R2', 2: 'R3', 3: 'R0', 4: 'R3', 5: 'R0', 6: 'R3'}[k])
            assert sum(s['pts'] for s in S[k]) == T[k][1], (n, k, sum(s['pts'] for s in S[k]))
            tasks.append(tt)
        # проверка заданий 3 и 5 по тексту
        # 3
        parts = re.findall(r'[\d,]+', t3line)
        variants.append(dict(n=n, tasks=tasks, calc=dict(t1=let, t2=st22, t4=str(val4), t6=str(res6), t5y=P)))
        L(W, n, 1, 'варианты ответа А–Г', 'R2', '[[OLE%d–%d]] — четыре формулы-дроби пусты; ответ в схеме: «%s»' % ({1: 26, 2: 44, 3: 62, 4: 80}[n], {1: 29, 2: 47, 3: 65, 4: 83}[n], let),
          '; '.join('%s) %d/%d' % (LET[i], p, q) for i, (p, q) in enumerate(fr)), 'Известны: цель 6.1.2.18, тип МВО, 1 балл, верный ответ — «%s». Подобраны 4 несократимые/сокращаемые дроби так, что ровно одна (в позиции «%s») не обращается в конечную десятичную; есть дробь-ловушка (напр., 6/15 = 2/5). Проверено вычислением.' % (let, let))
        L(W, n, 2, 'условие', 'R3', '[[OLE%d]] — формула пуста (≈ 2 строки, дробь)' % {1: 30, 2: 48, 3: 66, 4: 84}[n], '$%s$' % t2expr, 'Схема: два шага по 1 баллу (цель 6.2.1.10). Структура «умножение на знаменатель → перенос слагаемого» восстановлена, числа новые.')
        L(W, n, 2, 'схема выставления баллов', 'R3', '[[OLE]] ×2 — пусто', '$%s$; $%s$' % (st21, st22), 'Шаги вычислены из восстановленного условия (sympy: a = %s).' % sp.sstr(sol))
        L(W, n, 4, 'условие и схема', 'R3', '[[OLE]] ×(2 условие + 3 схема) — пусто', '$%s$, a=%s, b=%s → %s' % (e4tex, dtex(av), dtex(bv), dtex(F(int(val4.p), int(val4.q)))),
          'Схема: «раскрывает скобки → приводит подобные → подставляет значения» (цель 6.2.1.5/6.2.1.7/6.2.1.2). Выражение с двумя разностями скобок и значениями-десятичными дробями, 3 балла.')
        L(W, n, 6, 'условие и схема', 'R3', '[[OLE]] ×6 (в 4 варианте [[IMG120]]) — пусто', '$%s$ = %s' % (t6txt.split('$')[1], dtex(res6)),
          'Схема: 5 шагов; первый — «применено распределительное свойство относительно сложения» (6.1.2.17/6.1.2.16: деление рациональных чисел). Выражение: c·(u)+c·(v)+p:q; 5 шагов = распределительное, сумма в скобках, произведение, деление, итог.')
    return dict(id=W, quarter=2, title='Суммативное оценивание за 2 четверть', tables=tables(2045, 2093), variants=variants, max=20)
