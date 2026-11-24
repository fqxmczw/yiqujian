(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PickupParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STRONG_CODE_KEYWORD_RE = /(?:取件码|提货码|取货码|开箱码|取件密码|提货密码|取货密码|凭码|货架号|提件码|自提码)/;
  const EXPRESS_CONTEXT_RE = /(?:取件码|提货码|取货码|开箱码|取件密码|提货密码|取货密码|凭码|货架号|提件码|自提码|快递柜|智能柜|驿站|菜鸟|丰巢|蜂巢|兔喜|易递通|妈妈驿站|熊猫快收|驿收发|溪鸟|蓝店|小兵驿站|速递易|格格货栈|快递超市|代收点|快递点|快件|包裹|快递已到|已到站|已入库|已入柜|已存放|存放至|已放至|请及时取|待取件|待领取|已签收|已取件|已取出|已出站|已出库|已领取)/;
  const SIGNED_OFF_RE = /(?:已签收|签收成功|已取件|取件成功|已领取|领取成功|已取出|取出成功|已出库|已出站|已完成取件|取走成功|已成功(?:领取|取件|取出|签收|出库|出站)|成功(?:领取|取件|取出|签收)|您已取走|已被取走|本人签收|门卫签收|代收签收|驿站签收|已自提|已从.{0,12}取出|包裹已.{0,8}签收|快件已.{0,8}签收|快递已.{0,8}签收)/;
  const NOT_SIGNED_OFF_GUARD_RE = /(?:未签收|待签收|尚未签收|未取件|待取件|尚未取件|未领取|待领取)/;
  const OTP_REJECT_RE = /(?:验证码|校验码|动态码|动态密码|登录密码|支付密码|交易密码|安全码|短信码|确认码|授权码|随机码|口令|切勿泄露|请勿向他人泄露|打死也不要告诉|非本人操作|登录验证|修改密码|重置密码|绑定手机|解绑)/;
  const FINANCE_REJECT_RE = /(?:尾号\d{4}.*(?:消费|支出|收入|转入|转出|余额|还款|扣款)|信用卡账单|还款日|最低还款|话费余额|流量提醒)/;

  const BRAND_PATTERNS = [
    { name: '易递通', re: /易递通/ },
    { name: '菜鸟驿站', re: /菜鸟驿站|菜鸟/ },
    { name: '丰巢', re: /丰巢|蜂巢/ },
    { name: '兔喜生活', re: /兔喜(?:生活|快递超市|驿站)?/ },
    { name: '妈妈驿站', re: /妈妈驿站/ },
    { name: '熊猫快收', re: /熊猫快收/ },
    { name: '驿收发', re: /驿收发/ },
    { name: '速递易', re: /速递易|近邻宝|格格货栈/ },
    { name: '小兵驿站', re: /小兵驿站/ },
    { name: '溪鸟', re: /溪鸟/ },
    { name: '拼多多驿站', re: /多多买菜|拼多多/ },
    { name: '京东快递', re: /京东(?:快递|物流|派送|自提柜|智能柜)?/ },
    { name: '顺丰', re: /顺丰(?:速运|快递)?/ },
    { name: '中通', re: /中通(?:快递)?/ },
    { name: '圆通', re: /圆通(?:速递|快递)?/ },
    { name: '韵达', re: /韵达(?:快递)?/ },
    { name: '申通', re: /申通(?:快递)?/ },
    { name: '极兔', re: /极兔(?:速递|快递)?/ },
    { name: '邮政EMS', re: /邮政|EMS/i },
    { name: '德邦', re: /德邦(?:快递|物流)?/ }
  ];

  const STATION_BRANDS = new Set(['易递通', '菜鸟驿站', '丰巢', '兔喜生活', '妈妈驿站', '熊猫快收', '驿收发', '速递易', '小兵驿站', '溪鸟', '拼多多驿站']);
  const CARRIER_BRANDS = new Set(['京东快递', '顺丰', '中通', '圆通', '韵达', '申通', '极兔', '邮政EMS', '德邦']);

  const TRACKING_PREFIX_RE = /^(?:SF|YT|ZT|YD|ST|JT|JD|JDV|EMS|DPK|KK|DB|YZ|CN|CAINIAO)\d{7,}$/i;
  const PHONE_RE = /^1[3-9]\d{9}$/;
  const HOTLINE_RE = /^(?:400|800|95\d{3}|10\d{3,6})/;
  const DATE_LIKE_RE = /^(?:20\d{2}[-/.]\d{1,2}(?:[-/.]\d{1,2})?|\d{1,2}[:：]\d{2})$/;
  const FORBIDDEN_BEFORE_RE = /(?:验证码|校验码|动态码|手机号|手机|电话|热线|客服|联系|单号|运单号|快递单号|订单号|尾号|查询|详询|致电|拨打|回复|密码重置)\s*[:：为是]?\s*$/;

  function toHalfWidth(input) {
    return String(input || '').replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
      .replace(/\u3000/g, ' ')
      .replace(/[－—–﹣]/g, '-');
  }

  function normalizePickupCode(raw) {
    return toHalfWidth(raw)
      .trim()
      .replace(/^[\[\(【（'"`]+|[\]\)】）'"`，。,.；;!！?？]+$/g, '')
      .replace(/\s*-\s*/g, '-')
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }

  function dedupKey(code) {
    return normalizePickupCode(code).replace(/\s+/g, '').toLowerCase();
  }

  function isValidCandidateCode(raw, beforeText) {
    const code = normalizePickupCode(raw);
    if (!code || code.length < 3 || code.length > 20) return false;
    if (!/\d/.test(code)) return false;
    if (!/^[A-Z0-9][A-Z0-9\- ]*[A-Z0-9]$/.test(code)) return false;
    if (beforeText && FORBIDDEN_BEFORE_RE.test(beforeText.slice(-16))) return false;

    const compact = code.replace(/[\s-]/g, '');
    if (compact.length < 3 || compact.length > 16) return false;
    if (PHONE_RE.test(compact)) return false;
    if (HOTLINE_RE.test(compact) && compact.length >= 8) return false;
    if (TRACKING_PREFIX_RE.test(compact)) return false;
    if (DATE_LIKE_RE.test(code)) return false;
    if (/^\d+$/.test(compact)) {
      const minDigits = code.includes('-') ? 3 : 4;
      if (compact.length < minDigits || compact.length > 9) return false;
    }
    if (/^20\d{2}$/.test(compact)) return false;
    if ((compact.match(/\d/g) || []).length < 2) return false;
    return true;
  }

  function looksLikeExpressMessage(text) {
    const normalized = toHalfWidth(text);
    if (!normalized.trim()) return false;
    const hasStrongKeyword = STRONG_CODE_KEYWORD_RE.test(normalized);
    const hasExpressContext = EXPRESS_CONTEXT_RE.test(normalized);
    if (!hasExpressContext) return false;
    if (!hasStrongKeyword && (OTP_REJECT_RE.test(normalized) || FINANCE_REJECT_RE.test(normalized))) {
      return false;
    }
    return true;
  }

  function isSignedOffMessage(text) {
    const normalized = toHalfWidth(text);
    if (!normalized.trim()) return false;
    if (NOT_SIGNED_OFF_GUARD_RE.test(normalized)) return false;
    return SIGNED_OFF_RE.test(normalized);
  }

  function cleanStationName(raw) {
    let s = String(raw || '').trim()
      .replace(/^[【\[]|[】\]]$/g, '')
      .replace(/^(?:已到达|已到|到达|已存放在|存放在|已存放至|存放至|已存入|存入|已放入|放入|已放至|放至|放于|已放在|放在|已投递至|投递至|已投递到|投递到|请到|到|至|在|前往)\s*/g, '')
      .replace(/(?:领取|取件|自取|签收|取货|包裹|快件|快递).*$/g, '')
      .replace(/[，。,.；;！!？?（(].*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (s.length > 16) s = s.slice(0, 16);
    return s;
  }

  function extractLabel(text, sourceApp) {
    const normalized = toHalfWidth(text);
    const foundStations = [];
    const foundCarriers = [];

    for (const brand of BRAND_PATTERNS) {
      if (brand.re.test(normalized)) {
        if (STATION_BRANDS.has(brand.name) && !foundStations.includes(brand.name)) foundStations.push(brand.name);
        else if (CARRIER_BRANDS.has(brand.name) && !foundCarriers.includes(brand.name)) foundCarriers.push(brand.name);
      }
    }

    let place = '';
    const fieldMatch = normalized.match(/(?:驿站名称|取件地点|取件地址|自提点|代收点|存放地点|柜机地址|收货点|站点)\s*[:：]\s*([^\n，。,;；]{2,20})/);
    if (fieldMatch) {
      place = cleanStationName(fieldMatch[1]);
    }

    if (!place) {
      const placeMatch = normalized.match(/(?:已到达|已到|已存放在|存放在|已存放至|存放至|已存入|存入|已放入|放入|已放至|放至|放于|已放在|放在|已投递至|投递至|已投递到|投递到|请到|到|至)([^\n，。,;；：:]{2,18}?(?:驿站|智能柜|快递柜|丰巢柜|蜂巢柜|自提柜|快递超市|超市|代收点|服务站|快递点|快递站|门卫室|门卫处|收发室|菜鸟点))/);
      if (placeMatch) {
        place = cleanStationName(placeMatch[1]);
      }
    }

    let headerTag = '';
    const bracketMatch = normalized.match(/[【\[]([^】\]]{2,14})[】\]]/);
    if (bracketMatch) {
      headerTag = bracketMatch[1].trim();
    }

    const station = foundStations[0] || '';
    const carrier = foundCarriers[0] || '';

    let label = '';
    if (place) {
      if (carrier && !place.includes(carrier) && (carrier.length + place.length + 3) <= 24) {
        label = `${carrier} · ${place}`;
      } else if (station && !place.includes(station) && (station.length + place.length + 3) <= 24) {
        label = `${station} · ${place}`;
      } else {
        label = place;
      }
    } else if (carrier && station) {
      label = `${carrier} · ${station}`;
    } else if (station) {
      label = station;
    } else if (carrier) {
      label = /快递柜|智能柜|丰巢|蜂巢|自提柜/.test(normalized) ? `${carrier} · 智能柜` : `${carrier} · 快递驿站`;
    } else if (headerTag && !/通知|提醒|服务|消息|短信/.test(headerTag)) {
      label = headerTag;
    } else if (/快递柜|智能柜|自提柜|开箱码/.test(normalized)) {
      label = '智能柜';
    } else if (/门卫|收发室|保安/.test(normalized)) {
      label = '门卫处';
    } else if (sourceApp && /微信|易递通|菜鸟|丰巢|拼多多|京东|顺丰|兔喜/.test(sourceApp)) {
      label = `${sourceApp}取件`;
    } else {
      label = '快递驿站';
    }

    return label.slice(0, 24);
  }

  function extractCodesFromSingleMessage(messageText) {
    const normalized = toHalfWidth(messageText);
    if (!looksLikeExpressMessage(normalized)) return [];

    const results = [];
    const seen = new Set();
    const pushIfValid = (raw, beforeText) => {
      const code = normalizePickupCode(raw);
      if (!isValidCandidateCode(code, beforeText)) return;
      const key = dedupKey(code);
      if (seen.has(key)) return;
      seen.add(key);
      results.push(code);
    };

    const explicitRe = /(?:取件码|提货码|取货码|开箱码|取件密码|提货密码|取货密码|提件码|自提码|货架号|凭码)\s*(?:为|是|[:：])?\s*([A-Za-z0-9][A-Za-z0-9\-]*(?:(?:\s*[、,，\/&＆和及]\s*|\s+)[A-Za-z0-9][A-Za-z0-9\-]*)*)/g;
    let match;
    while ((match = explicitRe.exec(normalized)) !== null) {
      const before = normalized.slice(Math.max(0, match.index - 20), match.index);
      const listPart = match[1];
      const rawGroups = listPart.split(/\s*[、,，\/&＆和及]\s*/);
      for (const group of rawGroups) {
        const trimmedGroup = group.trim();
        if (!trimmedGroup) continue;
        if (/^[A-Za-z]\s+\d{2,6}$/.test(trimmedGroup)) {
          pushIfValid(trimmedGroup, before);
          continue;
        }
        const tokens = trimmedGroup.split(/\s+/);
        for (let idx = 0; idx < tokens.length; idx++) {
          const token = tokens[idx];
          if (!token) continue;
          if (/^[A-Za-z]$/.test(token) && idx + 1 < tokens.length && /^\d{2,6}$/.test(tokens[idx + 1])) {
            pushIfValid(`${token} ${tokens[idx + 1]}`, before);
            idx++;
            continue;
          }
          if (!/\d/.test(token)) break;
          pushIfValid(token, before);
        }
      }
    }

    if (results.length === 0) {
      const pingRe = /凭\s*([A-Za-z0-9]{1,5}(?:-[A-Za-z0-9]{1,6}){1,3}|[A-Za-z]?\d{4,8})\s*(?:到|去|至|领取|取件|取货|自取|在|扫码|开箱|可)/g;
      while ((match = pingRe.exec(normalized)) !== null) {
        const before = normalized.slice(Math.max(0, match.index - 20), match.index);
        pushIfValid(match[1], before);
      }
    }

    if (results.length === 0) {
      const hyphenRe = /(?:^|[^A-Za-z0-9-])([A-Za-z]?\d{1,4}-[A-Za-z0-9]{1,5}(?:-[A-Za-z0-9]{1,6})?)(?=$|[^A-Za-z0-9-])/g;
      while ((match = hyphenRe.exec(normalized)) !== null) {
        const idx = match.index + (match[0].length - match[1].length);
        const before = normalized.slice(Math.max(0, idx - 20), idx);
        const segs = match[1].split('-');
        const looksLikeMonthDay = segs.length === 2 && /^\d{1,2}$/.test(segs[0]) && /^\d{1,2}$/.test(segs[1]) && Number(segs[0]) <= 12 && Number(segs[1]) <= 31;
        if (looksLikeMonthDay) continue;
        pushIfValid(match[1], before);
      }
    }

    if (results.length === 0 && !OTP_REJECT_RE.test(normalized) && !FINANCE_REJECT_RE.test(normalized) && /(?:快递柜|智能柜|丰巢|蜂巢|驿站|菜鸟|兔喜|易递通|妈妈驿站|熊猫快收|已入柜|已到站|已存放)/.test(normalized)) {
      const fallbackRe = /(?:编号|编码|密码|码)\s*(?:为|是|[:：])?\s*([A-Za-z]?\d{4,8})/g;
      while ((match = fallbackRe.exec(normalized)) !== null) {
        const before = normalized.slice(Math.max(0, match.index - 20), match.index);
        pushIfValid(match[1], before);
      }
    }

    return results;
  }

  function splitMessages(rawText) {
    const text = String(rawText || '').replace(/\r\n?/g, '\n').trim();
    if (!text) return [];

    const paragraphs = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
    const chunks = [];

    for (const para of paragraphs) {
      const bracketStarts = para.match(/[【\[]/g);
      if (bracketStarts && bracketStarts.length > 1) {
        const parts = para.split(/(?=(?:^|\n)\s*[【\[])/).map(s => s.trim()).filter(Boolean);
        if (parts.length > 1) {
          chunks.push(...parts);
          continue;
        }
      }

      const lines = para.split('\n').map(s => s.trim()).filter(Boolean);
      const codeLines = lines.filter(line => STRONG_CODE_KEYWORD_RE.test(toHalfWidth(line)));
      if (lines.length > 1 && codeLines.length > 1) {
        chunks.push(...lines);
      } else {
        chunks.push(para);
      }
    }

    return chunks;
  }

  function parseMessagesDetailed(rawText, options) {
    const opts = options || {};
    const chunks = splitMessages(rawText);
    const arrivals = [];
    const completed = [];
    const seenArrivals = new Set();
    const seenCompleted = new Set();

    for (const chunk of chunks) {
      const extracted = extractCodesFromSingleMessage(chunk);
      if (extracted.length === 0) continue;
      const signedOff = isSignedOffMessage(chunk);
      const ts = typeof opts.timestamp === 'number' && Number.isFinite(opts.timestamp) ? opts.timestamp : Date.now();
      const snippet = chunk.replace(/\s+/g, ' ').slice(0, 80);

      if (signedOff) {
        for (const code of extracted) {
          const key = dedupKey(code);
          if (seenCompleted.has(key)) continue;
          seenCompleted.add(key);
          completed.push({
            code,
            source: opts.source || 'paste',
            sourceApp: opts.sourceApp || '',
            timestamp: ts,
            snippet
          });
        }
        continue;
      }

      const label = extractLabel(chunk, opts.sourceApp || '');
      for (const code of extracted) {
        const key = dedupKey(code);
        if (seenArrivals.has(key)) continue;
        seenArrivals.add(key);
        arrivals.push({
          code,
          label,
          source: opts.source || 'paste',
          sourceApp: opts.sourceApp || '',
          timestamp: ts,
          snippet
        });
      }
    }

    return { arrivals, completed };
  }

  function parseMessages(rawText, options) {
    return parseMessagesDetailed(rawText, options).arrivals;
  }

  function parseRecordsDetailed(records) {
    if (!Array.isArray(records)) return { arrivals: [], completed: [] };
    const arrivalsMap = new Map();
    const completedMap = new Map();
    for (const rec of records) {
      if (!rec) continue;
      const combined = [rec.title || '', rec.text || rec.body || ''].filter(Boolean).join('\n');
      const detailed = parseMessagesDetailed(combined, {
        source: rec.source || 'notification',
        sourceApp: rec.app || rec.address || '',
        timestamp: typeof rec.timestamp === 'number' ? rec.timestamp : (typeof rec.date === 'number' ? rec.date : Date.now())
      });
      for (const item of detailed.completed) {
        const key = dedupKey(item.code);
        const prev = completedMap.get(key);
        if (!prev || item.timestamp > prev.timestamp) {
          completedMap.set(key, item);
        }
      }
      for (const item of detailed.arrivals) {
        const key = dedupKey(item.code);
        const prev = arrivalsMap.get(key);
        if (!prev || item.timestamp > prev.timestamp) {
          arrivalsMap.set(key, item);
        }
      }
    }
    return {
      arrivals: [...arrivalsMap.values()],
      completed: [...completedMap.values()]
    };
  }

  function parseRecords(records) {
    return parseRecordsDetailed(records).arrivals;
  }

  return {
    normalizePickupCode,
    dedupKey,
    looksLikeExpressMessage,
    isSignedOffMessage,
    extractLabel,
    parseMessages,
    parseMessagesDetailed,
    parseRecords,
    parseRecordsDetailed
  };
});
