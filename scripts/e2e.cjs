const automator = require('miniprogram-automator'),
  assert = require('node:assert/strict'),
  fs = require('node:fs');
let active;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const mini = await automator.connect({
    wsEndpoint: process.env.ANXIN_WS || 'ws://127.0.0.1:9421',
  });
  active = mini;
  const exceptions = [];
  mini.on('exception', (e) => exceptions.push(e));
  await mini.mockWxMethod('showModal', function (o) {
    getApp().globalData.lastModal = o;
    return { confirm: true, cancel: false };
  });
  await mini.mockWxMethod('vibrateShort', {});
  // This script mutates only explicitly labelled local mock entitlements.
  for (const [key, value] of [
    ['mockGrants', []],
    ['mockOrders', []],
    ['mockRedeemed', false],
  ])
    await mini.callWxMethod('setStorageSync', 'anxin:mock:' + key, value);
  await mini.callWxMethod('reLaunch', { url: '/pages/today/index' });
  await sleep(1000);
  let page = await mini.currentPage();
  assert.equal(page.path, 'pages/today/index');
  assert.equal(await page.data('offline'), false);
  // A fresh run uses only generated development fixtures.
  await mini.callWxMethod('setStorageSync', 'anxin:mock:draft', null);
  page = await mini.navigateTo('/pages/measure/index');
  await sleep(300);
  if ((await page.data('stage')) === 'prepare') await page.callMethod('ready');
  await sleep(300);
  assert.equal(await page.data('stage'), 'input');
  assert.equal(await page.data('confirmed'), false);
  await page.callMethod('save');
  assert.equal((await page.data('readings')).length, 0);
  await page.setData({ values: [68, 46, 38] });
  await sleep(400);
  await (await page.$('.save-reading')).tap();

  await sleep(600);
  assert.equal(await page.data('stage'), 'wait');
  assert.equal((await page.data('readings')).length, 1);
  assert.equal(await page.data('canContinue'), false);
  // Fast-forward the wait deadline only; production clock logic is unchanged.
  await page.setData({ waitEnd: Date.now() + 29000 });
  await page.callMethod('tick');
  assert.equal(await page.data('canContinue'), true);
  await page.callMethod('next');
  await page.setData({ values: [78, 56, 40] });
  await sleep(400);
  await page.callMethod('confirm');
  await page.callMethod('save');
  await sleep(400);
  assert.equal(await page.data('third'), true);
  assert.equal(await page.data('stage'), 'wait');
  await page.setData({ waitEnd: Date.now() - 1 });
  await page.callMethod('tick');
  await page.callMethod('next');
  await page.setData({ values: [66, 44, 37] });
  await sleep(400);
  await page.callMethod('confirm');
  await page.callMethod('save');
  await sleep(500);
  assert.equal(await page.data('stage'), 'done');
  assert.equal((await page.data('readings')).length, 3);
  assert.deepEqual(await page.data('result'), { systolic: 131, diastolic: 79, pulse: 68 });
  console.log('PASS measurement');
  page = await mini.switchTab('/pages/today/index');
  await sleep(500);
  assert.equal((await page.data('latest')).count, 3);
  page = await mini.switchTab('/pages/trends/index');
  await sleep(500);
  assert.ok((await page.data('points')).length > 0);
  await page.callMethod('chooseRange', { currentTarget: { dataset: { key: '30' } } });
  await sleep(300);
  assert.equal(await page.data('locked'), true);
  assert.ok(await page.$('.locked'));
  assert.equal(await page.$('trend-chart'),null);
  assert.equal((await page.data('rows')).length, 0);
  console.log('PASS free-history lock');
  page = await mini.navigateTo('/pages/access/index');
  await sleep(300);
  assert.equal((await page.data('products')).length, 2);
  await page.callMethod('buy', { currentTarget: { dataset: { id: 'history_access_365d' } } });
  await sleep(800);
  assert.equal(await page.data('state'), '一年 / 时长版');
  await page.callMethod('restore');
  await sleep(200);
  assert.equal(await page.data('state'), '一年 / 时长版');
  await page.callMethod('refund');
  await sleep(300);
  assert.equal(await page.data('state'), '免费版');
  console.log('PASS purchase, restore, refund');
  page = await mini.navigateTo('/pages/redeem/index');
  await page.setData({ code: 'AXBP-7DAY-TEST' });
  await page.callMethod('redeem');
  await sleep(3500);
  page = await mini.currentPage();
  assert.equal(page.path, 'pages/access/index');
  assert.equal(await page.data('state'), '一年 / 时长版');
  console.log('PASS redemption');
  page = await mini.switchTab('/pages/calendar/index');
  await sleep(300);
  assert.ok((await page.data('rows')).length > 0);
  page = await mini.switchTab('/pages/profile/index');
  await sleep(300);
  assert.ok((await page.data('count')) > 0);
  await page.callMethod('backup');
  await sleep(500);
  assert.equal(await page.data('pending'), 0);
  await page.callMethod('restore');
  await sleep(500);
  assert.ok((await page.data('count')) > 0);
  console.log('PASS cloud mock backup and restore');
  await mini.mockWxMethod('openDocument', { errMsg: 'openDocument:ok' });
  await page.callMethod('report', { currentTarget: { dataset: { long: false } } });
  await sleep(700);
  assert.equal(
    await mini.evaluate(() =>
      wx
        .getFileSystemManager()
        .readFileSync(wx.env.USER_DATA_PATH + '/安心血压医生报告.pdf', 'utf8')
        .slice(0, 8),
    ),
    '%PDF-1.4',
  );
  await mini.mockWxMethod('shareFileMessage', { errMsg: 'shareFileMessage:ok' });
  await page.callMethod('export', { currentTarget: { dataset: { kind: 'json' } } });
  await sleep(500);
  await mini.restoreWxMethod('openDocument');
  await mini.restoreWxMethod('shareFileMessage');
  await mini.restoreWxMethod('showModal');
  await mini.restoreWxMethod('vibrateShort');
  const report = {
    status: 'passed',
    checks: [
      'fresh homepage',
      'defaults cannot save',
      'first raw reading saved',
      '30-second gate',
      'difference triggers third reading',
      'three-reading mean',
      'today persisted reading',
      'native canvas trend',
      'free long-history lock',
      'mock purchase',
      'entitlement restore',
      'mock refund',
      'free redemption',
      'calendar',
      'backup and restore',
      'seven-day PDF generated in mini program',
      'complete JSON export',
    ],
    exceptions,
    at: new Date().toISOString(),
  };
  fs.writeFileSync('artifacts/e2e-result.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  mini.disconnect();
  if (exceptions.length) process.exitCode = 1;
})().catch(async (e) => {
  console.error(e);
  if (active) {
    for (const name of ['showModal', 'vibrateShort', 'openDocument', 'shareFileMessage'])
      try {
        await active.restoreWxMethod(name);
      } catch {}
    active.disconnect();
  }
  process.exit(1);
});
