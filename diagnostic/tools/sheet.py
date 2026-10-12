# -*- coding: utf-8 -*-
"""Рабочий лист A4: задания с кружками А–Г рядом с вариантами ответа (всё на одной стороне), фиксируем координаты кружков."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
import omr, figs

LET = 'АБВГ'
X0, X1 = 17.0, 193.0                 # область заданий по горизонтали, мм
Y_TOP, Y_BOT = 45.0, 278.0           # по вертикали, мм (от верхнего края)
W_MM = X1 - X0
H = omr.PAGE[1]

def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def rich(text, fs):
    parts = text.split('$'); out = []
    for i, p in enumerate(parts):
        if i % 2 == 0: out.append(esc(p).replace('\n', '<br/>'))
        else:
            path, w, h = figs.math_img(p, fs=fs * 1.12); out.append('<img src="%s" width="%.1f" height="%.1f" valign="middle"/>' % (path, w, h))
    return ''.join(out)

def _style(fs, bold=False):
    return ParagraphStyle('x', fontName='DVB' if bold else 'DV', fontSize=fs, leading=fs * 1.32)

def layout(items, scale):
    fs = 9.6 * scale; gap_item = 2.6 * scale; gap_row = 1.0 * scale
    placed = []; y = Y_TOP; shown_fig = None
    for it in items:
        stem = it['stem']
        if it.get('fig'):
            if shown_fig is None: shown_fig = it['no']
            else: stem += ' (рисунок к заданию %d)' % shown_fig
        sp = Paragraph('<b>%d.</b> ' % it['no'] + rich(stem, fs), ParagraphStyle('q', fontName='DV', fontSize=fs, leading=fs * 1.32, leftIndent=5 * mm, firstLineIndent=-5 * mm))
        w, h = sp.wrap(W_MM * mm, 1000); h_mm = h / mm
        el = dict(item=it['no'], stem=(sp, X0, y, h_mm)); y += h_mm + 0.6
        if it.get('fig') and shown_fig == it['no']:
            fh = 16.0 * scale; el['fig'] = (it['fig']['path'], X0 + 8, y, 5 * fh, fh); y += fh + 0.6
        # колонки
        paras = [Paragraph('<b>%s</b>&nbsp; ' % LET[k] + rich(o, fs), _style(fs)) for k, o in enumerate(it['opt_texts'])]
        def natural(p):
            p.wrap(1000 * mm, 1000); return max(p.getActualLineWidths0() or [0]) / mm
        nat = max(natural(p) for p in paras)
        ncols = 4 if nat <= W_MM / 4 - 8.5 else (2 if nat <= W_MM / 2 - 8.5 else 1)
        colw = W_MM / ncols; cells = []
        for k, p in enumerate(paras):
            cw = colw - 8.0; ph = p.wrap(cw * mm, 1000)[1] / mm
            cells.append((k, p, ph))
        rows = [cells[i:i + ncols] for i in range(0, 4, ncols)]
        opts = []
        for row in rows:
            rh = max(max(ph for _, _, ph in row), 4.8)
            for col, (k, p, ph) in enumerate(row):
                cx = X0 + col * colw + 2.6 + 3.2; cy = y + min(rh / 2, 2.9 * scale + 0.3)
                opts.append(dict(k=k, para=p, px=cx + 0.0 + 3.0, py=y, ph=ph, cx=X0 + col * colw + 5.0, cy=cy))
            y += rh + gap_row
        el['opts'] = opts; el['ncols'] = ncols; placed.append(el); y += gap_item
    return placed, y

def render_sheet(c, items, wid, name, tidx, variant, answers=None, fonts=('DV', 'DVB')):
    """c — canvas. Возвращает геометрию кружков (мм) и итоговый масштаб."""
    scale = 1.25
    while True:
        placed, yend = layout(items, scale)
        if yend <= Y_BOT or scale < 0.7: break
        scale -= 0.02
    assert yend <= Y_BOT, ('не помещается на лист', wid, variant, yend)
    omr.draw_marks(c, mm, H)
    c.setFillColor(colors.black); c.setStrokeColor(colors.black)
    c.setFont('DVB', 10); c.drawString(X0 * mm, (H - 21.5) * mm, 'Входная диагностика 7 кл. · %s' % name.split(' (')[0])
    c.setFont('DV', 8.5); c.drawRightString(X1 * mm, (H - 21.5) * mm, 'Вариант %d' % variant)
    c.setLineWidth(0.5)
    c.rect(X0 * mm, (H - 31) * mm, 108 * mm, 6 * mm, fill=0); c.rect((X0 + 111) * mm, (H - 31) * mm, 38 * mm, 6 * mm, fill=0)
    c.setFont('DV', 6.2); c.setFillColor(colors.Color(.35, .35, .35)); c.drawString((X0 + 1) * mm, (H - 26.9) * mm, 'Фамилия, имя'); c.drawString((X0 + 112) * mm, (H - 26.9) * mm, 'Класс')
    c.setFillColor(colors.black)
    omr.draw_id(c, mm, H, tidx, variant)
    c.setFont('DV', 6.2); c.drawString((X0 + 12 * 5.6 + 2) * mm, (H - 36.3) * mm, 'служебный код · не закрашивать')
    c.setFont('DV', 7); c.drawString(X0 * mm, (H - 42) * mm, 'Решайте на черновике. Закрасьте ОДИН кружок рядом с верным ответом полностью (ручка чёрная/синяя). Исправлять нельзя.')
    rows = []
    for el in placed:
        sp, x, y, h = el['stem']; sp.drawOn(c, x * mm, (H - y - h) * mm)
        if 'fig' in el:
            path, fx, fy, fw, fh = el['fig']; c.drawImage(path, fx * mm, (H - fy - fh) * mm, width=fw * mm, height=fh * mm, preserveAspectRatio=True, anchor='nw', mask='auto')
        orow = []
        for o in el['opts']:
            filled = answers is not None and o['k'] in answers.get(el['item'], [])
            c.setLineWidth(0.8); c.setStrokeColor(colors.black); c.setFillColor(colors.black)
            c.circle(o['cx'] * mm, (H - o['cy']) * mm, omr.BUB_R * mm, stroke=1, fill=1 if filled else 0)
            o['para'].drawOn(c, (o['cx'] + omr.BUB_R + 1.2) * mm, (H - o['py'] - o['ph']) * mm)
            orow.append(dict(letter=LET[o['k']], x=round(o['cx'], 2), y=round(o['cy'], 2), r=omr.BUB_R))
        orow.sort(key=lambda d: d['letter'])
        rows.append(dict(item=el['item'], options=orow))
    g = omr.base_geometry(); g['rows'] = rows; g['layout_scale'] = round(scale, 2); g['content_bottom_mm'] = round(yend, 1)
    return g
