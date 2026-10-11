import re,sys,json
from lxml import etree
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
M='http://schemas.openxmlformats.org/officeDocument/2006/math'
ns={'w':W,'m':M}
q=lambda t:'{%s}%s'%(W,t)
def omath(el):
    # linearize OMML roughly
    tag=etree.QName(el).localname
    if tag=='t': return el.text or ''
    kids=lambda e,n:[c for c in e if etree.QName(c).localname==n]
    if tag=='f':
        return '(%s)/(%s)'%(omath(kids(el,'num')[0]),omath(kids(el,'den')[0]))
    if tag=='sSup': return '%s^(%s)'%(omath(kids(el,'e')[0]),omath(kids(el,'sup')[0]))
    if tag=='sSub': return '%s_(%s)'%(omath(kids(el,'e')[0]),omath(kids(el,'sub')[0]))
    if tag=='rad': return 'sqrt(%s)'%omath(kids(el,'e')[0])
    if tag=='d':
        b=kids(el,'dPr'); beg='('; end=')'
        for p in b:
            for c in p:
                n=etree.QName(c).localname
                if n=='begChr': beg=c.get('{%s}val'%M,'')
                if n=='endChr': end=c.get('{%s}val'%M,'')
        return beg+','.join(omath(e) for e in kids(el,'e'))+end
    return ''.join(omath(c) for c in el if etree.QName(c).localname not in('rPr','fPr','dPr','sSupPr','sSubPr','radPr'))
state={'ole':0,'img':0}
def para(p):
    out=[]
    for node in p.iter():
        t=etree.QName(node).localname
        if node.tag==q('t'): out.append(node.text or '')
        elif node.tag==q('tab'): out.append('\t')
        elif node.tag==q('br'): out.append('\n')
        elif t=='object':
            state['ole']+=1
            out.append('[[OLE%d]]'%state['ole'])
        elif t=='oMath' and node.getparent().tag!='{%s}oMathPara'%M or t=='oMathPara':
            out.append('{{'+omath(node)+'}}')
        elif node.tag==q('drawing') or node.tag==q('pict'):
            if node.getparent().tag==q('object'): continue
            state['img']+=1
            out.append('[[IMG%d]]'%state['img'])
    return ''.join(out)
def handle(el,lines,depth=0):
    t=etree.QName(el).localname
    if t=='p':
        # skip paragraphs nested handled by iter? oMath nested double count guard
        lines.append(para(el))
    elif t=='tbl':
        lines.append('<<TABLE>>')
        for tr in el.findall(q('tr')):
            cells=[]
            for tc in tr.findall(q('tc')):
                sub=[]
                for c in tc: handle(c,sub)
                cells.append(' / '.join(s for s in sub if s.strip()))
            lines.append(' | '.join(cells))
        lines.append('<<END>>')
    elif t in('sdt',):
        for c in el.iter(q('p')): lines.append(para(c))
tree=etree.parse(sys.argv[1]); body=tree.getroot().find(q('body'))
lines=[]
for el in body: handle(el,lines)
open(sys.argv[2],'w').write('\n'.join(lines))
print(state,len(lines))
