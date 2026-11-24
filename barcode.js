(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PickupBarcode = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ISO/IEC 15417 Code 128 bar/space module patterns (values 0..106)
  const CODE128_PATTERNS = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
  ];

  const START_B = 104;
  const STOP = 106;

  function normalizeExclusiveCode(raw) {
    return String(raw || '').trim().replace(/\s+/g, '').toUpperCase();
  }

  function isValidCode128B(text) {
    if (!text || text.length < 2 || text.length > 32) return false;
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      if (code < 32 || code > 126) return false;
    }
    return true;
  }

  function encodeCode128B(text) {
    const value = String(text || '');
    if (!value) throw new Error('Barcode text cannot be empty');
    const symbols = [START_B];
    let checksum = START_B;

    for (let i = 0; i < value.length; i += 1) {
      const charCode = value.charCodeAt(i);
      if (charCode < 32 || charCode > 126) {
        throw new Error('Unsupported Code 128B character: ' + value[i]);
      }
      const sym = charCode - 32;
      symbols.push(sym);
      checksum += sym * (i + 1);
    }

    symbols.push(checksum % 103);
    symbols.push(STOP);

    const widths = [];
    for (let i = 0; i < symbols.length; i += 1) {
      const pattern = CODE128_PATTERNS[symbols[i]];
      for (let j = 0; j < pattern.length; j += 1) {
        widths.push(Number(pattern[j]));
      }
    }

    const totalModules = widths.reduce((sum, w) => sum + w, 0);
    return { text: value, symbols, widths, totalModules };
  }

  function decodeCode128BFromWidths(widths) {
    const patternMap = new Map();
    CODE128_PATTERNS.forEach((p, idx) => patternMap.set(p, idx));
    if (!Array.isArray(widths) || widths.length < 19 || (widths.length - 7) % 6 !== 0) {
      throw new Error('Invalid Code 128 width sequence');
    }
    const symbols = [];
    for (let i = 0; i < widths.length - 7; i += 6) {
      const pat = widths.slice(i, i + 6).join('');
      const sym = patternMap.get(pat);
      if (sym === undefined) throw new Error('Unknown pattern: ' + pat);
      symbols.push(sym);
    }
    const stopPat = widths.slice(-7).join('');
    if (patternMap.get(stopPat) !== STOP) throw new Error('Missing stop pattern');
    if (symbols[0] !== START_B) throw new Error('Not Code 128B');

    let checksum = START_B;
    let output = '';
    for (let i = 1; i < symbols.length - 1; i += 1) {
      const sym = symbols[i];
      checksum += sym * i;
      output += String.fromCharCode(sym + 32);
    }
    const expectedCheck = checksum % 103;
    const actualCheck = symbols[symbols.length - 1];
    if (expectedCheck !== actualCheck) {
      throw new Error('Checksum mismatch');
    }
    return output;
  }

  function renderBarcodeSVG(text, options = {}) {
    const { quietModules = 10, barHeight = 96, ariaLabel } = options;
    const encoded = encodeCode128B(text);
    const totalWidth = encoded.totalModules + quietModules * 2;
    const rects = [];
    let x = quietModules;

    for (let i = 0; i < encoded.widths.length; i += 1) {
      const w = encoded.widths[i];
      if (i % 2 === 0) {
        rects.push(`<rect x="${x}" y="0" width="${w}" height="${barHeight}" fill="#000000"/>`);
      }
      x += w;
    }

    const safeLabel = String(ariaLabel || `专属码 ${text} 条形码`).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);

    return `<svg class="barcode-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${barHeight}" preserveAspectRatio="none" role="img" aria-label="${safeLabel}" shape-rendering="crispEdges" stroke="none"><rect width="${totalWidth}" height="${barHeight}" fill="#ffffff" stroke="none"/>${rects.join('')}</svg>`;
  }

  return {
    CODE128_PATTERNS,
    normalizeExclusiveCode,
    isValidCode128B,
    encodeCode128B,
    decodeCode128BFromWidths,
    renderBarcodeSVG
  };
});
