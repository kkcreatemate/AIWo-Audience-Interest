/* KK Verse Studio · page runtime.
 * Everything on screen is a pure function of time: KKV.seek(t) sets inline styles, nothing
 * uses CSS animation or the wall clock, so frames can be captured in any order and re-rendered
 * identically. Two layers are produced: `back` (goes behind the person) and `front`. */
(function () {
  'use strict';
  const KKV = window.KKV;
  const { clamp, lerp, hash } = KKV.m;
  let S = null;

  const FONT_PRELOAD = [
    ['Anton', 400], ['Archivo Black', 400], ['Baloo 2', 500], ['Baloo 2', 700], ['Baloo 2', 800],
    ['DM Sans', 400], ['DM Sans', 500], ['DM Sans', 700], ['DM Serif Display', 400],
    ['Inter', 400], ['Inter', 600], ['Inter', 800], ['Inter', 900], ['Kalam', 400], ['Kalam', 700],
    ['Noto Sans Devanagari', 400], ['Noto Sans Devanagari', 700], ['Noto Sans Devanagari', 900],
    ['Space Mono', 400], ['Space Mono', 700], ['KKV Deva Heavy', 400],
  ];

  function collectText(comp) {
    let s = ' 0123456789.,:;!?%₹$@#&+-–—…/()\'"“”‘’✓✗★→↑↓•KKVERSEFollowingkk';
    const add = (v) => { if (typeof v === 'string') s += v; };
    if (comp.captions) for (const ln of comp.captions.lines || []) for (const w of ln.words) { add(w.w); add(w.w.toUpperCase()); }
    for (const fx of comp.effects || []) for (const k in fx) { add(fx[k]); if (typeof fx[k] === 'string') add(fx[k].toUpperCase()); }
    if (comp.captions) for (const k in comp.captions) add(comp.captions[k]);
    return Array.from(new Set(s)).join('');
  }

  /* ---------- face track access (screen space, camera-aware) ---------- */
  function makeFace(comp, DW, DH) {
    const tr = comp.track;
    const cues = comp.camera || [];
    const fallback = { x: 0.5, y: 0.36, w: 0.34, h: 0.2, top: 0.2, tracked: false };
    const sample = (arr, f) => {
      if (!arr || !arr.length) return null;
      const i = clamp(f, 0, arr.length - 1), i0 = Math.floor(i), i1 = Math.min(arr.length - 1, i0 + 1);
      const a = arr[i0], b = arr[i1];
      if (a == null || b == null) return a || b || null;
      if (typeof a === 'number') return lerp(a, b, i - i0);
      return a.map((v, k) => lerp(v, b[k], i - i0));
    };
    return function face(t) {
      let f = fallback;
      if (tr && tr.face && tr.face.length) {
        const b = sample(tr.face, t * tr.fps);
        if (b) {
          const top = sample(tr.top, t * tr.fps);
          f = { x: b[0], y: b[1], w: b[2], h: b[3], top: top == null ? b[1] - b[3] * 0.85 : top, tracked: true };
        }
      }
      const cam = window.KKVCamera.at(cues, t);
      const [sx, sy] = window.KKVCamera.toScreen(cam, f.x, f.y);
      const [, st] = window.KKVCamera.toScreen(cam, f.x, f.top);
      return { x: sx * DW, y: sy * DH, w: f.w * cam.z * DW, h: f.h * cam.z * DH, top: st * DH, z: cam.z, tracked: f.tracked };
    };
  }

  /* ---------- captions layer ---------- */
  function mountCaptions(comp, ctx, front) {
    const cap = comp.captions;
    if (!cap || !cap.lines || !cap.lines.length) return null;
    const def = KKV.captions[cap.style];
    if (!def) throw new Error('Unknown caption style: ' + cap.style);
    const opts = Object.assign({}, def.defaults || {}, cap);
    opts.accent = cap.accent || (def.defaults && def.defaults.accent) || KKV.brand.yellow;
    opts.scale = +cap.scale || 1;
    opts.y = cap.y == null ? (def.defaults && def.defaults.y) || 0.7 : +cap.y;
    const root = KKV.h('div', {
      position: 'absolute', left: '0', width: ctx.W + 'px', top: opts.y * ctx.H + 'px',
      display: 'none', transformOrigin: '50% 50%',
    });
    root.className = 'kkv-cap kkv-cap-' + cap.style;
    front.appendChild(root);
    const inner = KKV.h('div', {
      position: 'absolute', left: '0', width: '100%', top: '0',
      transform: `translateY(-50%) scale(${opts.scale})`, transformOrigin: '50% 50%',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
    });
    root.appendChild(inner);

    const lead = def.lead == null ? 0.06 : def.lead;
    const tail = def.tail == null ? 0.3 : def.tail;
    const lines = cap.lines.map((ln, i) => {
      const s = ln.words[0].s, e = ln.words[ln.words.length - 1].e;
      return { i, s, e, words: ln.words, on: s - lead, off: e + tail };
    });
    for (let i = 0; i < lines.length; i++) {
      const nx = lines[i + 1];
      if (i > 0) lines[i].on = Math.max(lines[i].on, lines[i - 1].off);
      if (nx) {
        const nextOn = nx.s - lead;
        // short gap → hold this line until the next one arrives (no flicker)
        if (nextOn - lines[i].e < 0.7) lines[i].off = nextOn;
        else lines[i].off = Math.min(lines[i].off, nextOn);
      }
    }
    let cur = -1, refs = null;
    return {
      root,
      seek(t) {
        let idx = -1;
        for (let i = 0; i < lines.length; i++) if (t >= lines[i].on && t < lines[i].off) { idx = i; break; }
        if (idx < 0) { if (cur !== -2) { root.style.display = 'none'; cur = -2; } return false; }
        if (idx !== cur) {
          inner.textContent = '';
          root.style.display = 'block';
          refs = def.build(inner, lines[idx], ctx, opts);
          cur = idx;
        }
        def.frame(refs, lines[idx], t, ctx, opts);
        return true;
      },
    };
  }

  /* ---------- effects ---------- */
  function mountEffects(comp, ctx, front, back) {
    const out = [];
    (comp.effects || []).forEach((fx, n) => {
      const def = KKV.effects[fx.type];
      if (!def || !def.mount) return; // camera / grade effects are done by ffmpeg
      const p = Object.assign(KKV.coerce(def.params || {}, fx), { at: +fx.at, dur: +fx.dur, id: n, given: fx });
      if (fx.ticks) p.ticks = fx.ticks;
      const L = {};
      L.front = KKV.h('div', { position: 'absolute', inset: '0', display: 'none' });
      L.front.className = 'kkv-fx kkv-fx-' + fx.type;
      front.appendChild(L.front);
      if (def.back) {
        L.back = KKV.h('div', { position: 'absolute', inset: '0', display: 'none' });
        L.back.className = 'kkv-fx kkv-fx-' + fx.type;
        back.appendChild(L.back);
      }
      const state = def.mount(L, p, ctx) || {};
      out.push({ def, p, L, state, on: false });
    });
    return out;
  }

  KKV.init = async function init(comp) {
    const stage = document.getElementById('stage');
    stage.textContent = '';
    const s = Math.min(comp.W, comp.H) / 1080;
    const DW = comp.W / s, DH = comp.H / s;
    KKV.css(stage, { width: DW + 'px', height: DH + 'px', transform: `scale(${s})`, transformOrigin: '0 0' });
    const back = KKV.h('div', { position: 'absolute', inset: '0', overflow: 'hidden' }); back.id = 'back';
    const front = KKV.h('div', { position: 'absolute', inset: '0', overflow: 'hidden' }); front.id = 'front';
    stage.appendChild(back); stage.appendChild(front);
    const ctx = {
      W: DW, H: DH, fps: comp.fps, duration: comp.duration, brand: KKV.brand,
      face: makeFace(comp, DW, DH), words: comp.words || [],
    };
    /** Top (px) for a block of height `hgt` that wants to sit at `want`: if that would cover the
     *  face during the effect, move it just above the head, or else just under the chin.
     *  Only acts when the head position is known and the user did not choose a position. */
    ctx.clearOfFace = (p, want, hgt) => {
      if (p.given && p.given.y != null) return want;
      const f = ctx.face(p.at + Math.min(p.dur, 2) * 0.5);
      if (!f.tracked) return want;
      const top = f.top - 10, bottom = f.y + f.h * 0.62;
      if (want + hgt < top || want > bottom) return want;
      const above = top - hgt - 24;
      if (above >= DH * 0.05) return above;
      return Math.min(bottom + 30, DH * 0.6);
    };
    // Load exactly the font subsets this edit needs before the first frame is captured.
    const text = collectText(comp);
    await Promise.all(FONT_PRELOAD.map(([fam, w]) => document.fonts.load(`${w} 40px "${fam}"`, text).catch(() => {})));
    await document.fonts.load(`italic 400 40px "DM Serif Display"`, text).catch(() => {});
    const caps = mountCaptions(comp, ctx, front);
    const fxs = mountEffects(comp, ctx, front, back);
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((im) => (im.decode ? im.decode().catch(() => {}) : null)));
    S = { comp, ctx, caps, fxs, back, front, stage };
    KKV.seek(0);
    return { DW, DH, hasBack: fxs.some((f) => f.def.back) };
  };

  /** Move every layer to time t. Returns a content signature per layer (null = nothing visible). */
  KKV.seek = function seek(t) {
    const { caps, fxs, ctx } = S;
    let sf = '', sb = '';
    if (caps && caps.seek(t)) sf += caps.root.outerHTML;
    for (const f of fxs) {
      const lt = t - f.p.at;
      const on = lt >= 0 && lt < f.p.dur;
      if (on !== f.on) {
        f.L.front.style.display = on ? 'block' : 'none';
        if (f.L.back) f.L.back.style.display = on ? 'block' : 'none';
        f.on = on;
      }
      if (!on) continue;
      f.def.frame(f.state, lt, f.p, ctx, t);
      if (f.L.front.childNodes.length) sf += f.L.front.outerHTML;
      if (f.L.back && f.L.back.childNodes.length) sb += f.L.back.outerHTML;
    }
    return { front: sf ? hash(sf) : null, back: sb ? hash(sb) : null };
  };

  KKV.show = function show(which) {
    S.front.style.visibility = which === 'front' || which === 'both' ? 'visible' : 'hidden';
    S.back.style.visibility = which === 'back' || which === 'both' ? 'visible' : 'hidden';
  };
})();
