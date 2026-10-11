# -*- coding: utf-8 -*-
import os, io, hashlib, math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image
plt.rcParams['mathtext.fontset'] = 'dejavusans'
plt.rcParams['font.family'] = 'DejaVu Sans'
CACHE = '/home/user/KAP_1/work/out/img'
os.makedirs(CACHE, exist_ok=True)

def math_img(tex, fs=11):
    key = hashlib.md5((tex + str(fs)).encode()).hexdigest()
    p = os.path.join(CACHE, 'm_%s.png' % key)
    if not os.path.exists(p):
        fig = plt.figure(figsize=(0.1, 0.1))
        fig.text(0, 0, '$%s$' % tex, fontsize=fs, color='black')
        fig.savefig(p, dpi=300, bbox_inches='tight', pad_inches=0.015, transparent=True)
        plt.close(fig)
    w, h = Image.open(p).size
    return p, w * 72 / 300, h * 72 / 300

def numline(a, b, path):
    lo, hi = min(0, min(a, b) - 2), max(a, b) + 2
    fig, ax = plt.subplots(figsize=(11 / 2.54, 2.2 / 2.54))
    ax.annotate('', xy=(hi + 0.7, 0), xytext=(lo - 0.7, 0), arrowprops=dict(arrowstyle='-|>', lw=1.2, color='black'))
    for t in range(lo, hi + 1):
        ax.plot([t, t], [-0.12, 0.12], color='black', lw=1)
    ax.text(0, -0.55, '0', ha='center', va='top', fontsize=9)
    ax.text(1, -0.55, '1', ha='center', va='top', fontsize=9)
    for name, c in (('A', a), ('B', b)):
        ax.plot([c], [0], 'o', ms=5, color='black')
        ax.text(c, 0.35, name, ha='center', va='bottom', fontsize=10, fontweight='bold')
    ax.set_xlim(lo - 1, hi + 1); ax.set_ylim(-1.2, 1.0); ax.axis('off')
    fig.subplots_adjust(0, 0, 1, 1)
    fig.savefig(path, dpi=300); plt.close(fig)

def draw_map(c1, c2, scale, path, CITY, proj):
    km_per_cm = scale * 10
    show = {c1, c2}
    pool = ['Астана', 'Алматы', 'Актобе', 'Караганда', 'Павлодар', 'Кызылорда', 'Костанай', 'Атырау', 'Шымкент', 'Актау', 'Тараз', 'Балхаш', 'Уральск', 'Петропавловск']
    # набор городов: два целевых + разреженные остальные
    pts = {c: proj(*CITY[c]) for c in pool + [c1, c2]}
    for c in pool:
        if c in show: continue
        if all(math.hypot(pts[c][0] - pts[s][0], pts[c][1] - pts[s][1]) / km_per_cm > 1.1 for s in show): show.add(c)
    xs = [pts[c][0] for c in pool]; ys = [pts[c][1] for c in pool]
    mx = max(150, 1.9 * km_per_cm)
    x0, x1, y0, y1 = min(xs) - 150, max(xs) + mx, min(ys) - 150, max(ys) + 330
    W = (x1 - x0) / km_per_cm; H = (y1 - y0) / km_per_cm
    fig = plt.figure(figsize=(W / 2.54, H / 2.54))
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(x0, x1); ax.set_ylim(y0, y1); ax.axis('off')
    ax.add_patch(plt.Rectangle((x0, y0), x1 - x0, y1 - y0, fill=False, lw=1.0, ec='black'))
    for lat in range(42, 57, 2):
        _, y = proj(lat, 70); 
        if y0 < y < y1: ax.plot([x0, x1], [y, y], color='0.8', lw=0.4, ls='--'); ax.text(x0 + 15, y + 8, '%d°с.ш.' % lat, fontsize=5, color='0.4')
    for lon in range(50, 84, 4):
        x, _ = proj(45, lon)
        if x0 < x < x1: ax.plot([x, x], [y0, y1], color='0.8', lw=0.4, ls='--'); ax.text(x + 8, y0 + 12, '%d°в.д.' % lon, fontsize=5, color='0.4')
    for c in show:
        x, y = pts[c]
        ax.plot([x], [y], 'o', ms=3.2 if c not in (c1, c2) else 4.2, color='black' if c in (c1, c2) else '0.35')
        ax.text(x + 22, y + 22, c, fontsize=6.5 if c not in (c1, c2) else 7.5, fontweight='bold' if c in (c1, c2) else 'normal')
    ax.text(x1 - 20, y1 - 25, 'Схематическая карта\nМасштаб 1 : %s' % '{:,}'.format(scale * 10 ** 6).replace(',', ' '), ha='right', va='top', fontsize=6.5)
    fig.savefig(path, dpi=300); plt.close(fig)
    return W, H
