const { test, expect } = require('@playwright/test');

async function openPlatformDrawer(page) {
  const drawer = page.locator('#platform-drawer');
  await page.locator('#platform-launcher').click();
  await expect(drawer).toBeVisible();
  await expect(page.locator('#platform-launcher')).toHaveAttribute('aria-expanded', 'true');
  await drawer.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))));
}

async function selectPlatformEntry(page, tile) {
  if (!await page.locator('#platform-drawer').isVisible()) await openPlatformDrawer(page);
  await tile.click();
  await expect(page.locator('#platform-drawer')).toBeHidden();
  await expect(page.locator('#platform-launcher')).toHaveAttribute('aria-expanded', 'false');
}

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
  await expect(page.locator('#exclusive-switcher [data-exclusive-add]')).toBeHidden();
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
  await expect(page.locator('#exclusive-switcher [data-exclusive-add]')).toBeVisible();
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
  await page.locator('#exclusive-switcher [data-exclusive-add]').click();
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
  await page.locator('#exclusive-switcher [data-exclusive-add]').click();
  await page.locator('#exclusive-code-input').fill('C34DE567');
  await page.locator('#exclusive-form [type="submit"]').click();
  await expect(page.locator('#exclusive-switcher [data-exclusive-select]')).toHaveText(['我的', '专属码']);
  await expect(page.locator('#exclusive-switcher')).not.toContainText('C34DE567');

  // Add 3rd unlabeled code -> multiple unnamed show "专属码 1", "专属码 2"
  await page.locator('#exclusive-switcher [data-exclusive-add]').click();
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

test('opens stacked pickup cards from the front card and preserves the open group after pickup', async ({ page }) => {
  await page.addInitScript(() => {
    const entries = [
      ['Q9-29', '递管家'],
      ['N7-1', '智能柜'],
      ['G9-1', ' 递管家 '],
      ['G9-2', '递管家'],
      ['G9-3', '递管家']
    ];
    localStorage.setItem('pickupCodes.v1', JSON.stringify(entries.map(([code, label]) => ({
      id: code, code, label, createdAt: Date.now()
    }))));
  });
  await page.goto('/#pickup');
  const groups = page.locator('.pickup-group');
  await expect(groups.locator('.pickup-label')).toHaveText(['递管家', '智能柜']);
  const group = groups.first();
  const toggle = group.locator('.pickup-stack-toggle');
  const frontCard = group.locator('.pickup-stack-front .pickup-card');
  await expect(group.locator('.pickup-stack-layer')).toHaveCount(3);
  await expect(group.locator('.pickup-code:visible')).toHaveText(['Q9-29']);
  await group.evaluate(element => {
    const animations = [...element.getAnimations(), ...element.closest('.page').getAnimations()];
    return Promise.all(animations.map(animation => animation.finished));
  });
  const frontPosition = await frontCard.boundingBox();
  await frontCard.locator('.pickup-code').click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(group.locator('.pickup-stack-surface .pickup-card:visible')).toHaveCount(4);
  await expect(group.locator('.pickup-code:visible')).toHaveText(['Q9-29', 'G9-1', 'G9-2', 'G9-3']);
  expect(await frontCard.boundingBox()).toEqual(frontPosition);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(group.locator('.pickup-code:visible')).toHaveText(['Q9-29']);
  expect(await frontCard.boundingBox()).toEqual(frontPosition);
  await toggle.focus();
  await toggle.press('Enter');
  for (const code of ['G9-3', 'G9-2']) {
    await group.getByRole('button', { name: `标记取件码 ${code} 为已取件`, exact: true }).click();
    await expect(group.locator('.pickup-stack-layer')).toHaveCount(code === 'G9-3' ? 2 : 1);
  }
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(group.locator('.pickup-code:visible')).toHaveText(['Q9-29', 'G9-1']);
  await expect(page.locator('#pending-list-count')).toHaveText('待取 3 件');
  await toggle.click();
  await expect(group.locator('.pickup-code:visible')).toHaveText(['Q9-29']);
  await toggle.click();
  await group.getByRole('button', { name: '标记取件码 G9-1 为已取件', exact: true }).click();
  await expect(toggle).toHaveCount(0);
  await expect(group.locator('.pickup-stack-layer')).toHaveCount(0);
  await expect(group.locator('.pickup-code:visible')).toHaveText(['Q9-29']);
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

test('platform drawer opens only the shortcuts for the active page', async ({ page }) => {
  await page.goto('/');
  const launcher = page.locator('#platform-launcher');
  const drawer = page.locator('#platform-drawer');
  await expect(drawer).toBeHidden();
  await expect(launcher).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#platform-identity-section')).toBeHidden();
  await expect(page.locator('#platform-pickup-section')).toBeHidden();

  for (const [pageName, group, title, count] of [
    ['exclusive', 'identity', '平台身份码', 3],
    ['pickup', 'pickup', '平台实时取件', 8]
  ]) {
    await page.locator(`.nav-item[data-page="${pageName}"]`).click();
    await expect(launcher).toHaveAttribute('aria-label', `展开${title}`);
    await openPlatformDrawer(page);
    await expect(drawer).toHaveAccessibleName(title);
    await expect(page.locator(`#platform-${group}-section`)).toBeVisible();
    await expect(page.locator(`#platform-${group}-grid .platform-tile`)).toHaveCount(count);
    await expect(page.locator(`#platform-${group === 'identity' ? 'pickup' : 'identity'}-section`)).toBeHidden();
    await page.locator('#close-platform-drawer').click();
    await expect(drawer).toBeHidden();
    await expect(launcher).toHaveAttribute('aria-expanded', 'false');
  }
});

test('platform drawer dismisses by close button, backdrop, Escape, and Android Back without switching pages', async ({ page }) => {
  await page.goto('/#pickup');
  const dismissals = [
    () => page.locator('#close-platform-drawer').click(),
    () => page.mouse.click(8, 8),
    () => page.keyboard.press('Escape'),
    async () => { expect(await page.evaluate(() => window.handleAndroidBack())).toBe(true); }
  ];
  for (const dismiss of dismissals) {
    await openPlatformDrawer(page);
    await dismiss();
    await expect(page.locator('#platform-drawer')).toBeHidden();
    await expect(page.locator('#platform-launcher')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.nav-item[data-page="pickup"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#page-title')).toHaveText('我的取件码');
  }
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
      },
      openInstalledApp: (packageName) => {
        window.__bridgeCalls.push({ method: 'openInstalledApp', arg: packageName });
        return packageName === 'com.cainiao.wireless';
      }
    };
  });

  await page.goto('/');
  const identityTiles = page.locator('#platform-identity-grid .platform-tile');
  await expect(identityTiles).toHaveCount(3);
  await expect(identityTiles.nth(0)).toContainText('淘宝身份码');
  await expect(identityTiles.nth(1)).toContainText('拼多多身份码');
  await expect(identityTiles.nth(2)).toContainText('菜鸟身份码');
  await expect(page.getByText('京东身份码', { exact: true })).toHaveCount(0);

  await selectPlatformEntry(page, identityTiles.nth(0));
  await expect(page.locator('#toast')).toContainText('已请求打开淘宝身份码');
  await selectPlatformEntry(page, identityTiles.nth(1));
  await expect(page.locator('#toast')).toContainText('已请求打开多多驿站身份码');
  await selectPlatformEntry(page, identityTiles.nth(2));
  await expect(page.locator('#toast')).toContainText('已请求打开菜鸟身份码');
  expect(await page.evaluate(() => window.__bridgeCalls.some(c => c.method === 'openApp' && c.arg === 'cainiao://router/station_code'))).toBe(true);

  // If Cainiao station_code deep link is rejected on an older client, falls back to Cainiao home
  await page.evaluate(() => { window.__openAppFailPrefixes = ['cainiao://']; });
  await selectPlatformEntry(page, identityTiles.nth(2));
  await expect(page.locator('#toast')).toContainText('请点首页“取件码”');
  expect(await page.evaluate(() => window.__bridgeCalls.some(c => c.method === 'openInstalledApp' && c.arg === 'com.cainiao.wireless'))).toBe(true);

  // Long-press drag reorder on identity grid (drag 淘宝身份码 onto 菜鸟身份码)
  await openPlatformDrawer(page);
  await page.locator('#platform-identity-grid').scrollIntoViewIfNeeded();
  const firstBox = await identityTiles.nth(0).boundingBox();
  const lastBox = await identityTiles.nth(2).boundingBox();
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await expect(identityTiles.nth(0)).toHaveClass(/is-dragging/);
  await page.mouse.move(lastBox.x + lastBox.width / 2, lastBox.y + lastBox.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#platform-identity-grid .platform-tile').nth(2)).toContainText('淘宝身份码');

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/exclusive-with-platforms.png', fullPage: true, animations: 'disabled' });
  await page.locator('#close-platform-drawer').click();

  // Switch to pickup page and verify all eight symmetrical platform entries.
  await page.locator('.nav-item[data-page="pickup"]').click();
  await openPlatformDrawer(page);
  const pickupTiles = page.locator('#platform-pickup-grid .platform-tile');
  await expect(pickupTiles).toHaveCount(8);
  await expect(pickupTiles.filter({ hasText: '小红书待取' })).toHaveCount(1);
  expect(await pickupTiles.locator('.platform-tile-name, .platform-tile-detail').evaluateAll(
    nodes => nodes.some(el => el.scrollWidth > el.clientWidth + 1)
  )).toBe(false);

  await page.evaluate(() => {
    window.__bridgeCalls = [];
    window.__openAppFailPrefixes = ['kwai://', 'snssdk1128://', 'cainiao://'];
  });

  await selectPlatformEntry(page, pickupTiles.filter({ hasText: '淘宝待取' }));
  await expect(page.locator('#toast')).toContainText('已请求打开淘宝待取列表');
  await selectPlatformEntry(page, pickupTiles.filter({ hasText: '拼多多待取' }));
  await selectPlatformEntry(page, pickupTiles.filter({ hasText: '菜鸟待取' }));
  await expect(page.locator('#toast')).toContainText('请在首页查看待取包裹');
  await selectPlatformEntry(page, pickupTiles.filter({ hasText: '小红书待取' }));
  await expect(page.locator('#toast')).toContainText('已请求打开小红书订单列表');

  // Missing app with web fallback -> calls openWeb
  await selectPlatformEntry(page, pickupTiles.filter({ hasText: '快手待取' }));
  await expect(page.locator('#toast')).toContainText('快手应用跳转未成功，已改用浏览器打开');

  // Missing app without web fallback -> shows install hint without calling openWeb
  await selectPlatformEntry(page, pickupTiles.filter({ hasText: '抖音待取' }));
  await expect(page.locator('#toast')).toContainText('暂时无法打开抖音');

  const calls = await page.evaluate(() => window.__bridgeCalls);
  expect(calls.some(c => c.method === 'openApp' && c.arg.startsWith('tbopen://'))).toBe(true);
  expect(calls.some(c => c.method === 'openApp' && c.arg.startsWith('kwai://'))).toBe(true);
  expect(calls.some(c => c.method === 'openWeb' && c.arg.startsWith('https://app.kwaixiaodian.com/'))).toBe(true);
  expect(calls.some(c => c.method === 'openApp' && c.arg === 'snssdk1128://ecom_order_list')).toBe(true);
  expect(calls.some(c => c.method === 'openApp' && c.arg === 'xhsdiscover://rn/lancer-order/order/list')).toBe(true);
  expect(calls.some(c => c.method === 'openApp' && c.arg.endsWith('/mdkd/package?tab=PACKAGE&entry_source=11'))).toBe(true);
  expect(calls.filter(c => c.method === 'openWeb')).toHaveLength(1);

  await openPlatformDrawer(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/pickup-with-platforms.png', fullPage: true, animations: 'disabled' });
  await page.locator('#platform-pickup-section').screenshot({ path: 'test-results/platform-pickup-redesign.png', animations: 'disabled' });

  // Reload persists reordered identity tiles
  await page.goto('/');
  await openPlatformDrawer(page);
  await expect(page.locator('#platform-identity-grid .platform-tile').nth(2)).toContainText('淘宝身份码');
});

test('platform launch supports packaged chains, lite app fallback, app home, and official web fallback', async ({ page }) => {
  await page.addInitScript(() => {
    window.__launchCalls = [];
    window.__canLaunchHome = true;
    window.__webThrows = false;
    window.__allowPackages = new Set();
    window.AndroidApp = {
      openAppForPackage: (uri, pkg) => {
        window.__launchCalls.push(`pkg:${pkg}:${uri}`);
        return window.__allowPackages.has(pkg);
      },
      openApp: () => { throw new Error('Unsupported link'); },
      openInstalledApp: pkg => { window.__launchCalls.push(pkg); return window.__canLaunchHome; },
      openWeb: url => {
        if (window.__webThrows) throw new Error('No browser');
        window.__launchCalls.push(url);
        return true;
      },
      hapticFeedback: () => { window.__launchCalls.push('haptic'); }
    };
  });
  await page.goto('/');
  await selectPlatformEntry(page, page.locator('[data-entry-id="taobao-code"]'));
  await expect(page.locator('#toast')).toContainText('已打开淘宝首页');
  expect(await page.evaluate(() => window.__launchCalls)).toContain('com.taobao.taobao');

  await page.evaluate(() => { window.__canLaunchHome = false; });
  await selectPlatformEntry(page, page.locator('[data-entry-id="cainiao-code"]'));
  await expect(page.locator('#toast')).toContainText('已改用浏览器打开');
  expect(await page.evaluate(() => window.__launchCalls)).toContain('https://page.cainiao.com/cn-app-web/identity-code/index.html#/');

  await page.evaluate(() => { window.__webThrows = true; });
  await selectPlatformEntry(page, page.locator('[data-entry-id="cainiao-code"]'));
  await expect(page.locator('#toast')).toContainText('暂时无法打开菜鸟');

  // Douyin standard missing -> automatically succeeds via Douyin Lite chain
  await page.locator('.nav-item[data-page="pickup"]').click();
  await page.evaluate(() => {
    window.__launchCalls = [];
    window.__allowPackages = new Set(['com.ss.android.ugc.aweme.lite']);
  });
  await selectPlatformEntry(page, page.locator('[data-entry-id="douyin-query"]'));
  await expect(page.locator('#toast')).toContainText('已请求打开抖音订单列表');
  expect(await page.evaluate(() => window.__launchCalls)).toContain('pkg:com.ss.android.ugc.aweme.lite:snssdk2329://ecom_order_list');
});

test('platform order migrates removed IDs without duplicates; narrow layout respects reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await openPlatformDrawer(page);
  const first = page.locator('[data-entry-id="taobao-code"]');
  await first.focus();
  await first.press('Alt+ArrowDown');
  await page.evaluate(() => {
    const orderKey = Object.keys(localStorage).find(key => {
      try { return Array.isArray(JSON.parse(localStorage.getItem(key)).identity); } catch { return false; }
    });
    if (!orderKey) throw new Error('No saved platform order');
    localStorage.setItem(orderKey, JSON.stringify({ identity: ['jd-code', 'pdd-code', 'pdd-code', 'taobao-code'], pickup: ['jd-query'] }));
  });
  await page.reload();
  expect(await page.locator('#platform-identity-grid .platform-tile').evaluateAll(tiles => tiles.map(tile => tile.dataset.entryId)))
    .toEqual(['pdd-code', 'taobao-code', 'cainiao-code']);
  for (const pageName of ['exclusive', 'pickup']) {
    await page.locator(`.nav-item[data-page="${pageName}"]`).click();
    await openPlatformDrawer(page);
    const grid = page.locator(`#platform-${pageName === 'exclusive' ? 'identity' : 'pickup'}-grid`);
    await grid.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await grid.locator('.platform-tile-content').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    const overflowing = await grid.locator('.platform-tile-name, .platform-tile-detail').evaluateAll(nodes => nodes.some(el => el.scrollWidth > el.clientWidth + 1));
    expect(overflowing).toBe(false);
    await page.locator('#close-platform-drawer').click();
  }
  await expect(page.locator('#platform-pickup-grid .platform-tile').first()).toHaveAttribute('data-entry-id', 'jd-query');
  await openPlatformDrawer(page);
  await page.locator('#platform-pickup-section').screenshot({ path: 'test-results/platform-pickup-320.png', animations: 'disabled' });
});

test('touch sorting moves a platform card without launching it and persists after reload', async ({ page, context }) => {
  await page.addInitScript(() => {
    window.__launchCount = 0;
    window.AndroidApp = { openApp: () => { window.__launchCount++; return true; } };
  });
  await page.goto('/');
  await openPlatformDrawer(page);
  const sortButton = page.locator('[aria-controls="platform-identity-grid"]');
  await sortButton.click();
  await expect(sortButton).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#platform-identity-section').scrollIntoViewIfNeeded();
  const first = await page.locator('[data-entry-id="taobao-code"]').boundingBox();
  const last = await page.locator('[data-entry-id="cainiao-code"]').boundingBox();
  const client = await context.newCDPSession(page);
  const x = first.x + first.width / 2;
  const startY = first.y + first.height / 2;
  const endY = last.y + last.height / 2;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
  for (let step = 1; step <= 8; step++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY + (endY - startY) * step / 8 }] });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#platform-identity-grid .platform-tile').last()).toHaveAttribute('data-entry-id', 'taobao-code');
  expect(await page.evaluate(() => window.__launchCount)).toBe(0);
  await sortButton.click();
  await expect(sortButton).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#close-platform-drawer').click();
  await openPlatformDrawer(page);
  await expect(page.locator('#platform-identity-grid .platform-tile').last()).toHaveAttribute('data-entry-id', 'taobao-code');
  expect(await page.evaluate(() => window.__launchCount)).toBe(0);
  await page.reload();
  await openPlatformDrawer(page);
  await expect(page.locator('#platform-identity-grid .platform-tile').last()).toHaveAttribute('data-entry-id', 'taobao-code');
  await page.locator('#platform-identity-section').screenshot({ path: 'test-results/platform-identity-redesign.png', animations: 'disabled' });
});
