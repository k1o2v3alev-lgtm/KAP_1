# -*- coding: utf-8 -*-
"""OMR-бланк ответов: геометрия, рисование (reportlab), распознавание по фото (OpenCV).
Единица измерения геометрии — миллиметры, начало координат в левом верхнем углу листа A4 (210×297 мм)."""
import json, math, sys
import numpy as np
VERSION = 'OMR-A4-v1.0'
PAGE = (210.0, 297.0)
MARK = 8.0                      # сторона регистрационной метки
MARKS = {'TL': (12.0, 12.0), 'TR': (198.0, 12.0), 'BL': (12.0, 285.0), 'BR': (198.0, 285.0)}   # центры; BR — «рамка» (с белым отверстием)
ID_CELLS = dict(x0=24.0, y=68.0, w=7.0, h=7.0, gap=2.0, n=12)        # 12 ячеек: sync(1) + 6 бит шаблон + 2 бита вариант + чётность + конец(0)... см. id_bits
ROW0, PITCH, BUB_R = 100.0, 14.0, 3.4
OPT_X = [58.0, 83.0, 108.0, 133.0]
NUM_X = 28.0
LETTERS = 'АБВГ'
MAX_ROWS = 12

def id_bits(template_idx, variant):
    """template_idx 1..63, variant 1..4 -> 12 бит"""
    t = [int(b) for b in format(template_idx, '06b')]
    v = [int(b) for b in format(variant - 1, '02b')]
    body = [1] + t + v
    par = sum(body) % 2
    return body + [par, 0, 1][:3]      # sync=1, 6 бит, 2 бита, чётность, 0, 1 -> всего 1+6+2+3 = 12

def decode_bits(bits):
    if len(bits) != 12 or bits[0] != 1 or bits[10] != 0 or bits[11] != 1: return None
    if sum(bits[:9]) % 2 != bits[9]: return None
    t = int(''.join(map(str, bits[1:7])), 2); v = int(''.join(map(str, bits[7:9])), 2) + 1
    return t, v

def geometry(n_items):
    rows = []
    for i in range(n_items):
        cy = ROW0 + i * PITCH
        rows.append(dict(item=i + 1, y=cy, num_x=NUM_X, options=[dict(letter=LETTERS[k], x=OPT_X[k], y=cy, r=BUB_R) for k in range(4)]))
    return dict(version=VERSION, page_mm=list(PAGE), marks={k: dict(cx=v[0], cy=v[1], size=MARK, kind=('ring' if k == 'BR' else 'solid')) for k, v in MARKS.items()},
                id_cells=[dict(index=i, x=ID_CELLS['x0'] + i * (ID_CELLS['w'] + ID_CELLS['gap']), y=ID_CELLS['y'], w=ID_CELLS['w'], h=ID_CELLS['h']) for i in range(ID_CELLS['n'])],
                fields=dict(fio=dict(x=22, y=38, w=166, h=10), klass=dict(x=22, y=54, w=60, h=8)), rows=rows, bubble_radius_mm=BUB_R, row_pitch_mm=PITCH,
                recognition=dict(fill_marked=0.45, fill_blank=0.22, canonical_px_per_mm=4))

def draw_sheet(c, title, subtitle, template_idx, variant, n_items, fonts, answers=None, ink_extra=None):
    """c — reportlab canvas, координаты в мм сверху вниз. answers: {item: [индексы закрашенных]} — для тестового бланка."""
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    H = PAGE[1]
    X = lambda x: x * mm
    Y = lambda y: (H - y) * mm
    c.setFillColor(colors.black); c.setStrokeColor(colors.black)
    for k, (cx, cy) in MARKS.items():
        s = MARK
        c.rect(X(cx - s / 2), Y(cy + s / 2), X(s), X(s), fill=1, stroke=0)
        if k == 'BR':
            c.setFillColor(colors.white); c.rect(X(cx - s / 4), Y(cy + s / 4), X(s / 2), X(s / 2), fill=1, stroke=0); c.setFillColor(colors.black)
    c.setFont(fonts[1], 13); c.drawString(X(22), Y(26), title)
    c.setFont(fonts[0], 9); c.drawString(X(22), Y(32), subtitle)
    g = geometry(n_items)
    c.setFont(fonts[0], 8)
    f = g['fields']['fio']; c.setLineWidth(0.6); c.rect(X(f['x']), Y(f['y'] + f['h']), X(f['w']), X(f['h']), fill=0)
    c.drawString(X(f['x'] + 1.5), Y(f['y'] - 1.2), 'Фамилия, имя (печатными буквами)')
    f = g['fields']['klass']; c.rect(X(f['x']), Y(f['y'] + f['h']), X(f['w']), X(f['h']), fill=0)
    c.drawString(X(f['x'] + 1.5), Y(f['y'] - 1.2), 'Класс (например, 7 А)')
    c.drawString(X(100), Y(58), 'Вариант: %d' % variant); c.drawString(X(100), Y(62), 'Шаблон: %s' % title.split('·')[0].strip())
    bits = id_bits(template_idx, variant)
    for cell, b in zip(g['id_cells'], bits):
        c.setLineWidth(0.5); c.rect(X(cell['x']), Y(cell['y'] + cell['h']), X(cell['w']), X(cell['h']), fill=1 if b else 0, stroke=1)
    c.setFont(fonts[0], 6.5); c.drawString(X(24), Y(78.5), 'Служебный код бланка (не закрашивать): %s, вариант %d' % (VERSION, variant))
    c.setFont(fonts[0], 8.5); c.drawString(X(22), Y(85), 'Закрасьте ОДИН кружок полностью обычной ручкой (чёрной или синей).'); c.drawString(X(22), Y(89.5), 'Исправления не допускаются: при ошибке попросите новый бланк.')
    for i, row in enumerate(g['rows']):
        if i % 2 == 0:
            c.setFillColor(colors.Color(0.94, 0.94, 0.94)); c.rect(X(20), Y(row['y'] + PITCH / 2 - 0.5), X(170), X(PITCH - 1), fill=1, stroke=0); c.setFillColor(colors.black)
        c.setFont(fonts[1], 11); c.drawRightString(X(row['num_x']), Y(row['y'] - 1.3), '%d.' % row['item'])
        for k, o in enumerate(row['options']):
            filled = answers is not None and k in answers.get(row['item'], [])
            c.setLineWidth(0.9); c.circle(X(o['x']), Y(o['y']), X(o['r']), stroke=1, fill=1 if filled else 0)
            c.setFont(fonts[0], 11); c.drawString(X(o['x'] + o['r'] + 2.2), Y(o['y'] - 1.4), o['letter'])
    c.setFont(fonts[0], 7); c.drawString(X(22), Y(278), 'Не загибайте и не пачкайте углы листа: чёрные метки нужны для распознавания по фотографии.')
    return g

# --------------------------------------------------------------------------- распознавание
def _order_pts(pts):
    pts = np.array(pts, dtype='float32'); s = pts.sum(1); d = np.diff(pts, axis=1).ravel()
    return np.array([pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(d)], pts[np.argmax(s)]], dtype='float32')   # TL, TR, BL?, BR

def find_marks(gray):
    import cv2
    h, w = gray.shape
    scale = 1000.0 / max(h, w)
    g = cv2.resize(gray, None, fx=scale, fy=scale) if scale < 1 else gray.copy(); scale = g.shape[0] / h
    bl = cv2.GaussianBlur(g, (5, 5), 0)
    th = cv2.adaptiveThreshold(bl, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 51, 12)
    cnts, hier = cv2.findContours(th, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    area_img = g.shape[0] * g.shape[1]
    cand = []
    for i, cn in enumerate(cnts):
        if hier[0][i][3] != -1: continue
        a = cv2.contourArea(cn)
        if a < area_img * 0.0002 or a > area_img * 0.03: continue
        x, y, ww, hh = cv2.boundingRect(cn)
        if not (0.6 < ww / float(hh) < 1.6): continue
        if a / float(ww * hh) < 0.6: continue
        approx = cv2.approxPolyDP(cn, 0.06 * cv2.arcLength(cn, True), True)
        if len(approx) != 4: continue
        has_hole = hier[0][i][2] != -1
        M = cv2.moments(cn)
        cand.append((a, (M['m10'] / M['m00'], M['m01'] / M['m00']), has_hole))
    if len(cand) < 4: return None
    P = np.array([c[1] for c in cand]); sm = P.sum(1); df = P[:, 0] - P[:, 1]
    idx = [int(np.argmin(sm)), int(np.argmax(df)), int(np.argmax(sm)), int(np.argmin(df))]        # TL, TR, BR, BL
    if len(set(idx)) < 4: return None
    comb = [cand[k] for k in idx]
    sizes = [c[0] for c in comb]
    if max(sizes) / min(sizes) > 3.5: return None
    pts = [(c[1][0] / scale, c[1][1] / scale) for c in comb]; holes = [c[2] for c in comb]
    return pts, holes

def canonical_candidates(img_bgr, ppm=4):
    """возвращает список из 4 кандидатов-разверток (поворот на 0/90/180/270°); верный выбирается по коду бланка"""
    import cv2
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    r = find_marks(gray)
    if r is None: return [], 'метки не найдены'
    pts, holes = r
    cx = np.mean([p[0] for p in pts]); cy = np.mean([p[1] for p in pts])
    order = sorted(pts, key=lambda p: math.atan2(p[1] - cy, p[0] - cx))          # по часовой стрелке на экране
    k0 = min(range(4), key=lambda i: order[i][0] + order[i][1])
    order = order[k0:] + order[:k0]                                                 # TL, TR, BR, BL
    W, Hh = PAGE
    dst = np.array([MARKS['TL'], MARKS['TR'], MARKS['BL'], MARKS['BR']], dtype='float32') * ppm
    out = []
    for rot in range(4):
        o = order[rot:] + order[:rot]
        src = np.array([o[0], o[1], o[3], o[2]], dtype='float32')
        Mx = cv2.getPerspectiveTransform(src, dst)
        out.append(cv2.warpPerspective(gray, Mx, (int(W * ppm), int(Hh * ppm)), flags=cv2.INTER_AREA, borderValue=255))
    return out, 'ok'

def _bits(th, g, ppm):
    bits = []
    for c in g['id_cells']:
        x0, y0 = int((c['x'] + 1.5) * ppm), int((c['y'] + 1.5) * ppm); x1, y1 = int((c['x'] + c['w'] - 1.5) * ppm), int((c['y'] + c['h'] - 1.5) * ppm)
        roi = th[y0:y1, x0:x1]; bits.append(1 if roi.mean() / 255.0 > 0.5 else 0)
    return bits

def read_sheet(img_bgr, n_items, thr_mark=0.45, thr_blank=0.22):
    import cv2
    ppm = 4
    cands, info = canonical_candidates(img_bgr, ppm)
    if not cands: return dict(status='REVIEW', reason=info)
    g = geometry(n_items); th = None; dec = None; bits = None
    for warped in cands:
        bl = cv2.GaussianBlur(warped, (3, 3), 0)
        t = cv2.adaptiveThreshold(bl, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 41, 14)
        bt = _bits(t, g, ppm); d = decode_bits(bt)
        if d is not None: th, dec, bits = t, d, bt; break
    if th is None: return dict(status='REVIEW', reason='код бланка не распознан ни в одной ориентации')
    res = dict(status='OK', id_bits=bits, template=dec[0], variant=dec[1], answers=[], flags=[])
    yy, xx = np.mgrid[0:th.shape[0], 0:th.shape[1]]
    for row in g['rows']:
        fills = []
        for o in row['options']:
            cx, cy = o['x'] * ppm, o['y'] * ppm; r = o['r'] * ppm * 0.78
            x0, x1, y0, y1 = int(cx - r - 1), int(cx + r + 2), int(cy - r - 1), int(cy + r + 2)
            sub = th[y0:y1, x0:x1]; Y, X = np.mgrid[y0:y1, x0:x1]
            mask = (X - cx) ** 2 + (Y - cy) ** 2 <= r * r
            fills.append(float(sub[mask[:sub.shape[0], :sub.shape[1]]].mean() / 255.0))
        marked = [k for k, f in enumerate(fills) if f >= thr_mark]
        weak = [k for k, f in enumerate(fills) if thr_blank <= f < thr_mark]
        if len(marked) == 1 and not weak: ans, st = LETTERS[marked[0]], 'ok'
        elif len(marked) == 0 and not weak: ans, st = None, 'blank'
        elif len(marked) >= 2: ans, st = None, 'multi'
        else: ans, st = None, 'doubtful'
        res['answers'].append(dict(item=row['item'], answer=ans, status=st, fills=[round(f, 2) for f in fills]))
    if any(a['status'] in ('doubtful',) for a in res['answers']): res['flags'].append('есть сомнительные заполнения (REVIEW)')
    return res
