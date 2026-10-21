# -*- coding: utf-8 -*-
"""OMR-бланк ответов: геометрия, рисование (reportlab), распознавание по фото (OpenCV).
Единица измерения геометрии — миллиметры, начало координат в левом верхнем углу листа A4 (210×297 мм)."""
import json, math, sys
import numpy as np
VERSION = 'OMR-A4-v1.0'
PAGE = (210.0, 297.0)
MARK = 8.0                      # сторона регистрационной метки
MARKS = {'TL': (12.0, 12.0), 'TR': (198.0, 12.0), 'BL': (12.0, 285.0), 'BR': (198.0, 285.0)}   # центры; BR — «рамка» (с белым отверстием)
ID_CELLS = dict(x0=17.0, y=33.0, w=4.6, h=4.6, gap=1.0, n=12)      # 12 ячеек служебного кода в шапке
LETTERS = 'АБВГ'
BUB_R = 2.3

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

def base_geometry():
    return dict(version=VERSION, page_mm=list(PAGE), marks={k: dict(cx=v[0], cy=v[1], size=MARK, kind=('ring' if k == 'BR' else 'solid')) for k, v in MARKS.items()},
                id_cells=[dict(index=i, x=ID_CELLS['x0'] + i * (ID_CELLS['w'] + ID_CELLS['gap']), y=ID_CELLS['y'], w=ID_CELLS['w'], h=ID_CELLS['h']) for i in range(ID_CELLS['n'])],
                bubble_radius_mm=BUB_R, recognition=dict(fill_marked=0.45, fill_blank=0.22, canonical_px_per_mm=6))

def draw_marks(c, mm_, H):
    from reportlab.lib import colors
    c.setFillColor(colors.black)
    for k, (cx, cy) in MARKS.items():
        s_ = MARK
        c.rect((cx - s_ / 2) * mm_, (H - cy - s_ / 2) * mm_, s_ * mm_, s_ * mm_, fill=1, stroke=0)
        if k == 'BR':
            c.setFillColor(colors.white); c.rect((cx - s_ / 4) * mm_, (H - cy - s_ / 4) * mm_, s_ / 2 * mm_, s_ / 2 * mm_, fill=1, stroke=0); c.setFillColor(colors.black)

def draw_id(c, mm_, H, template_idx, variant):
    from reportlab.lib import colors
    g = base_geometry(); c.setStrokeColor(colors.black); c.setFillColor(colors.black)
    for cell, b in zip(g['id_cells'], id_bits(template_idx, variant)):
        c.setLineWidth(0.4); c.rect(cell['x'] * mm_, (H - cell['y'] - cell['h']) * mm_, cell['w'] * mm_, cell['h'] * mm_, fill=1 if b else 0, stroke=1)

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

def canonical_candidates(img_bgr, ppm=6):
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

def read_sheet(img_bgr, geo, thr_mark=0.45, thr_blank=0.22):
    import cv2
    ppm = 6
    cands, info = canonical_candidates(img_bgr, ppm)
    if not cands: return dict(status='REVIEW', reason=info)
    g = dict(base_geometry(), rows=geo['rows']); th = None; dec = None; bits = None
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
        base = float(np.median(fills))
        if min(fills) >= 0.6: marked, weak = list(range(4)), []
        else:
            marked = [k for k, f in enumerate(fills) if f >= thr_mark and f - base >= 0.3]
            weak = [k for k, f in enumerate(fills) if k not in marked and f - base >= 0.12 and f >= thr_blank]
        if len(marked) == 1 and not weak: ans, st = LETTERS[marked[0]], 'ok'
        elif len(marked) == 0 and not weak: ans, st = None, 'blank'
        elif len(marked) >= 2: ans, st = None, 'multi'
        else: ans, st = None, 'doubtful'
        res['answers'].append(dict(item=row['item'], answer=ans, status=st, fills=[round(f, 2) for f in fills]))
    if any(a['status'] in ('doubtful',) for a in res['answers']): res['flags'].append('есть сомнительные заполнения (REVIEW)')
    return res
