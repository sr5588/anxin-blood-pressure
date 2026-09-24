from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset
import json
source=Path('artifacts/pdf/NotoSansSC.ttf')
font=TTFont(source);font=instantiateVariableFont(font,{'wght':400},inplace=True)
chars=set(Path('shared/pdf.ts').read_text()+'最近7个自然日全部历史0123456789 .:/|-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')
options=subset.Options();options.name_IDs=['*'];options.notdef_glyph=True
sub=subset.Subsetter(options=options);sub.populate(text=''.join(chars));sub.subset(font)
font.save('assets/fonts/report-subset.ttf')
cmap=font.getBestCmap();upem=font['head'].unitsPerEm
mapping={str(k):[font.getGlyphID(v),round(font['hmtx'][v][0]*1000/upem)] for k,v in cmap.items()}
fonthex=Path('assets/fonts/report-subset.ttf').read_bytes().hex()
Path('shared/pdf-font.ts').write_text('// Noto Sans SC subset, SIL Open Font License. See assets/fonts/OFL.txt.\nexport const fontHex='+json.dumps(fonthex)+';\nexport const glyphs:Record<string,[number,number]>='+json.dumps(mapping,separators=(',',':'))+';\n')
print('Embedded PDF subset:',len(fonthex)//2,'bytes;',len(mapping),'glyphs')
