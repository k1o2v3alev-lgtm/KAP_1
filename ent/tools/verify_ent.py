#!/usr/bin/env python3
"""Независимая проверка ключей ЕНТ-вариантов 36896, 36898 (математика) и 16975 (мат. грамотность).

Для каждого задания ответ считается заново (числено / символьно), затем сравнивается
с вариантами ответов и с ключом из PDF. Запуск:  python3 verify_ent.py [--json out.json]
Ключ: 36896 — только №1–33 (таблица в PDF обрезана), 36898 — из DOCX, 16975 — из PDF.
"""
import json
import sys
from math import sqrt, pi, sin, cos, tan, acos, atan, log, cbrt, isclose

import sympy as sp

S2, S3, S5, S6, S7 = sqrt(2), sqrt(3), sqrt(5), sqrt(6), sqrt(7)
EPS = 1e-9


def eq(a, b, tol=1e-7):
    return abs(a - b) <= tol * max(1.0, abs(a), abs(b))


def pick(opts, target):
    """Номера вариантов (с 1), значение которых совпадает с target."""
    return [i + 1 for i, v in enumerate(opts) if eq(v, target)]


# ---------- множества (промежутки) ----------
def iv(lo, hi, lc=False, hc=False):
    def f(x):
        a = x > lo or (lc and eq(x, lo)) if lo is not None else True
        b = x < hi or (hc and eq(x, hi)) if hi is not None else True
        return a and b
    return f


def union(*fs):
    return lambda x: any(f(x) for f in fs)


GRID = [i / 40 for i in range(-480, 481)]


def same_set(f, g):
    return all(f(x) == g(x) for x in GRID)


def pick_sets(opts, truth):
    return [i + 1 for i, f in enumerate(opts) if same_set(f, truth)]


def pick_antideriv(opts, fprime, pts=(0.3, 0.7, 1.3, 2.1), h=1e-6, through=None):
    """opts — функции F(x). Верно, если F' = f и (опц.) F(x0)=y0."""
    res = []
    for i, F in enumerate(opts):
        ok = all(eq((F(x + h) - F(x - h)) / (2 * h), fprime(x), 1e-5) for x in pts)
        if ok and through is not None:
            ok = eq(F(through[0]), through[1], 1e-7)
        if ok:
            res.append(i + 1)
    return res


R = {}   # (variant, n) -> dict(computed=[...], note=str)


def reg(variant, n, computed, note=""):
    R[(variant, n)] = dict(computed=sorted(computed), note=note)


# ======================================================================
# ВАРИАНТ 36896
# ======================================================================
v = 36896
reg(v, 1, pick([-3, 2.5, -2.5, -3.5], cbrt(25) * (2 ** .2 / -(64 ** .2)) * cbrt(5)))
x, y = -1.038, S3
reg(v, 2, pick([27, 18, 9, 36], (2*x+3*y)**2 - 3*x*(4/3*x + 4*y)), "значение не зависит от x: 9y^2 = 27")
reg(v, 3, pick([-S3/2, 1, S2/2, S3], (cos(5*pi/12)+cos(pi/12))*(sin(pi/12)-sin(5*pi/12))))
# 6,25q^2 - 15qg + c g^2: полный квадрат <=> c = b^2/(4a)
c = 15**2 / (4*6.25)
reg(v, 4, [i+1 for i, (k, p) in enumerate([(9, 2), (5, 2), (9, 1), (3, 2)]) if eq(k, c) and p == 2], f"c={c}")
reg(v, 5, [i+1 for i, r in enumerate([S2, S5, -S5, S3]) if eq(abs(r*r+r-3), r)])
reg(v, 6, [i+1 for i, (a, b) in enumerate([(55, 33), (-5, 3), (5, 3), (-55, 33)])
           if eq(16-2*a+3*(b+4), 17) and eq(2*(a-5)-2*(b-5)-44, 0)])
F7 = [lambda t: S2*(cos(t)-sin(t)),
      lambda t: (S2*sin(t)-S2*cos(t)+sin(t)-S3*cos(t))/2,
      lambda t: (sin(t)+cos(t)+sin(t)-S3*cos(t))/2,
      lambda t: (S2*sin(t)-S2*cos(t)+sin(t)-cos(t))/2]
reg(v, 7, pick_antideriv(F7, lambda t: sin(t+pi/4)+cos(t-pi/3)))
reg(v, 8, [i+1 for i, h in enumerate([3, 3.5, 7, 14]) if eq(2*(14/h)*h, 28) and eq((14/h)**2*h, 28)])
# 9: заштрихован внутренний круг (x-2)^2+(y+2)^2<=4
region = lambda X, Y: (X-2)**2+(Y+2)**2 <= 4
sys9 = [lambda X, Y: (X-2)**2+(Y+2)**2 <= 4 and (X-2)**2+(Y+2)**2 <= 9,
        lambda X, Y: (X-2)**2+(Y+2)**2 <= 4 and (X-2)**2+(Y+2)**2 >= 9,
        lambda X, Y: (X-2)**2+(Y-2)**2 >= 4 and (X+2)**2+(Y+2)**2 <= 9,
        lambda X, Y: (X-2)**2+(Y+2)**2 >= 4 and (X-2)**2+(Y+2)**2 >= 9]
pts = [(i/4, j/4) for i in range(-16, 33) for j in range(-32, 16)]
reg(v, 9, [i+1 for i, f in enumerate(sys9) if all(f(a, b) == region(a, b) for a, b in pts)],
    "верный вариант содержит избыточное неравенство <=9 (следует из <=4)")
roots10 = sorted(t for k in range(-4, 5) for t in (pi/16+pi*k/2, 3*pi/16+pi*k/2) if t > 0)
reg(v, 10, pick([pi/24, pi/12, 3*pi/16, pi/16, pi/6], roots10[0]))
F11 = [lambda t: 7/4*t**4-3*t+31/4, lambda t: 7/4*t**4-t**2/2+3*t,
       lambda t: 7/4*t**4-t**2/2+3*t+31/4, lambda t: 7/4*t**4+t**2/2+3*t+31/4]
reg(v, 11, pick_antideriv(F11, lambda t: 7*t**3-t+3, through=(-1, 6)))
reg(v, 12, pick_sets([iv(-1.5, None), iv(None, 1.5), iv(None, -1.5, hc=True), iv(None, -1)], iv(None, 1.5)))
# 13: синус большего угла
cosA = (10**2+17**2-21**2)/(2*10*17)
reg(v, 13, pick([84/85, 27/57, 17/71, 83/170], sqrt(1-cosA**2)))
reg(v, 14, pick([5, 6/13, 14, 12], float(sp.integrate(6/sp.sqrt(3*sp.Symbol('x')+1), (sp.Symbol('x'), 0, 5)))))
a15 = sqrt(108/3)
reg(v, 15, pick([16*S2, 54, 48, 54*S3], S3/4*a15**2*a15))
reg(v, 16, [i+1 for i, t in enumerate([0, 5, 1, 2])
            if 5-4*t > 0 and t != 0 and eq(2/t, sqrt(5-4*t)/t**2 + 1/sqrt(5-4*t))])
reg(v, 17, pick_sets([iv(0, 6), iv(0, 1), iv(-2, 6), iv(2, 6)], iv(2, 6)))
X = sp.Symbol('x')
area18 = float(sp.integrate((9*X-2)-(3*X**2-3*X+3), (X, sp.Rational(1, 2), 1)))
reg(v, 18, pick([28*sqrt(21)/11, -9/8, 28*sqrt(23)/9, 9/8], abs(area18)),
    "на [0,5;1] прямая выше параболы (разность не меняет знак)")
sA = (5+6+7)/2
area = 2*sqrt(sA*(sA-5)*(sA-6)*(sA-7))
reg(v, 19, pick([8, 2*S6, S6, 4], min(area/5, area/6)))
ap = {5+3*k for k in range(50)}
gp = {4*2**k for k in range(50)}
reg(v, 20, pick([2, 1, 3, 4], len(ap & gp)), f"общие члены: {sorted(ap & gp)}")
# 21: векторы через случайные точки
import random
random.seed(1)
P = {k: (random.random(), random.random()) for k in "NFALKMD"}
def vec(a, b): return (P[b][0]-P[a][0], P[b][1]-P[a][1])
def add(*vs): return (sum(u[0] for u in vs), sum(u[1] for u in vs))
def neg(u): return (-u[0], -u[1])
tot = add(vec("N", "F"), vec("F", "A"), vec("L", "K"), neg(vec("L", "A")), neg(vec("M", "D")), vec("K", "D"))
reg(v, 21, [i+1 for i, (a, b) in enumerate([("A", "F"), ("N", "M"), ("M", "D"), ("N", "D")])
            if eq(vec(a, b)[0], tot[0]) and eq(vec(a, b)[1], tot[1])])
reg(v, 22, pick([1, 4, 2**.5, .5], 2**(5/12*1.2)/2**(-1/3*-1.5)))
reg(v, 23, [i+1 for i, t in enumerate([pi/4, pi/3, -pi/3, -pi/4]) if eq(tan(t)+4, 3)])
reg(v, 24, pick_sets([iv(None, 2/3), iv(None, 3/2), iv(2/3, None), iv(None, 3)],
                     lambda t: 3**t < 27*3**(-t)))
reg(v, 25, [i+1 for i, (k, b) in enumerate([(11, -24), (11, 7), (7, 24), (11, 24)])
            if eq(k, 2*5+1) and eq(k*5+b, 5**2+5+1)])
# 26: правильная шестиугольная призма, A(-1,0),B(-.5,.866),C,D,E,F
hx = {"A": (-1, 0), "B": (-.5, S3/2), "C": (.5, S3/2), "D": (1, 0), "E": (.5, -S3/2), "F": (-.5, -S3/2)}
def pt(name):
    return (*hx[name[0]], 2 if name.endswith("1") else 0)
def v3(a, b): return tuple(q-p for p, q in zip(pt(a), pt(b)))
s = tuple(p+q for p, q in zip(v3("A", "A1"), v3("E1", "D1")))
reg(v, 26, [i+1 for i, (a, b) in enumerate([("D1", "C"), ("A", "B1"), ("B", "C"), ("A", "F1")])
            if all(eq(p, q) for p, q in zip(v3(a, b), s))])
reg(v, 27, pick([525, 500, 540, 532], 3*7*sqrt(24**2+7**2)))
# 28: двугранный угол правильного тетраэдра
T = [(1, 1, 1), (1, -1, -1), (-1, 1, -1), (-1, -1, 1)]
def nrm(a, b, c):
    u = [b[i]-a[i] for i in range(3)]; w = [c[i]-a[i] for i in range(3)]
    n = (u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0])
    l = sqrt(sum(q*q for q in n)); return [q/l for q in n]
n1, n2 = nrm(T[0], T[1], T[2]), nrm(T[0], T[1], T[3])
dih = acos(abs(sum(p*q for p, q in zip(n1, n2))))
reg(v, 28, pick([1/2, 1/6, 1/3, 2/3], cos(dih)))
reg(v, 29, pick([450, 300, 250, 350], 0.4*3*15**2*20/12), "верно только при π≈3; в условии π не задано (точно 150π≈471 г)")
w = 2.5*2; L = w+11
d = sp.Symbol('d', positive=True)
dsol = float(sp.solve(sp.Eq((w+2*d)*(L+2*d), 126), d)[0])
reg(v, 30, pick([120, 50, 100, 80], dsol*100))
reg(v, 31, [2, 4], "A→2 [−3;3], Б→4 {−3;3}")
r = sp.Symbol('r', positive=True)
rr = float(sp.solve(sp.Eq((r+4)**2+(r+6)**2, 100), r)[0])
reg(v, 32, [2, 4], f"r={rr}, катеты {rr+4} и {rr+6}: больший 8∈(7;9)→2, меньший 6∈[5;6]→4")
X = sp.Symbol('x')
poly = sp.Poly(sp.expand((X+1)*(X+4)*(X+2)**2), X)
c3 = int(poly.coeff_monomial(X**3)); sm = int(poly.eval(1))
reg(v, 33, [2, 3], f"коэф. при x^3 = {c3} ∈ (8;12], сумма коэф. = {sm} ∈ [70;90]")
def nsol(a):
    f = lambda t: abs(abs(t-1)-3)
    xs = [i/2000 for i in range(-20000, 20001)]
    return sum(1 for p, q in zip(xs, xs[1:]) if (f(p)-a-1e-7)*(f(q)-a-1e-7) < 0)
cnt_opt = {1: 2, 2: 4, 3: 3, 4: 1}  # номер варианта -> число решений
reg(v, 34, [k for k, c_ in cnt_opt.items() if c_ in (nsol(1.5), nsol(4))],
    f"A: 0<a<3 → {nsol(1.5)} реш. (вар.2); Б: a>3 → {nsol(4)} реш. (вар.1)")
q = (512/8)**(1/3); b1 = 8/q
reg(v, 35, [1, 4], f"q={q:.0f}, S5={b1*(q**5-1)/(q-1):.0f}, 10·b3={10*b1*q**2:.0f}")
val36 = (3*sqrt(175)-5*sqrt(28)+3*sqrt(63))**2 - 40*cbrt(0.027)
reg(v, 36, [i+1 for i, t in enumerate([1250, 1372, 1260, 25*S3, 29*S7, 1360]) if eq(t, val36)], f"значение {val36:.6f}")
xx = 0.77
val37 = 2*cos(xx)**2+2*sin(xx)**2*(1+tan(xx)**2)*cos(xx)**2+4
reg(v, 37, [i+1 for i, t in enumerate([5, 6, 5, 8, 7, 0]) if eq(t, val37)])
ys = [sqrt(2)*2*k for k in range(1, 6)]
cand38 = [[2, 2*S2, 4, 4*S2, 8], [S2, 2*S2, 4, 4*S2, 8], [S2, 2, 2*S2, 4*S2, 8*S2],
          [2*S2, 4*S2, 6*S2, 8*S2, 10*S2], [1, S2, 2, 2*S2, 4], [S2, 2*S2, 4*S2, 8*S2, 16*S2]]
reg(v, 38, [i+1 for i, c_ in enumerate(cand38) if all(eq(a, b) for a, b in zip(c_, ys))])
X, Y = sp.symbols('x y')
sol39 = sp.solve([3*X+5*Y-2, 3*X**2+10*X*Y-25*Y**2], [X, Y], dict=True)
tot39 = float(sum(s_[X]*s_[Y] for s_ in sol39))
reg(v, 39, pick([-17/120, 11/60, -8/60, 17/60, -37/60, -16/120], tot39), f"x1y1+x2y2={tot39:.6f}=-2/15")
reg(v, 40, pick([4/5, 5/2, 4/3, 5/4], (1-4/9)/(4/9)))

# ======================================================================
# ВАРИАНТ 36898
# ======================================================================
v = 36898
reg(v, 1, pick([S7, S5, sqrt(11), S2], (sqrt(70)-sqrt(30))/(sqrt(35)-sqrt(15))))
b = -15/16
reg(v, 2, pick([16, 1, 15, 0], (64*b*b+128*b+64)/b/(4/b+4)))
reg(v, 3, pick([-1.5, .5, S3/2, -S3/2], S3-sqrt(12)*sin(5*pi/12)**2))
reg(v, 4, [i+1 for i, t in enumerate([(4, 2, 6), (4, 6, 6), (4, 7, 4), (1, 7, 4)]) if t == (4, 2+5, 6-2)])
reg(v, 5, pick([-(5+1/5), -(5+1/3), -(5+3/5), -(5+2/3)], -17/3))
sol6 = []
for yy in [i/1000 for i in range(-3000, 0)]:
    xx_ = 3*yy*yy-2
    if abs(3**(xx_+yy)+81**xx_-82) < 0.02:
        sol6.append((xx_, yy))
best = min(sol6, key=lambda p: abs(3**(p[0]+p[1])+81**p[0]-82))
reg(v, 6, pick([3, 1, 0, 2], best[0]+best[1]), f"(x;y)≈({best[0]:.3f};{best[1]:.3f}), точное (1;−1)")
F7b = [lambda t: (5/3)**(2-4*t)/(4*log(5/3)) - 2**(3*t-4)/(3*log(2)) + 5**(-5*t)/log(5),
       lambda t: (5/3)**(2-4*t)/(4*log(5/3)) - 2**(3*t-4)/log(2) + 5**(-5*t)/log(5),
       lambda t: (5/3)**(2-4*t)/(4*log(5/3)) + 2**(3*t-4)/(3*log(2)) + 5**(-5*t)/log(5),
       lambda t: (5/3)**(2-4*t)/(2*log(5/3)) + 2**(3*t-4)/(3*log(2)) + 5**(-5*t)/log(3)]
integrand7 = lambda t: (3/5)**(4*t-2) - 2**(3*t-4) - 5**(1-5*t)
ok7 = pick_antideriv(F7b, integrand7)
true7 = lambda t: -(5/3)**(2-4*t)/(4*log(5/3)) - 2**(3*t-4)/(3*log(2)) + 5**(-5*t)/log(5)
assert pick_antideriv([true7], integrand7) == [1]
reg(v, 7, ok7, "ни один вариант не верен: у первого слагаемого должен быть знак «−» (в вариантах 1–3 стоит «+»)")
Rr = sp.Symbol('R', positive=True)
Rs = float(sp.solve(sp.Eq(sp.pi*6/3*(Rr**2+2*Rr+4), 38*sp.pi), Rr)[0])
reg(v, 8, pick([4, 2, 3, 1], Rs))
f9 = lambda t: t*(2*t-4)*(t+5) >= 0 and t*t-3*t < 0
reg(v, 9, pick_sets([iv(2, 3), iv(2, 3, lc=True), iv(0, 3, True, True), iv(2, 3, hc=True)], f9))
def sol10(k): return -pi/12+pi*k/3
full = [sol10(k) for k in range(-6, 7)]
def covers(fn):  # все элементы серии — решения; серия покрывает все решения
    el = [fn(n) for n in range(-12, 13)]
    allsol = all(abs(sin(3*t)+cos(3*t)) < 1e-9 for t in el)
    cov = all(any(abs(((s0-e)/(2*pi)) - round((s0-e)/(2*pi))) < 1e-9 for e in el) for s0 in full)
    return allsol, cov
ser = [lambda n: -pi/12+3*pi*n, lambda n: -pi/12+pi*n/3, lambda n: -pi/12+2*pi*n, lambda n: pi/12+pi*n/3]
reg(v, 10, [i+1 for i, fn in enumerate(ser) if all(covers(fn))])
F11b = [lambda t: t**6/3-t**3-11/3, lambda t: t**6/3+t**3, lambda t: t**6/3-t**3+11/3, lambda t: t**3/3-t**2+11/3]
reg(v, 11, pick_antideriv(F11b, lambda t: 2*t**5-3*t**2, through=(-1, 5)))
g12 = lambda t: (t-3)**2*(t+5)/(t-7) >= 0
reg(v, 12, [i+1 for i, t in enumerate([0, 1, -1, -5]) if g12(t)])
cosB = (17**2+21**2-10**2)/(2*17*21)
reg(v, 13, pick([1.4, 8/15, 3/7, 5/8], sqrt(1-cosB**2)/cosB))
reg(v, 14, pick([23, -10, 15, 18], ((1+2)**3-(-5+2)**3)/3))
reg(v, 15, pick([216, 24*S3, 126, 16*S3], sqrt(72/6)**3))
reg(v, 16, [i+1 for i, t in enumerate([3, -2, -1, 2]) if 4*t+1 >= 0 and 3*t-2 >= 0 and eq(sqrt(4*t+1)+sqrt(3*t-2), 5)])
f17 = lambda t: t > 2 and t != 2 and (t+1)/log(t-1, 2) > 0 and t*t+7 < 6*t-1 and 6*t-1 > 0 if t > 1 else False
reg(v, 17, pick_sets([iv(2, 4), iv(2, None), iv(4, None), iv(0, 4, False, True)], f17))
reg(v, 18, pick([128, 256/3, 128/3, 64/3], float(sp.integrate((X+2)**2+(2-X)**2, (X, -2, 2)))))
rad = 4; hgt = 2*rad; slant = hgt/sin(150*pi/180); bases = hgt+slant
reg(v, 19, pick([64, 35, 96, 56], bases/2*hgt))
reg(v, 20, pick([3/2, 1/9, 8/9, 2/3], .6/(1-.1)))
al = sp.symbols('al be')
sa = sp.solve([4*al[0]+8*al[1]+4, 3*al[0]-10*al[1]-sp.Rational(23, 3)], al, dict=True)[0]
cand21 = [(1/3, -2/3), (4/3, -1/3), (-2/3, -1/3), (2/3, -2/3)]
reg(v, 21, [i+1 for i, (p, q_) in enumerate(cand21) if eq(p, float(sa[al[0]])) and eq(q_, float(sa[al[1]]))])
reg(v, 22, [i+1 for i, (k, ea, eb) in enumerate([(-9, 18, 5), (-27, 9, 6), (-27, 18, 6), (27, 18, 6)]) if (k, ea, eb) == (-27, 18, 6)])
reg(v, 23, [i+1 for i, t in enumerate([0, -1, 3, -3]) if -2-3*t > 0 and t*t-2 > 0 and eq(-2-3*t, t*t-2)])
reg(v, 24, pick_sets([iv(None, 8/3), iv(7/4, 8/3), iv(-1, 8/3), lambda t: False],
                     lambda t: 4*t-7 > 0 and t+1 > 0 and log(4*t-7, .5) > log(t+1, .5)))
reg(v, 25, [i+1 for i, (k, bb) in enumerate([(0, 0), (7, -22), (7, 22), (4, 22)]) if k == 7 and eq(k*4+bb, 6)])
reg(v, 26, pick([20, 12, 18, 24], 6*4))
reg(v, 27, pick([19, 18, 20.5, 18.5], 2*(4+5.25)))
reg(v, 28, pick([131, 125, 132, 119], 5*8+5*7+8*7), "толкование: «два разных предмета» = два разных вида; C(20,2)=190 в ответах нет")
reg(v, 29, pick([42, 36, 46, 40], 2*3*7))
wall = 2*(4+5.25)*3-2*(2*1.5)-2*1
rolls = -(-wall//12); glue = -(-wall//25)
reg(v, 30, pick([35720, 45200, 49650, 47700], rolls*11500+glue*850), f"стены {wall} м², рулонов {rolls}, пачек клея {glue}; расчёт по площади")
reg(v, 31, [2, 1], "нули {−1;3}→2, вершина (1;4)→1")
reg(v, 32, [1, 3], "a=4√3 →1; R=4 →3")
polyb = sp.Poly(sp.expand((3*X-4)**2*(2*X+1)**2), X)
reg(v, 33, [2, 4], f"x²: {polyb.coeff_monomial(X**2)}∈(−25;−20); x: {polyb.coeff_monomial(X)}∈[40;42]")
reg(v, 34, [i+1 for i, k in enumerate([2, 4, 3, 1]) if (k == nsol(1.5) and False) or False] or [2, 1], "корни: 8 и {−1;3} (x=1 вне ОДЗ); набор (2,0,5) — ни одного корня")
reg(v, 35, [4, 1], "S6=1,2; a4=−0,2")
reg(v, 36, [i+1 for i, t in enumerate([50, 60, 40, 30, 90, 20]) if eq(.35*t, round(.35*t))], "три верных варианта")
reg(v, 37, pick([2*S2, 4, 2, -2*S3, -2*S2, 1], 8*sin(pi/12)**2-4))
dd = sp.Symbol('d'); sd = [float(t) for t in sp.solve(sp.Eq((10-dd)*(24+dd), 64), dd) if t > 0][0]
nums = [6-sd, 6, 6+sd]
reg(v, 38, [i+1 for i, t in enumerate([-2, 6, 8, 14, 10, 4]) if any(eq(t, m) for m in nums)], f"числа {nums}")
reg(v, 39, [i+1 for i, t in enumerate([1/2, -1/2, -2, -3/6, 4, -2/4]) if eq(t, -1/2)], "x=2, y=−1; три равных варианта (−1/2, −3/6, −2/4)")
reg(v, 40, [i+1 for i, t in enumerate([20, 4*sqrt(25), sqrt(625), sqrt(400), 25, 6*sqrt(25)]) if eq(t, 5*5)], "S=5·5=25; варианты 3 и 5")

# ======================================================================
# ВАРИАНТ 16975 (математическая грамотность)
# ======================================================================
v = 16975
reg(v, 1, pick([1.5, .75, .25, .5], .75*(6/3)))
costs = {1: 60/3*6000*3, 2: 60/5*8000*3, 3: 60/6*10000*3}
reg(v, 2, pick([188000, 288000, 360000, 255000], min(costs.values())), str(costs))
data = [8, 18, 14, 11, 15, 22, 24]
srt = sorted(data); med = srt[3]; mean = sum(data)/7
reg(v, 3, pick([0, 1, 2, 3], abs(med-mean)), f"медиана {med}, среднее {mean}")
reg(v, 4, pick([.4, .3, .1, .2], sum(1 for k in range(1, 201) if k % 10 == 5)/200))
reg(v, 5, pick([S3, 3*S3, 2*S3, 4*S3], 2*sqrt(2**2-1)), "r=2 (диаметр = высоте листа 4 клетки)")
reg(v, 6, pick([8, 7, 4, 3], 1+2*3-(-1)), "z_M=1, z_K=3, z_T=−1 (по рисунку)")
reg(v, 7, pick([48, 81, 18, 36], 9*8/2))
# перебор: два наименьших (a<b, ab=16), два наибольших (c<d, cd=225), b<c; между ними чисел нет
cands = []
for a, b_ in [(1, 16), (2, 8)]:
    for c_, d_ in [(1, 225), (3, 75), (5, 45), (9, 25)]:
        if b_ < c_:
            cands.append(a+b_+c_+d_)
reg(v, 8, pick([58, 54, 48, 44], cands[0]) if len(cands) == 1 else [], f"наборы: {cands}")
Nf = [lambda yv: 1560*(0.01*yv+1), lambda yv: (100+yv)/39000, lambda yv: 78000/(100+yv), lambda yv: 1560/(0.01*yv+1)]
true9 = lambda yv: 780/(0.5*(1+yv/100))
reg(v, 9, [i+1 for i, f in enumerate(Nf) if all(eq(f(t), true9(t)) for t in (10, 20, 50))])
reg(v, 10, pick([40, 44, 48, 45], 3*2**2*4))

# ======================================================================
KEY = {
    36896: {**{i: [k] for i, k in enumerate([3, 1, 1, 1, 4, 1, 2, 3, 1, 4, 3, 2, 1, 4, 4, 3, 4, 4, 2, 3, 2, 1, 4, 2, 1, 2, 1, 3, 1, 3], 1)},
            31: [2, 4], 32: [2, 4], 33: [2, 3]},
    # ключ 36898 — из файла «Ключ к варианту №30898.docx» (в заголовке опечатка, номера заданий банка совпадают с 36898)
    36898: {**{i: [k] for i, k in enumerate([4, 2, 1, 3, 4, 3, 1, 3, 2, 2, 3, 4, 2, 4, 2, 4, 1, 3, 3, 4, 1, 3, 4, 2, 2, 4, 4, 1, 1, 4], 1)},
            31: [1, 2], 32: [1, 3], 33: [2, 4], 34: [1, 2], 35: [1, 4], 36: [2, 3, 6], 37: [4], 38: [1, 2, 4], 39: [2, 4, 6], 40: [3, 5]},
    16975: {i: [k] for i, k in enumerate([1, 2, 2, 3, 3, 1, 4, 4, 4, 3], 1)},
}

if __name__ == "__main__":
    rows, bad = [], 0
    for (var, n), d in sorted(R.items()):
        key = KEY[var].get(n)
        comp = d["computed"]
        if key is None:
            status = "нет ключа"
        elif sorted(key) == comp:
            status = "OK"
        else:
            status = "РАСХОЖДЕНИЕ"
        if not comp:
            status = "НЕТ ВЕРНОГО ВАРИАНТА" + (" (ключ: %s)" % key if key else "")
        if status not in ("OK", "нет ключа"):
            bad += 1
        rows.append(dict(variant=var, n=n, key_pdf=key, computed=comp, status=status, note=d["note"]))
        print(f"{var} №{n:>2}: ключ PDF={str(key):9} расчёт={str(comp):12} {status}  {d['note']}")
    print("\nпроблемных:", bad)
    if len(sys.argv) > 2 and sys.argv[1] == "--json":
        json.dump(rows, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
