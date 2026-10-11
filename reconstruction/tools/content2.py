# -*- coding: utf-8 -*-
from content import *
import sympy as sp

LOG = []   # журнал реконструкции
def L(work, var, task, part, status, orig, restored, why):
    LOG.append(dict(work=work, variant=var, task=task, part=part, status=status, source=orig, restored=restored, rationale=why))

def sg(x):  # Fraction -> строка со знаком-минусом
    return fnum(x)

def cmp_sym(a, b):
    return '>' if a > b else ('<' if a < b else '=')

PG = {  # страницы рендера docx (LibreOffice) для привязки к исходнику
 'SOR-6-1': {1: 8, 2: 9, 3: 10, 4: 11}, 'SOR-6-2': {1: 16, 2: 17, 3: 17, 4: 18},
 'SOR-6-3': {1: 22, 2: 23, 3: 24, 4: 25}, 'SOR-6-4': {1: 29, 2: 30, 3: 30, 4: 31},
 'SOCH-6-Q1': {1: 76, 2: 80, 3: 83, 4: 86}, 'SOCH-6-Q2': {1: 93, 2: 96, 3: 98, 4: 101}}

# ------------------------------------------------------------------ СОР-2
def sor2():
    W = 'SOR-6-2'
    tabs = tables(334, 350)
    setA = {
     1: ('5,7; +7; 0; −2,05; +3,78', 'X', '17', F(-3, 4), r'-\frac{3}{4}'),
     2: ('5,2; −8; 0; 3,3; +0,9', 'X', '4', F(-5, 6), r'-\frac{5}{6}'),
     3: ('10,4; 5; 0; −1,7; −0,11', 'X', '11', F(-7, 10), r'-\frac{7}{10}'),
     4: ('3,2; −4; 0; 1,3; −0,7', 'X', '5', F(-2, 3), r'-\frac{2}{3}')}
    nat = {1: ['7', '17'], 2: ['4'], 3: ['5', '11'], 4: ['5']}
    ints = {1: ['0', '7', '17'], 2: ['−8', '0', '4'], 3: ['0', '5', '11'], 4: ['−4', '0', '5']}
    A_all = {1: ['5,7', '+7', '0', '−2,05', '+3,78', '−3/4', '17'], 2: ['5,2', '−8', '0', '3,3', '+0,9', '−5/6', '4'],
             3: ['10,4', '5', '0', '−1,7', '−0,11', '−7/10', '11'], 4: ['3,2', '−4', '0', '1,3', '−0,7', '−2/3', '5']}
    t2a = {1: ('−9,4', '1,8', dec('-9.4'), dec('1.8'), 'a'), 2: ('4,1', '−6,2', dec('4.1'), dec('-6.2'), 'a'), 3: ('2,7', '4', dec('2.7'), F(4), 'a'), 4: ('−5,5', '3', dec('-5.5'), F(3), 'a')}
    t2b = {1: ('−0,7', '0', dec('-0.7'), F(0)), 2: ('−2,7', '0', dec('-2.7'), F(0)), 3: ('0', '−1,2', F(0), dec('-1.2')), 4: ('0', '−4,8', F(0), dec('-4.8'))}
    t2c = {1: (dec('-3.5'), dec('2.8')), 2: (dec('5.6'), dec('-6.5')), 3: (dec('-2.4'), dec('-2.04')), 4: (dec('3.7'), dec('-7.3'))}
    t2d = {1: ((mix(4, 1, 2, True), mixv(4, 1, 2, True)), ('−4,8', dec('-4.8')), 'L'), 2: (('−1,3', dec('-1.3')), (mix(1, 1, 2, True), mixv(1, 1, 2, True)), 'R'),
           3: ((mix(3, 3, 4, True), mixv(3, 3, 4, True)), ('−3,7', dec('-3.7')), 'L'), 4: ((mix(5, 1, 4, True), mixv(5, 1, 4, True)), ('−5,6', dec('-5.6')), 'L')}
    t3 = {1: [mixv(2, 1, 2, True), dec('-1.75'), mixv(6, 1, 4)], 2: [mixv(1, 1, 4, True), dec('-2.5'), mixv(7, 1, 2)],
          3: [mixv(3, 1, 2, True), dec('-1.25'), mixv(7, 3, 4)], 4: [mixv(1, 3, 4, True), dec('-2.5'), mixv(5, 1, 2)]}
    t3tex = {1: (mix(2, 1, 2, True), '(-1{,}75)', mix(6, 1, 4)), 2: (mix(1, 1, 4, True), '(-2{,}5)', mix(7, 1, 2)),
             3: (mix(3, 1, 2, True), '(-1{,}25)', mix(7, 3, 4)), 4: (mix(1, 3, 4, True), '(-2{,}5)', mix(5, 1, 2))}
    pts4 = {1: ('M', '−2,6', 'K', '−4,3', 'D'), 2: ('A', '2,7', 'B', '−3,2', 'C'), 3: ('F', '−3,7', 'L', '4,5', 'D'), 4: ('B', '−2', 'C', '−3,9', 'G')}
    src4 = {1: ('M(–2,6)', 'K(–4,3)'), 2: ('А(2,7)', 'В(-3,2)'), 3: ('F(-3,7)', 'L(4,5)'), 4: ('B(-2)', 'C(-3,9)')}
    variants = []
    for n in (1, 2, 3, 4):
        a = setA[n]
        t1 = ('Дано множество чисел А: А = {%s; $%s$; %s}. Выделите из множества А подмножества: В – натуральных чисел, С – целых чисел и D – рациональных чисел. '
              'Постройте диаграмму Эйлера–Венна для множеств В, С и D и отметьте на ней элементы множества А.') % (a[0], a[4], a[2])
        ans1 = 'B = {%s}; C = {%s}; D = {%s}; B ⊂ C ⊂ D' % ('; '.join(nat[n]), '; '.join(ints[n]), '; '.join(A_all[n]))
        # 2
        x1, x2, v1, v2, _ = t2a[n]
        ra = cmp_sym(v1, v2)
        y1, y2, w1, w2 = t2b[n]; rb = cmp_sym(w1, w2)
        m1, m2 = t2c[n]; rc = cmp_sym(abs(m1), abs(m2))
        (d1t, d1v), (d2t, d2v), side = t2d[n]
        rd = cmp_sym(d1v, d2v)
        def tx(t): return t if '\\frac' not in t else '$%s$' % t
        c_txt = '$|%s|$ и $|%s|$' % (dtex(m1), dtex(m2))
        d_txt = '%s и %s' % (tx(d1t), tx(d2t))
        t2txt = 'Сравните рациональные числа: а) %s и %s;  b) %s и %s;  c) %s;  d) %s.' % (x1, x2, y1, y2, c_txt, d_txt)
        ans2 = 'a) %s %s %s;  b) %s %s %s;  c) |%s| %s |%s| (%s %s %s);  d) %s %s %s' % (x1, ra, x2, y1, rb, y2, fnum(m1), rc, fnum(m2), fnum(abs(m1)), rc, fnum(abs(m2)),
                '%s' % (re.sub(r'\\,|\\frac\{(\d+)\}\{(\d+)\}', lambda m: ' ' if m.group(0) == '\\,' else '%s/%s' % m.groups(), d1t).replace('-', '−') if '\\frac' in d1t else d1t), rd,
                (re.sub(r'\\,|\\frac\{(\d+)\}\{(\d+)\}', lambda m: ' ' if m.group(0) == '\\,' else '%s/%s' % m.groups(), d2t).replace('-', '−') if '\\frac' in d2t else d2t))
        # 3
        vals = t3[n]; tt = t3tex[n]
        s1 = vals[0] + vals[1]; res = s1 + vals[2]
        t3txt = 'Вычислите: $%s+%s+%s$.' % (tt[0], tt[1], tt[2])
        ans3 = '%s + (%s) = %s;  %s + %s = %s' % (sg(vals[0]), sg(vals[1]), sg(s1), sg(vals[2]), sg(-s1) if False else sg(s1), sg(res))
        ans3 = '1) %s + (%s) = %s;  2) %s + (%s) = %s' % (sg(vals[0]), sg(vals[1]), sg(s1), sg(s1), sg(vals[2]), sg(res)) + '  Ответ: %s' % sg(res)
        # 4
        p = pts4[n]; ps = src4[n]
        P1v, P1c, P2v, P2c, Pd = p
        c_pt = dec(P1c); opp = -c_pt; q = dec(P2c); dist = abs(opp - q)
        t4txt = ('Даны точки %s. a) Найдите координату точки %s, противоположную координате точки %s. b) Изобразите точки %s, %s и %s на координатной прямой. '
                 'c) Найдите расстояние от точки %s до точки %s.') % (' и '.join(ps), Pd, P1v, P1v, P2v, Pd, P2v, Pd)
        ans4 = 'a) %s(%s); b) точки на координатной прямой; c) %s%s = |%s − (%s)| = %s' % (Pd, sg(opp), P2v, Pd, sg(opp), sg(q), sg(dist))
        tk = [dict(no=1, pts=4, text=t1, answer=ans1, status='R3'), dict(no=2, pts=4, text=t2txt, answer=ans2, status='R3'),
              dict(no=3, pts=3, text=t3txt, answer=ans3, status='R3'), dict(no=4, pts=3, text=t4txt, answer=ans4, status='R0')]
        variants.append(dict(n=n, tasks=tk, calc=dict(set_A=A_all[n], t2=[ra, rb, rc, rd], t3=str(res), t4=str(dist))))
        L(W, n, 1, 'элемент множества А (дробь)', 'R3', '[[OLE%d]] — объект MathType пуст (вложение 1536 байт без потока Equation Native), превью WMF отсутствует; размер объекта ≈ %s' % (
            {1: 1, 2: 5, 3: 9, 4: 13}[n], {1: '16,5×31,5 pt', 2: '17,25×31,5 pt', 3: '18×31,5 pt', 4: '17,25×31,5 pt'}[n]),
          '$%s$' % a[4], 'Размер и положение указывают на однострочную отрицательную обыкновенную дробь с однозначными числителем и знаменателем (в V3 — с двузначным знаменателем). Значение не определяется: подобрана несократимая отрицательная дробь, не равная целому, чтобы задание проверяло цель 6.1.2.11 (множества N⊂Z⊂Q).')
        L(W, n, 2, 'пункт c) (сравнение модулей)', 'R3', '[[OLE%d]] — пусто' % {1: 2, 2: 6, 3: 10, 4: 14}[n], c_txt.replace('$', ''),
          'Дескриптор 3 к заданию 2: «сравнивает модули рациональных чисел» (6.1.1.9). Размер объекта (≈46–47×20 pt, одна строка) соответствует записи |a| и |b|. Числа подобраны так, чтобы ответ отличался от сравнения самих чисел.')
        L(W, n, 2, 'пункт d) (дробное число и отрицательная десятичная)', 'R3', '[[OLE%d]] — пусто (рядом сохранено «%s»)' % ({1: 3, 2: 7, 3: 11, 4: 15}[n], ('−4,8' if n == 1 else '−1,3' if n == 2 else '−3,7' if n == 3 else '−5,6')),
          d_txt.replace('$', ''), 'Дескриптор 4: «сравнивает отрицательные числа». Размер объекта (≈27×31 pt) соответствует смешанному числу с обыкновенной дробной частью. Подобрано смешанное отрицательное число, сравнение требует перевода дроби в десятичную.')
        L(W, n, 3, 'выражение', 'R3', '[[OLE%d]] — пусто (≈%s pt, две строки: есть дроби)' % ({1: 4, 2: 8, 3: 12, 4: 16}[n], {1: '119×37,5', 2: '116×37,5', 3: '122×37,5', 4: '121×37,5'}[n]),
          '$%s+%s+%s$ = %s' % (tt[0], tt[1], tt[2], sg(res)), 'Дескрипторы: «складывает отрицательные числа» → «алгоритм сложения чисел с разными знаками» → «находит значение выражения»: три слагаемых — два отрицательных и одно положительное. Числа новые.')
    w = dict(id=W, quarter=1, title='Суммативное оценивание за раздел «Рациональные числа и действия над ними»', tables=tabs, variants=variants, max=14,
             desc_table=None, rubric=None)
    return w

# ------------------------------------------------------------------ СОР-3
def sor3():
    W = 'SOR-6-3'
    tabs = tables(456, 474)
    exprs = {
        1: [('-5,2+1,8', dec('-5.2') + dec('1.8')), ('-2,3 − (-1,4)', dec('-2.3') - dec('-1.4')), ('3,2·(-0,5)', dec('3.2') * dec('-0.5')), ('-2,25 : (-1,5)', dec('-2.25') / dec('-1.5'))],
        2: [('-3,5+(-2,7)', dec('-3.5') + dec('-2.7')), ('-8,1 + 4,3', dec('-8.1') + dec('4.3')), ('-2,3·(-0,6)', dec('-2.3') * dec('-0.6')), ('7,2 : (-4)', dec('7.2') / F(-4))],
        3: [('-3,9 + (-4,8)', dec('-3.9') + dec('-4.8')), ('-5,9 − (-2,4)', dec('-5.9') - dec('-2.4')), ('-3,5·0,6', dec('-3.5') * dec('0.6')), ('1,53 : (-0,9)', dec('1.53') / dec('-0.9'))],
        4: [('-6,2 + (-3,1)', dec('-6.2') + dec('-3.1')), ('-2,8 − (-7,3)', dec('-2.8') - dec('-7.3')), ('6,5·(-0,2)', dec('6.5') * dec('-0.2')), ('3,24 : (-1,8)', dec('3.24') / dec('-1.8'))]}
    opts = {1: ['-1,6', '1,5', '3,4', '-3,4', '1,6', '-0,9', '0,9'], 2: ['1,38', '-12,4', '-6,2', '-0,8', '-1,8', '-3,8', '-1,38'],
            3: ['-3,5', '-2,1', '-1,7', '-7,1', '-8,7', '-0,9', '8,3'], 4: ['4,5', '-1,8', '-9,3', '-1,3', '3,1', '-10,1', '1,8']}
    LET = 'ABCDEFG'
    t2tex = {1: (r'-3\frac{1}{11}\cdot a\cdot(-0{,}11)\cdot b', r'\frac{1}{17}', mixv(3, 1, 11, True) * a_ if False else None),}
    t2 = {1: (mixv(3, 1, 11, True), dec('-0.11'), F(1, 17), r'-3\frac{1}{11}\cdot a\cdot(-0{,}11)\cdot b', r'\frac{1}{17}'),
          2: (F(-3, 10), F(2, 9), dec('-0.3'), r'-\frac{3}{10}\cdot a\cdot\frac{2}{9}\cdot b', r'-0{,}3'),
          3: (mixv(1, 2, 3, True), dec('-0.09'), F(3, 20), r'-1\frac{2}{3}\cdot a\cdot(-0{,}09)\cdot b', r'\frac{3}{20}'),
          4: (mixv(4, 2, 3, True), F(-3, 7), dec('-3.5'), r'-4\frac{2}{3}\cdot a\cdot\left(-\frac{3}{7}\right)\cdot b', r'-3{,}5')}
    per = {1: ('0,(12)', '1,2(3)', (F(12, 99), F(1) + F(23 - 2, 90))), 2: ('0,(15)', '2,2(1)', (F(15, 99), F(2) + F(21 - 2, 90))),
           3: ('0,(16)', '3,2(1)', (F(16, 99), F(3) + F(21 - 2, 90))), 4: ('0,(27)', '1,2(4)', (F(27, 99), F(1) + F(24 - 2, 90)))}
    t4 = {1: (7, dec('13.2'), dec('0.8'), 'на (−7)'), 2: (5, dec('13.5'), dec('2.5'), 'на (−5)'), 3: (dec('0.9'), dec('14.1'), dec('-5.1'), 'на (−0,9)'), 4: (dec('0.4'), F(6), dec('10.4'), 'на (−0,4)')}
    t4txt = {1: 'Асем задумала число. Это задуманное число она разделила на (−7), затем от полученного частного вычла 13,2 и в результате получила число 0,8. Какое число задумала Асем?',
             2: 'Асем задумала число. Это задуманное число она разделила на (−5), затем от полученного частного вычла 13,5 и в результате получила число 2,5. Какое число задумала Асем?',
             3: 'Асем задумала число. Это задуманное число она разделила на (−0,9), затем от полученного частного вычла 14,1 и в результате получила число −5,1. Какое число задумала Асем?',
             4: 'Асем задумала число. Это задуманное число она разделила на (−0,4), затем от полученного частного вычла 6 и в результате получила число 10,4. Какое число задумала Асем?'}
    variants = []
    for n in (1, 2, 3, 4):
        match = []
        for k, (e, v) in enumerate(exprs[n], 1):
            idx = [i for i, o in enumerate(opts[n]) if dec(o) == v]
            assert len(idx) == 1, (n, k, v)
            match.append('%d–%s' % (k, LET[idx[0]]))
        lines = ['%d) %s' % (k, e.replace('-', '−')) for k, (e, v) in enumerate(exprs[n], 1)]
        t1txt = 'Найдите соответствие данных выражений.\n' + '      '.join(lines) + '\nВарианты ответа:  ' + '     '.join('%s. %s' % (LET[i], o.replace('-', '−')) for i, o in enumerate(opts[n]))
        a, b_, ab, tx, tab = t2[n]
        val = a * b_ * ab
        t2txt = 'Найдите значение выражения, используя свойство умножения: $%s$ при $ab=%s$.' % (tx, tab)
        ans2 = 'по переместительному и сочетательному свойствам: (%s)·(%s) = %s; %s·(%s) = %s' % (sg(a), sg(b_), sg(a * b_), sg(a * b_), sg(ab), sg(val))
        pa, pb, (ra, rb) = per[n]
        t3txt = 'Переведите периодическую десятичную дробь в обыкновенную: а) %s;  б) %s — и запишите решение.' % (pa, pb)
        def mixs(x):
            w, r = divmod(x.numerator, x.denominator)
            return '%d %d/%d' % (w, r, x.denominator) if w else '%d/%d' % (r, x.denominator)
        ans3 = 'а) %s = %s;  б) %s = %s = %s' % (pa, '%d/%d' % (ra.numerator, ra.denominator), pb, mixs(rb), '%d/%d' % (rb.numerator, rb.denominator))
        d, sub, res, _ = t4[n]
        xx = (res + sub) * -F(d)
        assert xx / -F(d) - sub == res
        ans4 = 'x : (−%s) − %s = %s;  x : (−%s) = %s;  x = %s' % (sg(F(d)), sg(sub), sg(res), sg(F(d)), sg(res + sub), sg(xx))
        variants.append(dict(n=n, tasks=[dict(no=1, pts=4, text=t1txt, answer='; '.join(match), status='R0'),
                                         dict(no=2, pts=3, text=t2txt, answer=ans2, status='R1'),
                                         dict(no=3, pts=3, text=t3txt, answer=ans3, status='R0'),
                                         dict(no=4, pts=4, text=t4txt[n], answer=ans4, status='R0')],
                             calc=dict(t1=match, t2=str(val), t3=[str(ra), str(rb)], t4=str(xx))))
        L(W, n, 2, 'условие (смешанное число и дроби вокруг a·b)', 'R1',
          'уцелели фрагменты OMath «%s» и «%s»; знак «−» и целая часть вынесены в обычный текст, второй множитель и значение a·b разбросаны по нескольким блокам' % ('…∙а∙…∙в,…', '…'),
          tx + ' при ab=' + tab, 'Фрагменты стыкуются однозначно: подстановка ab даёт конечную десятичную дробь (проверено вычислением), целая часть мешанного числа стоит в тексте перед OMath-дробью.')
    return dict(id=W, quarter=1, title='Суммативное оценивание за раздел «Действия над рациональными числами»', tables=tabs, variants=variants, max=14, desc_table=None, rubric=None)

# ------------------------------------------------------------------ СОР-4
def fmt_poly(e):
    e = sp.expand(e)
    gens = sorted(e.free_symbols, key=lambda g: str(g))
    P = sp.Poly(e, *gens) if gens else None
    if P is None: return dtex(F(int(e.p), int(e.q)))
    terms = sorted(P.terms(), key=lambda t: tuple(-d for d in t[0]))
    out = ''
    for mon, c in terms:
        c = F(int(c.p), int(c.q))
        vars_ = ''.join(('%s' % g) + ('^{%d}' % d if d > 1 else '') for g, d in zip(gens, mon) if d)
        try:
            cs = dtex(abs(c)); 
            if cs in ('1',) and vars_: cs = ''
        except Exception: cs = None
        d_ = abs(c).denominator
        dd = d_
        while dd % 2 == 0: dd //= 2
        while dd % 5 == 0: dd //= 5
        if dd != 1:
            w = abs(c).numerator; cs = r'\frac{%d}{%d}' % (w, d_)
        sign = '-' if c < 0 else ('+' if out else '')
        out += sign + (cs if cs is not None else '') + vars_
    return out

def sor4():
    W = 'SOR-6-4'
    tabs = tables(615, 633)
    x = sp.symbols('x'); y = sp.symbols('y'); a = sp.symbols('a')
    R = sp.Rational
    ex = {1: ((x + 3) / (x + 4), x / (3 * x - 6)), 2: ((x + 5) / 4, x / (R(1, 2) * x - 2)), 3: ((2 * x) / (3 * (x - 2)), -4 / (5 * x)), 4: ((x - 2) / (5 + R(5, 2) * x), 12 / (3 * x - 12))}
    extex = {1: (r'\frac{x+3}{x+4}', r'\frac{x}{3x-6}'), 2: (r'\frac{x+5}{4}', r'\frac{x}{0{,}5x-2}'), 3: (r'\frac{2x}{3(x-2)}', r'\frac{-4}{5x}'), 4: (r'\frac{x-2}{5+2{,}5x}', r'\frac{12}{3x-12}')}
    opts = {1: {'А': 5, 'B': -3, 'C': 2, 'D': None, 'E': -4}, 2: {'А': 4, 'B': -5, 'C': 2, 'D': None, 'E': -4}, 3: {'А': 0, 'B': -3, 'C': 2, 'D': None, 'E': -4}, 4: {'А': -5, 'B': 0, 'C': -2, 'D': None, 'E': 4}}
    t2 = {
        1: [(r'3{,}4x+1{,}6-2{,}8x-2', sp.Rational(34, 10) * x + R(16, 10) - R(28, 10) * x - 2), (r'-3\frac{1}{2}y\cdot 4x', -R(7, 2) * y * 4 * x), (r'5\cdot(1{,}8x+1{,}2)-12', 5 * (R(18, 10) * x + R(12, 10)) - 12)],
        2: [(r'-1{,}2a-2{,}5+\frac{1}{5}a-3{,}5', -R(12, 10) * a - R(25, 10) + a / 5 - R(35, 10)), (r'\frac{3}{11}a\cdot\left(-2\frac{1}{5}\right)\cdot b', R(3, 11) * a * (-R(11, 5)) * sp.Symbol('b')), (r'\frac{3}{5}\cdot(-0{,}5x-10)+4', R(3, 5) * (-R(1, 2) * x - 10) + 4)],
        3: [(r'3{,}4x+1{,}6-2{,}8x-2', R(34, 10) * x + R(16, 10) - R(28, 10) * x - 2), (r'-3\frac{1}{2}y\cdot 4x', -R(7, 2) * y * 4 * x), (r'-4\cdot\left(1\frac{1}{2}x-3\right)-10', -4 * (R(3, 2) * x - 3) - 10)],
        4: [(r'-3\frac{1}{2}x+1{,}6-2x-2\frac{1}{5}', -R(7, 2) * x + R(16, 10) - 2 * x - R(11, 5)), (r'-4\frac{1}{3}y\cdot(-6)x', -R(13, 3) * y * (-6) * x), (r'-0{,}5\cdot\left(\frac{2}{3}x-6\right)+\frac{1}{3}', -R(1, 2) * (R(2, 3) * x - 6) + R(1, 3))]}
    t3 = {1: (R(2, 10), R(75, 100), 'a'), 2: (R(5, 10), R(20, 100), 'a'), 3: (R(7, 10), R(10, 100), 'a'), 4: (R(4, 10), R(15, 100), 'a')}
    t3txt = {1: 'Длина коробки a см, ширина составляет 0,2 длины, а высота 75% ширины. Найдите объем коробки.',
             2: 'Длина коробки a см, ширина составляет 0,5 длины, а высота 20% ширины. Найдите объем коробки.',
             3: 'Длина коробки a см, ширина составляет 0,7 длины, а высота 10% ширины. Найдите объем коробки.',
             4: 'Длина коробки a см, ширина составляет 0,4 длины, а высота 15% ширины. Найдите объем коробки.'}
    variants = []
    for n in (1, 2, 3, 4):
        ans1 = []
        for k, e in enumerate(ex[n], 1):
            den = sp.denom(sp.together(e))
            sol = sp.solve(den, x)
            if not sol: key = None
            else:
                assert len(sol) == 1; key = int(sol[0])
            letter = [L_ for L_, v in opts[n].items() if v == key]
            assert len(letter) == 1, (n, k, key)
            ans1.append('%d – %s (%s)' % (k, letter[0], 'x ≠ %d' % key if key is not None else 'x — любое число'))
        opt_txt = '     '.join('%s. %s' % (L_, ('x ≠ %s' % str(v).replace('-', '−')) if v is not None else 'x – любое число') for L_, v in opts[n].items())
        t1 = 'Определите допустимые значения переменной в алгебраическом выражении: 1) $%s$;  2) $%s$.   \nВарианты ответа: %s' % (extex[n][0], extex[n][1], opt_txt)
        tl = []
        ans2 = []
        for sub, (tx, e) in zip('abc', t2[n]):
            e2 = sp.expand(e)
            tl.append('%s) $%s$' % (sub, tx))
            ans2.append('%s) $%s$' % (sub, fmt_poly(e2)))
        t2txt = 'Преобразуйте выражения в тождественно равные: ' + ';  '.join(tl) + '.'
        wf, hf, _ = t3[n]
        vol = sp.nsimplify(1 * wf * wf * 0 + wf * (wf * 0 + 1) if False else 1)
        wv = wf; hv = wf * t3[n][1]; V = wv * hv  # * a^3
        ans3 = 'ширина %s·a, высота %s·%s·a = %s·a; V = a·%s·a·%s·a = %s·a³ см³' % (fnum(wv), fnum(t3[n][1]), fnum(wv), fnum(hv), fnum(wv), fnum(hv), fnum(V))
        variants.append(dict(n=n, tasks=[dict(no=1, pts=2, text=t1, answer='; '.join(ans1), status='R0'),
                                         dict(no=2, pts=6, text=t2txt, answer='; '.join(ans2), status='R0'),
                                         dict(no=3, pts=6, text=t3txt[n], answer=ans3, status='R0')],
                             calc=dict(t1=ans1, t2=[str(sp.expand(e)) for _, e in t2[n]], t3=str(V))))
    return dict(id=W, quarter=2, title='Суммативное оценивание за раздел «Алгебраические выражения»', tables=tabs, variants=variants, max=14, desc_table=None, rubric=None)
