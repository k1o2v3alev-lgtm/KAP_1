# -*- coding: utf-8 -*-
"""Самопроверка omr.py 2.0 на составных фото: 1–5 бланков, повороты 90/180/270°, перспектива, шум, тени."""
import sys, os, random, subprocess, json, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2
SRC = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build_lmd.py'), encoding='utf8').read().split('# ---------------- листы')[0]
ns = {'__file__': os.path.abspath(__file__)}; exec(SRC, ns)
import omr
DB1 = '/home/user/KAP_1/work/out2/Diagnostic_DB.json'; DB2 = '/home/user/KAP_1/work/out3/Diagnostic_DB_oblegchennaya.json'
works, scale = omr.load_dbs([DB1, DB2])
sheet = ns['sheet']; canvas = ns['canvas']; A4 = ns['A4']; DB_ITEMS = ns['DB_ITEMS']; TITLE = ns['TITLE']; WORKS = ns['WORKS']; LET = 'АБВГ'
TMP = '/tmp/omrtest'; shutil.rmtree(TMP, ignore_errors=True); os.makedirs(TMP)
rnd = random.Random(21)
def make_sheet(idx):
    wid, name, tidx, kind = WORKS[idx % 6]; n = rnd.randint(1, 4); its = DB_ITEMS[(wid, n)]; k = len(its)
    ans = {i: [rnd.randrange(4)] for i in range(1, k + 1)}; ans[k] = []; ans[k - 1] = [1, 2]
    c = canvas.Canvas(TMP + '/s.pdf', pagesize=A4); sheet.render_sheet(c, its, wid, name, tidx, n, answers=ans, title=TITLE[wid], tag='облегчённая программа', scale0=1.6); c.showPage(); c.save()
    subprocess.run(['pdftoppm', '-r', '110', '-png', '-singlefile', TMP + '/s.pdf', TMP + '/s'], check=True)
    return cv2.imread(TMP + '/s.png'), dict(template=tidx, variant=n, ans=ans, k=k)
def compose(sheets, layout, rots, seed, persp=0.02):
    r = np.random.RandomState(seed); H = W = max(max(i.shape[:2]) for i in sheets) + 40
    rows, cols = layout; canvas_ = np.full((rows * H + 40, cols * W + 40, 3), (70, 80, 90), np.uint8); sh = []
    for k, im in enumerate(sheets):
        if rots[k]: im = cv2.rotate(im, rots[k])
        h, w = im.shape[:2]; rr, cc = divmod(k, cols); y0, x0 = 20 + rr * H + (H - h) // 2, 20 + cc * W + (W - w) // 2
        canvas_[y0:y0 + h, x0:x0 + w] = im
    h, w = canvas_.shape[:2]; src = np.float32([[0, 0], [w, 0], [0, h], [w, h]]); dst = src + np.float32([[r.uniform(-persp, persp) * w, r.uniform(-persp, persp) * h] for _ in range(4)])
    out = cv2.warpPerspective(canvas_, cv2.getPerspectiveTransform(src, dst), (w, h), borderValue=(70, 80, 90))
    gx = np.linspace(r.uniform(0.75, 0.95), 1.05, w)[None, :, None]; out = np.clip(out.astype(np.float32) * gx + r.normal(0, 5, out.shape), 0, 255).astype(np.uint8)
    return cv2.GaussianBlur(out, (0, 0), 1.0)
ROT = [None, cv2.ROTATE_90_CLOCKWISE, cv2.ROTATE_180, cv2.ROTATE_90_COUNTERCLOCKWISE]
cases = [('1 бланк', 1, (1, 1)), ('2 бланка рядом', 2, (1, 2)), ('3 бланка', 3, (1, 3)), ('2x2', 4, (2, 2)), ('1 бланк, 90°', 1, (1, 1)), ('2 бланка друг под другом', 2, (2, 1)), ('3 бланка с поворотами', 3, (1, 3)), ('2x2 с поворотами', 4, (2, 2))]
tot = ok = 0; log = []
for ci, (name, ns_, layout) in enumerate(cases):
    for rep in range(5):
        sheets = []; truth = []
        for k in range(ns_):
            im, t = make_sheet(ci * 7 + rep * 3 + k); sheets.append(im); truth.append(t)
        rots = [ROT[(ci + k + rep) % 4] if ('поворот' in name or '90' in name) else None for k in range(ns_)]
        img = compose(sheets, layout, rots, 100 + ci * 10 + rep)
        if ci in (3, 7) and rep == 0: cv2.imwrite('/tmp/omrtest/photo_%d.jpg' % ci, img)
        res = omr.read_photo(img, works, scale, debug=False)
        good = len(res) == ns_
        if good:
            # сопоставить по (template, variant): все пары уникальны? иначе по порядку
            for t in truth:
                m = [r for r in res if r['template'] == t['template'] and r['variant'] == t['variant']]
                if not m: good = False; break
                r = m[0]
                for a in r['answers']:
                    e = t['ans'][a['item']]
                    if len(e) == 0: good &= a['status'] == 'blank'
                    elif len(e) == 2: good &= a['status'] == 'multi'
                    else: good &= a['status'] == 'ok' and a['answer'] == LET[e[0]]
        if not good:
            cv2.imwrite('/tmp/omrtest/fail_%d_%d.jpg' % (ci, rep), img); g_ = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); print('FAIL', name, rep, img.shape, 'cands', [round(c[0]) for c in omr.mark_candidates(g_)], 'quads', len(omr.find_sheets(g_)), [ (r['status'], r.get('flags')) for r in res])
        tot += 1; ok += good; log.append((name, rep, len(res), ns_, good))
print('составных фото:', tot, ' без ошибок:', ok)
for l in log: print(l)
json.dump(dict(photos=tot, ok=ok, cases=[dict(case=l[0], rep=l[1], found=l[2], expected=l[3], ok=bool(l[4])) for l in log]), open('/home/user/KAP_1/work/out2/omr_selftest_multi.json', 'w'), ensure_ascii=False, indent=1)
