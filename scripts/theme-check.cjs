const a = require('miniprogram-automator'),
  assert = require('assert/strict'),
  fs = require('fs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const m = await a.connect({ wsEndpoint: 'ws://127.0.0.1:9421' });
  const previous = await m.callWxMethod('getStorageSync', 'anxin:theme');
  for (const theme of ['light', 'dark']) {
    let p = await m.switchTab('/pages/profile/index');
    await p.callMethod('changeTheme', { currentTarget: { dataset: { theme } } });
    assert.equal(await p.data('theme'), theme);
    p = await m.switchTab('/pages/today/index');
    await wait(500);
    assert.equal(await p.data('theme'), theme);
    assert.ok((await p.data('quote')).length > 8);
    assert.equal((await p.$$('.day')).length, 7);
    if ((await p.data('safety'))?.level === 'normal') assert.equal(await p.$('.notice'), null);
    if ((await p.data('pending')) === 0) assert.equal(await p.$('.sync-hint'), null);
    const week = await p.$('.week-card');
    const weekOffset = await week.offset(),
      weekSize = await week.size();
    const homeWindow = await m.evaluate(() => wx.getWindowInfo());
    assert.ok(
      Number(weekOffset.top) + Number(weekSize.height) <= homeWindow.windowHeight - 72,
      'record button must not cover the week card on the test device',
    );
    await m.screenshot({ path: 'artifacts/screenshots/today-' + theme + '.png' });
    await m.callWxMethod('setStorageSync', 'anxin:mock:draft', null);
    p = await m.navigateTo('/pages/measure/index');
    if ((await p.data('stage')) === 'prepare') await p.callMethod('ready');
    await wait(500);
    assert.equal(await p.data('theme'), theme);
    assert.equal(await p.$('.preparation-art'), null);
    assert.equal(await p.$('.details-card'), null);
    assert.equal((await p.$$('.picker-item')).length, 201 + 151 + 191);
    await m.screenshot({ path: 'artifacts/screenshots/picker-' + theme + '.png' });
    const save = await p.$('.save-reading'),
      position = await save.offset(),
      size = await save.size();
    const windowInfo = await m.evaluate(() => wx.getWindowInfo());
    assert.ok(
      Number(position.top) + Number(size.height) <= windowInfo.windowHeight,
      'save button must be visible without scrolling',
    );
    const picker = await p.$('picker-view');
    await picker.trigger('change', { value: [69, 47, 39] });
    await wait(400);
    assert.equal(await p.data('confirmed'), true);
    assert.deepEqual(await p.data('values'), [69, 47, 39]);
    await p.callMethod('toggleSound');
    const sound = await p.data('soundOn');
    assert.equal(await m.callWxMethod('getStorageSync', 'anxin:mock:wheelSound'), sound);
    await p.callMethod('toggleSound');
  }
  if (previous === 'light' || previous === 'dark')
    await m.callWxMethod('setStorageSync', 'anxin:theme', previous);
  else await m.callWxMethod('removeStorageSync', 'anxin:theme');
  await m.switchTab('/pages/today/index');
  await m.callWxMethod('setStorageSync', 'anxin:mock:draft', null);
  console.log('PASS light/dark themes, holiday quote, picker native change and sound toggle');
  fs.writeFileSync(
    'artifacts/theme-result.json',
    JSON.stringify(
      {
        status: 'passed',
        checks: [
          'light and dark home',
          'light and dark picker',
          'native picker change arms save',
          'sound preference persists false',
          'daily greeting present',
          'save button visible without scrolling in both themes',
          'home week card remains above record button',
        ],
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  m.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
