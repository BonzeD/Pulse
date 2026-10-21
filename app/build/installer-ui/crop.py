# Режет отрендеренные экраны на фоны/кнопки/переключатели/кадры анимаций (24-bit BMP) + layout.nsh
# 1.0.0: имена кадров —  кнопка: <стр>_<эл>-h0..h4 (плавное наведение), -p (нажата)
#        переключатель: -off -offh -on -onh, -k1..k3 (ход ползунка)
#        эквалайзер: <стр>_wave-c0..c11 (спокойно), -x0..x11 (курсор над шапкой); логотип: <стр>_logo-s0..s7 (блик), fin_logo-b0..b7 (значок)
import json,os,glob,shutil
from PIL import Image
D=os.path.dirname(os.path.abspath(__file__)); R=json.load(open(f'{D}/out/rects.json'))
SC=[100,125,150,175,200]
BTN={'wel':['go','browse'],'upd':['go'],'fin':['run','close'],'udone':['close'],'ucf':['cancel','go']}
TOG={'wel':['t1','t2'],'ucf':['u1','u2']}
TOGMAP={'t1':('off',2,'offh',3,'on',0,'onh',1),'t2':('off',2,'offh',3,'on',0,'onh',1),'u1':('on',0,'onh',1,'off',2,'offh',3),'u2':('off',0,'offh',1,'on',2,'onh',3)}
HEAD=['wel','upd','ucf']
def raw(pg,k,s): return Image.open(f'{D}/out/raw/{pg}_{k}_{s}.png').convert('RGB')
for s in SC:
  o=f'{D}/out/{s}'; shutil.rmtree(o,ignore_errors=True); os.makedirs(o)
  def box(pg,el):
    x,y,w,h=[int(round(v)) for v in R[pg][el]]; return (x*s//100,y*s//100,(x+w)*s//100,(y+h)*s//100)
  def save(img,name): img.save(f'{o}/{name}.bmp')
  for pg in R: save(raw(pg,'0',s),f'{pg}_bg')
  for pg,els in BTN.items():
    for el in els:
      a=raw(pg,'0',s).crop(box(pg,el)); h=raw(pg,'1',s).crop(box(pg,el))
      for i in range(5): save(Image.blend(a,h,i/4),f'{pg}_{el}-h{i}')
      save(raw(pg,'p',s).crop(box(pg,el)),f'{pg}_{el}-p')
  for pg,els in TOG.items():
    for el in els:
      m=TOGMAP[el]
      for j in range(0,8,2): save(raw(pg,str(m[j+1]),s).crop(box(pg,el)),f'{pg}_{el}-{m[j]}')
      for k in (1,2,3): save(raw(pg,f'k{k}',s).crop(box(pg,el)),f'{pg}_{el}-k{k}')
  for pg in HEAD:
    for i in range(12):
      save(raw(pg,f'c{i}',s).crop(box(pg,'wave')),f'{pg}_wave-c{i}')
      save(raw(pg,f'x{i}',s).crop(box(pg,'wave')),f'{pg}_wave-x{i}')
    for i in range(8): save(raw(pg,f'c{i}',s).crop(box(pg,'logo')),f'{pg}_logo-s{i}')
  for pg in ('fin','udone'):
    for i in range(8): save(raw(pg,f's{i}',s).crop(box(pg,'logo')),f'{pg}_logo-s{i}')
  for i in range(8): save(raw('fin',f'b{i}',s).crop(box('fin','logo')),f'fin_logo-b{i}')
with open(f'{D}/out/layout.nsh','w') as f:
  f.write('; сгенерировано build/installer-ui/crop.py — координаты в px при 100%\n')
  for pg in R:
    for el,(x,y,w,h) in R[pg].items():
      x,y,w,h=[int(round(v)) for v in (x,y,w,h)]
      assert x%4==0 and y%4==0 and w%4==0 and h%2==0,(pg,el)
      f.write(f'!define {pg}_{el} "{x} {y} {w} {h}"\n')
print('ok')
