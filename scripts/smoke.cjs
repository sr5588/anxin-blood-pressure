const automator = require('miniprogram-automator');
const fs = require('node:fs');
(async () => {
  fs.mkdirSync('artifacts/screenshots', { recursive: true });
  let mini;
  try {
    mini = await automator.connect({ wsEndpoint: process.env.ANXIN_WS || 'ws://127.0.0.1:9421' });
  } catch {
    mini = await automator.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      projectPath: process.cwd(),
      port: 9421,
      timeout: 60000,
      trustProject: true,
    });
  }
  mini.on('exception', (e) => console.error('APP_EXCEPTION', e));
  await new Promise((r) => setTimeout(r, 8000));
  await mini.callWxMethod('reLaunch', { url: '/pages/today/index' });
  await new Promise((r) => setTimeout(r, 4000));
  const page = await mini.currentPage();
  await page.waitFor(500);
  console.log('PAGE', page.path);
  console.log('DATA', JSON.stringify(await page.data()));
  await mini.screenshot({ path: 'artifacts/screenshots/today-empty.png' });
  await mini.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
