const { test, expect } = require('@playwright/test');

test('first launch prompts manual exclusive code, then supports barcode, copy, fullscreen scan, and help dialog', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await expect(page.getByRole('button', { name: '专属码', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.bottom-nav button')).toHaveCount(2);

  // Ensure top illustration loads with real pixels
  const locker = page.locator('.locker-illustration');
  await expect(locker).toBeVisible();
  await expect.poll(() => locker.evaluate(img => img.complete && img.naturalWidth > 100)).toBe(true);

  // First launch has NO built-in exclusive code
  await expect(page.locator('#exclusive-empty')).toBeVisible();
  await expect(page.locator('#exclusive-card')).toBeHidden();
  await expect(page.locator('#copy-exclusive')).toHaveCount(0);
  await expect(page.locator('#header-add-exclusive')).toBeHidden();
  await page.screenshot({ path: 'test-results/exclusive-first-launch.png', fullPage: true, animations: 'disabled' });

  // Add exclusive code manually on first use
  await page.locator('#empty-add-exclusive').click();
  await expect(page.locator('#exclusive-dialog')).toBeVisible();
  await page.locator('#exclusive-code-input').fill('a12bc345');
  await page.locator('[data-exclusive-label="我的"]').click();
  await expect(page.locator('#barcode-preview-box svg.barcode-svg')).toBeVisible();
  await page.locator('#exclusive-form [type="submit"]').click();

  await expect(page.locator('#exclusive-card')).toBeVisible();
  await expect(page.locator('#exclusive-number')).toHaveText('A12BC345');
  await expect(page.locator('#exclusive-barcode-stage svg.barcode-svg')).toBeVisible();
  await expect(page.locator('#header-add-exclusive')).toBeVisible();
  await expect(page.locator('#copy-exclusive')).toHaveCount(0);
  await expect(page.locator('#exclusive-switcher [data-exclusive-select]')).toHaveText(['我的']);
  await expect(page.locator('#exclusive-switcher')).not.toContainText('A12BC345');
  await page.screenshot({ path: 'test-results/exclusive-main.png', fullPage: true, animations: 'disabled' });

  // Enlarged rotated fullscreen scan dialog
  await page.locator('#enlarge-exclusive').click();
  await expect(page.locator('#barcode-dialog')).toBeVisible();
  await expect(page.locator('#fullscreen-scan-stage')).toHaveClass(/is-rotated/);
  await expect(page.locator('#fullscreen-barcode-stage svg.barcode-svg')).toBeVisible();
  await page.locator('#fullscreen-copy').click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('A12BC345');
  await expect(page.locator('#toast')).toContainText('A12BC345');
  await page.screenshot({ path: 'test-results/enlarged-code.png', animations: 'disabled' });
  await page.locator('#toggle-scan-orientation').click();
  await expect(page.locator('#fullscreen-scan-stage')).not.toHaveClass(/is-rotated/);
  await page.locator('#fullscreen-scan-stage').click();
  await expect(page.locator('#barcode-dialog')).not.toBeVisible();

  // Android back closes dialog then switches tab
  await page.locator('#enlarge-exclusive').click();
  expect(await page.evaluate(() => window.handleAndroidBack())).toBe(true);
  await expect(page.locator('#barcode-dialog')).not.toBeVisible();

  // Help dialog opens and closes
  await page.locator('#open-help').click();
  await expect(page.locator('#help-dialog')).toBeVisible();
  await page.locator('#help-dialog .primary-button').click();
  await expect(page.locator('#help-dialog')).not.toBeVisible();

  // Bottom nav switching
  await page.getByRole('button', { name: '取件码', exact: true }).click();
  await expect(page.locator('#pickup-page')).toBeVisible();
  await expect(page.locator('#exclusive-page')).not.toBeVisible();
  expect(await page.evaluate(() => window.handleAndroidBack())).toBe(true);
  await expect(page.locator('#exclusive-page')).toBeVisible();
  expect(await page.evaluate(() => window.handleAndroidBack())).toBe(false);
  await page.getByRole('button', { name: '取件码', exact: true }).click();
  await page.screenshot({ path: 'test-results/pickup-empty.png', fullPage: true, animations: 'disabled' });
});

test('anyone can add, switch, edit, import screenshot, and delete exclusive codes', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');

  // First user adds their own exclusive code from empty state
  await page.locator('#empty-add-exclusive').click();
  await page.locator('#exclusive-code-input').fill('A12BC345');
  await page.locator('[data-exclusive-label="我的"]').click();
  await page.locator('#exclusive-form [type="submit"]').click();
  await expect(page.locator('#exclusive-number')).toHaveText('A12BC345');

  // Add a second person's exclusive code
  await page.locator('#header-add-exclusive').click();
  await expect(page.locator('#exclusive-dialog')).toBeVisible();
  await page.locator('#exclusive-code-input').fill('b98xy765');
  await page.locator('[data-exclusive-label="室友"]').click();
  await expect(page.locator('#barcode-preview-box svg.barcode-svg')).toBeVisible();
  await page.screenshot({ path: 'test-results/exclusive-editor.png', animations: 'disabled' });
  await page.locator('#exclusive-form [type="submit"]').click();

  await expect(page.locator('#exclusive-number')).toHaveText('B98XY765');
  await expect(page.locator('#exclusive-owner-badge')).toContainText('室友');
  await expect(page.locator('#copy-exclusive')).toHaveCount(0);
  await expect(page.locator('#exclusive-switcher [data-exclusive-select]')).toHaveText(['我的', '室友']);
  await expect(page.locator('#exclusive-switcher')).not.toContainText('A12BC345');
  await expect(page.locator('#exclusive-switcher')).not.toContainText('B98XY765');

  // Reload cold-starts on the first exclusive code in order
  await page.reload();
  await expect(page.locator('#exclusive-number')).toHaveText('A12BC345');
  await expect(page.locator('#exclusive-switcher [data-exclusive-select]')).toHaveText(['我的', '室友']);

  // Switch between exclusive codes via label-only chips
  await page.locator('.switcher-chip', { hasText: '室友' }).click();
  await expect(page.locator('#exclusive-number')).toHaveText('B98XY765');
  await page.locator('.switcher-chip', { hasText: '我的' }).click();
  await expect(page.locator('#exclusive-number')).toHaveText('A12BC345');

  // Edit B98XY765 and import a synthetic barcode PNG screenshot
  const syntheticBarcodePng = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 120;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 320, 120);
    ctx.fillStyle = '#000000';
    for (let x = 24; x < 296; x += 6) {
      ctx.fillRect(x, 20, (x % 12 === 0) ? 3 : 2, 80);
    }
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('.switcher-chip', { hasText: '室友' }).click();
  await page.locator('#edit-exclusive').click();
  await page.locator('#barcode-file-input').setInputFiles({
    name: 'sample-barcode.png',
    mimeType: 'image/png',
    buffer: Buffer.from(syntheticBarcodePng, 'base64')
  });
  await expect(page.locator('#barcode-preview-box img')).toBeVisible();
  await page.locator('#exclusive-form [type="submit"]').click();
  await expect(page.locator('#exclusive-barcode-stage img.custom-barcode-img')).toBeVisible();
  await expect(page.locator('#exclusive-owner-badge')).toContainText('微信原图');

  // Delete B98XY765 falls back cleanly to A12BC345, then deleting last returns to empty state
  await page.locator('#edit-exclusive').click();
  await page.locator('#delete-exclusive-btn').click();
  await expect(page.locator('#exclusive-number')).toHaveText('A12BC345');
  await page.locator('#edit-exclusive').click();
  await page.locator('#delete-exclusive-btn').click();
  await expect(page.locator('#exclusive-empty')).toBeVisible();
  await expect(page.locator('#copy-exclusive')).toHaveCount(0);
});

test('exclusive switcher hides raw codes for unlabeled entries and supports long-press drag reordering', async ({ page }) => {
  await page.goto('/');

  // Add 1st labeled code
  await page.locator('#empty-add-exclusive').click();
  await page.locator('#exclusive-code-input').fill('A12BC345');
  await page.locator('[data-exclusive-label="我的"]').click();
  await page.locator('#exclusive-form [type="submit"]').click();

  // Add 2nd unlabeled code -> single unnamed shows "专属码"
  await page.locator('#header-add-exclusive').click();
  await page.locator('#exclusive-code-input').fill('C34DE567');
  await page.locator('#exclusive-form [type="submit"]').click();
  await expect(page.locator('#exclusive-switcher [data-exclusive-select]')).toHaveText(['我的', '专属码']);
  await expect(page.locator('#exclusive-switcher')).not.toContainText('C34DE567');

  // Add 3rd unlabeled code -> multiple unnamed show "专属码 1", "专属码 2"
  await page.locator('#header-add-exclusive').click();
  await page.locator('#exclusive-code-input').fill('D56FG789');
  await page.locator('#exclusive-form [type="submit"]').click();
  await expect(page.locator('#exclusive-switcher [data-exclusive-select]')).toHaveText(['我的', '专属码 1', '专属码 2']);
  await expect(page.locator('#exclusive-switcher')).not.toContainText('A12BC345');
  await expect(page.locator('#exclusive-switcher')).not.toContainText('C34DE567');
  await expect(page.locator('#exclusive-switcher')).not.toContainText('D56FG789');

  // Switch active view to "我的" (A12BC345) before testing gestures
  await page.locator('.switcher-chip', { hasText: '我的' }).click();
  await expect(page.locator('#exclusive-number')).toHaveText('A12BC345');

  // Quick swipe (<300ms, >8px) must NOT reorder
  const chipFirst = page.locator('#exclusive-switcher [data-exclusive-select]').nth(0);
  const chipSecond = page.locator('#exclusive-switcher [data-exclusive-select]').nth(1);
  const boxFirst = await chipFirst.boundingBox();
  const boxSecond = await chipSecond.boundingBox();
  await page.mouse.move(boxSecond.x + boxSecond.width / 2, boxSecond.y + boxSecond.height / 2);
  await page.mouse.down();
  await page.mouse.move(boxFirst.x + 4, boxFirst.y + boxFirst.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('#exclusive-switcher [data-exclusive-select]')).toHaveText(['我的', '专属码 1', '专属码 2']);

  // Long-press (>300ms) and drag "专属码 2" (D56FG789) to the 1st position
  const chipThird = page.locator('#exclusive-switcher [data-exclusive-select]').nth(2);
  const boxThird = await chipThird.boundingBox();
  await page.mouse.move(boxThird.x + boxThird.width / 2, boxThird.y + boxThird.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(360);
  await expect(chipThird).toHaveClass(/is-dragging/);
  await page.mouse.move(boxFirst.x + 2, boxFirst.y + boxFirst.height / 2, { steps: 12 });
  await page.mouse.up();

  // Order updates immediately, add-chip remains last, toast shown, active code NOT accidentally switched
  await expect(page.locator('#exclusive-switcher [data-exclusive-select]')).toHaveText(['专属码 1', '我的', '专属码 2']);
  await expect(page.locator('#exclusive-switcher .switcher-chip').last()).toHaveAttribute('data-exclusive-add', '1');
  await expect(page.locator('#toast')).toContainText('已调整专属码顺序');
  await expect(page.locator('#exclusive-number')).toHaveText('A12BC345');
  await page.screenshot({ path: 'test-results/exclusive-reordered.png', fullPage: true, animations: 'disabled' });

  // Cold launch (reload) automatically displays the 1st exclusive code (D56FG789)
  await page.reload();
  await expect(page.locator('#exclusive-number')).toHaveText('D56FG789');
  await expect(page.locator('#exclusive-owner-badge')).toContainText('专属码 1');
  await expect(page.locator('#exclusive-switcher [data-exclusive-select]')).toHaveText(['专属码 1', '我的', '专属码 2']);

  // Normal tap still switches cleanly right after reload
  await page.locator('.switcher-chip', { hasText: '我的' }).click();
  await expect(page.locator('#exclusive-number')).toHaveText('A12BC345');
});

test('pickup codes persist and support edit, duplicate validation, and delete', async ({ page }) => {
  await page.goto('/#pickup');
  await page.locator('#empty-add-code').click();
  await page.locator('#code-input').fill('8-2-3065');
  await page.locator('[data-label="智能柜"]').click();
  await page.locator('#code-form [type="submit"]').click();
  await expect(page.locator('.pickup-code')).toHaveText('8-2-3065');
  await expect(page.locator('.pickup-label')).toHaveText('智能柜');
  await expect(page.locator('#nav-count')).toHaveText('1');
  await page.reload();
  await expect(page.locator('.pickup-code')).toHaveText('8-2-3065');
  await page.locator('[data-action="edit"]').click();
  await page.locator('#code-input').fill('A 9036');
  await page.locator('#label-input').fill('北门驿站');
  await page.locator('#code-form [type="submit"]').click();
  await expect(page.locator('.pickup-code')).toHaveText('A 9036');
  await page.locator('#add-code').click();
  await page.locator('#code-input').fill('a 9036');
  await page.locator('#code-form [type="submit"]').click();
  await expect(page.locator('#code-error')).toHaveText('这个取件码已经保存过了');
  await page.locator('#edit-dialog .close-dialog').click();
  await page.locator('[data-action="delete"]').click();
  await page.locator('#confirm-delete').click();
  await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('.pickup-card')).toHaveCount(0);
});

test('escapes stored labels, fits small phones, and works offline', async ({ page, context }) => {
  test.setTimeout(60000);
  await page.goto('/#pickup');
  await expect(page.locator('#pickup-page')).toBeVisible();
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await expect(page.locator('#exclusive-empty')).toBeVisible();
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(bodyWidth).toBe(320);

  // Verify no device/OEM-specific wording or hardcoded exclusive code leaks into the UI
  const fullHtml = await page.content();
  expect(fullHtml).not.toMatch(/ColorOS|一加|OnePlus/i);
  await expect(page.locator('#exclusive-number')).toHaveText('');

  // Add an exclusive code and verify offline persistence
  await page.locator('#empty-add-exclusive').click();
  await page.locator('#exclusive-code-input').fill('A12BC345');
  await page.locator('#exclusive-label-input').fill('这是一个很长很长很长的专属码备注名称');
  await page.locator('#exclusive-form [type="submit"]').click();
  await expect(page.locator('#exclusive-barcode-stage svg.barcode-svg')).toBeVisible();
  const narrowExclusiveWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(narrowExclusiveWidth).toBe(320);

  await page.goto('/#pickup');
  const pickupWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(pickupWidth).toBe(320);
  await page.locator('#empty-add-code').click();
  await page.locator('#code-input').fill('9036');
  const unsafeLabel = '<img src=x data-test=blocked>';
  await page.locator('#label-input').evaluate((element, value) => { element.value = value; }, unsafeLabel);
  await page.locator('#code-form [type="submit"]').click();
  await expect(page.locator('.pickup-label')).toHaveText(unsafeLabel);
  await expect(page.locator('.pickup-label img')).toHaveCount(0);
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#exclusive-number')).toHaveText('A12BC345');
  await expect(page.locator('#exclusive-barcode-stage svg.barcode-svg')).toBeVisible();
});

test('smart paste import, clipboard banner, and Android SMS/notification/share callbacks', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#pickup');

  // 1. Batch paste import with mixed express messages + OTP (must filter OTP)
  await page.locator('#open-smart-import').click();
  await expect(page.locator('#import-dialog')).toBeVisible();
  await page.locator('#import-text-input').fill([
    '【菜鸟驿站】您的包裹已到幸福小区菜鸟驿站，凭取件码8-2-3065领取',
    '【淘宝】验证码 849201，15分钟内有效，切勿泄露给他人',
    '【丰巢】请凭取件码 654321 到东门丰巢柜取件'
  ].join('\n'));

  await expect(page.locator('.import-preview-item')).toHaveCount(2);
  await expect(page.locator('#import-parse-summary')).toContainText('已识别 2 条');
  await page.screenshot({ path: 'test-results/import-paste-modal.png', animations: 'disabled' });

  await page.locator('#import-confirm-btn').click();
  await expect(page.locator('#import-dialog')).not.toBeVisible();
  await expect(page.locator('.pickup-card')).toHaveCount(2);
  await expect(page.locator('#nav-count')).toHaveText('2');

  // 2. Simulated Android bridge: SMS scan + WeChat notification + clipboard banner + Auto tab screenshot
  await page.evaluate(() => {
    const mockStatus = {
      isAndroid: true,
      hasSmsPermission: true,
      smsAutoSync: true,
      smsScanDays: 7,
      hasNotificationAccess: true,
      notifyEnabled: true,
      notifyCapturedCount: 3,
      lastSmsSyncTs: Date.now()
    };
    window.AndroidApp = {
      copyText() {},
      setScanMode() {},
      getAutoImportStatus: () => JSON.stringify(mockStatus),
      drainPendingMessages: () => '[]',
      requestSmsScan() {},
      setSmsAutoSync(v) { mockStatus.smsAutoSync = v; },
      setSmsScanDays(d) { mockStatus.smsScanDays = d; },
      setNotifyCaptureEnabled(v) { mockStatus.notifyEnabled = v; },
      openNotificationSettings() {},
      openAppSettings() {},
      requestClipboardCheck() {}
    };
    window.onAndroidAutoImportStatus(JSON.stringify(mockStatus));
    window.onAndroidIncomingMessages(JSON.stringify([
      { source: 'notification', app: '微信', title: '易递通', text: '包裹到站通知\n取件码：A12-3045\n驿站名称：北门易递通驿站', timestamp: Date.now() }
    ]));
    window.onAndroidSmsScanResult(JSON.stringify([
      { source: 'sms', address: '10690000', body: '【兔喜生活】您有1个中通包裹已到阳光花园兔喜快递超市，取件码：5-3-1028', date: Date.now() },
      { source: 'sms', address: '10690000', body: '【菜鸟驿站】重复提醒：取件码8-2-3065', date: Date.now() }
    ]), false, '');
    window.onAndroidClipboardText('【顺丰速运】您的快件已存入西门丰巢柜，取件码998877', false);
  });

  await expect(page.locator('.pickup-card')).toHaveCount(4);
  await expect(page.locator('#quick-notify-label')).toHaveText('通知抓取 · 已开');
  await expect(page.locator('#clipboard-banner')).toBeVisible();
  await expect(page.locator('#clipboard-banner-code')).toHaveText('998877');
  await page.screenshot({ path: 'test-results/pickup-auto-import.png', animations: 'disabled' });

  // One-tap clipboard banner import
  await page.locator('#clipboard-import-btn').click();
  await expect(page.locator('#clipboard-banner')).toBeHidden();
  await expect(page.locator('.pickup-card')).toHaveCount(5);

  // Inspect Auto tab visually
  await page.locator('#quick-notify-btn').click();
  await expect(page.locator('#import-panel-auto')).toBeVisible();
  await expect(page.locator('#notify-status-pill')).toHaveText('监听中');
  await expect(page.locator('#sms-status-pill')).toHaveText('已授权');
  await page.screenshot({ path: 'test-results/import-auto-modal.png', animations: 'disabled' });
  await page.locator('#import-dialog .close-dialog').click();

  // 3. Share intent opens pre-filled paste import dialog
  await page.evaluate(() => {
    window.onAndroidIncomingMessages(JSON.stringify([
      { source: 'share', app: '分享', title: '', text: '【妈妈驿站】您的包裹已到南门妈妈驿站，取件码：B-205', timestamp: Date.now() }
    ]));
  });
  await expect(page.locator('#import-dialog')).toBeVisible();
  await expect(page.locator('.import-preview-code')).toHaveText('B-205');
});

test('mark picked-up prevents old SMS resurrection, allows reused shelf codes, and auto-clears signed-off notifications', async ({ page }) => {
  await page.goto('/#pickup');

  const now = Date.now();
  const oldTs = now - 3 * 3600 * 1000;
  const futureReusedTs = now + 5 * 60 * 1000;

  await page.evaluate(({ oldTs }) => {
    const mockStatus = {
      isAndroid: true,
      hasSmsPermission: true,
      smsAutoSync: true,
      smsScanDays: 7,
      hasNotificationAccess: true,
      notifyEnabled: true,
      notifyCapturedCount: 2,
      lastSmsSyncTs: Date.now(),
      smsIgnoreBeforeTs: 0
    };
    window.AndroidApp = {
      copyText() {},
      setScanMode() {},
      getAutoImportStatus: () => JSON.stringify(mockStatus),
      drainPendingMessages: () => '[]',
      requestSmsScan() {},
      setSmsAutoSync(v) { mockStatus.smsAutoSync = v; },
      setSmsScanDays(d) { mockStatus.smsScanDays = d; },
      setSmsIgnoreBeforeNow() { mockStatus.smsIgnoreBeforeTs = Date.now(); },
      clearSmsIgnoreBefore() { mockStatus.smsIgnoreBeforeTs = 0; },
      setNotifyCaptureEnabled(v) { mockStatus.notifyEnabled = v; },
      openNotificationSettings() {},
      openAppSettings() {},
      requestClipboardCheck() {}
    };
    window.onAndroidAutoImportStatus(JSON.stringify(mockStatus));
    // Simulate SMS scan containing: 2 active packages + 1 package that has BOTH arrival & signed-off SMS
    window.onAndroidSmsScanResult(JSON.stringify([
      { source: 'sms', address: '1069', body: '【兔喜生活】您的包裹取件码 7-7-7777 已成功领取', date: oldTs + 3600000 },
      { source: 'sms', address: '1069', body: '【兔喜生活】您的包裹已到兔喜超市，取件码 7-7-7777', date: oldTs },
      { source: 'sms', address: '1069', body: '【菜鸟驿站】您的包裹已到北门驿站，取件码 8-2-3065', date: oldTs },
      { source: 'sms', address: '1069', body: '【丰巢】请凭取件码 654321 到东门丰巢柜取件', date: oldTs }
    ]), false, '');
  }, { oldTs });

  // 7-7-7777 already had signed-off SMS, so only 2 pending codes should be imported
  await expect(page.locator('.pickup-card')).toHaveCount(2);
  await expect(page.locator('#pending-list-count')).toHaveText('待取 2 件');

  // Mark 8-2-3065 as picked up (1-tap, no confirm dialog)
  await page.locator('.pickup-card', { hasText: '8-2-3065' }).locator('[data-action="picked"]').click();
  await expect(page.locator('.pickup-card')).toHaveCount(1);
  await expect(page.locator('#history-section')).toBeVisible();
  await expect(page.locator('#history-summary-label')).toHaveText('已取件记录 (1)');

  // Re-scanning the exact same old SMS must NOT resurrect 8-2-3065 or 7-7-7777
  await page.evaluate(({ oldTs }) => {
    window.onAndroidSmsScanResult(JSON.stringify([
      { source: 'sms', address: '1069', body: '【菜鸟驿站】您的包裹已到北门驿站，取件码 8-2-3065', date: oldTs },
      { source: 'sms', address: '1069', body: '【兔喜生活】您的包裹已到兔喜超市，取件码 7-7-7777', date: oldTs }
    ]), true, '');
  }, { oldTs });
  await expect(page.locator('.pickup-card')).toHaveCount(1);

  // Signed-off notification auto-clears remaining pending code 654321
  await page.evaluate(() => {
    window.onAndroidIncomingMessages(JSON.stringify([
      { source: 'notification', app: '微信', title: '丰巢', text: '您的快件（取件码 654321）已取出，欢迎下次使用', timestamp: Date.now() }
    ]));
  });
  await expect(page.locator('.pickup-card')).toHaveCount(0);
  await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('#history-summary-label')).toHaveText('已取件记录 (2)');

  // Reused shelf code 8-2-3065 with a genuinely NEWER arrival timestamp DOES import
  await page.evaluate(({ futureReusedTs }) => {
    window.onAndroidSmsScanResult(JSON.stringify([
      { source: 'sms', address: '1069', body: '【菜鸟驿站】您的新包裹已到北门驿站，取件码 8-2-3065', date: futureReusedTs }
    ]), false, '');
  }, { futureReusedTs });
  await expect(page.locator('.pickup-card')).toHaveCount(1);
  await expect(page.locator('.pickup-code')).toHaveText('8-2-3065');

  // Expand history, verify visual layout, restore 654321, then mark all picked
  await page.locator('.history-summary').click();
  await expect(page.locator('.history-item')).toHaveCount(2);
  await expect(page.locator('.history-item', { hasText: '654321' })).toContainText('签收自动核销');
  await page.screenshot({ path: 'test-results/pickup-picked-history.png', fullPage: true, animations: 'disabled' });

  await page.locator('.history-item', { hasText: '654321' }).locator('.history-restore-btn').click();
  await expect(page.locator('.pickup-card')).toHaveCount(2);
  await expect(page.locator('#history-summary-label')).toHaveText('已取件记录 (1)');

  // Batch mark all as picked
  await page.locator('#mark-all-picked').click();
  await expect(page.locator('.pickup-card')).toHaveCount(0);
  await expect(page.locator('#history-summary-label')).toHaveText('已取件记录 (2)');

  // Clear history display keeps anti-resurrection active for old SMS
  await page.locator('#clear-history-btn').click();
  await expect(page.locator('#history-section')).toBeHidden();
  await page.evaluate(({ oldTs }) => {
    window.onAndroidSmsScanResult(JSON.stringify([
      { source: 'sms', address: '1069', body: '【丰巢】请凭取件码 654321 到东门丰巢柜取件', date: oldTs }
    ]), true, '');
  }, { oldTs });
  await expect(page.locator('.pickup-card')).toHaveCount(0);

  // SMS baseline "只认此后新短信" + "今天" chip + Reset
  await page.locator('#quick-notify-btn').click();
  await expect(page.locator('#import-panel-auto')).toBeVisible();
  await page.locator('[data-sms-days="1"]').click();
  await expect(page.locator('#run-sms-scan-btn')).toContainText('今天');
  await page.locator('#ignore-old-sms-btn').click();
  await expect(page.locator('#sms-baseline-row')).toBeVisible();
  await page.screenshot({ path: 'test-results/import-auto-baseline.png', animations: 'disabled' });
  await page.locator('#reset-sms-baseline-btn').click();
  await expect(page.locator('#sms-baseline-row')).toBeHidden();
});

test('platform identity & live pickup shortcuts launch apps, fallback to web, and persist drag order', async ({ page }) => {
  await page.addInitScript(() => {
    window.__bridgeCalls = [];
    window.__openAppFailPrefixes = [];
    window.AndroidApp = {
      getAutoImportStatus: () => JSON.stringify({
        isAndroid: true, hasSmsPermission: true, smsAutoSync: true, smsScanDays: 7,
        smsIgnoreBeforeTs: 0, hasNotificationAccess: true, notifyEnabled: true, notifyCapturedCount: 0
      }),
      drainPendingMessages: () => '[]',
      requestClipboardCheck: () => {},
      openApp: (uri) => {
        window.__bridgeCalls.push({ method: 'openApp', arg: uri });
        return !window.__openAppFailPrefixes.some(prefix => uri.startsWith(prefix));
      },
      openWeb: (url) => {
        window.__bridgeCalls.push({ method: 'openWeb', arg: url });
        return true;
      }
    };
  });

  await page.goto('/');
  const identityTiles = page.locator('#platform-identity-grid .platform-tile');
  await expect(identityTiles).toHaveCount(3);
  await expect(identityTiles.nth(0)).toContainText('淘宝身份码');
  await expect(identityTiles.nth(1)).toContainText('拼多多身份码');
  await expect(identityTiles.nth(2)).toContainText('京东身份码');

  await identityTiles.nth(0).click();
  await expect(page.locator('#toast')).toContainText('已打开淘宝身份码');
  await identityTiles.nth(1).click();
  await expect(page.locator('#toast')).toContainText('已打开多多驿站身份码');
  await identityTiles.nth(2).click();
  await expect(page.locator('#toast')).toContainText('已打开京东');

  // Long-press drag reorder on identity grid (drag 淘宝身份码 onto 京东身份码)
  const firstBox = await identityTiles.nth(0).boundingBox();
  const lastBox = await identityTiles.nth(2).boundingBox();
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(480);
  await page.mouse.move(lastBox.x + lastBox.width / 2, lastBox.y + lastBox.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#platform-identity-grid .platform-tile').nth(2)).toContainText('淘宝身份码');

  await page.screenshot({ path: 'test-results/exclusive-with-platforms.png', fullPage: true, animations: 'disabled' });

  // Switch to pickup page and verify all 6 live pickup platform entries
  await page.locator('.nav-item[data-page="pickup"]').click();
  const pickupTiles = page.locator('#platform-pickup-grid .platform-tile');
  await expect(pickupTiles).toHaveCount(6);

  await page.evaluate(() => {
    window.__bridgeCalls = [];
    window.__openAppFailPrefixes = ['kwai://', 'snssdk1128://'];
  });

  await pickupTiles.filter({ hasText: '淘宝待取' }).click();
  await expect(page.locator('#toast')).toContainText('已打开淘宝待取列表');

  // Missing app with web fallback -> calls openWeb
  await pickupTiles.filter({ hasText: '快手待取' }).click();
  await expect(page.locator('#toast')).toContainText('未检测到快手客户端，已改用浏览器打开');

  // Missing app without web fallback -> shows install hint without calling openWeb
  await pickupTiles.filter({ hasText: '抖音待取' }).click();
  await expect(page.locator('#toast')).toContainText('未检测到抖音客户端');

  const calls = await page.evaluate(() => window.__bridgeCalls);
  expect(calls.some(c => c.method === 'openApp' && c.arg.startsWith('tbopen://'))).toBe(true);
  expect(calls.some(c => c.method === 'openApp' && c.arg.startsWith('kwai://'))).toBe(true);
  expect(calls.some(c => c.method === 'openWeb' && c.arg.startsWith('https://app.kwaixiaodian.com/'))).toBe(true);
  expect(calls.some(c => c.method === 'openApp' && c.arg === 'snssdk1128://ecom_order_list')).toBe(true);
  expect(calls.filter(c => c.method === 'openWeb')).toHaveLength(1);

  await page.screenshot({ path: 'test-results/pickup-with-platforms.png', fullPage: true, animations: 'disabled' });

  // Reload persists reordered identity tiles
  await page.goto('/');
  await expect(page.locator('#platform-identity-grid .platform-tile').nth(2)).toContainText('淘宝身份码');
});
