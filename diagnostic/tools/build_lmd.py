# -*- coding: utf-8 -*-
import sys, os, json, re, random, collections, datetime, subprocess, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2
import dg_lmd, omr, figs, sheet
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

OUT = '/home/user/KAP_1/work/out3'; os.makedirs(OUT, exist_ok=True)
FD = '/usr/share/fonts/truetype/dejavu/'
pdfmetrics.registerFont(TTFont('DV', FD + 'DejaVuSans.ttf')); pdfmetrics.registerFont(TTFont('DVB', FD + 'DejaVuSans-Bold.ttf'))
LET = 'АБВГ'
WORKS = [('LMD-SOR-1', 'Числа в пределах 10 000', 7, 'СОР'), ('LMD-SOR-2', 'Величины. Текстовые задачи', 8, 'СОР'), ('LMD-SOR-3', 'Умножение и деление', 9, 'СОР'),
         ('LMD-SOR-4', 'Доли и обыкновенные дроби', 10, 'СОР'), ('LMD-SOCH-Q1', '1 четверть', 11, 'СОЧ'), ('LMD-SOCH-Q2', '2 четверть', 12, 'СОЧ')]
TITLE = {w[0]: ('Суммативное оценивание за раздел «%s»' % w[1]) if w[3] == 'СОР' else ('Суммативное оценивание за %s' % w[1]) for w in WORKS}
TAG = 'облегчённая программа'

def assign(items, seed):
    rnd = random.Random(seed); cnt = collections.Counter(); seq = []
    for i, it in enumerate(items):
        mn = min(cnt[k] for k in range(4)); cands = [k for k in range(4) if cnt[k] == mn]
        prev = seq[-2:]
        good = [k for k in cands if not (len(prev) == 2 and prev[0] == prev[1] == k)]
        pick = rnd.choice(good or cands); cnt[pick] += 1; seq.append(pick)
    for it, pos in zip(items, seq):
        correct = [o for o, c in it['options'] if c][0]; wr = [o for o, c in it['options'] if not c]; rnd.shuffle(wr)
        it['opt_texts'] = wr[:pos] + [correct] + wr[pos:]; it['key'] = pos

DB_ITEMS = {}
for wid, f in dg_lmd.GEN.items():
    for n in (1, 2, 3, 4):
        its = f(n); assign(its, sum(map(ord, wid)) * 17 + n * 4243); DB_ITEMS[(wid, n)] = its
CHK = []
def chk(name, ok, info=''):
    CHK.append(dict(check=name, result='PASS' if ok else 'FAIL', info=info)); assert ok, (name, info)
for (wid, n), its in DB_ITEMS.items():
    for it in its:
        o = it['opt_texts']
        chk('%s в%d №%d: 4 различных варианта' % (wid, n, it['no']), len(set(o)) == 4)
        chk('%s в%d №%d: один верный на своей позиции' % (wid, n, it['no']), sum(c for _, c in it['options']) == 1 and o[it['key']] == [x for x, c in it['options'] if c][0])
for wid, *_ in WORKS:
    for n in (1, 2, 3, 4):
        ks = [it['key'] for it in DB_ITEMS[(wid, n)]]; c = collections.Counter(ks)
        chk('%s в%d: баланс позиций' % (wid, n), max(c.values()) - min(c.get(k, 0) for k in range(4)) <= 2, str(dict(c)))
        chk('%s в%d: нет трёх одинаковых подряд' % (wid, n), not any(a == b == c_ for a, b, c_ in zip(ks, ks[1:], ks[2:])))
    base = [(it['goal'], it['skill']) for it in DB_ITEMS[(wid, 1)]]
    for n in (2, 3, 4): chk('%s: структура варианта %d = варианту 1' % (wid, n), [(it['goal'], it['skill']) for it in DB_ITEMS[(wid, n)]] == base)

# ---------------- независимая проверка арифметики: пересчёт ответа из текста условия
import math
def val_of(txt):
    return int(txt.replace(' ', '').replace(' ', ''))
for (wid, n), its in DB_ITEMS.items():
    for it in its:
        st = it['stem'].replace(' ', ''); ans = it['opt_texts'][it['key']].replace(' ', '')
        m = re.match(r'Вычислите: (\d+) ([+−·:]) (\d+)\.$', st)
        if m:
            a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
            exp = {'+': a + b, '−': a - b, '·': a * b, ':': a // b}[op]
            chk('%s в%d №%d: пересчёт «%s»' % (wid, n, it['no'], st), int(ans) == exp and (op != ':' or a % b == 0), str(exp))
        m = re.match(r'Чему равно x, если x \+ (\d+) = (\d+)\?', st)
        if m: chk('%s в%d №%d: x+a=b' % (wid, n, it['no']), int(ans) == int(m.group(2)) - int(m.group(1)))
        m = re.match(r'Чему равно x, если x · (\d+) = (\d+)\?', st)
        if m: chk('%s в%d №%d: x·a=b' % (wid, n, it['no']), int(ans) * int(m.group(1)) == int(m.group(2)))
        m = re.match(r'Какое из чисел делится на (\d+)\?', st)
        if m: chk('%s в%d №%d: признак делимости' % (wid, n, it['no']), int(ans) % int(m.group(1)) == 0 and all(int(x[0].replace(' ', '')) % int(m.group(1)) != 0 for x in it['options'] if not x[1]))
        m = re.match(r'Округлите число (\d+) до сотен\.', st)
        if m: chk('%s в%d №%d: округление' % (wid, n, it['no']), int(ans) == int(m.group(1)) // 100 * 100 + (100 if int(m.group(1)) % 100 >= 50 else 0))

# ---------------- листы
GEO = {}
c = canvas.Canvas(OUT + '/Student_Tests_oblegchennaya.pdf', pagesize=A4); c.setTitle('Суммативное оценивание, облегчённая программа')
for wid, name, tidx, kind in WORKS:
    for n in (1, 2, 3, 4):
        GEO[(wid, n)] = sheet.render_sheet(c, DB_ITEMS[(wid, n)], wid, name, tidx, n, title=TITLE[wid], tag=TAG, scale0=1.6); c.showPage()
c.save()

def render_png(pdf, prefix, dpi=170):
    subprocess.run(['pdftoppm', '-r', str(dpi), '-png', '-singlefile', pdf, prefix], check=True); return prefix + '.png'
def distort(img, seed, strength=1.0):
    rnd = np.random.RandomState(seed); h, w = img.shape[:2]
    bg = np.full((int(h * 1.25), int(w * 1.25), 3), (70, 90, 110), np.uint8); oy, ox = int(h * .125), int(w * .125); bg[oy:oy + h, ox:ox + w] = img
    H_, W_ = bg.shape[:2]; src = np.float32([[ox, oy], [ox + w, oy], [ox, oy + h], [ox + w, oy + h]])
    j = lambda: rnd.uniform(-0.07, 0.07, 2) * np.array([w, h]) * strength
    M = cv2.getPerspectiveTransform(src, src + np.float32([j() for _ in range(4)])); R = cv2.getRotationMatrix2D((W_ / 2, H_ / 2), rnd.uniform(-6, 6) * strength, 1.0)
    out = cv2.warpAffine(cv2.warpPerspective(bg, M, (W_, H_), borderValue=(70, 90, 110)), R, (W_, H_), borderValue=(70, 90, 110))
    gx = np.linspace(rnd.uniform(0.65, 0.95), rnd.uniform(0.9, 1.1), W_)[None, :, None]; out = np.clip(out.astype(np.float32) * gx, 0, 255) + rnd.normal(0, 6 * strength, out.shape)
    out = cv2.GaussianBlur(np.clip(out, 0, 255).astype(np.uint8), (0, 0), 1.0 + 0.5 * strength); ok, enc = cv2.imencode('.jpg', out, [cv2.IMWRITE_JPEG_QUALITY, 70]); return cv2.imdecode(enc, 1), enc
rnd = random.Random(9); ok_n = 0; tot_n = 0; fails = []
os.makedirs(OUT + '/_tmp', exist_ok=True)
for wid, name, tidx, kind in WORKS:
    for n in (1, 2, 3, 4):
        k = len(DB_ITEMS[(wid, n)]); ans = {i: [rnd.randrange(4)] for i in range(1, k + 1)}
        if k >= 6: ans[k - 1] = []; ans[k - 2] = [0, 3]          # пропуск и двойная отметка
        cc = canvas.Canvas(OUT + '/_tmp/s.pdf', pagesize=A4); g = sheet.render_sheet(cc, DB_ITEMS[(wid, n)], wid, name, tidx, n, answers=ans, title=TITLE[wid], tag=TAG, scale0=1.6); cc.showPage(); cc.save()
        im, _ = distort(cv2.imread(render_png(OUT + '/_tmp/s.pdf', OUT + '/_tmp/s')), tot_n + 3, 1.0 if tot_n % 3 else 1.5)
        r = omr.read_sheet(im, g); tot_n += 1
        good = r.get('status') == 'OK' and (r['template'], r['variant']) == (tidx, n)
        if good:
            for a in r['answers']:
                it = a['item']; exp = ans[it]
                if len(exp) == 0: good &= a['status'] == 'blank'
                elif len(exp) == 2: good &= a['status'] == 'multi'
                else: good &= a['status'] == 'ok' and a['answer'] == LET[exp[0]]
        ok_n += good
        if not good: fails.append('%s в%d' % (wid, n))
        if wid == 'LMD-SOR-1' and n == 1:
            ok_, enc = cv2.imencode('.jpg', im); open(OUT + '/OMR_selftest_photo.jpg', 'wb').write(enc.tobytes())
shutil.rmtree(OUT + '/_tmp')
print('OMR selftest', ok_n, '/', tot_n, fails)

# ---------------- БД
GOALS = collections.OrderedDict(); db_works = []
for wid, name, tidx, kind in WORKS:
    n_items = len(DB_ITEMS[(wid, 1)]); items = []
    for k in range(n_items):
        vs = {n: DB_ITEMS[(wid, n)][k] for n in (1, 2, 3, 4)}; b = vs[1]
        items.append(dict(no=k + 1, goal=b['goal'], topic=b['topic'], skill=b['skill'], points=1,
                          variants={str(n): dict(stem=v['stem'], options=v['opt_texts'], key=LET[v['key']], correct=v['opt_texts'][v['key']]) for n, v in vs.items()}))
        GOALS.setdefault(b['goal'], set()).add(b['topic'])
    db_works.append(dict(id=wid, title=TITLE[wid], kind=kind, template_index=tidx, n_items=n_items, max_points=n_items, items=items, omr_geometry={str(n): GEO[(wid, n)] for n in (1, 2, 3, 4)}))
DB = dict(meta=dict(title='Суммативное оценивание, математика 6 класс, облегчённая программа (1 полугодие), закрытые задания', generated=datetime.date.today().isoformat(),
                    program='Типовая учебная программа РК для обучающихся с лёгкой умственной отсталостью, 6 класс, долгосрочный план (коды целей сохранены из присланного файла)',
                    journal_note='4 СОР + 2 СОЧ — столько же, сколько в графах журнала класса; названия СОР привязаны к целям облегчённой программы', answer_letters=list(LET), omr_version=omr.VERSION,
                    scale=[dict(mark=5, min_pct=85), dict(mark=4, min_pct=65), dict(mark=3, min_pct=40), dict(mark=2, min_pct=0)], scale_note='как в основном классе; требует согласования'),
          goals={g: sorted(t) for g, t in GOALS.items()}, works=db_works, checks=dict(total=len(CHK), passed=sum(x['result'] == 'PASS' for x in CHK)), omr_selftest=dict(sheets=tot_n, ok=ok_n))
json.dump(DB, open(OUT + '/Diagnostic_DB_oblegchennaya.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('items', sum(len(v) for v in DB_ITEMS.values()), 'checks', len(CHK))
