/* KK Verse Studio · core registry + helpers.
 * Loaded both in the render page (browser) and in Node (to read the catalog),
 * so nothing here may touch `document` at load time. */
(function (g) {
  'use strict';
  const KKV = (g.KKV = g.KKV || {});
  KKV.captions = {};
  KKV.effects = {};
  KKV.caption = (name, def) => { def.name = name; KKV.captions[name] = def; };
  KKV.effect = (name, def) => { def.name = name; KKV.effects[name] = def; };

  KKV.brand = {
    violet: '#5B4FE8', violetLight: '#9A8FFF', cream: '#F7F4EF', ink: '#1C1814',
    yellow: '#FFD400', red: '#E5322D', green: '#22B573', saffron: '#FF9933',
    pink: '#FF2E88', teal: '#00C2A8',
  };

  /* ---------- math ---------- */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, start, dur) => (dur <= 0 ? (t >= start ? 1 : 0) : clamp((t - start) / dur));
  const ease = {
    lin: (u) => u,
    in2: (u) => u * u,
    in3: (u) => u * u * u,
    out2: (u) => 1 - (1 - u) * (1 - u),
    out3: (u) => 1 - Math.pow(1 - u, 3),
    out5: (u) => 1 - Math.pow(1 - u, 5),
    inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
    ss: (u) => u * u * (3 - 2 * u),
    outExpo: (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u)),
    outBack: (u, s = 1.70158) => 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2),
    outElastic: (u) => {
      if (u <= 0) return 0;
      if (u >= 1) return 1;
      return Math.pow(2, -10 * u) * Math.sin(((u * 10 - 0.75) * 2 * Math.PI) / 3) + 1;
    },
  };
  /** Deterministic RNG so every render of the same edit is identical. */
  const rng = (seed) => {
    let a = (seed >>> 0) || 1;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const hash = (str) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36) + ':' + str.length;
  };
  /** in/out envelope for an effect: 0→1 over `tin`, 1→0 over the last `tout`. */
  const inOut = (lt, dur, tin, tout) => ({
    i: prog(lt, 0, tin),
    o: prog(lt, dur - tout, tout),
  });
  KKV.m = { clamp, lerp, prog, ease, rng, hash, inOut };

  /* ---------- number formatting (Indian + international) ---------- */
  const groupIndian = (intStr) => {
    if (intStr.length <= 3) return intStr;
    const last3 = intStr.slice(-3);
    const rest = intStr.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return rest + ',' + last3;
  };
  const groupIntl = (intStr) => intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  KKV.fmt = {
    number(n, { format = 'indian', decimals = 0 } = {}) {
      const neg = n < 0; n = Math.abs(n);
      if (format === 'compact') {
        const units = [[1e7, ' Cr'], [1e5, ' L'], [1e3, 'K']];
        for (const [v, s] of units) {
          if (n >= v) {
            const x = n / v;
            return (neg ? '-' : '') + (x >= 100 ? x.toFixed(0) : x.toFixed(x >= 10 ? 1 : 2)).replace(/\.?0+$/, '') + s;
          }
        }
        return (neg ? '-' : '') + n.toFixed(0);
      }
      if (format === 'compact-intl') {
        const units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
        for (const [v, s] of units) {
          if (n >= v) {
            const x = n / v;
            return (neg ? '-' : '') + (x >= 100 ? x.toFixed(0) : x.toFixed(1)).replace(/\.0$/, '') + s;
          }
        }
        return (neg ? '-' : '') + n.toFixed(0);
      }
      const [i, d] = n.toFixed(decimals).split('.');
      const grouped = format === 'plain' ? i : format === 'intl' ? groupIntl(i) : groupIndian(i);
      return (neg ? '-' : '') + grouped + (d ? '.' + d : '');
    },
  };

  /* ---------- param coercion (CLI gives strings) ---------- */
  KKV.coerce = (defaults, given) => {
    const out = {};
    for (const k of Object.keys(defaults)) {
      const d = defaults[k];
      let v = given != null && given[k] != null ? given[k] : d;
      if (typeof d === 'number' && typeof v !== 'number') { const n = parseFloat(v); v = Number.isFinite(n) ? n : d; }
      else if (typeof d === 'boolean' && typeof v !== 'boolean') v = !/^(false|0|no|off)$/i.test(String(v));
      out[k] = v;
    }
    return out;
  };
  /** "a|b|c" → ['a','b','c'] */
  KKV.list = (v) => (Array.isArray(v) ? v : String(v == null ? '' : v).split('|').map((s) => s.trim()).filter(Boolean));

  /* ---------- DOM helpers (browser only, called at mount time) ---------- */
  KKV.css = (el, st) => {
    for (const k in st) {
      const v = st[k];
      if (k.startsWith('--') || k.includes('-')) el.style.setProperty(k, v);
      else el.style[k] = v;
    }
    return el;
  };
  KKV.h = (tag, style, text) => {
    const el = document.createElement(tag);
    if (style) KKV.css(el, style);
    if (text != null) el.textContent = text;
    return el;
  };
  KKV.px = (n) => (Math.round(n * 100) / 100) + 'px';
  /** Crisp outline that sits behind the fill. */
  KKV.stroke = (w, color) => ({ '-webkit-text-stroke': `${w}px ${color}`, 'paint-order': 'stroke fill' });
  KKV.fonts = {
    impact: `'Anton','KKV Deva Heavy','Baloo 2','Noto Sans Devanagari',sans-serif`,
    black: `'Archivo Black','KKV Deva Heavy','Baloo 2','Noto Sans Devanagari',sans-serif`,
    sans: `'Inter','Noto Sans Devanagari',sans-serif`,
    brand: `'DM Sans','Noto Sans Devanagari',sans-serif`,
    serif: `'DM Serif Display','Noto Sans Devanagari',serif`,
    mono: `'Space Mono','Noto Sans Devanagari',monospace`,
    hand: `'Kalam','Noto Sans Devanagari',cursive`,
    desi: `'Baloo 2','Noto Sans Devanagari',sans-serif`,
    emoji: `'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif`,
  };
})(typeof window !== 'undefined' ? window : globalThis);
