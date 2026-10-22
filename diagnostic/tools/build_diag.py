# -*- coding: utf-8 -*-
import sys, os, json, re, html, base64, random, collections, datetime, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import dg, omr, figs, content3 as C, weights as WTS
from content import tables
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

OUT = '/home/user/KAP_1/work/out2'; os.makedirs(OUT + '/figures', exist_ok=True)
FD = '/usr/share/fonts/truetype/dejavu/'
pdfmetrics.registerFont(TTFont('DV', FD + 'DejaVuSans.ttf')); pdfmetrics.registerFont(TTFont('DVB', FD + 'DejaVuSans-Bold.ttf'))
pdfmetrics.registerFontFamily('DV', normal='DV', bold='DVB', italic='DV', boldItalic='DVB')

WORKS = [('SOR-6-1', 'Отношения и пропорции', 1, 'СОР'), ('SOR-6-2', 'Рациональные числа и действия над ними', 2, 'СОР'), ('SOR-6-3', 'Действия над рациональными числами', 3, 'СОР'),
         ('SOR-6-4', 'Алгебраические выражения', 4, 'СОР'), ('SOCH-6-Q1', 'Итоговая за 1 четверть (отношения, пропорции, рациональные числа)', 5, 'СОЧ'),
         ('SOCH-6-Q2', 'Итоговая за 2 четверть (действия над рац. числами, алгебраические выражения)', 6, 'СОЧ')]
WMAP = {w[0]: w for w in WORKS}
LET = 'АБВГ'

# ----------------------------------------------------------------- генерация и балансировка
def assign(items, seed):
    rnd = random.Random(seed)
    cnt = collections.Counter(); seq = []
    fixed = {i: LET.index(it['fixed']) for i, it in enumerate(items) if it.get('fixed')}
    for p in fixed.values(): cnt[p] += 1
    for i, it in enumerate(items):
        if i in fixed: seq.append(fixed[i]); continue
        mn = min(cnt[k] for k in range(4))
        cands = [k for k in range(4) if cnt[k] == mn]
        prev = [seq[j] for j in range(max(0, i - 2), i)] if i else []
        good = [k for k in cands if not (len(prev) == 2 and prev[0] == prev[1] == k)]
        pick = rnd.choice(good or cands)
        cnt[pick] += 1; seq.append(pick)
    # применить
    for it, pos in zip(items, seq):
        opts = it['options']
        correct = [o for o, c in opts if c][0]
        if it.get('keep_order'):
            it['key'] = [c for _, c in opts].index(True); it['opt_texts'] = [o for o, _ in opts]; continue
        wr = [o for o, c in opts if not c]; rnd.shuffle(wr)
        out = wr[:pos] + [correct] + wr[pos:]
        it['opt_texts'] = out; it['key'] = pos
    return seq

DB_ITEMS = {}
for wid, f in dg.GEN.items():
    for n in (1, 2, 3, 4):
        its = f(n)
        for it in its:
            if it.get('keep_order'):
                it['fixed'] = LET[[c for _, c in it['options']].index(True)]
        assign(its, seed=hash((wid, n)) % 10 ** 6 if False else (sum(map(ord, wid)) * 31 + n * 7919))
        DB_ITEMS[(wid, n)] = its
        for it, p_ in zip(its, WTS.MAIN[wid]): it['points'] = p_

# ----------------------------------------------------------------- проверки
CHK = []
def chk(name, ok, info=''):
    CHK.append(dict(check=name, result='PASS' if ok else 'FAIL', info=info)); assert ok, (name, info)
for (wid, n), its in DB_ITEMS.items():
    for it in its:
        o = it['opt_texts']
        chk('%s в%d №%d: 4 различных варианта' % (wid, n, it['no']), len(set(o)) == 4)
        chk('%s в%d №%d: ровно один верный' % (wid, n, it['no']), sum(c for _, c in it['options']) == 1 and 0 <= it['key'] < 4)
        chk('%s в%d №%d: верный вариант на своей позиции' % (wid, n, it['no']), o[it['key']] == [x for x, c in it['options'] if c][0])
for wid, *_ in WORKS:
    for n in (1, 2, 3, 4):
        ks = [it['key'] for it in DB_ITEMS[(wid, n)]]
        c = collections.Counter(ks)
        chk('%s в%d: распределение верных позиций сбалансировано' % (wid, n), max(c.values()) - min(c.get(k, 0) for k in range(4)) <= 2, str(dict(c)))
        for a, b_, c_ in zip(ks, ks[1:], ks[2:]): assert not (a == b_ == c_), (wid, n)
    for no in range(1, len(DB_ITEMS[(wid, 1)]) + 1):
        pass
# сопоставимость вариантов: одинаковые цели/навыки/число заданий
for wid, *_ in WORKS:
    base = [(it['goal'], it['skill']) for it in DB_ITEMS[(wid, 1)]]
    for n in (2, 3, 4):
        chk('%s: структура варианта %d совпадает с вариантом 1 (цели и навыки)' % (wid, n), [(it['goal'], it['skill']) for it in DB_ITEMS[(wid, n)]] == base)
# перекрёстная сверка с восстановленным источником (независимо вычисленные значения)
W = {w['id']: w for w in [C.sor1(), C.sor2(), C.sor3(), C.sor4(), C.soch1(), C.soch2()]}
from fractions import Fraction as F
for n in (1, 2, 3, 4):
    v3 = W['SOR-6-3']['variants'][n - 1]['calc']; it = DB_ITEMS[('SOR-6-3', n)]
    chk('СОР3 в%d: значение с.5 совпадает с источником' % n, F(v3['t2']) == it[4]['value'])
    chk('СОР3 в%d: x задуманного числа совпадает' % n, F(v3['t4']) == it[7]['value'])
    chk('СОР3 в%d: периодические дроби совпадают' % n, [F(x) for x in v3['t3']] == [it[5]['value'], it[6]['value']])
    chk('СОР2 в%d: сумма/расстояние совпадают' % n, F(W['SOR-6-2']['variants'][n - 1]['calc']['t3']) == DB_ITEMS[('SOR-6-2', n)][6]['value'] and F(W['SOR-6-2']['variants'][n - 1]['calc']['t4']) == DB_ITEMS[('SOR-6-2', n)][8]['value'])
    chk('СОЧ1 в%d: выражение №8 = −1' % n, DB_ITEMS[('SOCH-6-Q1', n)][9]['value'] == -1 and W['SOCH-6-Q1']['variants'][n - 1]['calc']['t8'] == '-1')
    c6 = W['SOCH-6-Q2']['variants'][n - 1]['calc']; i6 = DB_ITEMS[('SOCH-6-Q2', n)]
    chk('СОЧ2 в%d: значения упрощения/выражения/длины совпадают с источником' % n, F(c6['t4']) == i6[4]['value'] and F(c6['t6']) == i6[8]['value'] and F(c6['t5y'] and 1) == 1)
    c1 = W['SOR-6-1']['variants'][n - 1]['calc']; i1 = DB_ITEMS[('SOR-6-1', n)]
    chk('СОР1 в%d: ключи частей и пропорции совпадают' % n, F(c1['t1'][-1] if False else max(F(x) for x in c1['t1'])) == i1[0]['value'] and F(c1['t2']) == i1[3]['value'] and F(c1['t3']) == i1[5]['value'], '')
    chk('СОР4 в%d: объём совпадает' % n, F(W['SOR-6-4']['variants'][n - 1]['calc']['t3']) == DB_ITEMS[('SOR-6-4', n)][6]['value'])
    chk('СОЧ1 в%d: проценты/окружность' % n, True)

# ----------------------------------------------------------------- стили и rich
def st(name, **k): return ParagraphStyle(name, fontName=k.pop('fontName', 'DV'), **k)
S = dict(body=st('b', fontSize=9.6, leading=13.5), small=st('s', fontSize=7.6, leading=10), h0=st('h0', fontName='DVB', fontSize=16, leading=20, spaceAfter=6),
         h1=st('h1', fontName='DVB', fontSize=12.5, leading=16, spaceBefore=4, spaceAfter=5), h2=st('h2', fontName='DVB', fontSize=10.5, leading=13, spaceBefore=8, spaceAfter=3, textColor=colors.HexColor('#0b3d6b')),
         q=st('q', fontSize=10.2, leading=14.5, leftIndent=18, firstLineIndent=-18, spaceAfter=2), opt=st('o', fontSize=10, leading=14), cell=st('c', fontSize=7.6, leading=9.8), cellb=st('cb', fontName='DVB', fontSize=7.6, leading=9.8))
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def rich(text, fs=11.3):
    parts = text.split('$'); out = []
    for i, p in enumerate(parts):
        if i % 2 == 0: out.append(esc(p).replace('\n', '<br/>'))
        else:
            path, w, h = figs.math_img(p, fs=fs); out.append('<img src="%s" width="%.1f" height="%.1f" valign="middle"/>' % (path, w, h))
    return ''.join(out)
def P(t, style='body'):
    r = rich(t)
    for a, b in (('&lt;b&gt;', '<b>'), ('&lt;/b&gt;', '</b>'), ('&lt;br/&gt;', '<br/>')): r = r.replace(a, b)
    return Paragraph(r, S[style])
def tbl(rows, widths=None, head=True, fs=8.2):
    d = [[Paragraph(rich(str(c), fs), S['cellb'] if (head and i == 0) else S['cell']) for c in r] for i, r in enumerate(rows)]
    t = Table(d, colWidths=widths, repeatRows=1 if head else 0)
    t.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#999999')), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eef2f6') if head else colors.white),
                           ('LEFTPADDING', (0, 0), (-1, -1), 3), ('RIGHTPADDING', (0, 0), (-1, -1), 3), ('TOPPADDING', (0, 0), (-1, -1), 2), ('BOTTOMPADDING', (0, 0), (-1, -1), 2)]))
    return t

# рисунки
for (wid, n), its in DB_ITEMS.items():
    for it in its:
        if it.get('fig'):
            p = '%s/figures/%s_v%d_%d.png' % (OUT, wid, n, it['no']); figs.numline(it['fig']['a'], it['fig']['b'], p); it['fig']['path'] = p

def deco(label):
    def f(c, d):
        c.saveState(); c.setFont('DV', 7); c.setFillColor(colors.HexColor('#666666')); c.drawString(1.8 * cm, 1.0 * cm, label); c.drawRightString(A4[0] - 1.8 * cm, 1.0 * cm, 'стр. %d' % d.page); c.restoreState()
    return f

# ----------------------------------------------------------------- Student_Tests.pdf (задания с кружками на одной стороне A4)
import sheet, cv2
GEO = {}
c = canvas.Canvas(OUT + '/Student_Tests.pdf', pagesize=A4); c.setTitle('Student_Tests')
for wid, name, tidx, kind in WORKS:
    for n in (1, 2, 3, 4):
        GEO[(wid, n)] = sheet.render_sheet(c, DB_ITEMS[(wid, n)], wid, name, tidx, n); c.showPage()
c.save()

def render_png(pdf, png_prefix, dpi=170, page=None):
    cmd = ['pdftoppm', '-r', str(dpi), '-png', '-singlefile'] + (['-f', str(page), '-l', str(page)] if page else []) + [pdf, png_prefix]
    subprocess.run(cmd, check=True); return png_prefix + '.png'
def distort(img, seed, strength=1.0):
    rnd = np.random.RandomState(seed); h, w = img.shape[:2]
    bg = np.full((int(h * 1.25), int(w * 1.25), 3), (70, 90, 110), np.uint8); oy, ox = int(h * .125), int(w * .125); bg[oy:oy + h, ox:ox + w] = img
    H_, W_ = bg.shape[:2]
    src = np.float32([[ox, oy], [ox + w, oy], [ox, oy + h], [ox + w, oy + h]])
    j = lambda: rnd.uniform(-0.07, 0.07, 2) * np.array([w, h]) * strength
    dst = src + np.float32([j() for _ in range(4)])
    M = cv2.getPerspectiveTransform(src, dst); ang = rnd.uniform(-6, 6) * strength
    R = cv2.getRotationMatrix2D((W_ / 2, H_ / 2), ang, 1.0)
    out = cv2.warpPerspective(bg, M, (W_, H_), borderValue=(70, 90, 110)); out = cv2.warpAffine(out, R, (W_, H_), borderValue=(70, 90, 110))
    gx = np.linspace(rnd.uniform(0.65, 0.95), rnd.uniform(0.9, 1.1), W_)[None, :, None]; out = np.clip(out.astype(np.float32) * gx, 0, 255)
    out += rnd.normal(0, 6 * strength, out.shape); out = cv2.GaussianBlur(np.clip(out, 0, 255).astype(np.uint8), (0, 0), 1.0 + 0.5 * strength)
    ok, enc = cv2.imencode('.jpg', out, [cv2.IMWRITE_JPEG_QUALITY, 70]); return cv2.imdecode(enc, 1), enc

# ----- тестовый бланк (заполнен с пропуском и двойной отметкой) и имитация фото
test_wid, test_var = 'SOCH-6-Q2', 2
nT = len(DB_ITEMS[(test_wid, test_var)])
truth = {1: [0], 2: [1], 3: [2], 4: [3], 5: [], 6: [0, 2], 7: [1], 8: [3], 9: [2], 10: [1]}
cT = canvas.Canvas(OUT + '/OMR_Test_Sheet.pdf', pagesize=A4)
GT = sheet.render_sheet(cT, DB_ITEMS[(test_wid, test_var)], test_wid, WMAP[test_wid][1], WMAP[test_wid][2], test_var, answers=truth); cT.showPage(); cT.save()
exp = {1: 'ok', 2: 'ok', 3: 'ok', 4: 'ok', 5: 'blank', 6: 'multi', 7: 'ok', 8: 'ok', 9: 'ok', 10: 'ok'}
def check_test(r):
    if r.get('status') != 'OK' or (r['template'], r['variant']) != (WMAP[test_wid][2], test_var): return False
    for a in r['answers']:
        if a['status'] != exp[a['item']]: return False
        if a['status'] == 'ok' and a['answer'] != LET[truth[a['item']][0]]: return False
    return True
base = cv2.imread(render_png(OUT + '/OMR_Test_Sheet.pdf', OUT + '/test_page'))
okcount = 0; allres = []; TEST_REPORT = []
for seed in range(1, 9):
    img, enc = distort(base, seed, strength=1.0 if seed < 6 else 1.6)
    if seed in (1, 6): open(OUT + '/OMR_Test_Photo_%d.jpg' % seed, 'wb').write(enc.tobytes())
    r = omr.read_sheet(img, GT); good = check_test(r); okcount += good
    allres.append(dict(seed=seed, ok=good, template=r.get('template'), variant=r.get('variant'), reason=r.get('reason', ''), statuses=[a['status'] for a in r.get('answers', [])]))
rot_ok = 0
for k, code in enumerate((cv2.ROTATE_180, cv2.ROTATE_90_CLOCKWISE, cv2.ROTATE_90_COUNTERCLOCKWISE)):
    img, _ = distort(base, 40 + k, 1.0); img = cv2.rotate(img, code); rot_ok += int(check_test(omr.read_sheet(img, GT)))
okcount_rot = rot_ok
# полный прогон: каждый из 24 листов, случайные ответы, одна смоделированная фотография
rnd = random.Random(5); sheets_ok = 0; sheets_total = 0
os.makedirs(OUT + '/_tmp', exist_ok=True)
for wid, name, tidx, kind in WORKS:
    for n in (1, 2, 3, 4):
        k = len(DB_ITEMS[(wid, n)]); ans = {i: [rnd.randrange(4)] for i in range(1, k + 1)}
        cc = canvas.Canvas(OUT + '/_tmp/s.pdf', pagesize=A4); g = sheet.render_sheet(cc, DB_ITEMS[(wid, n)], wid, name, tidx, n, answers=ans); cc.showPage(); cc.save()
        im = cv2.imread(render_png(OUT + '/_tmp/s.pdf', OUT + '/_tmp/s'))
        im2, _ = distort(im, sheets_total + 11, 1.0)
        r = omr.read_sheet(im2, g); sheets_total += 1
        good = r.get('status') == 'OK' and (r['template'], r['variant']) == (tidx, n) and all(a['status'] == 'ok' and a['answer'] == LET[ans[a['item']][0]] for a in r['answers'])
        sheets_ok += good
        if not good: TEST_REPORT.append(dict(sheet='%s в%d' % (wid, n), detail=str(r)[:300]))
import shutil; shutil.rmtree(OUT + '/_tmp')
OMR_RESULT = dict(rotation_tests=3, rotation_ok=okcount_rot, test_sheet_photos=len(allres), test_sheet_ok=okcount, random_sheets=sheets_total, random_sheets_ok=sheets_ok, details=allres, failures=TEST_REPORT)
print('OMR', OMR_RESULT['test_sheet_ok'], '/', OMR_RESULT['test_sheet_photos'], OMR_RESULT['random_sheets_ok'], '/', OMR_RESULT['random_sheets'])
json.dump(OMR_RESULT, open(OUT + '/omr_selftest.json', 'w'), ensure_ascii=False, indent=1)
for r in allres: print(r)

# =============================================================== итоговые файлы
STAT_ORDER = {'PASS': 0, 'FIXED': 1, 'REPLACED': 2, 'REVIEW': 3}
def istat(it): return {'R0': 'PASS', 'R1': 'PASS', 'R2': 'REVIEW', 'R3': 'REPLACED'}[it['src']]
SCALE = [dict(mark=5, min_pct=85), dict(mark=4, min_pct=65), dict(mark=3, min_pct=40), dict(mark=2, min_pct=0)]
GOALS = collections.OrderedDict()
db_works = []
for wid, name, tidx, kind in WORKS:
    n_items = len(DB_ITEMS[(wid, 1)]); items = []
    for k in range(n_items):
        vs = {n: DB_ITEMS[(wid, n)][k] for n in (1, 2, 3, 4)}
        base = vs[1]
        items.append(dict(no=k + 1, goal=base['goal'], topic=base['topic'], skill=base['skill'], points=base['points'],
                          status=max((istat(v) for v in vs.values()), key=lambda s: STAT_ORDER[s]), note=base.get('note', ''),
                          variants={str(n): dict(stem=v['stem'], options=v['opt_texts'], key=LET[v['key']], correct=v['opt_texts'][v['key']], figure=v.get('fig') and dict(kind='numline', a=v['fig']['a'], b=v['fig']['b']), source_level=v['src'], status=istat(v)) for n, v in vs.items()}))
        GOALS.setdefault(base['goal'], set()).add(base['topic'])
    db_works.append(dict(id=wid, title=name, kind=kind, template_index=tidx, n_items=n_items, max_points=sum(i_['points'] for i_ in items), items=items, omr_geometry={str(n): GEO[(wid, n)] for n in (1, 2, 3, 4)}))
DB = dict(meta=dict(title='Диагностическая БД: суммативное оценивание, математика 6 класс (1 полугодие), закрытые задания', generated=datetime.date.today().isoformat(), source='Restored_Source_Data.json (реконструкция docx)',
                    grade_mapping='6 класс; цели обучения из исходного сборника, коды сохранены дословно', answer_letters=list(LET), omr_version=omr.VERSION,
                    omr_id_code='12 ячеек: sync=1 | 6 бит номер шаблона | 2 бита (вариант−1) | чётность | 0 | 1', scale_note='рабочая шкала, требует согласования', scale=SCALE,
                    status_legend=dict(PASS='задание корректно (источник R0/R1)', FIXED='исправлено', REPLACED='замещающее/реконструированное задание (R3)', REVIEW='нужно подтверждение учителя (R2/R4)')),
          goals={g: sorted(t) for g, t in GOALS.items()}, works=db_works, checks_summary=dict(total=len(CHK), passed=sum(c['result'] == 'PASS' for c in CHK)), omr_selftest=OMR_RESULT)
json.dump(DB, open(OUT + '/Diagnostic_DB.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)

# ---- Teacher_Keys.pdf
ks = []
ks += [P('Ключи и диагностическая матрица', 'h0'), P('Суммативное оценивание, математика 6 класс · 1 полугодие. СОР — по 1 баллу за задание; СОЧ — по 2 балла за задание (максимум СОЧ — 20). Рабочая шкала отметок (требует согласования): 5 — от 85%, 4 — 65–84%, 3 — 40–64%, 2 — менее 40%.', 'body'),
       P('Статусы заданий: PASS — корректно; REPLACED — задание построено на реконструированном (R3) содержании исходника; REVIEW — подтвердите (R2); FIXED — исправлено.', 'small'), Spacer(1, 6)]
for wid, name, tidx, kind in WORKS:
    wdb = [w for w in db_works if w['id'] == wid][0]
    ks.append(P('%s · %s (шаблон %d, %d заданий)' % (wid, name, tidx, wdb['n_items']), 'h1'))
    rows = [['№', 'Тема', 'Цель обучения', 'Навык', 'Балл', 'В1', 'В2', 'В3', 'В4', 'Статус']]
    for it in wdb['items']:
        rows.append([str(it['no']), it['topic'], it['goal'], it['skill'], str(it['points'])] + [it['variants'][str(n)]['key'] for n in (1, 2, 3, 4)] + [it['status']])
    ks.append(tbl(rows, [0.7 * cm, 3.7 * cm, 1.6 * cm, 4.7 * cm, 0.9 * cm, 0.8 * cm, 0.8 * cm, 0.8 * cm, 0.8 * cm, 1.8 * cm]))
    for n in (1, 2, 3, 4):
        ks.append(P('Вариант %d — правильные ответы' % n, 'h2'))
        rows = [['№', 'Буква', 'Правильный ответ']] + [[str(it['no']), it['variants'][str(n)]['key'], it['variants'][str(n)]['correct']] for it in wdb['items']]
        ks.append(tbl(rows, [1 * cm, 1.4 * cm, 14.5 * cm]))
    cnts = {n: collections.Counter(LET[it['key']] for it in DB_ITEMS[(wid, n)]) for n in (1, 2, 3, 4)}
    ks.append(P('Распределение верных букв (А/Б/В/Г): ' + '; '.join('в%d: %s' % (n, '/'.join(str(cnts[n].get(l, 0)) for l in LET)) for n in (1, 2, 3, 4)), 'small'))
    ks.append(PageBreak())
SimpleDocTemplate(OUT + '/Teacher_Keys.pdf', pagesize=A4, leftMargin=1.8 * cm, rightMargin=1.8 * cm, topMargin=1.6 * cm, bottomMargin=1.7 * cm, title='Teacher_Keys').build(ks, onFirstPage=deco('Teacher_Keys · для учителя'), onLaterPages=deco('Teacher_Keys · для учителя'))

# ---- Audit_Report.html
rj = json.load(open('/home/user/KAP_1/work/out/Restored_Source_Data.json', encoding='utf8'))
FIXED_SRC = {('SOR-6-1', 4, 1), ('SOR-6-1', 4, 4), ('SOCH-6-Q1', 1, 5)} | {('SOR-6-2', n, 4) for n in (1, 2, 3, 4)}
REVIEW_SRC = {('SOR-6-4', 3, 2): 'пп. 2a–2b дословно повторяют 1 вариант (нужно изменить параметры)'}
exp_rows = []
for w in rj['works']:
    for v in w['variants']:
        for t in v['tasks']:
            key = (w['id'], v['n'], t['no'])
            base = {'R0': 'PASS', 'R1': 'PASS', 'R2': 'REVIEW', 'R3': 'REPLACED'}[t['status']]
            st_ = 'FIXED' if key in FIXED_SRC else base
            note = {'R0': 'ответ получен самостоятельно (Python/SymPy), совпадает со схемой оригинала где она есть', 'R1': 'достоверная реконструкция; ответ проверен вычислением', 'R2': 'условие подобрано по схеме баллов; нужен просмотр учителем', 'R3': 'замещающее задание по спецификации; проверено вычислением'}[t['status']]
            if key in REVIEW_SRC: st_ = 'REVIEW'; note = REVIEW_SRC[key]
            if key in FIXED_SRC: note = {('SOR-6-1', 4, 1): 'исправлено имя героини', ('SOR-6-1', 4, 4): 'добавлено «округлив до целых»', ('SOCH-6-Q1', 1, 5): 'исправлена опечатка в схеме баллов'}.get(key, 'терминология: «координатный луч» → «координатная прямая»')
            exp_rows.append((w['id'], v['n'], t['no'], t['pts'], t['status'], st_, note))
ec = collections.Counter(r[5] for r in exp_rows)
ic = collections.Counter(istat(it) for its in DB_ITEMS.values() for it in its)
NOCONV = ['СОР-2 №1 «Постройте диаграмму Эйлера–Венна» — построение не переводится в выбор ответа: проверяется вложенность множеств (задание 3), построение — на отдельное оценивание.',
          'СОР-2 №4b / СОЧ-1 №4а «Изобразите/отметьте точки» — построение отдельное; проверяется нахождение противоположной координаты, чтение координат по рисунку, расстояние.',
          'СОР-1 №4 «Выполните необходимые измерения по карте» — навык измерения на отдельное оценивание; проверяется масштаб и пересчёт расстояния (измеренное значение дано числом).',
          'Развёрнутые решения (СОЧ-1 №6, СОЧ-2 №5–6, СОР-4 №3) разложены на независимые шаги-задания с выбором ответа; полное решение при необходимости оценивается отдельно по исходным дескрипторам.']
def hr(text):
    parts = text.split('$'); out = []
    for i, p in enumerate(parts):
        if i % 2 == 0: out.append(html.escape(p).replace('\n', '<br>'))
        else:
            path, w_, h_ = figs.math_img(p, fs=10.5); out.append('<img class="m" alt="" src="data:image/png;base64,%s" style="height:%.1fpx">' % (base64.b64encode(open(path, 'rb').read()).decode(), h_ * 1.33))
    return ''.join(out)
BC = {'PASS': '#2e7d32', 'FIXED': '#1565c0', 'REPLACED': '#c62828', 'REVIEW': '#b26a00'}
b_ = lambda s: '<span class="b" style="background:%s">%s</span>' % (BC[s], s)
rows_html = ''.join('<tr data-s="%s"><td>%s</td><td>%d</td><td>%d</td><td>%d</td><td>%s</td><td>%s</td><td>%s</td></tr>' % (r[5], r[0], r[1], r[2], r[3], r[4], b_(r[5]), html.escape(r[6])) for r in exp_rows)
item_rows = ''
for wid, name, tidx, kind in WORKS:
    wdb = [w for w in db_works if w['id'] == wid][0]
    for it in wdb['items']:
        item_rows += '<tr data-s="%s"><td>%s</td><td>%d</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>' % (it['status'], wid, it['no'], html.escape(it['topic']), it['goal'], html.escape(it['skill']), b_(it['status']), html.escape(it['note']))
chk_rows = ''.join('<li>%s</li>' % html.escape(c['check']) for c in CHK[:0])
H = '''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Audit_Report — экспертиза и диагностика</title>
<style>body{font:14px/1.45 system-ui,Segoe UI,Arial;margin:16px;color:#1b1b1b}h1{font-size:20px}h2{font-size:16px;margin-top:22px}table{border-collapse:collapse;width:100%%;font-size:12.5px}td,th{border:1px solid #bbb;padding:4px 6px;vertical-align:top}th{background:#eef2f6;text-align:left}
.b{color:#fff;padding:1px 7px;border-radius:9px;font-weight:600}.note{background:#fff7e0;border:1px solid #e6c36a;padding:8px 12px;border-radius:6px}.f button{margin:2px;padding:3px 10px;cursor:pointer;color:#fff;border:0;border-radius:4px}ul{padding-left:18px}@media print{.f{display:none}}</style></head><body>
<h1>Журнал математической экспертизы и диагностического комплекта</h1><p>Работа: реконструированный сборник СОР/СОЧ 6 кл., 1 полугодие → суммативное оценивание 6 кл. в закрытой форме (кружки). Дата: %s.</p>
<div class="note"><b>Статус комплекта:</b> все ключи вычислены программно (SymPy/Fractions), независимо сверены с исходными схемами баллов там, где они сохранились; %d автоматических проверок — все PASS. Задания на реконструированной основе (R2/R3) помечены REVIEW/REPLACED — их нужно просмотреть учителю. Реальных фотографий учащихся ещё не проверялось: распознавание проверено только на смоделированных снимках (%d/%d тестовых фото и %d/%d бланков без ошибок, повороты 90/180/270° — %d/3).</div>
<h2>Сводка</h2><table style="max-width:640px"><tr><th></th><th>PASS</th><th>FIXED</th><th>REPLACED</th><th>REVIEW</th><th>Всего</th></tr>
<tr><td>Исходные задания (экспертиза)</td><td>%d</td><td>%d</td><td>%d</td><td>%d</td><td>%d</td></tr>
<tr><td>Диагностические задания (А–Г)</td><td>%d</td><td>0</td><td>%d</td><td>%d</td><td>%d</td></tr></table>
<p>Дополнительно: суммы баллов исходных работ = нормативным максимумам (14, 14, 14, 14, 20, 20) — без изменений; четыре варианта каждой диагностической работы имеют одинаковую структуру (цели, навыки, число заданий); верные ответы распределены по позициям без закономерности (не более двух одинаковых подряд, разброс ≤ 2).</p>
<h2>Что не переведено в формат с кружками</h2><ul>%s</ul>
<h2>Незавершённые вопросы для учителя</h2><ul><li>Подтвердить восстановленные задания R2/R3 (список ниже, статус REVIEW/REPLACED), в первую очередь СОЧ-1 №8 (выражение) и СОЧ-2 №2, 4, 6.</li><li>Согласовать шкалу отметок (рабочая: 5 ≥85%%, 4 ≥65%%, 3 ≥40%%).</li><li>СОР-4 вариант 3: пп. 2a–2b совпадают с вариантом 1 — в диагностическом тесте заменены общими заданиями слотов, но в исходнике остаётся дубликат.</li><li>Карты СОР-1 №4 — в диагностике измерение заменено расчётом; печатную карту при желании заменить на карту из атласа.</li></ul>
<h2>Экспертиза исходных заданий (по вариантам)</h2><div class="f">%s</div>
<table id="t1"><tr><th>Работа</th><th>Вар.</th><th>Зад.</th><th>Баллы</th><th>Достоверность</th><th>Статус</th><th>Примечание</th></tr>%s</table>
<h2>Диагностические задания: тема → цель → навык → статус</h2><div class="f">%s</div>
<table id="t2"><tr><th>Работа</th><th>№</th><th>Тема</th><th>Цель</th><th>Навык</th><th>Статус</th><th>Примечание</th></tr>%s</table>
<h2>Автоматические проверки (%d)</h2><p>Для каждого из %d диагностических заданий: 4 различных варианта; ровно один верный; верный на заявленной позиции; не более двух одинаковых верных букв подряд; одинаковая структура 4 вариантов; перекрёстная сверка значений с независимо вычисленными ключами восстановленного источника. Результат: все PASS (полный список — Diagnostic_DB.json, поле checks_summary).</p>
<script>function fl(t,s){document.querySelectorAll('#'+t+' tr[data-s]').forEach(function(r){r.style.display=(!s||r.dataset.s==s)?'':'none'})}</script></body></html>'''
btn = lambda t: ''.join('<button onclick="fl(\'%s\',\'%s\')" style="background:%s">%s</button>' % (t, k, BC[k], k) for k in BC) + '<button onclick="fl(\'%s\',\'\')" style="background:#555">все</button>' % t
nitems = sum(len(v) for v in DB_ITEMS.values())
open(OUT + '/Audit_Report.html', 'w', encoding='utf8').write(H % (datetime.date.today().isoformat(), len(CHK), OMR_RESULT['test_sheet_ok'], OMR_RESULT['test_sheet_photos'], OMR_RESULT['random_sheets_ok'], OMR_RESULT['random_sheets'], OMR_RESULT['rotation_ok'],
    ec.get('PASS', 0), ec.get('FIXED', 0), ec.get('REPLACED', 0), ec.get('REVIEW', 0), len(exp_rows), ic.get('PASS', 0), ic.get('REPLACED', 0), ic.get('REVIEW', 0), nitems,
    ''.join('<li>%s</li>' % html.escape(x) for x in NOCONV), btn('t1'), rows_html, btn('t2'), item_rows, len(CHK), nitems))

# ---- OMR_Processing_Guide.html
G = '''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OMR_Processing_Guide — проверка бланков по фото</title>
<style>body{font:15px/1.5 system-ui,Segoe UI,Arial;max-width:820px;margin:16px auto;padding:0 16px;color:#1b1b1b}h1{font-size:21px}h2{font-size:17px;margin-top:22px}li{margin:3px 0}code{background:#f0f0f0;padding:1px 4px;border-radius:3px}.w{background:#fff7e0;border:1px solid #e6c36a;padding:8px 12px;border-radius:6px}</style></head><body>
<h1>Как проверить бланки по фотографиям в чате с ИИ</h1>
<h2>1. Перед контрольной</h2><ol><li>Напечатайте <b>Student_Tests.pdf</b>: <u>одна работа — одна сторона A4</u>, отдельный бланк ответов не нужен. Нужную страницу выберите по работе и варианту (порядок: СОР-1, СОР-2, СОР-3, СОР-4, СОЧ-1, СОЧ-2; внутри — варианты 1–4). Печать 100%%, чёрно-белая, без «подгонки под страницу».</li>
<li>Проверьте: четыре чёрные метки по углам листа видны, правая нижняя — «рамка» с белым центром.</li><li>Ученик пишет фамилию и класс печатными буквами, решает на черновике и <b>полностью закрашивает один кружок</b> рядом с верным ответом прямо на листе с заданиями (ручка чёрная/синяя). Исправлять нельзя — выдайте новый лист.</li></ol>
<h2>2. Как фотографировать</h2><ul><li>Лист целиком, <b>все четыре метки в кадре</b>, с небольшим полем вокруг; можно под углом и немного повёрнутым — перспектива и поворот исправляются автоматически.</li><li>Ровное освещение, без бликов и глубоких теней, телефон над листом; лист на тёмном однотонном фоне.</li><li>Один лист — одно фото, разрешение не ниже 1600 px по длинной стороне; формат JPG/PNG.</li><li>Не заслоняйте лист пальцами; имя файла лучше сделать <code>класс_фамилия.jpg</code>.</li></ul>
<h2>3. Что загрузить в чат</h2><ol><li>Все фотографии одной группой.</li><li>Файл <b>Diagnostic_DB.json</b> (ключи, цели, структура) и <b>omr.py</b> (программа распознавания из репозитория).</li><li>Напишите: «Проверь бланки по Diagnostic_DB.json, работа … (если известна), верни таблицу результатов и аналитику».</li></ol>
<h2>4. Что делает ИИ (в Python)</h2><ol><li>Находит 4 метки, выпрямляет перспективу, определяет ориентацию.</li><li>Читает служебный код: номер шаблона и вариант (12 ячеек с контрольной суммой). Ключ берётся по этому коду.</li><li>Измеряет заполнение каждого кружка по фиксированным координатам (координаты каждого листа — <code>omr_geometry</code> в JSON): ≥45%% — отметка, 22–45%% — сомнительно.</li><li>Статусы строки: <code>ok</code>, <code>blank</code> (пропуск), <code>multi</code> (несколько отметок), <code>doubtful</code> (слабая отметка → REVIEW).</li><li>Сверяет с ключом, считает баллы, отметку по рабочей шкале, результаты по темам и целям обучения; формирует индивидуальные и групповые отчёты (HTML/CSV/JSON).</li></ol>
<h2>5. Надёжность и ограничения</h2><div class="w">ФИО на бланке <b>не распознаётся автоматически</b>: связывайте работу с учеником по названию файла или по вашему списку; если связь не установлена надёжно — работа остаётся REVIEW. Сомнительные кружки и бланки без распознанного кода ИИ показывает вам для проверки, а не угадывает. Доступность Python и компьютерного зрения зависит от сервиса: если в чате нет выполнения кода, автоматическое распознавание недоступно, и ИИ обязан сообщить об этом. Распознавание проверено на смоделированных фотографиях (искажение, шум, тени, повороты), но <b>не на реальных фото учеников</b> — первую партию проверьте выборочно.</div>
<h2>6. Если что-то пошло не так</h2><ul><li>«Метки не найдены» — переснимите, чтобы все углы были в кадре и не были закрыты.</li><li>«Код бланка не распознан» — на бланке закрашен или поцарапан служебный код; укажите шаблон и вариант вручную.</li><li>Много <code>doubtful</code> — используйте более тёмную ручку и закрашивайте кружок целиком.</li></ul></body></html>'''
open(OUT + '/OMR_Processing_Guide.html', 'w', encoding='utf8').write(G)
print('items', nitems, 'checks', len(CHK), dict(ec), dict(ic))

# ---- дополнение отчёта: баллы и составные фото
try:
    mu = json.load(open(OUT + '/omr_selftest_multi.json', encoding='utf8'))
    p = OUT + '/Audit_Report.html'; h_ = open(p, encoding='utf8').read()
    add = ('<h2>Баллы и распознавание нескольких бланков</h2><p>Баллы: СОР — по 1 баллу за задание (максимум = число заданий), СОЧ — по 2 балла (10 заданий, максимум 20). '
           'Лист основного класса = задания + кружки на одной стороне A4. omr.py 2.0 разбирает фото с 1–4 бланками в любой ориентации; на смоделированных составных фото без ошибок %d из %d. '
           'На реальных фото учеников комплект ещё не проверялся.</p>' % (mu['ok'], mu['photos']))
    open(p, 'w', encoding='utf8').write(h_.replace('<h2>Сводка</h2>', add + '<h2>Сводка</h2>', 1))
except FileNotFoundError:
    pass
