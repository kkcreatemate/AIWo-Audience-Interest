/* KK Verse Studio · behind-the-subject effects.
 * These draw on the `back` layer, which the compositor slots between the room and the speaker
 * (person cut-out + face track come from `kkv track`). `back: true` + `needs` tell the engine. */
(function (KKV) {
  'use strict';
  const { h, css, stroke, fonts, brand } = KKV;
  const { prog, lerp, ease, clamp, inOut } = KKV.m;

  /* ── big-word ─────────────────────────────────────────────── */
  KKV.effect('big-word', {
    kind: 'behind', back: true, needs: { matte: true, track: true }, dur: 2.2,
    desc: 'One giant word drops in BEHIND your head and fills the frame.',
    params: { text: 'MYTH', color: '#fff', lift: 0.15, width: 0.96, follow: false },
    sfx: () => [{ name: 'thud', t: 0.08, gain: -8 }],
    mount(L, p, ctx) {
      const el = h('div', { position: 'absolute', left: '0', top: '0', fontFamily: fonts.impact, fontSize: '300px', lineHeight: '0.95', color: p.color, textTransform: 'uppercase', whiteSpace: 'nowrap', textShadow: '0 16px 50px rgba(0,0,0,.45)' }, p.text);
      L.back.appendChild(el);
      const wpx = el.offsetWidth || 1;
      const size = Math.min(620, (300 * ctx.W * p.width) / wpx);
      el.style.fontSize = size + 'px';
      return { el, size, f0: ctx.face(p.at) };
    },
    frame({ el, f0, size }, lt, p, ctx, t) {
      const f = p.follow ? ctx.face(t) : f0;
      const e = inOut(lt, p.dur, 0.36, 0.22);
      const u = ease.out5(e.i);
      const cx = p.follow ? f.x : ctx.W / 2;
      const cy = Math.max(f.top - p.lift * f.h, size * 0.5 + ctx.H * 0.025); // never clip off the top of the frame
      el.style.opacity = String(Math.min(1, e.i * 2.5) * (1 - e.o));
      el.style.transform = `translate(${cx.toFixed(2)}px, ${(cy - (1 - u) * 120).toFixed(2)}px) translate(-50%,-50%) scale(${(lerp(1.16, 1, u) * (1 + 0.035 * (lt / p.dur))).toFixed(4)})`;
    },
  });

  /* ── spotlight ────────────────────────────────────────────── */
  KKV.effect('spotlight', {
    kind: 'behind', back: true, needs: { matte: true, track: true }, dur: 3,
    desc: 'The room goes dark and a warm light stays on you.',
    params: { dim: 0.78, glow: 0.42 },
    sfx: () => [{ name: 'click', t: 0, gain: -8 }, { name: 'boom', t: 0.02, gain: -14 }],
    mount(L, p, ctx) {
      const dark = h('div', { position: 'absolute', inset: '0', background: `rgba(4,5,12,${p.dim})` });
      const glow = h('div', { position: 'absolute', inset: '0' });
      L.back.appendChild(dark); L.back.appendChild(glow);
      const vig = h('div', { position: 'absolute', inset: '0', background: 'radial-gradient(ellipse 75% 60% at 50% 42%, rgba(0,0,0,0) 55%, rgba(0,0,0,.42) 100%)' });
      L.front.appendChild(vig);
      return { dark, glow, vig };
    },
    frame({ dark, glow, vig }, lt, p, ctx, t) {
      const e = inOut(lt, p.dur, 0.3, 0.35);
      const a = ease.ss(e.i) * (1 - ease.ss(e.o));
      const f = ctx.face(t);
      dark.style.opacity = String(a);
      glow.style.opacity = String(a);
      glow.style.background = `radial-gradient(ellipse ${(ctx.W * 0.62).toFixed(0)}px ${(ctx.H * 0.36).toFixed(0)}px at ${f.x.toFixed(1)}px ${(f.y + f.h * 0.4).toFixed(1)}px, rgba(255,214,150,${p.glow}), rgba(255,214,150,0) 72%)`;
      vig.style.opacity = String(a * 0.9);
    },
  });

  /* ── orbit ────────────────────────────────────────────────── */
  const isShortGlyph = (s) => Array.from(s).length <= 3 && !/^[\w\s]+$/.test(s);
  function makeItem(spec, size) {
    if (/^img:/i.test(spec)) {
      const im = document.createElement('img');
      im.src = spec.slice(4);
      css(im, { width: size * 1.25 + 'px', height: 'auto', borderRadius: '22px', boxShadow: '0 14px 34px rgba(0,0,0,.45)', display: 'block' });
      return im;
    }
    if (isShortGlyph(spec)) return h('div', { fontFamily: fonts.emoji, fontSize: size + 'px', lineHeight: '1.1', filter: 'drop-shadow(0 12px 18px rgba(0,0,0,.4))' }, spec);
    return h('div', { fontFamily: fonts.brand, fontWeight: '700', fontSize: size * 0.34 + 'px', lineHeight: '1.15', color: brand.ink, background: '#fff', padding: `${size * 0.14}px ${size * 0.24}px`, borderRadius: size * 0.2 + 'px', whiteSpace: 'nowrap', boxShadow: '0 14px 34px rgba(0,0,0,.4)' }, spec);
  }
  KKV.effect('orbit', {
    kind: 'behind', back: true, needs: { matte: true, track: true }, dur: 3.5,
    desc: 'Emoji, words or images circle your head, passing behind and in front. items: "🎬|Hook|img:logo.png".',
    params: { items: '🎬|✂️|🎧|💡|📈|🔥', radius: 1.3, tilt: 0.32, speed: 0.3, size: 140, lift: 0.1 },
    fileParams: ['items'],
    sfx: () => [{ name: 'swish', t: 0, gain: -13 }],
    mount(L, p, ctx) {
      const items = KKV.list(p.items).map((spec) => {
        const mk = (layer) => { const w = h('div', { position: 'absolute', left: '0', top: '0', willChange: 'transform' }); w.appendChild(makeItem(spec, p.size)); layer.appendChild(w); return w; };
        return { b: mk(L.back), f: mk(L.front) };
      });
      return { items };
    },
    frame({ items }, lt, p, ctx, t) {
      const f = ctx.face(t), n = items.length;
      const R = Math.max(ctx.W * 0.27, f.w * p.radius);
      const cy = f.y - f.h * p.lift;
      const out = 1 - ease.in2(prog(lt, p.dur - 0.3, 0.3));
      items.forEach((it, i) => {
        const a = 2 * Math.PI * (i / n + p.speed * lt) - Math.PI / 2;
        const depth = Math.sin(a);
        const x = f.x + R * Math.cos(a), y = cy + R * p.tilt * depth;
        const grow = ease.outBack(prog(lt, i * 0.06, 0.32)) * out;
        const sc = lerp(0.7, 1.14, (depth + 1) / 2) * grow;
        const tr = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) translate(-50%,-50%) scale(${Math.max(0, sc).toFixed(4)})`;
        const front = depth >= 0;
        const show = front ? it.f : it.b, hide = front ? it.b : it.f;
        show.style.display = 'block'; show.style.transform = tr; show.style.zIndex = String(Math.round((depth + 1) * 50));
        show.style.opacity = String(front ? 1 : 0.92);
        hide.style.display = 'none';
      });
    },
  });

  /* ── wall-text ────────────────────────────────────────────── */
  KKV.effect('wall-text', {
    kind: 'behind', back: true, needs: { matte: true }, dur: 3,
    desc: 'Your phrase tiles the wall behind you in scrolling rows.',
    params: { text: 'EDIT FASTER', rows: 8, color: '#fff', dim: 0.55, speed: 70, accent: brand.yellow },
    sfx: () => [{ name: 'whoosh', t: 0, gain: -13 }],
    mount(L, p, ctx) {
      const tint = h('div', { position: 'absolute', inset: '0', background: `rgba(10,10,16,${p.dim})` });
      L.back.appendChild(tint);
      const rh = ctx.H / p.rows, fs = rh * 0.84;
      const unit = p.text + '  ✦  ';
      const repeat = Math.ceil((ctx.W * 3) / Math.max(1, Array.from(unit).length * fs * 0.42)) + 2;
      const rows = [];
      for (let i = 0; i < p.rows; i++) {
        const filled = i % 2 === 0;
        const r = h('div', Object.assign({ position: 'absolute', left: '0', top: i * rh + 'px', height: rh + 'px', lineHeight: rh + 'px', fontFamily: fonts.impact, fontSize: fs + 'px', whiteSpace: 'pre', textTransform: 'uppercase', color: filled ? (i % 4 === 2 ? p.accent : p.color) : 'transparent', willChange: 'transform' }, filled ? {} : { '-webkit-text-stroke': `3px ${p.color}` }), unit.repeat(repeat));
        L.back.appendChild(r);
        rows.push(r);
      }
      return { tint, rows, shift: ctx.W };
    },
    frame({ tint, rows, shift }, lt, p) {
      const e = inOut(lt, p.dur, 0.3, 0.25);
      tint.style.opacity = String(ease.ss(e.i) * (1 - e.o));
      rows.forEach((r, i) => {
        const dir = i % 2 ? 1 : -1;
        const u = ease.out5(prog(lt, i * 0.035, 0.4));
        const x = -shift + dir * (lt * p.speed + (1 - u) * 260);
        r.style.opacity = String(u * (1 - e.o) * (i % 2 ? 0.75 : 0.95));
        r.style.transform = `translateX(${x.toFixed(2)}px)`;
      });
    },
  });
})(typeof window !== 'undefined' ? window.KKV : globalThis.KKV);
