import json
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
FD='/usr/share/fonts/truetype/dejavu/'
pdfmetrics.registerFont(TTFont('DV',FD+'DejaVuSans.ttf')); pdfmetrics.registerFont(TTFont('DVB',FD+'DejaVuSans-Bold.ttf'))
h=ParagraphStyle('h',fontName='DVB',fontSize=8.6,leading=11); big=ParagraphStyle('b',fontName='DVB',fontSize=13,leading=16,spaceAfter=2); sm=ParagraphStyle('s',fontName='DV',fontSize=8,leading=10,spaceAfter=6)
def head(w):
    t=w['title']
    if t.startswith('Суммативное'): return t
    if w['id'].endswith('Q1'): return 'Суммативное оценивание за 1 четверть'
    if w['id'].endswith('Q2'): return 'Суммативное оценивание за 2 четверть'
    return 'Суммативное оценивание за раздел «%s»' % t
def tab(w,vs):
    rows=[['№','Балл']+['В%d'%v for v in vs]]+[[str(i['no']),str(i['points'])]+[i['variants'][str(v)]['key'] for v in vs] for i in w['items']]+[['','%d'%w['max_points']]+['']*len(vs)]
    cw=[0.9*cm,1.1*cm]+[(1.3 if len(vs)==4 else 1.7)*cm]*len(vs)
    t=Table(rows,colWidths=cw)
    t.setStyle(TableStyle([('FONT',(0,0),(-1,-1),'DV',9),('FONT',(0,0),(-1,0),'DVB',8.5),('FONT',(0,-1),(-1,-1),'DVB',9),('GRID',(0,0),(-1,-1),0.4,colors.grey),('ALIGN',(0,0),(-1,-1),'CENTER'),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eef2f6')),('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),2)]))
    return [Paragraph(head(w),h),Spacer(1,3),t]
def make(db,out,title,sub,vs):
    d=json.load(open(db,encoding='utf8')); ws=d['works']
    grid=Table([[tab(ws[0],vs),tab(ws[1],vs),tab(ws[2],vs)],[tab(ws[3],vs),tab(ws[4],vs),tab(ws[5],vs)]],colWidths=[5.9*cm]*3)
    grid.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),14)]))
    SimpleDocTemplate(out,pagesize=A4,leftMargin=1.4*cm,rightMargin=1.4*cm,topMargin=1.5*cm,bottomMargin=1.5*cm).build([Paragraph(title,big),Paragraph(sub,sm),grid])
R='/home/user/KAP_1/diagnostic/'
make(R+'Diagnostic_DB.json',R+'Klyuchi_SOR_SOCH_var1-2.pdf','Ключи. Математика, 6 класс (варианты 1 и 2)','Столбец «Балл» — баллы за задание; внизу — максимум работы (СОР 14, СОЧ 20).',[1,2])
make(R+'oblegchennaya/Diagnostic_DB_oblegchennaya.json',R+'oblegchennaya/Klyuchi_oblegchennaya.pdf','Ключи. Математика, 6 класс, облегчённая программа','Суммативное оценивание, 1 полугодие, варианты 1–4. Столбец «Балл» — баллы за задание; внизу — максимум работы.',[1,2,3,4])
