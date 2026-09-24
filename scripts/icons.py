from PIL import Image, ImageDraw
from pathlib import Path
out=Path('miniprogram/assets');out.mkdir(exist_ok=True)
for name in ['today','trends','calendar','profile']:
 for active in [False,True]:
  im=Image.new('RGBA',(96,96));d=ImageDraw.Draw(im);c='#277dee' if active else '#8291a5';w=5
  if name=='today':
   d.line([(12,45),(48,15),(84,45)],fill=c,width=w);d.line([(23,38),(23,80),(73,80),(73,38)],fill=c,width=w);d.line([(41,80),(41,59),(56,59),(56,80)],fill=c,width=w)
  elif name=='trends':
   d.line([(17,17),(17,79),(83,79)],fill=c,width=w);d.line([(25,60),(40,44),(54,53),(76,24)],fill=c,width=w)
   for x,y in [(25,60),(40,44),(54,53),(76,24)]:d.ellipse((x-4,y-4,x+4,y+4),fill=c)
  elif name=='calendar':
   d.rounded_rectangle((17,23,79,82),radius=9,outline=c,width=w);d.line([(17,40),(79,40)],fill=c,width=w)
   for x in [32,63]:d.line([(x,13),(x,30)],fill=c,width=w)
   for x in [32,49,65]:
    for y in [54,69]:d.ellipse((x-3,y-3,x+3,y+3),fill=c)
  else:
   d.ellipse((34,13,63,43),outline=c,width=w);d.arc((19,48,78,104),180,360,fill=c,width=w);d.line([(19,77),(78,77)],fill=c,width=w)
  im.resize((72,72),Image.Resampling.LANCZOS).save(out/(name+('-active' if active else '')+'.png'))
