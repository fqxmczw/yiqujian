(() => {
  'use strict';

  const STORAGE_KEY = 'pickup' + 'Codes.v1';
  const HISTORY_STORAGE_KEY = 'pickupHistory.v1';
  const DISMISSED_STORAGE_KEY = 'pickupDismissed.v1';
  const HANDLED_TTL_MS = 35 * 86400000;
  const CLIPBOARD_SUPPRESS_MS = 7 * 86400000;
  const CLOCK_SKEW_MS = 60 * 1000;
  const EXCLUSIVE_STORAGE_KEY = 'exclusiveCodes.v1';
  const PLATFORM_ORDER_KEY = 'expressPlatformOrder.v1';

  const TB_IDENTITY_H5 = 'https://pages-fast.m.taobao.com/wow/z/uniapp/1011717/last-mile-fe/end-collect-platform/identity-code?x-ssr=true';
  const TB_PENDING_H5 = 'https://pages-fast.m.taobao.com/wow/z/uniapp/1100333/last-mile-fe/m-end-school-tab/home';
  const KS_ORDER_H5 = 'https://app.kwaixiaodian.com/page/kwaishop-trade-order-list-app?layoutType=4&hyId=kwaishopOrder';
  const PDD_PACKAGE_H5 = 'https://m.pinduoduo.net/mdkd/package?entry_source=18&extra_params=from_wx_jump%3D1&p_channel=0';
  const CAINIAO_IDENTITY_H5 = 'https://page.cainiao.com/cn-app-web/identity-code/index.html#/';

  const PLATFORM_ENTRIES = {
    identity: [
      {
        id: 'taobao-code',
        short: '淘宝',
        name: '淘宝身份码',
        detail: '驿站扫码 · 动态身份码',
        actionLabel: '出示',
        packageName: 'com.taobao.taobao',
        brand: 'taobao',
        glyph: '淘',
        uri: `tbopen://m.taobao.com/tbopen/index.html?h5Url=${encodeURIComponent(TB_IDENTITY_H5)}`,
        chains: [
          {
            pkg: 'com.taobao.taobao',
            uris: [
              `taobao://m.taobao.com/tbopen/index.html?h5Url=${encodeURIComponent(TB_IDENTITY_H5)}`,
              `tbopen://m.taobao.com/tbopen/index.html?h5Url=${encodeURIComponent(TB_IDENTITY_H5)}`
            ]
          }
        ],
        web: TB_IDENTITY_H5,
        toast: '已请求打开淘宝身份码'
      },
      {
        id: 'pdd-code',
        short: '拼多多',
        name: '拼多多身份码',
        detail: '多多驿站 · 动态身份码',
        actionLabel: '出示',
        packageName: 'com.xunmeng.pinduoduo',
        brand: 'pinduoduo',
        glyph: '拼',
        uri: 'pinduoduo://com.xunmeng.pinduoduo/mdkd/package?tab=ID_CODE&entry_source=11',
        chains: [
          {
            pkg: 'com.xunmeng.pinduoduo',
            uris: [
              'pinduoduo://com.xunmeng.pinduoduo/mdkd/package?tab=ID_CODE&entry_source=11&refer_page_name=login&refer_page_sn=10169',
              'pinduoduo://com.xunmeng.pinduoduo/mdkd/package?tab=ID_CODE&entry_source=11',
              'pinduoduo://com.xunmeng.pinduoduo/mdkd/package'
            ]
          }
        ],
        web: PDD_PACKAGE_H5,
        toast: '已请求打开多多驿站身份码'
      },
      {
        id: 'cainiao-code',
        short: '菜鸟',
        name: '菜鸟身份码',
        detail: '菜鸟驿站 · 出库身份码',
        actionLabel: '出示',
        brand: 'cainiao',
        glyph: '菜',
        packageName: 'com.cainiao.wireless',
        uri: 'cainiao://router/station_code',
        chains: [
          {
            pkg: 'com.cainiao.wireless',
            uris: ['cainiao://router/station_code', 'cainiao://desktop/station_code']
          }
        ],
        web: CAINIAO_IDENTITY_H5,
        toast: '已请求打开菜鸟身份码',
        homeToast: '已打开菜鸟首页，请点首页“取件码”出示身份码'
      }
    ],
    pickup: [
      {
        id: 'taobao-query',
        short: '淘宝',
        name: '淘宝待取',
        detail: '待取包裹',
        packageName: 'com.taobao.taobao',
        brand: 'taobao',
        glyph: '淘',
        uri: `tbopen://m.taobao.com/tbopen/index.html?h5Url=${encodeURIComponent(TB_PENDING_H5)}`,
        chains: [
          {
            pkg: 'com.taobao.taobao',
            uris: [
              `taobao://m.taobao.com/tbopen/index.html?h5Url=${encodeURIComponent(TB_PENDING_H5)}`,
              `tbopen://m.taobao.com/tbopen/index.html?h5Url=${encodeURIComponent(TB_PENDING_H5)}`
            ]
          }
        ],
        web: TB_PENDING_H5,
        toast: '已请求打开淘宝待取列表，下拉可刷新'
      },
      {
        id: 'pdd-query',
        short: '拼多多',
        name: '拼多多待取',
        detail: '驿站包裹',
        packageName: 'com.xunmeng.pinduoduo',
        brand: 'pinduoduo',
        glyph: '拼',
        uri: 'pinduoduo://com.xunmeng.pinduoduo/mdkd/package?tab=PACKAGE&entry_source=11',
        chains: [
          {
            pkg: 'com.xunmeng.pinduoduo',
            uris: [
              'pinduoduo://com.xunmeng.pinduoduo/mdkd/package?tab=PACKAGE&entry_source=11',
              'pinduoduo://com.xunmeng.pinduoduo/mdkd/package'
            ]
          }
        ],
        web: PDD_PACKAGE_H5,
        toast: '已请求打开多多驿站包裹列表'
      },
      {
        id: 'cainiao-query',
        short: '菜鸟',
        name: '菜鸟待取',
        detail: '驿站包裹',
        brand: 'cainiao',
        glyph: '菜',
        packageName: 'com.cainiao.wireless',
        uri: 'cainiao://client.main',
        chains: [
          {
            pkg: 'com.cainiao.wireless',
            uris: ['cainiao://client.main']
          }
        ],
        toast: '已请求打开菜鸟查看待取包裹',
        homeToast: '已打开菜鸟首页，请在首页查看待取包裹'
      },
      {
        id: 'jd-query',
        short: '京东',
        name: '京东待取',
        detail: '订单物流',
        packageName: 'com.jingdong.app.mall',
        brand: 'jd',
        glyph: '京',
        uri: 'openjd://virtual?params=%7B%22category%22%3A%22jump%22%2C%22des%22%3A%22orderlist%22%7D',
        chains: [
          {
            pkg: 'com.jingdong.app.mall',
            uris: ['openjd://virtual?params=%7B%22category%22%3A%22jump%22%2C%22des%22%3A%22orderlist%22%7D']
          }
        ],
        web: 'https://order.jd.com/center/list.action',
        toast: '已请求打开京东订单，点开订单可查看取件码'
      },
      {
        id: 'douyin-query',
        short: '抖音',
        name: '抖音待取',
        detail: '商城订单',
        packageName: 'com.ss.android.ugc.aweme',
        packages: ['com.ss.android.ugc.aweme', 'com.ss.android.ugc.aweme.lite'],
        brand: 'douyin',
        glyph: '抖',
        uri: 'snssdk1128://ecom_order_list',
        chains: [
          {
            pkg: 'com.ss.android.ugc.aweme',
            uris: ['snssdk1128://ecom_order_list', 'snssdk1128://wallet']
          },
          {
            pkg: 'com.ss.android.ugc.aweme.lite',
            uris: ['snssdk2329://ecom_order_list', 'snssdk2329://wallet']
          }
        ],
        web: '',
        toast: '已请求打开抖音订单列表，可看待收货与物流'
      },
      {
        id: 'ks-query',
        short: '快手',
        name: '快手待取',
        detail: '小店订单',
        packageName: 'com.smile.gifmaker',
        packages: ['com.smile.gifmaker', 'com.kuaishou.nebula'],
        brand: 'kuaishou',
        glyph: '快',
        uri: `kwai://webview?url=${encodeURIComponent(KS_ORDER_H5)}`,
        chains: [
          {
            pkg: 'com.smile.gifmaker',
            uris: [`kwai://webview?url=${encodeURIComponent(KS_ORDER_H5)}`]
          },
          {
            pkg: 'com.kuaishou.nebula',
            uris: [`ksnebula://webview?url=${encodeURIComponent(KS_ORDER_H5)}`]
          }
        ],
        web: KS_ORDER_H5,
        toast: '已请求打开快手小店订单列表'
      },
      {
        id: 'xhs-query',
        short: '小红书',
        name: '小红书待取',
        detail: '市集订单',
        packageName: 'com.xingin.xhs',
        brand: 'xiaohongshu',
        glyph: '书',
        uri: 'xhsdiscover://rn/lancer-order/order/list',
        chains: [
          {
            pkg: 'com.xingin.xhs',
            uris: ['xhsdiscover://rn/lancer-order/order/list']
          }
        ],
        web: 'https://www.xiaohongshu.com/',
        toast: '已请求打开小红书订单列表'
      },
      {
        id: 'dewu-query',
        short: '得物',
        name: '得物待取',
        detail: '买家订单',
        packageName: 'com.shizhuang.duapp',
        brand: 'dewu',
        glyph: '得',
        uri: '9dewuapp://m.dewu.com/router/order/buyer/orderList?tabId=0',
        chains: [
          {
            pkg: 'com.shizhuang.duapp',
            uris: [
              '9dewuapp://m.dewu.com/router/order/buyer/orderList?tabId=0',
              'dewuapp://m.dewu.com/router/order/buyer/orderList?tabId=0'
            ]
          }
        ],
        web: 'https://m.dewu.com/',
        toast: '已请求打开得物订单列表'
      }
    ]
  };

  const $ = selector => document.querySelector(selector);
  const callBridge = (method, ...args) => (
    window.AndroidApp && typeof window.AndroidApp[method] === 'function'
      ? window.AndroidApp[method](...args)
      : undefined
  );
  const barcodeAPI = window.PickupBarcode;
  const parserAPI = window.PickupParser;
  const pages = { exclusive: $('#exclusive-page'), pickup: $('#pickup-page') };
  const navItems = [...document.querySelectorAll('.nav-item')];
  const headerAddExclusive = $('#header-add-exclusive');
  const exclusiveSwitcher = document.querySelector('#exclusive-switcher');
  const platformLauncher = $('#platform-launcher');
  const platformDrawer = $('#platform-drawer');

  const barcodeDialog = document.querySelector('#barcode-dialog');
  const fullscreenScanStage = document.querySelector('#fullscreen-scan-stage');
  const fullscreenBarcodeStage = document.querySelector('#fullscreen-barcode-stage');
  const fullscreenNumber = document.querySelector('#fullscreen-number');
  const toggleOrientationBtn = document.querySelector('#toggle-scan-orientation');
  const orientationLabel = document.querySelector('#orientation-label');
  const fullscreenCopyBtn = document.querySelector('#fullscreen-copy');

  const exclusiveDialog = document.querySelector('#exclusive-dialog');
  const exclusiveForm = document.querySelector('#exclusive-form');
  const exclusiveEditId = document.querySelector('#exclusive-edit-id');
  const exclusiveDialogTitle = document.querySelector('#exclusive-dialog-title');
  const exclusiveCodeInput = document.querySelector('#exclusive-code-input');
  const exclusiveLabelInput = document.querySelector('#exclusive-label-input');
  const exclusiveCodeError = document.querySelector('#exclusive-code-error');
  const barcodePreviewBox = document.querySelector('#barcode-preview-box');
  const barcodeSourceBadge = document.querySelector('#barcode-source-badge');
  const barcodeFileInput = document.querySelector('#barcode-file-input');
  const clearBarcodeImageBtn = document.querySelector('#clear-barcode-image');
  const deleteExclusiveBtn = document.querySelector('#delete-exclusive-btn');
  const helpDialog = document.querySelector('#help-dialog');

  const editDialog = document.querySelector('#edit-dialog');
  const deleteDialog = document.querySelector('#delete-dialog');
  const codeForm = document.querySelector('#code-form');
  const codeInput = document.querySelector('#code-input');
  const labelInput = document.querySelector('#label-input');

  const importDialog = document.querySelector('#import-dialog');
  const importTextInput = document.querySelector('#import-text-input');
  const importPreviewList = document.querySelector('#import-preview-list');
  const importParseSummary = document.querySelector('#import-parse-summary');
  const importConfirmBtn = document.querySelector('#import-confirm-btn');
  const importTabs = [...document.querySelectorAll('[data-import-tab]')];
  const importPanels = {
    paste: document.querySelector('#import-panel-paste'),
    auto: document.querySelector('#import-panel-auto')
  };
  const clipboardBanner = document.querySelector('#clipboard-banner');
  const clipboardBannerCode = document.querySelector('#clipboard-banner-code');
  const clipboardBannerLabel = document.querySelector('#clipboard-banner-label');
  const quickSmsBtn = document.querySelector('#quick-sms-btn');
  const quickSmsLabel = document.querySelector('#quick-sms-label');
  const quickNotifyBtn = document.querySelector('#quick-notify-btn');
  const quickNotifyLabel = document.querySelector('#quick-notify-label');
  const smsStatusPill = document.querySelector('#sms-status-pill');
  const notifyStatusPill = document.querySelector('#notify-status-pill');
  const smsAutoToggle = document.querySelector('#sms-auto-toggle');
  const notifyEnabledToggle = document.querySelector('#notify-enabled-toggle');
  const runSmsScanBtn = document.querySelector('#run-sms-scan-btn');
  const ignoreOldSmsBtn = document.querySelector('#ignore-old-sms-btn');
  const smsBaselineRow = document.querySelector('#sms-baseline-row');
  const smsBaselineText = document.querySelector('#sms-baseline-text');
  const resetSmsBaselineBtn = document.querySelector('#reset-sms-baseline-btn');
  const openNotifySettingsBtn = document.querySelector('#open-notify-settings-btn');
  const openAppSettingsBtn = document.querySelector('#open-app-settings-btn');
  const smsLastResult = document.querySelector('#sms-last-result');
  const notifyCaptureSummary = document.querySelector('#notify-capture-summary');
  const pendingListBar = document.querySelector('#pending-list-bar');
  const pendingListCount = document.querySelector('#pending-list-count');
  const markAllPickedBtn = document.querySelector('#mark-all-picked');
  const historySection = document.querySelector('#history-section');
  const historySummaryLabel = document.querySelector('#history-summary-label');
  const historyList = document.querySelector('#history-list');
  const clearHistoryBtn = document.querySelector('#clear-history-btn');

  let exclusiveCodes = loadExclusiveCodes();
  let activeExclusiveId = exclusiveCodes[0]?.id || '';
  let draftImageDataUrl = '';
  let codes = loadCodes();
  let pickedHistory = loadHistory();
  let handledMap = loadHandledMap();
  let toastTimer;
  let wakeLock = null;
  let draftParsedItems = [];
  let draftSkippedSignedCount = 0;
  let clipboardCandidates = [];
  let lastClipboardRaw = '';
  let lastDismissedClipboardRaw = '';
  let smsScanBusy = false;
  let autoStatus = {
    isAndroid: Boolean(window.AndroidApp && typeof window.AndroidApp.getAutoImportStatus === 'function'),
    hasSmsPermission: false,
    smsAutoSync: true,
    smsScanDays: 7,
    hasNotificationAccess: false,
    notifyEnabled: true,
    notifyCapturedCount: 0,
    pendingCount: 0,
    lastSmsSyncTs: 0,
    lastNotifyTs: 0,
    smsIgnoreBeforeTs: 0
  };

  function loadExclusiveCodes() {
    try {
      const raw = localStorage.getItem(EXCLUSIVE_STORAGE_KEY);
      if (raw === null) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(item => item && typeof item.id === 'string' && typeof item.code === 'string' && item.code.trim())
        .map(item => ({
          id: item.id,
          code: barcodeAPI.normalizeExclusiveCode(item.code),
          label: typeof item.label === 'string' ? item.label : '',
          imageDataUrl: typeof item.imageDataUrl === 'string' && item.imageDataUrl.startsWith('data:image/') ? item.imageDataUrl : '',
          createdAt: Number.isFinite(item.createdAt) ? item.createdAt : 0
        }))
        .slice(0, 20);
    } catch {
      return [];
    }
  }

  function saveExclusiveCodes() {
    try {
      localStorage.setItem(EXCLUSIVE_STORAGE_KEY, JSON.stringify(exclusiveCodes));
      return true;
    } catch {
      showToast('保存失败，图片可能过大或无存储权限', false);
      return false;
    }
  }

  function getActiveExclusive() {
    return exclusiveCodes.find(item => item.id === activeExclusiveId) || exclusiveCodes[0] || null;
  }

  function buildExclusiveDisplayNames() {
    const unnamedCount = exclusiveCodes.filter(item => !item.label).length;
    let unnamedIndex = 0;
    const names = new Map();
    exclusiveCodes.forEach(item => {
      if (item.label) {
        names.set(item.id, item.label);
      } else {
        unnamedIndex += 1;
        names.set(item.id, unnamedCount > 1 ? `专属码 ${unnamedIndex}` : '专属码');
      }
    });
    return names;
  }

  function loadCodes() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      return stored
        .filter(item => item && typeof item.id === 'string' && typeof item.code === 'string' && typeof item.label === 'string')
        .map(item => ({
          id: item.id,
          code: item.code,
          label: item.label,
          source: typeof item.source === 'string' ? item.source : 'manual',
          createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now()
        }))
        .slice(0, 100);
    } catch {
      return [];
    }
  }

  function saveCodes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
      return true;
    } catch {
      showToast('保存失败，请检查浏览器存储权限', false);
      return false;
    }
  }

  function loadHistory() {
    try {
      const stored = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      return stored
        .filter(item => item && typeof item.id === 'string' && typeof item.code === 'string')
        .map(item => ({
          id: item.id,
          code: item.code,
          label: typeof item.label === 'string' ? item.label : '',
          source: typeof item.source === 'string' ? item.source : 'manual',
          reason: item.reason === 'auto_signed' ? 'auto_signed' : 'picked',
          createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
          handledAt: Number.isFinite(item.handledAt) ? item.handledAt : Date.now()
        }))
        .slice(0, 60);
    } catch {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(pickedHistory.slice(0, 60)));
      return true;
    } catch {
      return false;
    }
  }

  function pruneHandledMap(sourceMap) {
    const cutoff = Date.now() - HANDLED_TTL_MS;
    return Object.fromEntries(
      Object.entries(sourceMap)
        .filter(([key, ts]) => typeof key === 'string' && key && Number.isFinite(ts) && ts >= cutoff)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 300)
    );
  }

  function loadHandledMap() {
    try {
      const stored = JSON.parse(localStorage.getItem(DISMISSED_STORAGE_KEY) || '{}');
      if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
      return pruneHandledMap(stored);
    } catch {
      return {};
    }
  }

  function saveHandledMap() {
    try {
      handledMap = pruneHandledMap(handledMap);
      localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(handledMap));
      return true;
    } catch {
      return false;
    }
  }

  function commitPickupState(previousCodes, previousHistory) {
    if (!saveCodes()) {
      codes = previousCodes;
      pickedHistory = previousHistory;
      return false;
    }
    saveHistory();
    saveHandledMap();
    renderCodes();
    return true;
  }

  function recordHandled(rawCode, handledAt = Date.now()) {
    const key = codeDedupKey(rawCode);
    if (!key) return;
    const ts = Number.isFinite(handledAt) ? handledAt : Date.now();
    handledMap[key] = Math.max(handledMap[key] || 0, ts);
  }

  function unmarkHandled(rawCode) {
    const key = codeDedupKey(rawCode);
    if (key && Object.prototype.hasOwnProperty.call(handledMap, key)) {
      delete handledMap[key];
    }
  }

  function isBlockedByHandled(rawCode, messageTs, source = 'sms') {
    const key = codeDedupKey(rawCode);
    const handledAt = handledMap[key];
    if (!Number.isFinite(handledAt) || handledAt <= 0) return false;
    if (source === 'clipboard') {
      return (Date.now() - handledAt) < CLIPBOARD_SUPPRESS_MS;
    }
    const msgTs = Number.isFinite(messageTs) ? messageTs : Date.now();
    return msgTs <= handledAt + CLOCK_SKEW_MS;
  }

  function addToHistory(item, reason = 'picked', handledAt = Date.now()) {
    const key = codeDedupKey(item.code);
    pickedHistory = pickedHistory.filter(existing => codeDedupKey(existing.code) !== key);
    pickedHistory.unshift({
      id: makeId(),
      code: item.code,
      label: item.label || '',
      source: item.source || 'manual',
      reason: reason === 'auto_signed' ? 'auto_signed' : 'picked',
      createdAt: Number.isFinite(item.createdAt) ? item.createdAt : handledAt,
      handledAt
    });
    if (pickedHistory.length > 60) pickedHistory = pickedHistory.slice(0, 60);
  }

  function escapeHTML(value) {
    return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function makeId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function syncHeaderAddExclusive() {
    headerAddExclusive.hidden = pages.exclusive.hidden || exclusiveCodes.length === 0;
  }

  function syncPlatformLauncher() {
    const isExclusive = !pages.exclusive.hidden;
    const label = isExclusive ? '平台身份码' : '平台实时取件';
    platformLauncher.setAttribute('aria-label', `展开${label}`);
    platformLauncher.title = label;
    platformDrawer.querySelector('#platform-drawer-title').textContent = label;
    $('#platform-identity-section').hidden = !isExclusive;
    $('#platform-pickup-section').hidden = isExclusive;
  }

  function switchPage(pageName) {
    if (platformDrawer.open) closePlatformDrawer();
    Object.entries(pages).forEach(([name, page]) => { page.hidden = name !== pageName; });
    navItems.forEach(item => {
      const active = item.dataset.page === pageName;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    $('#page-title').textContent = pageName === 'exclusive' ? '我的专属码' : '我的取件码';
    syncPlatformLauncher();
    syncHeaderAddExclusive();
    window.scrollTo({ top: 0, behavior: 'instant' });
    window.history.replaceState(null, '', pageName === 'pickup' ? '#pickup' : '#exclusive');
  }

  function pageFromHash() {
    return location.hash === '#pickup' ? 'pickup' : 'exclusive';
  }

  navItems.forEach(item => item.addEventListener('click', () => switchPage(item.dataset.page)));
  window.addEventListener('hashchange', () => switchPage(pageFromHash()));

  function renderBarcodeMarkup(item, barHeight = 96) {
    if (item.imageDataUrl) {
      const safeAlt = escapeHTML(`专属码 ${item.code} 的条码图`);
      return `<img class="custom-barcode-img" src="${item.imageDataUrl}" alt="${safeAlt}">`;
    }
    if (barcodeAPI.isValidCode128B(item.code)) {
      return barcodeAPI.renderBarcodeSVG(item.code, { quietModules: 10, barHeight });
    }
    return '<span class="barcode-fallback">当前专属码格式不支持自动生成条码，请导入微信条码截图</span>';
  }

  function renderExclusivePage() {
    const card = document.querySelector('#exclusive-card');
    const emptyBox = document.querySelector('#exclusive-empty');

    const active = getActiveExclusive();
    activeExclusiveId = active ? active.id : '';
    const displayNames = buildExclusiveDisplayNames();
    const prevScrollLeft = exclusiveSwitcher.scrollLeft;

    const chips = exclusiveCodes.map(item => {
      const isActive = item.id === activeExclusiveId;
      const displayName = escapeHTML(displayNames.get(item.id) || '专属码');
      return `<button class="switcher-chip${isActive ? ' active' : ''}" type="button" role="tab" aria-selected="${isActive}" title="${displayName}" data-exclusive-select="${item.id}"><span class="switcher-chip-label">${displayName}</span></button>`;
    });
    chips.push('<button class="switcher-chip add-chip" type="button" data-exclusive-add="1"><svg><use href="#icon-plus"/></svg><span>添加专属码</span></button>');
    exclusiveSwitcher.innerHTML = chips.join('');
    exclusiveSwitcher.hidden = exclusiveCodes.length === 0;
    exclusiveSwitcher.scrollLeft = prevScrollLeft;

    if (!active) {
      card.hidden = true;
      emptyBox.hidden = false;
      syncHeaderAddExclusive();
      return;
    }

    card.hidden = false;
    emptyBox.hidden = true;
    syncHeaderAddExclusive();

    const ownerBadge = document.querySelector('#exclusive-owner-badge');
    const sourceTag = active.imageDataUrl ? '微信原图' : '标准条码';
    ownerBadge.textContent = `${displayNames.get(active.id) || '专属码'} · ${sourceTag}`;

    const enlargeBtn = document.querySelector('#enlarge-exclusive');
    enlargeBtn.setAttribute('aria-label', `放大专属码 ${active.code}`);

    document.querySelector('#exclusive-barcode-stage').innerHTML = renderBarcodeMarkup(active, 96);

    const numberEl = document.querySelector('#exclusive-number');
    numberEl.textContent = active.code;
    numberEl.setAttribute('aria-label', active.code);
    numberEl.classList.toggle('is-long', active.code.length > 10);

    fullscreenBarcodeStage.innerHTML = renderBarcodeMarkup(active, 130);
    fullscreenNumber.textContent = active.code;
    fullscreenNumber.classList.toggle('is-long', active.code.length > 10);
  }

  const LONG_PRESS_MS = 300;
  const DRAG_CANCEL_THRESHOLD = 8;
  let switcherDrag = null;
  let suppressNextSwitcherClick = false;
  let suppressClickResetTimer = 0;

  function stopSwitcherAutoScroll() {
    if (switcherDrag && switcherDrag.scrollRaf) {
      cancelAnimationFrame(switcherDrag.scrollRaf);
      switcherDrag.scrollRaf = 0;
    }
  }

  function updateSwitcherDragOrder(clientX) {
    if (!switcherDrag || !switcherDrag.active) return;
    const draggedChip = switcherDrag.chip;
    const addChip = exclusiveSwitcher.querySelector('[data-exclusive-add]');
    const siblings = [...exclusiveSwitcher.querySelectorAll('[data-exclusive-select]')].filter(el => el !== draggedChip);
    const target = siblings.find(el => {
      const rect = el.getBoundingClientRect();
      return clientX < rect.left + rect.width / 2;
    });
    if (target) {
      if (draggedChip.nextElementSibling !== target) {
        exclusiveSwitcher.insertBefore(draggedChip, target);
      }
    } else if (addChip) {
      if (draggedChip.nextElementSibling !== addChip) {
        exclusiveSwitcher.insertBefore(draggedChip, addChip);
      }
    } else if (exclusiveSwitcher.lastElementChild !== draggedChip) {
      exclusiveSwitcher.appendChild(draggedChip);
    }
  }

  function stepSwitcherAutoScroll() {
    if (!switcherDrag || !switcherDrag.active) return;
    const rect = exclusiveSwitcher.getBoundingClientRect();
    const edgeZone = 36;
    const maxScroll = exclusiveSwitcher.scrollWidth - exclusiveSwitcher.clientWidth;
    let delta = 0;
    if (switcherDrag.lastX < rect.left + edgeZone && exclusiveSwitcher.scrollLeft > 0) {
      delta = -Math.min(10, Math.max(2, Math.ceil((rect.left + edgeZone - switcherDrag.lastX) / 4)));
    } else if (switcherDrag.lastX > rect.right - edgeZone && exclusiveSwitcher.scrollLeft < maxScroll) {
      delta = Math.min(10, Math.max(2, Math.ceil((switcherDrag.lastX - (rect.right - edgeZone)) / 4)));
    }
    if (delta !== 0) {
      exclusiveSwitcher.scrollLeft += delta;
      updateSwitcherDragOrder(switcherDrag.lastX);
    }
    switcherDrag.scrollRaf = requestAnimationFrame(stepSwitcherAutoScroll);
  }

  function finishSwitcherDrag(commit) {
    if (!switcherDrag) return;
    const state = switcherDrag;
    clearTimeout(state.timer);
    stopSwitcherAutoScroll();
    switcherDrag = null;
    if (!state.active) return;

    exclusiveSwitcher.classList.remove('is-reordering');
    state.chip.classList.remove('is-dragging');
    try {
      if (exclusiveSwitcher.hasPointerCapture?.(state.pointerId)) {
        exclusiveSwitcher.releasePointerCapture(state.pointerId);
      }
    } catch { /* ignore */ }

    suppressNextSwitcherClick = true;
    clearTimeout(suppressClickResetTimer);
    suppressClickResetTimer = setTimeout(() => { suppressNextSwitcherClick = false; }, 400);

    if (!commit) {
      renderExclusivePage();
      return;
    }

    const orderedIds = [...exclusiveSwitcher.querySelectorAll('[data-exclusive-select]')].map(el => el.dataset.exclusiveSelect);
    const changed = orderedIds.length === exclusiveCodes.length && orderedIds.some((id, idx) => id !== exclusiveCodes[idx].id);
    if (!changed) return;

    const previous = [...exclusiveCodes];
    const byId = new Map(exclusiveCodes.map(item => [item.id, item]));
    exclusiveCodes = orderedIds.map(id => byId.get(id)).filter(Boolean);
    if (!saveExclusiveCodes()) {
      exclusiveCodes = previous;
      renderExclusivePage();
      return;
    }
    renderExclusivePage();
    showToast('已调整专属码顺序');
  }

  exclusiveSwitcher.addEventListener('contextmenu', event => {
    if (exclusiveCodes.length >= 2 && event.target.closest('[data-exclusive-select]')) {
      event.preventDefault();
    }
  });

  exclusiveSwitcher.addEventListener('pointerdown', event => {
    suppressNextSwitcherClick = false;
    clearTimeout(suppressClickResetTimer);
    if (exclusiveCodes.length < 2) return;
    if (event.isPrimary === false) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const chip = event.target.closest('[data-exclusive-select]');
    if (!chip) return;
    if (switcherDrag) finishSwitcherDrag(false);

    const state = {
      chip,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      active: false,
      timer: 0,
      scrollRaf: 0
    };
    state.timer = setTimeout(() => {
      if (switcherDrag !== state) return;
      state.active = true;
      exclusiveSwitcher.classList.add('is-reordering');
      chip.classList.add('is-dragging');
      try { exclusiveSwitcher.setPointerCapture?.(state.pointerId); } catch { /* ignore */ }
      try { navigator.vibrate?.(15); } catch { /* ignore */ }
      state.scrollRaf = requestAnimationFrame(stepSwitcherAutoScroll);
    }, LONG_PRESS_MS);
    switcherDrag = state;
  });

  window.addEventListener('pointermove', event => {
    if (!switcherDrag || event.pointerId !== switcherDrag.pointerId) return;
    switcherDrag.lastX = event.clientX;
    if (!switcherDrag.active) {
      if (Math.hypot(event.clientX - switcherDrag.startX, event.clientY - switcherDrag.startY) > DRAG_CANCEL_THRESHOLD) {
        finishSwitcherDrag(false);
      }
      return;
    }
    updateSwitcherDragOrder(event.clientX);
  });

  window.addEventListener('pointerup', event => {
    if (!switcherDrag || event.pointerId !== switcherDrag.pointerId) return;
    finishSwitcherDrag(true);
  });

  window.addEventListener('pointercancel', event => {
    if (!switcherDrag || event.pointerId !== switcherDrag.pointerId) return;
    finishSwitcherDrag(false);
  });

  window.addEventListener('blur', () => {
    if (switcherDrag) finishSwitcherDrag(false);
  });

  exclusiveSwitcher.addEventListener('touchmove', event => {
    if (!switcherDrag || !switcherDrag.active) return;
    if (event.cancelable) event.preventDefault();
    const touch = event.touches && event.touches[0];
    if (touch) {
      switcherDrag.lastX = touch.clientX;
      updateSwitcherDragOrder(touch.clientX);
    }
  }, { passive: false });

  window.addEventListener('touchend', () => {
    if (switcherDrag && switcherDrag.active) finishSwitcherDrag(true);
  });

  window.addEventListener('touchcancel', () => {
    if (switcherDrag && switcherDrag.active) finishSwitcherDrag(false);
  });

  exclusiveSwitcher.addEventListener('click', event => {
    if (suppressNextSwitcherClick) {
      suppressNextSwitcherClick = false;
      clearTimeout(suppressClickResetTimer);
      event.preventDefault();
      return;
    }
    const addBtn = event.target.closest('[data-exclusive-add]');
    if (addBtn) {
      openExclusiveEditor(null);
      return;
    }
    const chip = event.target.closest('[data-exclusive-select]');
    if (!chip) return;
    activeExclusiveId = chip.dataset.exclusiveSelect;
    renderExclusivePage();
  });

  function renderCodes() {
    const list = document.querySelector('#code-list');
    document.querySelector('#empty-state').hidden = codes.length > 0;
    document.querySelector('#add-code').hidden = codes.length === 0;
    pendingListBar.hidden = codes.length === 0;
    pendingListCount.textContent = `待取 ${codes.length} 件`;
    const count = document.querySelector('#nav-count');
    count.hidden = codes.length === 0;
    count.textContent = codes.length > 99 ? '99+' : String(codes.length);
    const sourceLabels = {
      notification: '通知自动',
      sms: '短信导入',
      clipboard: '剪贴板',
      share: '分享导入',
      paste: '识别导入'
    };
    list.innerHTML = codes.map(item => {
      const code = escapeHTML(item.code);
      const label = escapeHTML(item.label || '快递取件');
      const sourceName = sourceLabels[item.source] || '';
      const sourceBadge = sourceName ? `<span class="pickup-source-tag">${sourceName}</span>` : '';
      const date = Number.isFinite(item.createdAt) ? new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(item.createdAt) : '';
      return `<article class="pickup-card">
        <div class="pickup-card-top"><span class="pickup-label-icon"><svg><use href="#icon-box"/></svg></span><span class="pickup-label">${label}</span><span class="pickup-meta">${sourceBadge}<time class="pickup-date">${date}</time></span></div>
        <div class="pickup-code-row"><strong class="pickup-code">${code}</strong><button class="copy-icon-button" type="button" data-action="copy" data-id="${item.id}" aria-label="复制取件码 ${code}"><svg><use href="#icon-copy"/></svg></button></div>
        <div class="pickup-card-bottom"><div><button class="text-action" type="button" data-action="edit" data-id="${item.id}"><svg><use href="#icon-pencil"/></svg>编辑</button> <button class="text-action delete-action" type="button" data-action="delete" data-id="${item.id}"><svg><use href="#icon-trash"/></svg>删除</button></div><button class="mark-picked-btn" type="button" data-action="picked" data-id="${item.id}" aria-label="标记取件码 ${code} 为已取件"><svg><use href="#icon-check"/></svg>已取件</button></div>
      </article>`;
    }).join('');
    renderHistory();
    syncClipboardBannerVisibility();
  }

  function renderHistory() {
    historySection.hidden = pickedHistory.length === 0;
    historySummaryLabel.textContent = `已取件记录 (${pickedHistory.length})`;
    if (pickedHistory.length === 0) {
      historyList.innerHTML = '';
      return;
    }
    historyList.innerHTML = pickedHistory.map(item => {
      const code = escapeHTML(item.code);
      const label = escapeHTML(item.label || '快递取件');
      const reasonText = item.reason === 'auto_signed' ? '签收自动核销' : '已取件';
      const timeText = formatShortTime(item.handledAt);
      return `<div class="history-item">
        <div class="history-item-main">
          <span class="history-item-code">${code}</span>
          <span class="history-item-sub">${label} · ${reasonText}${timeText ? ' · ' + timeText : ''}</span>
        </div>
        <button class="history-restore-btn" type="button" data-history-restore="${item.id}">恢复</button>
      </div>`;
    }).join('');
  }

  function markCodePicked(id) {
    const item = codes.find(entry => entry.id === id);
    if (!item) return;
    const previousCodes = [...codes];
    const previousHistory = [...pickedHistory];
    const now = Date.now();
    codes = codes.filter(entry => entry.id !== id);
    addToHistory(item, 'picked', now);
    recordHandled(item.code, now);
    if (!commitPickupState(previousCodes, previousHistory)) return;
    showToast('已标为已取件，旧短信不再重复识别');
  }

  async function copyText(text, message = '取件码已复制') {
    try {
      if (window.AndroidApp) window.AndroidApp.copyText(text);
      else if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand('copy');
        textArea.remove();
        if (!copied) throw new Error('Copy failed');
      }
      showToast(message);
    } catch {
      showToast(`请手动复制：${text}`, false);
    }
  }

  function copyActiveExclusive() {
    const active = getActiveExclusive();
    if (!active) return;
    copyText(active.code, `专属码 ${active.code} 已复制`);
  }

  fullscreenCopyBtn.addEventListener('click', copyActiveExclusive);

  function updateExclusivePreview() {
    const normalized = barcodeAPI.normalizeExclusiveCode(exclusiveCodeInput.value);
    if (draftImageDataUrl) {
      barcodeSourceBadge.textContent = '已导入微信条码图';
      clearBarcodeImageBtn.hidden = false;
      barcodePreviewBox.innerHTML = `<img src="${draftImageDataUrl}" alt="已导入条码预览">`;
      return;
    }
    barcodeSourceBadge.textContent = '自动生成标准条码';
    clearBarcodeImageBtn.hidden = true;
    if (!normalized) {
      barcodePreviewBox.textContent = '输入专属码后实时预览条形码';
      return;
    }
    if (!barcodeAPI.isValidCode128B(normalized)) {
      barcodePreviewBox.textContent = '请输入 2–32 位字母、数字或常用符号';
      return;
    }
    barcodePreviewBox.innerHTML = barcodeAPI.renderBarcodeSVG(normalized, { quietModules: 10, barHeight: 68 });
  }

  function openExclusiveEditor(item = null) {
    exclusiveForm.reset();
    exclusiveEditId.value = item?.id || '';
    exclusiveDialogTitle.textContent = item ? '编辑 / 更换专属码' : '放入我的专属码';
    exclusiveCodeInput.value = item?.code || '';
    exclusiveLabelInput.value = item?.label || '';
    draftImageDataUrl = item?.imageDataUrl || '';
    exclusiveCodeError.textContent = '';
    deleteExclusiveBtn.hidden = !item;
    updateExclusivePreview();
    exclusiveDialog.showModal();
    setTimeout(() => exclusiveCodeInput.focus(), 100);
  }

  headerAddExclusive.addEventListener('click', () => openExclusiveEditor(null));
  document.querySelector('#empty-add-exclusive').addEventListener('click', () => openExclusiveEditor(null));
  document.querySelector('#edit-exclusive').addEventListener('click', () => {
    const active = getActiveExclusive();
    openExclusiveEditor(active);
  });
  document.querySelector('#open-help').addEventListener('click', () => helpDialog.showModal());

  document.querySelectorAll('[data-exclusive-label]').forEach(button => {
    button.addEventListener('click', () => { exclusiveLabelInput.value = button.dataset.exclusiveLabel; });
  });

  exclusiveCodeInput.addEventListener('input', () => {
    exclusiveCodeError.textContent = '';
    updateExclusivePreview();
  });

  document.querySelector('#import-barcode-btn').addEventListener('click', () => barcodeFileInput.click());
  clearBarcodeImageBtn.addEventListener('click', () => {
    draftImageDataUrl = '';
    barcodeFileInput.value = '';
    updateExclusivePreview();
  });

  function extractBarcodeFromImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('读取图片失败'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('图片格式不支持'));
        img.onload = () => {
          try {
            const maxW = 1000;
            const scale = img.width > maxW ? maxW / img.width : 1;
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const srcCanvas = document.createElement('canvas');
            srcCanvas.width = w;
            srcCanvas.height = h;
            const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);

            // Detect horizontal 1D barcode strip inside a full WeChat screenshot
            const data = ctx.getImageData(0, 0, w, h).data;
            const isDarkPixel = idx => (data[idx] * 299 + data[idx + 1] * 587 + data[idx + 2] * 114) < 110000;
            const barcodeRows = [];
            const xStart = Math.floor(w * 0.05);
            const xEnd = Math.ceil(w * 0.95);
            for (let y = 0; y < h; y += 2) {
              let transitions = 0;
              let darkCount = 0;
              let prevDark = false;
              for (let x = xStart; x < xEnd; x += 1) {
                const isDark = isDarkPixel((y * w + x) * 4);
                if (isDark) darkCount += 1;
                if (x > xStart && isDark !== prevDark) transitions += 1;
                prevDark = isDark;
              }
              const darkRatio = darkCount / Math.max(1, xEnd - xStart);
              if (transitions >= 28 && darkRatio >= 0.14 && darkRatio <= 0.72) {
                barcodeRows.push(y);
              }
            }

            let bestStart = -1;
            let bestEnd = -1;
            let runStart = -1;
            let prevY = -999;
            for (const y of barcodeRows) {
              if (y - prevY <= 6) {
                if (y - runStart > bestEnd - bestStart) {
                  bestStart = runStart;
                  bestEnd = y;
                }
              } else {
                runStart = y;
              }
              prevY = y;
            }

            const outCanvas = document.createElement('canvas');
            const outCtx = outCanvas.getContext('2d');
            if (bestStart >= 0 && (bestEnd - bestStart) >= 24 && (bestEnd - bestStart) < h * 0.75) {
              const midY = Math.floor((bestStart + bestEnd) / 2);
              let left = w;
              let right = 0;
              for (let x = 0; x < w; x += 1) {
                if (isDarkPixel((midY * w + x) * 4)) {
                  if (x < left) left = x;
                  if (x > right) right = x;
                }
              }
              const cropX = Math.max(0, left - 16);
              const cropW = Math.min(w - cropX, Math.max(40, (right - left) + 32));
              const cropY = Math.max(0, bestStart - 8);
              const cropH = Math.min(h - cropY, (bestEnd - bestStart) + 16);
              outCanvas.width = cropW + 32;
              outCanvas.height = cropH + 24;
              outCtx.fillStyle = '#ffffff';
              outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
              outCtx.drawImage(srcCanvas, cropX, cropY, cropW, cropH, 16, 12, cropW, cropH);
            } else {
              outCanvas.width = w;
              outCanvas.height = h;
              outCtx.fillStyle = '#ffffff';
              outCtx.fillRect(0, 0, w, h);
              outCtx.drawImage(srcCanvas, 0, 0);
            }
            resolve(outCanvas.toDataURL('image/png'));
          } catch (err) {
            reject(err);
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  barcodeFileInput.addEventListener('change', async () => {
    const file = barcodeFileInput.files?.[0];
    if (!file) return;
    try {
      draftImageDataUrl = await extractBarcodeFromImageFile(file);
      updateExclusivePreview();
      showToast('已导入条码图片');
    } catch {
      showToast('图片解析失败，请重试', false);
    }
  });

  exclusiveForm.addEventListener('submit', event => {
    event.preventDefault();
    const code = barcodeAPI.normalizeExclusiveCode(exclusiveCodeInput.value);
    const id = exclusiveEditId.value;
    if (!code) {
      exclusiveCodeError.textContent = '请输入专属码';
      exclusiveCodeInput.focus();
      return;
    }
    if (!draftImageDataUrl && !barcodeAPI.isValidCode128B(code)) {
      exclusiveCodeError.textContent = '专属码需为 2–32 位字母、数字或常用符号';
      exclusiveCodeInput.focus();
      return;
    }
    if (exclusiveCodes.some(item => item.code.toLowerCase() === code.toLowerCase() && item.id !== id)) {
      exclusiveCodeError.textContent = '这个专属码已经保存过了';
      return;
    }

    const previous = [...exclusiveCodes];
    const prevActive = activeExclusiveId;
    const label = exclusiveLabelInput.value.trim();
    if (id) {
      const index = exclusiveCodes.findIndex(item => item.id === id);
      if (index < 0) return;
      exclusiveCodes[index] = { ...exclusiveCodes[index], code, label, imageDataUrl: draftImageDataUrl };
      activeExclusiveId = id;
    } else {
      const newId = makeId();
      exclusiveCodes.push({ id: newId, code, label, imageDataUrl: draftImageDataUrl, createdAt: Date.now() });
      activeExclusiveId = newId;
    }

    if (!saveExclusiveCodes()) {
      exclusiveCodes = previous;
      activeExclusiveId = prevActive;
      return;
    }
    renderExclusivePage();
    exclusiveDialog.close();
    showToast(id ? '专属码已更新' : '已添加并切换到新专属码');
  });

  deleteExclusiveBtn.addEventListener('click', () => {
    const id = exclusiveEditId.value;
    if (!id) return;
    const previous = [...exclusiveCodes];
    const prevActive = activeExclusiveId;
    exclusiveCodes = exclusiveCodes.filter(item => item.id !== id);
    activeExclusiveId = exclusiveCodes[0]?.id || '';
    if (!saveExclusiveCodes()) {
      exclusiveCodes = previous;
      activeExclusiveId = prevActive;
      return;
    }
    renderExclusivePage();
    exclusiveDialog.close();
    showToast('专属码已删除');
  });

  document.querySelector('#code-list').addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const item = codes.find(code => code.id === button.dataset.id);
    if (!item) return;
    if (button.dataset.action === 'copy') copyText(item.code);
    if (button.dataset.action === 'edit') openEditor(item);
    if (button.dataset.action === 'picked') markCodePicked(item.id);
    if (button.dataset.action === 'delete') {
      document.querySelector('#delete-id').value = item.id;
      deleteDialog.showModal();
    }
  });

  markAllPickedBtn.addEventListener('click', () => {
    if (codes.length === 0) return;
    const previousCodes = [...codes];
    const previousHistory = [...pickedHistory];
    const now = Date.now();
    const count = codes.length;
    for (let idx = codes.length - 1; idx >= 0; idx--) {
      const item = codes[idx];
      addToHistory(item, 'picked', now);
      recordHandled(item.code, now);
    }
    codes = [];
    if (!commitPickupState(previousCodes, previousHistory)) return;
    showToast(`已将 ${count} 个取件码标为已取，旧短信不再复活`);
  });

  historyList.addEventListener('click', event => {
    const btn = event.target.closest('[data-history-restore]');
    if (!btn) return;
    const id = btn.dataset.historyRestore;
    const entry = pickedHistory.find(item => item.id === id);
    if (!entry) return;
    const previousCodes = [...codes];
    const previousHistory = [...pickedHistory];
    pickedHistory = pickedHistory.filter(item => item.id !== id);
    unmarkHandled(entry.code);
    if (!hasSavedCode(entry.code)) {
      codes.unshift({
        id: makeId(),
        code: entry.code,
        label: entry.label || '',
        source: entry.source || 'manual',
        createdAt: entry.createdAt || Date.now()
      });
    }
    if (!commitPickupState(previousCodes, previousHistory)) return;
    showToast(`已恢复取件码 ${entry.code}`);
  });

  clearHistoryBtn.addEventListener('click', () => {
    if (pickedHistory.length === 0) return;
    pickedHistory = [];
    saveHistory();
    renderHistory();
    showToast('已清空记录（旧短信码仍不会重复识别）');
  });

  function openEditor(item = null) {
    codeForm.reset();
    document.querySelector('#edit-id').value = item?.id || '';
    document.querySelector('#edit-title').textContent = item ? '编辑取件码' : '添加取件码';
    codeInput.value = item?.code || '';
    labelInput.value = item?.label || '';
    document.querySelector('#code-error').textContent = '';
    editDialog.showModal();
    setTimeout(() => codeInput.focus(), 100);
  }

  document.querySelector('#add-code').addEventListener('click', () => openEditor());
  document.querySelector('#empty-add-code').addEventListener('click', () => openEditor());
  document.querySelectorAll('[data-label]').forEach(button => button.addEventListener('click', () => { labelInput.value = button.dataset.label; }));

  codeForm.addEventListener('submit', event => {
    event.preventDefault();
    const code = codeInput.value.trim().replace(/\s+/g, ' ');
    const id = document.querySelector('#edit-id').value;
    if (!code) {
      document.querySelector('#code-error').textContent = '请输入取件码';
      codeInput.focus();
      return;
    }
    if (codes.some(item => item.code.toLowerCase() === code.toLowerCase() && item.id !== id)) {
      document.querySelector('#code-error').textContent = '这个取件码已经保存过了';
      return;
    }
    const previous = [...codes];
    if (id) {
      const index = codes.findIndex(item => item.id === id);
      if (index < 0) return;
      codes[index] = { ...codes[index], code, label: labelInput.value.trim() };
    } else {
      codes.unshift({ id: makeId(), code, label: labelInput.value.trim(), source: 'manual', createdAt: Date.now() });
    }
    unmarkHandled(code);
    if (!saveCodes()) { codes = previous; return; }
    saveHandledMap();
    renderCodes();
    editDialog.close();
    showToast(id ? '取件码已更新' : '取件码已保存');
  });

  codeInput.addEventListener('input', () => { document.querySelector('#code-error').textContent = ''; });
  document.querySelector('#cancel-delete').addEventListener('click', () => deleteDialog.close());
  document.querySelector('#confirm-delete').addEventListener('click', () => {
    const previous = [...codes];
    const deleteId = document.querySelector('#delete-id').value;
    const target = codes.find(item => item.id === deleteId);
    codes = codes.filter(item => item.id !== deleteId);
    if (!saveCodes()) { codes = previous; return; }
    if (target) {
      recordHandled(target.code, Date.now());
      saveHandledMap();
    }
    renderCodes();
    deleteDialog.close();
    showToast('已删除，旧短信不再重复识别');
  });

  document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  [exclusiveDialog, helpDialog, editDialog, deleteDialog, importDialog].forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }));

  function codeDedupKey(rawCode) {
    return parserAPI ? parserAPI.dedupKey(rawCode) : String(rawCode || '').trim().replace(/\s+/g, '').toLowerCase();
  }

  function hasSavedCode(rawCode) {
    const key = codeDedupKey(rawCode);
    return codes.some(item => codeDedupKey(item.code) === key);
  }

  function applyCompletedItems(completedItems) {
    if (!Array.isArray(completedItems) || completedItems.length === 0) {
      return { clearedCount: 0, recordedCount: 0 };
    }
    let clearedCount = 0;
    let recordedCount = 0;
    const previousCodes = [...codes];
    const previousHistory = [...pickedHistory];

    for (const entry of completedItems) {
      const normalizedCode = parserAPI ? parserAPI.normalizePickupCode(entry.code) : String(entry.code || '').trim();
      if (!normalizedCode) continue;
      const key = codeDedupKey(normalizedCode);
      const ts = Number.isFinite(entry.timestamp) ? entry.timestamp : Date.now();
      recordHandled(normalizedCode, ts);
      recordedCount++;

      const idx = codes.findIndex(item => codeDedupKey(item.code) === key);
      if (idx >= 0) {
        const activeItem = codes[idx];
        if ((activeItem.createdAt || 0) <= ts + CLOCK_SKEW_MS) {
          codes.splice(idx, 1);
          addToHistory(activeItem, 'auto_signed', ts);
          clearedCount++;
        }
      }
    }

    if (clearedCount > 0) {
      if (!commitPickupState(previousCodes, previousHistory)) return { clearedCount: 0, recordedCount };
    } else if (recordedCount > 0) {
      saveHandledMap();
    }
    return { clearedCount, recordedCount };
  }

  function importParsedItems(items, fallbackSource = 'paste', options = {}) {
    if (!Array.isArray(items) || items.length === 0) {
      return { addedCount: 0, duplicateCount: 0, skippedHandledCount: 0, addedItems: [] };
    }
    const respectHandled = options.respectHandled !== false;
    const existingKeys = new Set(codes.map(item => codeDedupKey(item.code)));
    const addedItems = [];
    let duplicateCount = 0;
    let skippedHandledCount = 0;

    const sorted = [...items].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    for (const entry of sorted) {
      const normalizedCode = parserAPI ? parserAPI.normalizePickupCode(entry.code) : String(entry.code || '').trim();
      if (!normalizedCode) continue;
      const key = codeDedupKey(normalizedCode);
      if (existingKeys.has(key)) {
        duplicateCount++;
        continue;
      }
      const source = entry.source || fallbackSource;
      if (respectHandled && isBlockedByHandled(normalizedCode, entry.timestamp, source)) {
        skippedHandledCount++;
        continue;
      }
      if (!respectHandled) {
        unmarkHandled(normalizedCode);
      }
      existingKeys.add(key);
      addedItems.push({
        id: makeId(),
        code: normalizedCode,
        label: String(entry.label || '快递驿站').trim().slice(0, 24),
        source,
        createdAt: Number.isFinite(entry.timestamp) ? entry.timestamp : Date.now()
      });
    }

    if (addedItems.length === 0) {
      return { addedCount: 0, duplicateCount, skippedHandledCount, addedItems: [] };
    }

    const previous = [...codes];
    codes = [...addedItems, ...codes].slice(0, 100);
    if (!saveCodes()) {
      codes = previous;
      return { addedCount: 0, duplicateCount, skippedHandledCount, addedItems: [] };
    }
    if (!respectHandled) saveHandledMap();
    renderCodes();
    return { addedCount: addedItems.length, duplicateCount, skippedHandledCount, addedItems };
  }

  function setImportTab(tabName) {
    const activeTab = tabName === 'auto' ? 'auto' : 'paste';
    importTabs.forEach(tab => {
      const isSelected = tab.dataset.importTab === activeTab;
      tab.classList.toggle('active', isSelected);
      tab.setAttribute('aria-selected', String(isSelected));
    });
    importPanels.paste.hidden = activeTab !== 'paste';
    importPanels.auto.hidden = activeTab !== 'auto';
    if (activeTab === 'auto') refreshAutoImportStatus();
  }

  function openImportDialog(tabName = 'paste', prefillText = '') {
    setImportTab(tabName);
    if (typeof prefillText === 'string' && prefillText.length > 0) {
      importTextInput.value = prefillText;
    }
    updateImportPreview();
    if (!importDialog.open) importDialog.showModal();
    if (tabName === 'paste' && !prefillText) {
      importTextInput.focus();
    }
  }

  function updateImportConfirmState() {
    const selectedCount = draftParsedItems.filter(item => item.selected && !item.duplicate).length;
    importConfirmBtn.disabled = selectedCount === 0;
    importConfirmBtn.querySelector('span').textContent = selectedCount > 0
      ? `导入选中的 ${selectedCount} 个取件码`
      : '导入选中的取件码';
  }

  function renderImportPreview() {
    const raw = importTextInput.value.trim();
    if (!raw) {
      importParseSummary.textContent = '粘贴后自动识别';
      importParseSummary.classList.remove('has-items');
      importPreviewList.innerHTML = '<div class="import-preview-empty">支持菜鸟驿站、丰巢、易递通、兔喜、妈妈驿站、顺丰、京东、拼多多等短信与微信通知，一次可粘贴多条。</div>';
      updateImportConfirmState();
      return;
    }
    if (draftParsedItems.length === 0) {
      importParseSummary.textContent = draftSkippedSignedCount > 0
        ? `已过滤 ${draftSkippedSignedCount} 条已签收/已取件消息`
        : '未识别到取件码';
      importParseSummary.classList.remove('has-items');
      importPreviewList.innerHTML = draftSkippedSignedCount > 0
        ? '<div class="import-preview-empty">粘贴的消息都是已签收/已取件记录，已自动跳过，不再重复导入。</div>'
        : '<div class="import-preview-empty">暂未识别到有效取件码（已自动过滤验证码、手机号和运单号）。可直接粘贴完整取件短信或微信通知。</div>';
      updateImportConfirmState();
      return;
    }

    const selectedCount = draftParsedItems.filter(item => item.selected && !item.duplicate).length;
    const freshCount = draftParsedItems.filter(item => !item.duplicate).length;
    const signedHint = draftSkippedSignedCount > 0 ? `，略过 ${draftSkippedSignedCount} 条已签收` : '';
    importParseSummary.textContent = selectedCount > 0
      ? `已识别 ${draftParsedItems.length} 条，${selectedCount} 条待导入${signedHint}`
      : (freshCount > 0
        ? `已识别 ${draftParsedItems.length} 条（曾已取件，可手动勾选）${signedHint}`
        : `已识别 ${draftParsedItems.length} 条（均已保存）${signedHint}`);
    importParseSummary.classList.toggle('has-items', selectedCount > 0);

    importPreviewList.innerHTML = draftParsedItems.map((item, idx) => {
      const code = escapeHTML(item.code);
      const label = escapeHTML(item.label);
      const dupBadge = item.duplicate
        ? '<span class="import-dup-badge">已保存</span>'
        : (item.previouslyHandled ? '<span class="import-dup-badge is-picked">已取过</span>' : '');
      const checked = item.selected && !item.duplicate ? 'checked' : '';
      const disabled = item.duplicate ? 'disabled' : '';
      return `<div class="import-preview-item${item.duplicate ? ' is-dup' : ''}">
        <input class="import-preview-check" type="checkbox" data-preview-check="${idx}" ${checked} ${disabled} aria-label="选择取件码 ${code}">
        <div class="import-preview-main">
          <div class="import-preview-top"><strong class="import-preview-code">${code}</strong>${dupBadge}</div>
          <input class="import-preview-label-input" type="text" maxlength="24" data-preview-label="${idx}" value="${label}" placeholder="驿站或快递备注" ${disabled}>
        </div>
      </div>`;
    }).join('');
    updateImportConfirmState();
  }

  function updateImportPreview() {
    const raw = importTextInput.value;
    const detailed = parserAPI
      ? parserAPI.parseMessagesDetailed(raw, { source: 'paste' })
      : { arrivals: [], completed: [] };
    const completedKeys = new Set(detailed.completed.map(item => codeDedupKey(item.code)));
    draftSkippedSignedCount = detailed.completed.length;
    const filteredArrivals = detailed.arrivals.filter(item => !completedKeys.has(codeDedupKey(item.code)));
    draftParsedItems = filteredArrivals.map(item => {
      const duplicate = hasSavedCode(item.code);
      const previouslyHandled = !duplicate && Boolean(handledMap[codeDedupKey(item.code)]);
      return {
        code: item.code,
        label: item.label,
        source: item.source || 'paste',
        timestamp: item.timestamp,
        duplicate,
        previouslyHandled,
        selected: !duplicate && !previouslyHandled
      };
    });
    renderImportPreview();
  }

  function syncClipboardBannerVisibility() {
    if (clipboardCandidates.length === 0) {
      clipboardBanner.hidden = true;
      return;
    }
    clipboardCandidates = clipboardCandidates.filter(item =>
      !hasSavedCode(item.code) && !isBlockedByHandled(item.code, item.timestamp, 'clipboard')
    );
    if (clipboardCandidates.length === 0) {
      clipboardBanner.hidden = true;
      return;
    }
    const first = clipboardCandidates[0];
    clipboardBannerCode.textContent = clipboardCandidates.length > 1
      ? `${first.code} 等 ${clipboardCandidates.length} 个取件码`
      : first.code;
    clipboardBannerLabel.textContent = first.label || '快递取件';
    clipboardBanner.hidden = false;
  }

  function inspectClipboardText(rawText, explicit = false) {
    const text = String(rawText || '').trim();
    if (explicit) {
      if (!text) {
        showToast('剪贴板里暂时没有文字', false);
        return;
      }
      importTextInput.value = text;
      updateImportPreview();
      if (draftParsedItems.length > 0) {
        showToast(`从剪贴板识别到 ${draftParsedItems.length} 个取件码`);
      } else {
        showToast('已粘贴剪贴板内容，未发现取件码', false);
      }
      return;
    }
    if (!text || text === lastDismissedClipboardRaw) return;
    if (exclusiveCodes.some(item => item.code.toLowerCase() === text.toLowerCase())) return;
    const detailed = parserAPI
      ? parserAPI.parseMessagesDetailed(text, { source: 'clipboard' })
      : { arrivals: [], completed: [] };
    const completedKeys = new Set(detailed.completed.map(item => codeDedupKey(item.code)));
    const fresh = detailed.arrivals.filter(item =>
      !completedKeys.has(codeDedupKey(item.code)) &&
      !hasSavedCode(item.code) &&
      !isBlockedByHandled(item.code, item.timestamp, 'clipboard')
    );
    if (fresh.length === 0) return;
    lastClipboardRaw = text;
    clipboardCandidates = fresh;
    syncClipboardBannerVisibility();
  }

  async function readClipboardForImport(explicit = true) {
    if (window.AndroidApp && typeof window.AndroidApp.requestClipboardCheck === 'function') {
      callBridge('requestClipboardCheck', explicit);
      return;
    }
    if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
      if (explicit) showToast('当前环境不支持自动读剪贴板，请直接长按粘贴', false);
      return;
    }
    try {
      if (!explicit && navigator.permissions && typeof navigator.permissions.query === 'function') {
        const perm = await navigator.permissions.query({ name: 'clipboard-read' });
        if (perm.state !== 'granted') return;
      }
      const text = await navigator.clipboard.readText();
      inspectClipboardText(text, explicit);
    } catch {
      if (explicit) showToast('未获剪贴板权限，请直接在上方输入框长按粘贴', false);
    }
  }

  function formatShortTime(ts) {
    if (!Number.isFinite(ts) || ts <= 0) return '';
    return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(ts);
  }

  function renderAutoImportStatus() {
    const isAndroid = Boolean(autoStatus.isAndroid);
    const smsReady = isAndroid && Boolean(autoStatus.hasSmsPermission);
    const notifyGranted = isAndroid && Boolean(autoStatus.hasNotificationAccess);
    const notifyActive = notifyGranted && Boolean(autoStatus.notifyEnabled);

    quickSmsBtn.classList.toggle('is-active', smsReady);
    quickSmsLabel.textContent = smsScanBusy ? '扫描中…' : (smsReady ? '扫描短信' : '短信导入');

    quickNotifyBtn.classList.toggle('is-active', notifyActive);
    quickNotifyLabel.textContent = notifyActive ? '通知抓取 · 已开' : (notifyGranted ? '通知抓取 · 暂停' : '通知抓取 · 未开');

    smsStatusPill.className = 'status-pill' + (smsReady ? ' is-on' : '');
    smsStatusPill.textContent = !isAndroid ? '安卓端可用' : (smsReady ? '已授权' : '未授权');

    notifyStatusPill.className = 'status-pill' + (notifyActive ? ' is-on' : (notifyGranted ? ' is-warn' : ''));
    notifyStatusPill.textContent = !isAndroid ? '安卓端可用' : (notifyActive ? '监听中' : (notifyGranted ? '已暂停' : '未开启'));

    document.querySelectorAll('[data-sms-days]').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.smsDays) === Number(autoStatus.smsScanDays));
    });

    smsAutoToggle.checked = Boolean(autoStatus.smsAutoSync);
    smsAutoToggle.disabled = !isAndroid;

    notifyEnabledToggle.checked = Boolean(autoStatus.notifyEnabled);
    notifyEnabledToggle.disabled = !notifyGranted;

    runSmsScanBtn.disabled = smsScanBusy;
    const daysLabel = Number(autoStatus.smsScanDays) === 1 ? '今天' : `近 ${autoStatus.smsScanDays} 天`;
    runSmsScanBtn.textContent = smsScanBusy
      ? '正在扫描短信…'
      : (!isAndroid ? '仅安卓端支持扫描短信' : (smsReady ? `立即扫描${daysLabel}短信` : '授权并扫描短信'));

    ignoreOldSmsBtn.disabled = !isAndroid;
    if (isAndroid && autoStatus.smsIgnoreBeforeTs > 0) {
      smsBaselineRow.hidden = false;
      smsBaselineText.textContent = `仅扫描 ${formatShortTime(autoStatus.smsIgnoreBeforeTs)} 后的新短信`;
    } else {
      smsBaselineRow.hidden = true;
    }

    openNotifySettingsBtn.textContent = !isAndroid
      ? '仅安卓端支持通知监听'
      : (notifyGranted ? '管理通知使用权' : '去开启通知使用权');
    openNotifySettingsBtn.disabled = !isAndroid;
    openAppSettingsBtn.disabled = !isAndroid;

    if (isAndroid && autoStatus.lastSmsSyncTs > 0) {
      smsLastResult.textContent = `上次扫描：${formatShortTime(autoStatus.lastSmsSyncTs)}（已取件/已删除的旧码不再复活）`;
    }
    if (isAndroid) {
      notifyCaptureSummary.textContent = notifyActive
        ? `正在本地监听取件通知 · 已累计捕获 ${autoStatus.notifyCapturedCount || 0} 条`
        : (notifyGranted
          ? '系统权限已授权，当前处于暂停状态，打开上方开关即可恢复。'
          : '开启后微信易递通、菜鸟、拼多多、丰巢等取件通知会自动识别入库。');
    } else {
      notifyCaptureSummary.textContent = '在安卓安装包中可直接开启系统通知监听与短信扫描；网页端请使用「文本 / 剪贴板」导入。';
    }
  }

  function applyStatusFromJson(jsonStr) {
    try {
      const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      if (parsed && typeof parsed === 'object') {
        autoStatus = { ...autoStatus, ...parsed };
      }
    } catch { /* ignore malformed status */ }
    renderAutoImportStatus();
  }

  function refreshAutoImportStatus() {
    const raw = callBridge('getAutoImportStatus');
    if (raw !== undefined) {
      applyStatusFromJson(raw);
    } else {
      autoStatus.isAndroid = false;
      renderAutoImportStatus();
    }
  }

  function triggerSmsScan(silent = false) {
    if (!window.AndroidApp || typeof window.AndroidApp.requestSmsScan !== 'function') {
      if (!silent) openImportDialog('auto');
      return;
    }
    smsScanBusy = true;
    renderAutoImportStatus();
    callBridge('requestSmsScan', autoStatus.smsScanDays || 7, Boolean(silent));
  }

  function handleIncomingRecords(records) {
    if (!Array.isArray(records) || records.length === 0) return;
    const shareRecords = records.filter(item => item && item.source === 'share');
    const autoRecords = records.filter(item => item && item.source !== 'share');

    if (autoRecords.length > 0 && parserAPI) {
      const detailed = parserAPI.parseRecordsDetailed(autoRecords);
      const cleared = applyCompletedItems(detailed.completed);
      const res = importParsedItems(detailed.arrivals, 'notification', { respectHandled: true });
      if (res.addedCount > 0 && cleared.clearedCount > 0) {
        showToast(`新导入 ${res.addedCount} 个取件码，自动核销 ${cleared.clearedCount} 个已签收件`);
      } else if (res.addedCount > 0) {
        showToast(`自动识别并导入了 ${res.addedCount} 个取件码`);
      } else if (cleared.clearedCount > 0) {
        showToast(`已自动核销 ${cleared.clearedCount} 个已签收的取件码`);
      }
    }

    if (shareRecords.length > 0) {
      const combined = shareRecords
        .map(item => [item.title || '', item.text || ''].filter(Boolean).join('\n'))
        .filter(Boolean)
        .join('\n\n');
      if (combined) {
        switchPage('pickup');
        openImportDialog('paste', combined);
      }
    }
  }

  window.onAndroidAutoImportStatus = jsonStr => {
    applyStatusFromJson(jsonStr);
  };

  window.onAndroidIncomingMessages = jsonStr => {
    try {
      const records = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      handleIncomingRecords(records);
    } catch { /* ignore malformed queue */ }
    refreshAutoImportStatus();
  };

  window.onAndroidSmsScanResult = (jsonStr, silent, errorMsg) => {
    smsScanBusy = false;
    renderAutoImportStatus();
    if (errorMsg) {
      if (!silent) showToast(errorMsg, false);
      return;
    }
    let records = [];
    try {
      records = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : (Array.isArray(jsonStr) ? jsonStr : []);
    } catch {
      records = [];
    }
    const detailed = parserAPI
      ? parserAPI.parseRecordsDetailed(records)
      : { arrivals: [], completed: [] };
    const cleared = applyCompletedItems(detailed.completed);
    const res = importParsedItems(detailed.arrivals, 'sms', { respectHandled: true });
    const nowText = formatShortTime(Date.now());
    const skippedTotal = res.duplicateCount + res.skippedHandledCount;
    const daysLabel = Number(autoStatus.smsScanDays) === 1 ? '今天' : `近 ${autoStatus.smsScanDays} 天`;
    if (res.addedCount > 0) {
      const extras = [];
      if (cleared.clearedCount > 0) extras.push(`自动核销 ${cleared.clearedCount} 个已签收`);
      if (skippedTotal > 0) extras.push(`跳过 ${skippedTotal} 个旧/重复码`);
      smsLastResult.textContent = `${nowText} 扫描完成：新导入 ${res.addedCount} 个取件码` + (extras.length > 0 ? `（${extras.join('，')}）` : '');
      showToast(silent
        ? `自动同步短信，新导入 ${res.addedCount} 个取件码`
        : (cleared.clearedCount > 0 ? `新导入 ${res.addedCount} 个，自动核销 ${cleared.clearedCount} 个已签收` : `扫描完成，新导入 ${res.addedCount} 个取件码`));
    } else if (cleared.clearedCount > 0) {
      smsLastResult.textContent = `${nowText} 扫描完成：自动核销 ${cleared.clearedCount} 个已签收包裹`;
      showToast(`已自动核销 ${cleared.clearedCount} 个已签收的取件码`);
    } else if (!silent) {
      smsLastResult.textContent = skippedTotal > 0
        ? `${nowText} 扫描完成：已跳过 ${skippedTotal} 个已保存或已取件的旧码`
        : `${nowText} 扫描了${daysLabel}短信，暂未发现新的取件码`;
      showToast(skippedTotal > 0 ? '短信里的旧取件码已全部处理过' : `${daysLabel}暂无新的取件码`, false);
    }
  };

  window.onAndroidSmsPermissionDenied = canAskAgain => {
    smsScanBusy = false;
    renderAutoImportStatus();
    showToast(canAskAgain ? '未授予短信权限，无法扫描短信' : '短信权限被禁用，请点「打开应用信息」开启', false);
    if (!canAskAgain) openImportDialog('auto');
  };

  window.onAndroidClipboardText = (text, explicit) => {
    inspectClipboardText(text, Boolean(explicit));
  };

  window.onAndroidAppFocused = () => {
    refreshAutoImportStatus();
    callBridge('requestClipboardCheck', false);
  };

  document.querySelector('#open-smart-import').addEventListener('click', () => openImportDialog('paste'));
  document.querySelector('#empty-smart-import').addEventListener('click', () => openImportDialog('paste'));
  document.querySelector('#quick-paste-btn').addEventListener('click', () => openImportDialog('paste'));
  quickSmsBtn.addEventListener('click', () => {
    if (autoStatus.isAndroid && autoStatus.hasSmsPermission) triggerSmsScan(false);
    else openImportDialog('auto');
  });
  quickNotifyBtn.addEventListener('click', () => openImportDialog('auto'));

  importTabs.forEach(tab => tab.addEventListener('click', () => setImportTab(tab.dataset.importTab)));
  importTextInput.addEventListener('input', updateImportPreview);
  document.querySelector('#import-clear-text').addEventListener('click', () => {
    importTextInput.value = '';
    updateImportPreview();
    importTextInput.focus();
  });
  document.querySelector('#import-read-clipboard').addEventListener('click', () => readClipboardForImport(true));

  importPreviewList.addEventListener('change', event => {
    const check = event.target.closest('[data-preview-check]');
    if (!check) return;
    const idx = Number(check.dataset.previewCheck);
    if (draftParsedItems[idx]) {
      draftParsedItems[idx].selected = check.checked;
      updateImportConfirmState();
    }
  });

  importPreviewList.addEventListener('input', event => {
    const input = event.target.closest('[data-preview-label]');
    if (!input) return;
    const idx = Number(input.dataset.previewLabel);
    if (draftParsedItems[idx]) {
      draftParsedItems[idx].label = input.value;
    }
  });

  importConfirmBtn.addEventListener('click', () => {
    const chosen = draftParsedItems.filter(item => item.selected && !item.duplicate);
    const res = importParsedItems(chosen, 'paste', { respectHandled: false });
    if (res.addedCount > 0) {
      importTextInput.value = '';
      draftParsedItems = [];
      draftSkippedSignedCount = 0;
      importDialog.close();
      showToast(`已导入 ${res.addedCount} 个取件码`);
    } else {
      showToast('没有可导入的新取件码', false);
    }
  });

  document.querySelector('#clipboard-import-btn').addEventListener('click', () => {
    const res = importParsedItems(clipboardCandidates, 'clipboard', { respectHandled: false });
    lastDismissedClipboardRaw = lastClipboardRaw;
    clipboardCandidates = [];
    clipboardBanner.hidden = true;
    if (res.addedCount > 0) showToast(`已从剪贴板导入 ${res.addedCount} 个取件码`);
  });

  document.querySelector('#clipboard-dismiss-btn').addEventListener('click', () => {
    lastDismissedClipboardRaw = lastClipboardRaw;
    clipboardCandidates = [];
    clipboardBanner.hidden = true;
  });

  document.querySelector('#sms-days-group').addEventListener('click', event => {
    const btn = event.target.closest('[data-sms-days]');
    if (!btn) return;
    const days = Number(btn.dataset.smsDays);
    autoStatus.smsScanDays = days;
    callBridge('setSmsScanDays', days);
    renderAutoImportStatus();
  });

  smsAutoToggle.addEventListener('change', () => {
    autoStatus.smsAutoSync = smsAutoToggle.checked;
    callBridge('setSmsAutoSync', smsAutoToggle.checked);
    renderAutoImportStatus();
  });

  notifyEnabledToggle.addEventListener('change', () => {
    autoStatus.notifyEnabled = notifyEnabledToggle.checked;
    callBridge('setNotifyCaptureEnabled', notifyEnabledToggle.checked);
    renderAutoImportStatus();
  });

  runSmsScanBtn.addEventListener('click', () => {
    if (!autoStatus.isAndroid) {
      showToast('请在安卓客户端中使用短信扫描，网页端可使用文本/剪贴板导入', false);
      return;
    }
    triggerSmsScan(false);
  });

  ignoreOldSmsBtn.addEventListener('click', () => {
    if (!autoStatus.isAndroid) {
      showToast('请在安卓客户端中使用短信扫描设置', false);
      return;
    }
    callBridge('setSmsIgnoreBeforeNow');
    autoStatus.smsIgnoreBeforeTs = Date.now();
    renderAutoImportStatus();
    showToast('已设截断线：只识别此后收到的新短信');
  });

  resetSmsBaselineBtn.addEventListener('click', () => {
    callBridge('clearSmsIgnoreBefore');
    autoStatus.smsIgnoreBeforeTs = 0;
    renderAutoImportStatus();
    showToast('已重置短信时间线');
  });

  openNotifySettingsBtn.addEventListener('click', () => callBridge('openNotificationSettings'));
  openAppSettingsBtn.addEventListener('click', () => callBridge('openAppSettings'));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !autoStatus.isAndroid) {
      readClipboardForImport(false);
    }
  });

  function setScanOrientation(rotated) {
    fullscreenScanStage.classList.toggle('is-rotated', rotated);
    orientationLabel.textContent = rotated ? '切换横屏' : '切换竖向';
  }

  toggleOrientationBtn.addEventListener('click', () => {
    setScanOrientation(!fullscreenScanStage.classList.contains('is-rotated'));
  });

  fullscreenScanStage.addEventListener('click', () => barcodeDialog.close());
  fullscreenScanStage.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      barcodeDialog.close();
    }
  });

  document.querySelector('#enlarge-exclusive').addEventListener('click', async () => {
    if (!getActiveExclusive()) return;
    setScanOrientation(window.innerHeight >= window.innerWidth);
    barcodeDialog.showModal();
    try { window.AndroidApp?.setScanMode?.(true); } catch { /* Optional Android bridge. */ }
    if ('wakeLock' in navigator) {
      try { wakeLock = await navigator.wakeLock.request('screen'); } catch { /* Wake lock is optional. */ }
    }
  });

  barcodeDialog.addEventListener('close', () => {
    try { window.AndroidApp?.setScanMode?.(false); } catch { /* Optional Android bridge. */ }
    wakeLock?.release();
    wakeLock = null;
  });

  function showToast(message, success = true) {
    const toast = document.querySelector('#toast');
    toast.querySelector('span').textContent = message;
    toast.querySelector('svg').style.display = success ? '' : 'none';
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400);
  }

  window.handleAndroidBack = () => {
    const openDialog = document.querySelector('dialog[open]');
    if (openDialog) { openDialog.close(); return true; }
    if (!pages.exclusive.hidden) return false;
    switchPage('exclusive');
    return true;
  };

  function loadPlatformOrder() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PLATFORM_ORDER_KEY) || '{}');
      return {
        identity: Array.isArray(parsed.identity) ? parsed.identity.filter(id => typeof id === 'string') : [],
        pickup: Array.isArray(parsed.pickup) ? parsed.pickup.filter(id => typeof id === 'string') : []
      };
    } catch {
      return { identity: [], pickup: [] };
    }
  }

  let platformOrder = loadPlatformOrder();
  let platformHoldTimer = null;
  let platformDragState = null;
  let suppressPlatformClick = false;

  function savePlatformOrder() {
    try {
      localStorage.setItem(PLATFORM_ORDER_KEY, JSON.stringify(platformOrder));
    } catch { /* Ignore storage quota errors. */ }
  }

  function getOrderedPlatformEntries(group) {
    const base = PLATFORM_ENTRIES[group] || [];
    const ids = platformOrder[group] || [];
    const byId = new Map(base.map(entry => [entry.id, entry]));
    const ordered = [];
    for (const id of ids) {
      const hit = byId.get(id);
      if (hit && !ordered.includes(hit)) ordered.push(hit);
    }
    for (const entry of base) {
      if (!ordered.includes(entry)) ordered.push(entry);
    }
    return ordered;
  }

  function openPlatformEntry(entry) {
    const bridge = window.AndroidApp;
    const hasPackagedOpen = Boolean(bridge && typeof bridge.openAppForPackage === 'function');
    const hasNativeOpen = Boolean(bridge && (
      hasPackagedOpen || typeof bridge.openApp === 'function' || typeof bridge.openInstalledApp === 'function'
    ));
    if (hasNativeOpen) {
      let opened = false;
      if (hasPackagedOpen && Array.isArray(entry.chains)) {
        for (const chain of entry.chains) {
          for (const candidateUri of chain.uris) {
            try { opened = Boolean(bridge.openAppForPackage(candidateUri, chain.pkg)); } catch { opened = false; }
            if (opened) break;
          }
          if (opened) break;
        }
      } else if (entry.uri && typeof bridge.openApp === 'function') {
        try { opened = Boolean(bridge.openApp(entry.uri)); } catch { opened = false; }
      }
      if (opened) {
        showToast(entry.toast);
        return;
      }
      const candidatePkgs = entry.packages || (entry.packageName ? [entry.packageName] : []);
      if (typeof bridge.openInstalledApp === 'function') {
        for (const pkg of candidatePkgs) {
          try { opened = Boolean(bridge.openInstalledApp(pkg)); } catch { opened = false; }
          if (opened) {
            showToast(entry.homeToast || `已打开${entry.short}首页，请在应用内查看${entry.name.includes('身份码') ? '身份码' : '订单与物流'}`);
            return;
          }
        }
      }
      if (hasPackagedOpen && entry.uri && typeof bridge.openApp === 'function') {
        try { opened = Boolean(bridge.openApp(entry.uri)); } catch { opened = false; }
        if (opened) {
          showToast(entry.toast);
          return;
        }
      }
      if (entry.web) {
        let webOpened = false;
        try {
          if (typeof bridge.openWeb === 'function') {
            webOpened = Boolean(bridge.openWeb(entry.web));
          }
        } catch { webOpened = false; }
        if (webOpened) {
          showToast(`${entry.short}应用跳转未成功，已改用浏览器打开`);
          return;
        }
      }
      showToast(`暂时无法打开${entry.short}，请确认已安装并可正常启动`, false);
      return;
    }

    if (entry.web) {
      try { window.open(entry.web, '_blank', 'noopener,noreferrer'); } catch { /* Ignore popup blockers. */ }
      showToast(`已在浏览器打开${entry.name}`);
      return;
    }
    showToast(`${entry.name}请在安卓客户端内打开`, false);
  }

  function platformHaptic(longPress = false) {
    try {
      if (longPress && typeof window.AndroidApp?.hapticLongPress === 'function') callBridge('hapticLongPress');
      else if (typeof window.AndroidApp?.hapticFeedback === 'function') callBridge('hapticFeedback');
      else if (navigator.vibrate) navigator.vibrate(longPress ? 14 : 10);
    } catch { /* Follow device feedback settings; feedback is optional. */ }
  }

  function syncPlatformOrderFromDom(group, grid) {
    platformOrder[group] = [...grid.querySelectorAll('.platform-tile')].map(el => el.dataset.entryId).filter(Boolean);
    savePlatformOrder();
  }

  function stopPlatformHold() {
    clearTimeout(platformHoldTimer);
    platformHoldTimer = null;
  }

  function openPlatformDrawer() {
    if (platformDrawer.open) {
      if (platformHoldTimer || platformDragState) return;
      closePlatformDrawer();
      return;
    }
    stopPlatformHold();
    finishPlatformDrag();
    syncPlatformLauncher();
    platformDrawer.showModal();
    platformLauncher.setAttribute('aria-expanded', 'true');
    platformLauncher.classList.add('is-expanded');
  }

  function closePlatformDrawer() {
    stopPlatformHold();
    finishPlatformDrag();
    if (platformDrawer.open) platformDrawer.close();
  }

  platformLauncher.addEventListener('click', openPlatformDrawer);
  $('#close-platform-drawer').addEventListener('click', closePlatformDrawer);
  platformDrawer.addEventListener('click', event => {
    if (event.target === platformDrawer && !platformHoldTimer && !platformDragState) closePlatformDrawer();
  });
  platformDrawer.addEventListener('close', () => {
    stopPlatformHold();
    finishPlatformDrag();
    platformLauncher.setAttribute('aria-expanded', 'false');
    platformLauncher.classList.remove('is-expanded');
  });

  function handlePlatformDragMove(event) {
    if (!platformDragState || event.pointerId !== platformDragState.pointerId) return;
    event.preventDefault();
    const { tile, grid } = platformDragState;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const target = hit ? hit.closest('.platform-tile') : null;
    if (!target || target === tile || target.parentElement !== grid) return;
    const siblings = [...grid.children];
    const dragIndex = siblings.indexOf(tile);
    const targetIndex = siblings.indexOf(target);
    if (dragIndex < 0 || targetIndex < 0) return;
    if (dragIndex < targetIndex) grid.insertBefore(tile, target.nextSibling);
    else grid.insertBefore(tile, target);
    platformDragState.moved = true;
  }

  function finishPlatformDrag(event) {
    if (!platformDragState) return;
    if (event && event.pointerId !== undefined && event.pointerId !== platformDragState.pointerId) return;
    const { tile, grid, group, moved } = platformDragState;
    tile.classList.remove('is-dragging');
    grid.classList.remove('is-reordering');
    window.removeEventListener('pointermove', handlePlatformDragMove);
    window.removeEventListener('pointerup', finishPlatformDrag);
    window.removeEventListener('pointercancel', finishPlatformDrag);
    platformDragState = null;
    if (moved) {
      syncPlatformOrderFromDom(group, grid);
      showToast('已更新平台顺序');
    }
    setTimeout(() => { suppressPlatformClick = false; }, 0);
  }

  function attachPlatformTileEvents(tile, entry, group, grid) {
    let startX = 0;
    let startY = 0;
    let activePointerId = null;

    function beginDrag() {
      platformHoldTimer = null;
      tile.classList.remove('is-pressing', 'is-rebounding');
      platformDragState = { tile, grid, group, pointerId: activePointerId, moved: false };
      suppressPlatformClick = true;
      tile.classList.add('is-dragging');
      grid.classList.add('is-reordering');
      platformHaptic(true);
      window.addEventListener('pointermove', handlePlatformDragMove, { passive: false });
      window.addEventListener('pointerup', finishPlatformDrag);
      window.addEventListener('pointercancel', finishPlatformDrag);
    }

    function clearPressVisual(rebound = false) {
      const wasPressing = tile.classList.contains('is-pressing');
      tile.classList.remove('is-pressing');
      if (rebound && wasPressing && !platformDragState) {
        tile.classList.remove('is-rebounding');
        void tile.offsetWidth;
        tile.classList.add('is-rebounding');
      }
    }

    tile.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (platformDragState) return;
      startX = event.clientX;
      startY = event.clientY;
      activePointerId = event.pointerId;
      stopPlatformHold();
      if (grid.classList.contains('is-sort-mode')) {
        beginDrag();
      } else {
        tile.classList.remove('is-rebounding');
        tile.classList.add('is-pressing');
        platformHoldTimer = setTimeout(beginDrag, 420);
      }
    });

    tile.addEventListener('pointermove', event => {
      if (platformDragState || event.pointerId !== activePointerId) return;
      if (Math.abs(event.clientX - startX) > 8 || Math.abs(event.clientY - startY) > 8) {
        stopPlatformHold();
        clearPressVisual(false);
      }
    });

    tile.addEventListener('pointerup', () => {
      stopPlatformHold();
      clearPressVisual(true);
    });
    tile.addEventListener('pointercancel', () => {
      stopPlatformHold();
      clearPressVisual(false);
    });
    tile.addEventListener('pointerleave', () => {
      if (!platformDragState) {
        stopPlatformHold();
        clearPressVisual(false);
      }
    });
    tile.addEventListener('animationend', event => {
      if (event.animationName === 'platform-rebound') tile.classList.remove('is-rebounding');
    });
    tile.addEventListener('contextmenu', event => event.preventDefault());
    tile.addEventListener('keydown', event => {
      if (!event.altKey || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const previous = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
      const sibling = previous ? tile.previousElementSibling : tile.nextElementSibling;
      if (!sibling) return;
      grid.insertBefore(tile, previous ? sibling : sibling.nextSibling);
      tile.focus({ preventScroll: true });
      syncPlatformOrderFromDom(group, grid);
      showToast('已更新平台顺序');
    });
    tile.addEventListener('click', () => {
      if (suppressPlatformClick) {
        suppressPlatformClick = false;
        return;
      }
      if (grid.classList.contains('is-sort-mode')) return;
      platformHaptic();
      closePlatformDrawer();
      openPlatformEntry(entry);
    });
  }

  function renderPlatformGrid(group, selector) {
    const grid = document.querySelector(selector);
    if (!grid) return;
    grid.innerHTML = '';
    for (const [index, entry] of getOrderedPlatformEntries(group).entries()) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'platform-tile';
      tile.dataset.entryId = entry.id;
      tile.dataset.platformGroup = group;
      tile.setAttribute('aria-label', `${entry.name}，${entry.detail}，长按或按 Alt 加方向键排序`);
      tile.style.setProperty('--entry-delay', `${index * 45}ms`);

      const content = document.createElement('span');
      content.className = 'platform-tile-content';

      const trail = document.createElement('span');
      trail.className = 'platform-tile-trail';
      trail.setAttribute('aria-hidden', 'true');
      if (entry.actionLabel) {
        const pill = document.createElement('span');
        pill.className = 'platform-tile-pill';
        pill.textContent = entry.actionLabel;
        trail.appendChild(pill);
      }
      const chevSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      chevSvg.setAttribute('class', 'platform-tile-chevron');
      const chevUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      chevUse.setAttribute('href', '#icon-chevron-right');
      chevSvg.appendChild(chevUse);

      const gripSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      gripSvg.setAttribute('class', 'platform-tile-grip');
      const gripUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      gripUse.setAttribute('href', '#icon-grip');
      gripSvg.appendChild(gripUse);
      trail.append(chevSvg, gripSvg);

      const badge = document.createElement('span');
      badge.className = 'platform-badge';
      badge.dataset.brand = entry.brand;
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = entry.glyph;

      const name = document.createElement('span');
      name.className = 'platform-tile-name';
      name.textContent = entry.name;

      const detail = document.createElement('span');
      detail.className = 'platform-tile-detail';
      detail.textContent = entry.detail;
      const text = document.createElement('span');
      text.className = 'platform-tile-text';
      text.append(name, detail);
      content.append(badge, text, trail);
      tile.append(content);
      attachPlatformTileEvents(tile, entry, group, grid);
      grid.appendChild(tile);
    }
  }

  function renderPlatformGrids() {
    renderPlatformGrid('identity', '#platform-identity-grid');
    renderPlatformGrid('pickup', '#platform-pickup-grid');
  }

  document.querySelectorAll('[data-sort-platforms]').forEach(button => {
    button.addEventListener('click', () => {
      const grid = document.getElementById(button.getAttribute('aria-controls'));
      stopPlatformHold();
      finishPlatformDrag();
      const sorting = grid.classList.toggle('is-sort-mode');
      button.setAttribute('aria-pressed', String(sorting));
      button.textContent = sorting ? '完成' : '排序';
      if (sorting) showToast('拖动卡片调整顺序，调整后点“完成”');
    });
  });

  renderExclusivePage();
  renderCodes();
  renderPlatformGrids();
  switchPage(pageFromHash());
  refreshAutoImportStatus();
  const initialPending = callBridge('drainPendingMessages');
  if (initialPending !== undefined) {
    if (initialPending && initialPending !== '[]') {
      window.onAndroidIncomingMessages(initialPending);
    }
  } else {
    readClipboardForImport(false);
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
