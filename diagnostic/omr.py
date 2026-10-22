# -*- coding: utf-8 -*-
"""OMR-бланк ответов: геометрия, рисование (reportlab), распознавание по фото (OpenCV).
Версия 2.0: на одном фото может быть НЕСКОЛЬКО бланков (1–6), в любой ориентации (0/90/180/270° и под углом).
Запуск:  python omr.py фото_или_папка [...] --db Diagnostic_DB.json [--db Diagnostic_DB_oblegchennaya.json] -o результат
Требуется: Python 3.9+, numpy, opencv-python-headless.
Единица измерения геометрии — миллиметры, начало координат в левом верхнем углу листа A4 (210×297 мм)."""
import json, math, sys, os, glob, csv, base64, argparse, html as _html
import numpy as np
VERSION = 'OMR-A4-v1.0'      # версия бланка (геометрия); версия программы — см. PROGRAM_VERSION
PROGRAM_VERSION = 'omr.py 2.0'
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

# ============================================================================ распознавание
def _read_gray(img):
    import cv2
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img

def mark_candidates(gray, work=1800):
    """Квадратные чёрные блоки (кандидаты в регистрационные метки): [(площадь_px, (cx, cy), has_hole)] в координатах исходного изображения."""
    import cv2
    h, w = gray.shape; k = min(1.0, work / float(max(h, w)))
    g = cv2.resize(gray, None, fx=k, fy=k, interpolation=cv2.INTER_AREA) if k < 1 else gray.copy()
    bl = cv2.GaussianBlur(g, (5, 5), 0)
    blk = int(0.055 * max(g.shape)) | 1                                  # окно порога пропорционально размеру кадра (метка должна быть меньше окна)
    th = cv2.adaptiveThreshold(bl, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, blk, 12)
    cnts, hier = cv2.findContours(th, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    A = g.shape[0] * g.shape[1]; out = []
    for i, cn in enumerate(cnts):
        if hier[0][i][3] != -1: continue
        a = cv2.contourArea(cn)
        if a < A * 0.00008 or a > A * 0.03: continue
        x, y, ww, hh = cv2.boundingRect(cn)
        if not (0.6 < ww / float(hh) < 1.6) or a / float(ww * hh) < 0.6: continue
        if len(cv2.approxPolyDP(cn, 0.06 * cv2.arcLength(cn, True), True)) != 4: continue
        M = cv2.moments(cn)
        if M['m00'] == 0: continue
        # зона тишины: вокруг настоящей метки почти белое поле (у ячеек кода и кружков рядом чернила)
        pad = int(0.45 * max(ww, hh)); X0_, Y0_, X1_, Y1_ = max(0, x - pad), max(0, y - pad), min(th.shape[1], x + ww + pad), min(th.shape[0], y + hh + pad)
        big = th[Y0_:Y1_, X0_:X1_]; inner = th[y:y + hh, x:x + ww]
        ring_area = big.size - inner.size
        if ring_area > 0 and (float(big.sum() - inner.sum()) / 255.0) / ring_area > 0.12: continue
        out.append((a / (k * k), (M['m10'] / M['m00'] / k, M['m01'] / M['m00'] / k), hier[0][i][2] != -1))
    if not out: return []
    mx = max(c[0] for c in out)
    return [c for c in out if c[0] >= 0.38 * mx]          # убираем мелкие квадраты (ячейки кода и т. п.)

def _search_quads(P, AR, allowed, aspect_tol, size_tol, area_ratio):
    import cv2, itertools
    expect = (MARKS['BL'][1] - MARKS['TL'][1]) / (MARKS['TR'][0] - MARKS['TL'][0])         # длинная/короткая сторона
    n = len(P); good = []
    for comb in itertools.combinations(allowed, 4):
        ar = AR[list(comb)]
        if ar.max() / ar.min() > area_ratio: continue
        pts = P[list(comb)]; c = pts.mean(0); order = sorted(range(4), key=lambda q: math.atan2(pts[q][1] - c[1], pts[q][0] - c[0])); q = pts[order]
        e = [np.linalg.norm(q[(i + 1) % 4] - q[i]) for i in range(4)]
        if min(e) < 1e-6 or not (0.55 < e[0] / e[2] < 1.8 and 0.55 < e[1] / e[3] < 1.8): continue
        ok = True
        for i in range(4):
            v1, v2 = q[(i - 1) % 4] - q[i], q[(i + 1) % 4] - q[i]
            if abs(float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2)))) > 0.55: ok = False; break
        if not ok: continue
        l, sh = max(e[0] + e[2], e[1] + e[3]) / 2, min(e[0] + e[2], e[1] + e[3]) / 2
        if abs(l / sh - expect) > aspect_tol: continue
        sc_ = math.sqrt(float(np.median(ar))) / MARK                           # px на мм по размеру меток
        if abs(sh / (sc_ * (MARKS['TR'][0] - MARKS['TL'][0])) - 1) > size_tol or abs(l / (sc_ * (MARKS['BL'][1] - MARKS['TL'][1])) - 1) > size_tol: continue
        cnt = q.astype('float32').reshape(-1, 1, 2)
        if any(cv2.pointPolygonTest(cnt, (float(P[m][0]), float(P[m][1])), True) > -0.05 * sh for m in range(n) if m not in comb and AR[m] >= 0.7 * float(np.median(ar))): continue
        good.append((cv2.contourArea(cnt), frozenset(comb), q))
    good.sort(key=lambda t: -t[0]); taken = set(); res = []
    for area_q, key, q in good:
        if key & taken: continue
        taken |= key; res.append((key, q))
    return res

def find_sheets(gray):
    """Находит все бланки на изображении: список четвёрок углов (по часовой стрелке) в координатах изображения.
    Четвёрка меток принимается, если это выпуклый почти-прямоугольник с пропорцией листа A4 (в любой ориентации) без других меток внутри/на сторонах.
    Проход 1 — строгие допуски (исключает ложные «сборные» четвёрки из меток соседних бланков); проход 2 — мягкие допуски для сильной перспективы, только по оставшимся меткам."""
    cands = mark_candidates(gray)
    if len(cands) < 4: return []
    cands = sorted(cands, key=lambda c: -c[0])[:20]
    P = np.array([c[1] for c in cands], dtype='float64'); AR = np.array([c[0] for c in cands])
    r1 = _search_quads(P, AR, list(range(len(P))), 0.27, 0.25, 1.7)
    used = set().union(*[k for k, _ in r1]) if r1 else set()
    rest = [i for i in range(len(P)) if i not in used]
    r2 = _search_quads(P, AR, rest, 0.45, 0.35, 2.4) if len(rest) >= 4 else []
    return [q for _, q in r1] + [q for _, q in r2]

def warp_candidates(gray, quad, ppm=6):
    """Развёртки одного бланка (две возможные ориентации: нормальная и вверх ногами) — верная выбирается по служебному коду."""
    import cv2
    W, Hh = PAGE
    dst = np.array([MARKS['TL'], MARKS['TR'], MARKS['BR'], MARKS['BL']], dtype='float32') * ppm
    q = np.array(quad, dtype='float32'); k0 = int(np.argmin(q.sum(1)))
    out = []
    for rot in range(4):
        o = np.roll(q, -(k0 + rot), axis=0)                                     # o[0] -> TL, o[1] -> TR, o[2] -> BR, o[3] -> BL
        e1, e2 = np.linalg.norm(o[1] - o[0]), np.linalg.norm(o[2] - o[1])
        if e1 > e2: continue                                                     # первое ребро (TL→TR) обязано быть короче
        Mx = cv2.getPerspectiveTransform(o.astype('float32'), dst)
        out.append(cv2.warpPerspective(gray, Mx, (int(W * ppm), int(Hh * ppm)), flags=cv2.INTER_AREA, borderValue=255))
    return out

def _bits(th, g, ppm):
    bits = []
    for c in g['id_cells']:
        x0, y0 = int((c['x'] + 1.2) * ppm), int((c['y'] + 1.2) * ppm); x1, y1 = int((c['x'] + c['w'] - 1.2) * ppm), int((c['y'] + c['h'] - 1.2) * ppm)
        bits.append(1 if th[y0:y1, x0:x1].mean() / 255.0 > 0.5 else 0)
    return bits

def _binarize(warped):
    import cv2
    return cv2.adaptiveThreshold(cv2.GaussianBlur(warped, (3, 3), 0), 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 41, 14)

def _read_bubbles(th, rows, ppm, thr_mark=0.45, thr_blank=0.22):
    answers = []
    for row in rows:
        fills = []
        for o in row['options']:
            cx, cy = o['x'] * ppm, o['y'] * ppm; r = o['r'] * ppm * 0.78
            x0, x1, y0, y1 = int(cx - r - 1), int(cx + r + 2), int(cy - r - 1), int(cy + r + 2)
            sub = th[y0:y1, x0:x1]; Y, X = np.mgrid[y0:y1, x0:x1]
            mask = ((X - cx) ** 2 + (Y - cy) ** 2 <= r * r)[:sub.shape[0], :sub.shape[1]]
            fills.append(float(sub[mask].mean() / 255.0) if mask.any() else 0.0)
        base = float(np.median(fills))
        if min(fills) >= 0.6: marked, weak = list(range(4)), []
        else:
            marked = [k for k, f in enumerate(fills) if f >= thr_mark and f - base >= 0.3]
            weak = [k for k, f in enumerate(fills) if k not in marked and f - base >= 0.12 and f >= thr_blank]
        if len(marked) == 1 and not weak: ans, st = LETTERS[marked[0]], 'ok'
        elif len(marked) == 0 and not weak: ans, st = None, 'blank'
        elif len(marked) >= 2: ans, st = None, 'multi'
        else: ans, st = None, 'doubtful'
        answers.append(dict(item=row['item'], answer=ans, status=st, fills=[round(f, 2) for f in fills]))
    return answers

def read_sheet(img_bgr, geo, thr_mark=0.45, thr_blank=0.22):
    """Совместимый режим: на изображении ОДИН бланк, геометрия известна (geo['rows'])."""
    ppm = 6; gray = _read_gray(img_bgr); quads = find_sheets(gray)
    if not quads: return dict(status='REVIEW', reason='метки не найдены')
    g = dict(base_geometry(), rows=geo['rows'])
    for w in warp_candidates(gray, quads[0], ppm):
        th = _binarize(w); bits = _bits(th, g, ppm); d = decode_bits(bits)
        if d is not None:
            return dict(status='OK', id_bits=bits, template=d[0], variant=d[1], answers=_read_bubbles(th, geo['rows'], ppm, thr_mark, thr_blank), flags=[])
    return dict(status='REVIEW', reason='код бланка не распознан ни в одной ориентации')

# ----------------------------------------------------------------------------- база и оценивание
def load_dbs(paths):
    works = {}; scale = None; meta = {}
    for p in paths:
        d = json.load(open(p, encoding='utf8'))
        for w in d['works']: works[w['template_index']] = w
        scale = scale or d['meta'].get('scale')
    scale = sorted(scale or [dict(mark=5, min_pct=85), dict(mark=4, min_pct=65), dict(mark=3, min_pct=40), dict(mark=2, min_pct=0)], key=lambda x: -x['min_pct'])
    return works, scale

def mark_for(pct, scale):
    for s in scale:
        if pct >= s['min_pct']: return s['mark']
    return scale[-1]['mark']

def _crop(warped, x, y, w, h, ppm=6):
    import cv2
    return warped[int(y * ppm):int((y + h) * ppm), int(x * ppm):int((x + w) * ppm)]

def read_photo(img_bgr, works, scale, ppm=6, debug=True):
    """Все бланки одного фото. Возвращает список результатов (в порядке: сверху вниз, затем слева направо)."""
    import cv2
    gray = _read_gray(img_bgr); quads = find_sheets(gray); results = []
    cands = mark_candidates(gray)
    if cands:
        mxa = max(c[0] for c in cands); med = float(np.median([c[0] for c in cands if c[0] >= 0.6 * mxa]))
        used = [np.array(q) for q in quads]
        left = [c for c in cands if c[0] >= 0.7 * med and not any(np.min(np.linalg.norm(u - np.array(c[1]), axis=1)) < 0.5 * math.sqrt(c[0]) for u in used)]
        if len(left) >= 2:
            results.append(dict(centroid=tuple(np.mean([c[1] for c in left], axis=0)), status='REVIEW', template=None, variant=None, flags=['найдено меток вне распознанных бланков: %d — возможно, бланк обрезан рамкой фото или закрыт; переснимите' % len(left)]))
    for quad in quads:
        cx, cy = np.array(quad).mean(0)
        r = dict(centroid=(float(cx), float(cy)), status='OK', flags=[], template=None, variant=None)
        chosen = None
        for w in warp_candidates(gray, quad, ppm):
            th = _binarize(w); bits = _bits(th, base_geometry(), ppm); d = decode_bits(bits)
            if d is not None: chosen = (w, th, d, bits); break
        if chosen is None:
            r.update(status='REVIEW', flags=['код бланка не распознан (не тот бланк, закрыт код или плохое фото)']); results.append(r); continue
        w, th, (t, v), bits = chosen
        r.update(template=t, variant=v)
        work = works.get(t)
        if work is None:
            r.update(status='REVIEW', flags=['шаблон %d не найден в базе (подключите нужный --db)' % t]); results.append(r); continue
        geo = work['omr_geometry'][str(v)]
        ans = _read_bubbles(th, geo['rows'], ppm)
        pts = 0; mx = 0; wrong = []; amap = {}
        for a, it in zip(ans, work['items']):
            key = it['variants'][str(v)]['key']; p = it['points']; mx += p
            ok_ = a['answer'] == key; a['key'] = key; a['points'] = p if ok_ else 0; a['correct'] = ok_; pts += a['points']
            amap[it['no']] = a
        pct = round(100.0 * pts / mx, 1) if mx else 0.0
        astr = ' '.join('%d%s' % (a['item'], a['answer'] if a['status'] == 'ok' else {'blank': '—', 'multi': '(несколько)', 'doubtful': '?'}[a['status']]) for a in ans)
        # цели
        goals = {}
        for it in work['items']:
            a = amap[it['no']]; g = goals.setdefault(it['goal'], [0, 0]); g[1] += 1; g[0] += 1 if a['correct'] else 0
        gl = {g: ('освоена' if c == n else 'пробел' if c == 0 else 'частично') for g, (c, n) in goals.items()}
        flags = r['flags']
        if any(a['status'] == 'doubtful' for a in ans): flags.append('сомнительные кружки: ' + ','.join(str(a['item']) for a in ans if a['status'] == 'doubtful'))
        if any(a['status'] == 'multi' for a in ans): flags.append('несколько отметок: ' + ','.join(str(a['item']) for a in ans if a['status'] == 'multi'))
        r.update(work=work['id'], title=work['title'], answers=ans, answers_str=astr, points=pts, max_points=mx, percent=pct, mark=mark_for(pct, scale), goals=gl,
                 crops=dict(fio=_crop(w, 17, 24, 108, 8), klass=_crop(w, 128, 24, 38, 8)))
        if any(f for f in flags): r['status'] = 'REVIEW'
        if debug:
            vis = cv2.cvtColor(w, cv2.COLOR_GRAY2BGR)
            for row, a in zip(geo['rows'], ans):
                for o in row['options']:
                    col = (0, 160, 0) if (a['answer'] == o['letter'] and a['status'] == 'ok') else ((0, 0, 220) if a['status'] in ('multi', 'doubtful') and max(a['fills']) > 0.3 and a['fills'][LETTERS.index(o['letter'])] > 0.3 else None)
                    if col: cv2.circle(vis, (int(o['x'] * ppm), int(o['y'] * ppm)), int(o['r'] * ppm * 1.5), col, 3)
            r['debug'] = vis
        results.append(r)
    # порядок: ряды сверху вниз, внутри ряда слева направо
    if results:
        hs = np.median([np.linalg.norm(np.array(q[0]) - np.array(q[3])) for q in quads]) if quads else 1000.0
        results.sort(key=lambda x: (round(x['centroid'][1] / (0.6 * hs)), x['centroid'][0]))
    return results

# ----------------------------------------------------------------------------- командная строка
def main():
    import cv2
    ap = argparse.ArgumentParser(description='Проверка бланков СОР/СОЧ по фотографиям (до 4–6 бланков на фото)')
    ap.add_argument('inputs', nargs='+', help='фото или папки с фото'); ap.add_argument('--db', action='append', required=True, help='Diagnostic_DB*.json (можно несколько)')
    ap.add_argument('-o', '--out', default='omr_result'); a = ap.parse_args()
    works, scale = load_dbs(a.db)
    files = []
    for p in a.inputs:
        files += sorted(glob.glob(os.path.join(p, '*'))) if os.path.isdir(p) else [p]
    files = [f for f in files if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff', '.webp'))]
    os.makedirs(a.out, exist_ok=True); os.makedirs(os.path.join(a.out, 'fio'), exist_ok=True); os.makedirs(os.path.join(a.out, 'debug'), exist_ok=True)
    rows = []; summary = []
    for f in files:
        img = cv2.imread(f)
        if img is None: summary.append((os.path.basename(f), 0, 'не открыт')); continue
        res = read_photo(img, works, scale)
        summary.append((os.path.basename(f), len(res), ''))
        for m, r in enumerate(res, 1):
            tag = '%s_%d' % (os.path.splitext(os.path.basename(f))[0], m)
            fio = klass = dbg = ''
            if 'crops' in r:
                cv2.imwrite(os.path.join(a.out, 'fio', tag + '_fio.png'), r['crops']['fio']); cv2.imwrite(os.path.join(a.out, 'fio', tag + '_class.png'), r['crops']['klass']); fio = 'fio/' + tag + '_fio.png'; klass = 'fio/' + tag + '_class.png'
                if 'debug' in r: cv2.imwrite(os.path.join(a.out, 'debug', tag + '.jpg'), r['debug']); dbg = 'debug/' + tag + '.jpg'
            rows.append(dict(photo=os.path.basename(f), sheet=m, template=r.get('template'), variant=r.get('variant'), work=r.get('work', ''), answers=r.get('answers_str', ''), points=r.get('points', ''), max=r.get('max_points', ''),
                             percent=r.get('percent', ''), mark=r.get('mark', ''), status=r['status'], flags='; '.join(r['flags']), goals='; '.join('%s: %s' % kv for kv in r.get('goals', {}).items()), fio=fio, klass=klass, debug=dbg, _r=r))
    cols = ['photo', 'sheet', 'work', 'variant', 'answers', 'points', 'max', 'percent', 'mark', 'status', 'flags', 'goals']
    with open(os.path.join(a.out, 'results.csv'), 'w', encoding='utf-8-sig', newline='') as fh:
        wr = csv.writer(fh, delimiter=';'); wr.writerow(cols + ['fio_image', 'class_image'])
        for r in rows: wr.writerow([r[c] for c in cols] + [r['fio'], r['klass']])
    json.dump([{k: v for k, v in r.items() if k != '_r'} | {'answers_detail': r['_r'].get('answers', [])} for r in rows], open(os.path.join(a.out, 'results.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    def img_tag(p):
        return '' if not p else '<img src="data:image/png;base64,%s" style="max-height:44px">' % base64.b64encode(open(os.path.join(a.out, p), 'rb').read()).decode()
    body = ''.join('<tr class="%s"><td>%s</td><td>%d</td><td>%s</td><td>%s</td><td>%s</td><td><code>%s</code></td><td>%s/%s</td><td>%s</td><td><b>%s</b></td><td>%s</td></tr>' % (
        'rv' if r['status'] != 'OK' else '', _html.escape(r['photo']), r['sheet'], img_tag(r['fio']), img_tag(r['klass']), _html.escape(r['work']) + (' в%s' % r['variant'] if r['variant'] else ''), _html.escape(r['answers']), r['points'], r['max'], r['percent'], r['mark'], _html.escape(r['flags']) or '') for r in rows)
    open(os.path.join(a.out, 'report.html'), 'w', encoding='utf8').write('<!doctype html><meta charset="utf-8"><title>Результаты проверки бланков</title><style>body{font:14px system-ui;margin:14px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:4px 6px;vertical-align:middle}th{background:#eef2f6}tr.rv{background:#fff4d6}@media print{button{display:none}}</style>'
        '<h2>Результаты проверки бланков</h2><button onclick="print()">Печать</button><p>Фамилия и класс на бланке программа не читает: сверьте по вырезкам (колонки 3–4). Жёлтые строки — нужна проверка учителя (REVIEW).</p>'
        '<table><tr><th>Фото</th><th>Бланк</th><th>Фамилия, имя</th><th>Класс</th><th>Работа</th><th>Строка ответов</th><th>Баллы</th><th>%</th><th>Отметка</th><th>Примечание</th></tr>' + body + '</table>')
    print('Фото: %d, бланков найдено: %d' % (len(files), len(rows)))
    for name, n, note in summary: print('  %s: бланков %d %s' % (name, n, note))
    print('Результаты:', os.path.join(a.out, 'results.csv'), '|', os.path.join(a.out, 'report.html'))

if __name__ == '__main__':
    main()
