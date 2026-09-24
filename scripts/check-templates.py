from pathlib import Path
import subprocess,sys,re
base=Path('/Applications/wechatwebdevtools.app/Contents/Resources/app.asar.unpacked/node_modules/wcc-exec')
failed=False
for extension,tool in [('wxml','wcc'),('wxss','wcsc')]:
 for file in Path('miniprogram').rglob('*.'+extension):
  if extension=='wxml':
   for directive,value in re.findall(r'wx:(if|elif|for)="([^"]*)"',file.read_text()):
    if '{{' not in value:failed=True;print(file,'Unbound directive',directive,value)
  result=subprocess.run([str(base/tool),str(file)],capture_output=True,text=True)
  if result.returncode:failed=True;print(str(file),result.stderr)
print('Native WXML/WXSS compilation:', 'FAIL' if failed else 'PASS')
sys.exit(int(failed))
