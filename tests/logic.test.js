const test = require('node:test');
const assert = require('node:assert/strict');
const barcode = require('../barcode.js');
const parser = require('../parser.js');

test('Code 128B round-trips arbitrary exclusive codes', () => {
  const samples = ['A12BC345', 'B98XY765', 'YD-2026-99', '$EX12345$', '99887766'];
  for (const sample of samples) {
    const encoded = barcode.encodeCode128B(sample);
    assert.equal(barcode.decodeCode128BFromWidths(encoded.widths), sample);
  }
});

test('normalizeExclusiveCode trims, removes whitespace, and uppercases', () => {
  assert.equal(barcode.normalizeExclusiveCode('  a 12 bc 345 '), 'A12BC345');
  assert.equal(barcode.isValidCode128B('A12BC345'), true);
  assert.equal(barcode.isValidCode128B('A'), false);
  assert.equal(barcode.isValidCode128B('中文码'), false);
});

test('renderBarcodeSVG produces crisp SVG with quiet zones and bars', () => {
  const svg = barcode.renderBarcodeSVG('A12BC345');
  assert.match(svg, /^<svg[^>]+class="barcode-svg"/);
  assert.match(svg, /shape-rendering="crispEdges"/);
  assert.ok((svg.match(/<rect /g) || []).length > 20);
});

test('PickupParser extracts pickup codes and labels from major Chinese express templates', () => {
  const cases = [
    {
      text: '【菜鸟驿站】您的包裹已到幸福小区菜鸟驿站，凭取件码8-2-3065领取，客服13800138000',
      codes: ['8-2-3065'],
      labelIncludes: '幸福小区菜鸟驿站'
    },
    {
      text: '【丰巢】请凭取件码 654321 到东门丰巢柜取件，运单号SF1234567890123',
      codes: ['654321'],
      labelIncludes: '东门丰巢柜'
    },
    {
      text: '包裹入站通知\n取件码：A12-3045\n驿站名称：北门易递通驿站\n快递公司：中通快递',
      codes: ['A12-3045'],
      labelIncludes: '北门易递通驿站'
    },
    {
      text: '【兔喜生活】您有2个中通包裹已到阳光花园兔喜快递超市，取件码：5-3-1028、5-3-1029',
      codes: ['5-3-1028', '5-3-1029'],
      labelIncludes: '阳光花园'
    },
    {
      text: '【妈妈驿站】您的圆通快件已到达南门妈妈驿站，凭 1-2-3 领取',
      codes: ['1-2-3'],
      labelIncludes: '南门妈妈驿站'
    },
    {
      text: '【拼多多】您的包裹已存放在东区智能柜，开箱码：Ａ ９０３６',
      codes: ['A 9036'],
      labelIncludes: '东区智能柜'
    },
    {
      text: '【京东快递】您的包裹已放入西门自提柜，提货码为839201，请24小时内取件',
      codes: ['839201'],
      labelIncludes: '京东'
    }
  ];

  for (const item of cases) {
    const parsed = parser.parseMessages(item.text);
    assert.deepEqual(parsed.map(x => x.code), item.codes, `Failed for: ${item.text}`);
    assert.ok(parsed[0].label.includes(item.labelIncludes), `Expected label "${parsed[0].label}" to include "${item.labelIncludes}"`);
  }
});

test('PickupParser batch parses multiple pasted messages and deduplicates', () => {
  const batch = [
    '【菜鸟驿站】您的包裹已到北门菜鸟驿站，取件码：12-3-4567',
    '【丰巢】请凭取件码 908172 到东门丰巢柜取件',
    '【菜鸟驿站】重复提醒：取件码 12-3-4567 请及时领取'
  ].join('\n');

  const parsed = parser.parseMessages(batch);
  assert.deepEqual(parsed.map(x => x.code), ['12-3-4567', '908172']);
});

test('PickupParser rejects OTP codes, bank alerts, and non-pickup logistics notifications', () => {
  const nonPickup = [
    '【淘宝】验证码 849201，15分钟内有效，切勿泄露给他人',
    '【菜鸟】您的登录验证码为 392014，请勿向他人泄露',
    '【顺丰速运】您的登录动态密码为 582910，5分钟内有效',
    '【招商银行】您尾号8821的储蓄卡消费128.00元，余额9988.00元',
    '【顺丰速运】您的快件SF1234567890123已发出，快递员电话13912345678，预计11-25送达',
    '【菜鸟驿站】您的包裹已于2026-11-24签收，详询4001234567'
  ];

  for (const text of nonPickup) {
    const parsed = parser.parseMessages(text);
    assert.deepEqual(parsed, [], `Should have rejected: ${text}`);
  }
});

test('PickupParser parseRecords handles structured Android notification and SMS payloads', () => {
  const records = [
    { source: 'notification', app: '微信', title: '易递通', text: '包裹到站提醒：取件码 36-4-1029，请到南门驿站领取', timestamp: 1730000000000 },
    { source: 'sms', address: '10690000', body: '【顺丰】您的快件已存入丰巢柜，取件码884721', date: 1730000005000 }
  ];
  const parsed = parser.parseRecords(records);
  assert.deepEqual(parsed.map(x => x.code), ['36-4-1029', '884721']);
  assert.equal(parsed[0].source, 'notification');
  assert.equal(parsed[1].source, 'sms');
});

test('PickupParser detects signed-off/picked-up messages and never imports them as pending', () => {
  const signedOffMsgs = [
    '【菜鸟驿站】您的包裹（取件码8-2-3065）已签收，如有疑问请联系驿站',
    '【易递通】签收通知：取件码 A12-3045 已出站，感谢使用',
    '【丰巢】您的快件（取件码 654321）已取出，欢迎下次使用',
    '【兔喜生活】您的包裹取件码 5-3-1028 已成功领取'
  ];
  for (const msg of signedOffMsgs) {
    assert.equal(parser.isSignedOffMessage(msg), true, `Expected signed-off: ${msg}`);
    const res = parser.parseMessagesDetailed(msg);
    assert.equal(res.arrivals.length, 0, `Should not import signed-off as arrival: ${msg}`);
    assert.equal(res.completed.length, 1, `Should extract completed code: ${msg}`);
  }

  // Arrival phrasing containing "签收" in future tense must still be treated as arrival
  const arrival = '【易递通】您的包裹已到北门驿站，请凭取件码 9-4-1120 用于高拍仪签收';
  assert.equal(parser.isSignedOffMessage(arrival), false);
  const arrivalRes = parser.parseMessagesDetailed(arrival);
  assert.deepEqual(arrivalRes.arrivals.map(x => x.code), ['9-4-1120']);
  assert.equal(arrivalRes.completed.length, 0);
});

test('PickupParser parseRecordsDetailed keeps newest timestamp regardless of record order', () => {
  const tOld = 1730000000000;
  const tNew = 1730100000000;
  const ascending = [
    { source: 'sms', body: '【菜鸟驿站】您的包裹已到北门驿站，取件码 1-2-3045', date: tOld },
    { source: 'sms', body: '【菜鸟驿站】您的新包裹已到北门驿站，取件码 1-2-3045', date: tNew },
    { source: 'sms', body: '【丰巢】取件码 654321 已取出', date: tOld },
    { source: 'sms', body: '【丰巢】取件码 654321 已取出', date: tNew }
  ];
  const detailed = parser.parseRecordsDetailed(ascending);
  assert.equal(detailed.arrivals.length, 1);
  assert.equal(detailed.arrivals[0].timestamp, tNew);
  assert.equal(detailed.completed.length, 1);
  assert.equal(detailed.completed[0].timestamp, tNew);
});
