/* KK Verse Studio · overlay effects (drawn in front of the speaker).
 * An effect is { kind, desc, dur, params, sfx(p), mount(L, p, ctx) → state, frame(state, lt, p, ctx) }.
 * `lt` is seconds since the effect started; p.dur is its length. Sizes are design px (short side 1080). */
(function (KKV) {
  'use strict';
  const { h, css, stroke, fonts, brand } = KKV;
  const { prog, lerp, ease, clamp, inOut } = KKV.m;
  const SVG = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs) => { const e = document.createElementNS(SVG, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const at = (x, y, st) => h('div', Object.assign({ position: 'absolute', left: x + 'px', top: y + 'px' }, st));

  /* ── headline ─────────────────────────────────────────────── */
  KKV.effect('headline', {
    kind: 'front', dur: 3,
    desc: 'Hook title: one or two stacked headline bars wipe in at the top. Use "a|b" for two lines.',
    params: { text: 'Stop scrolling|Watch this', y: 0.13, accent: brand.yellow },
    sfx: () => [{ name: 'whoosh', t: 0, gain: -12 }],
    mount(L, p, ctx) {
      const col = at(0, p.y * ctx.H, { width: ctx.W + 'px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' });
      L.front.appendChild(col);
      const lines = KKV.list(p.text).map((tx, i) => {
        const el = h('div', { fontFamily: fonts.black, fontSize: '74px', lineHeight: '1.12', textTransform: 'uppercase', padding: '8px 30px 10px', maxWidth: '980px', textAlign: 'center', background: i % 2 ? p.accent : brand.ink, color: i % 2 ? brand.ink : '#fff', boxShadow: '0 14px 34px rgba(0,0,0,.35)', transform: `rotate(${i % 2 ? 1.2 : -1.2}deg)` }, tx);
        col.appendChild(el);
        return el;
      });
      col.style.top = ctx.clearOfFace(p, p.y * ctx.H, col.offsetHeight) + 'px';
      return { lines };
    },
    frame({ lines }, lt, p) {
      const out = 1 - ease.in2(prog(lt, p.dur - 0.25, 0.25));
      lines.forEach((el, i) => {
        const u = ease.out5(prog(lt, i * 0.1, 0.34));
        el.style.clipPath = `inset(0 ${((1 - u) * 100).toFixed(2)}% 0 0)`;
        el.style.opacity = String(out);
        el.style.transform = `translate(${((1 - u) * -40).toFixed(2)}px, ${((1 - out) * -24).toFixed(2)}px) rotate(${i % 2 ? 1.2 : -1.2}deg)`;
      });
    },
  });

  /* ── lower-third ──────────────────────────────────────────── */
  KKV.effect('lower-third', {
    kind: 'front', dur: 3.5,
    desc: 'Name card that slides in from the left: who is speaking and where they are from.',
    params: { name: 'Kavya', title: 'KK Create', y: 0.58, accent: brand.violet },
    sfx: () => [{ name: 'swish', t: 0.05, gain: -14 }],
    mount(L, p, ctx) {
      const wrap = at(64, p.y * ctx.H, { display: 'flex', alignItems: 'stretch' });
      const bar = h('div', { width: '14px', background: p.accent, transformOrigin: '50% 100%' });
      const card = h('div', { background: 'rgba(28,24,20,.94)', padding: '18px 38px 20px 28px', boxShadow: '0 16px 40px rgba(0,0,0,.35)' });
      card.appendChild(h('div', { fontFamily: fonts.brand, fontWeight: '700', fontSize: '58px', lineHeight: '1.1', color: '#fff' }, p.name));
      card.appendChild(h('div', { fontFamily: fonts.brand, fontWeight: '500', fontSize: '34px', lineHeight: '1.3', color: 'rgba(247,244,239,.78)', letterSpacing: '0.02em' }, p.title));
      wrap.appendChild(bar); wrap.appendChild(card);
      L.front.appendChild(wrap);
      return { bar, card };
    },
    frame({ bar, card }, lt, p) {
      const o = ease.in2(prog(lt, p.dur - 0.3, 0.3));
      bar.style.transform = `scaleY(${(ease.out3(prog(lt, 0, 0.2)) * (1 - o)).toFixed(4)})`;
      const u = ease.out5(prog(lt, 0.1, 0.4)) * (1 - o);
      card.style.clipPath = `inset(0 ${((1 - u) * 100).toFixed(2)}% 0 0)`;
      card.style.transform = `translateX(${((1 - u) * -30).toFixed(2)}px)`;
    },
  });

  /* ── checklist ────────────────────────────────────────────── */
  const tickTimes = (p, n) => (Array.isArray(p.ticks) && p.ticks.length ? p.ticks : Array.from({ length: n }, (_, i) => 0.5 + ((p.dur - 1.1) * (i + 0.6)) / n));
  KKV.effect('checklist', {
    kind: 'front', dur: 5,
    desc: 'A card of points that tick off one by one. --ticks takes times or @phrases, one per item.',
    params: { title: '', items: 'First thing|Second thing|Third thing', y: 0.1, accent: brand.green },
    timeParams: ['ticks'],
    sfx: (p) => [{ name: 'swish', t: 0, gain: -15 }].concat(tickTimes(p, KKV.list(p.items).length).map((t) => ({ name: 'pop', t, gain: -9 }))),
    mount(L, p, ctx) {
      const card = h('div', { position: 'absolute', left: '50%', top: p.y * ctx.H + 'px', width: '800px', marginLeft: '-400px', background: 'rgba(255,255,255,.97)', borderRadius: '30px', padding: '30px 38px 34px', boxShadow: '0 24px 60px rgba(0,0,0,.35)', transformOrigin: '50% 0' });
      if (p.title) card.appendChild(h('div', { fontFamily: fonts.black, fontSize: '38px', textTransform: 'uppercase', color: brand.ink, letterSpacing: '0.02em', marginBottom: '14px' }, p.title));
      const rows = KKV.list(p.items).map((txt) => {
        const r = h('div', { display: 'flex', alignItems: 'center', gap: '24px', padding: '11px 0', transformOrigin: '0 50%' });
        const box = h('div', { width: '56px', height: '56px', borderRadius: '16px', border: '5px solid #CCC7BE', flex: 'none', position: 'relative', boxSizing: 'border-box' });
        const s = svg('svg', { viewBox: '0 0 56 56', width: '56', height: '56' });
        css(s, { position: 'absolute', left: '-5px', top: '-5px' });
        const path = svg('path', { d: 'M14 29 L24 39 L43 18', fill: 'none', stroke: '#fff', 'stroke-width': '7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: '1', 'stroke-dasharray': '1', 'stroke-dashoffset': '1' });
        s.appendChild(path); box.appendChild(s);
        const label = h('div', { fontFamily: fonts.brand, fontWeight: '700', fontSize: '46px', lineHeight: '1.2', color: brand.ink }, txt);
        r.appendChild(box); r.appendChild(label); card.appendChild(r);
        return { r, box, path, label };
      });
      L.front.appendChild(card);
      card.style.top = ctx.clearOfFace(p, p.y * ctx.H, card.offsetHeight) + 'px';
      return { card, rows, ticks: tickTimes(p, rows.length) };
    },
    frame({ card, rows, ticks }, lt, p) {
      const e = inOut(lt, p.dur, 0.34, 0.28);
      const u = ease.out5(e.i);
      card.style.opacity = String(Math.min(1, e.i * 3) * (1 - e.o));
      card.style.transform = `translateY(${((1 - u) * -50 - e.o * 30).toFixed(2)}px) scale(${lerp(0.94, 1, u).toFixed(4)})`;
      rows.forEach((row, i) => {
        const a = ease.out3(prog(lt, 0.12 + i * 0.07, 0.25));
        row.r.style.opacity = String(a);
        const k = prog(lt, ticks[i], 0.22);
        const done = k > 0;
        row.box.style.background = done ? p.accent : 'transparent';
        row.box.style.borderColor = done ? p.accent : '#CCC7BE';
        row.path.setAttribute('stroke-dashoffset', (1 - ease.out3(k)).toFixed(4));
        row.r.style.transform = `translateX(${((1 - a) * -24).toFixed(2)}px) scale(${(1 + 0.05 * Math.sin(Math.PI * k)).toFixed(4)})`;
      });
    },
  });

  /* ── counter ──────────────────────────────────────────────── */
  KKV.effect('counter', {
    kind: 'front', dur: 3,
    desc: 'A big number that counts up. format: indian (12,34,567) · compact (1.2 Cr) · intl · compact-intl · plain.',
    params: { from: 0, to: 100, prefix: '', suffix: '', label: '', format: 'indian', decimals: 0, y: 0.12, count: 0.6, accent: brand.yellow },
    sfx: (p) => [{ name: 'riser', t: 0.15, dur: Math.max(0.4, p.dur * p.count), gain: -20 }, { name: 'ding', t: 0.15 + p.dur * p.count, gain: -10 }],
    mount(L, p, ctx) {
      const col = at(0, p.y * ctx.H, { width: ctx.W + 'px', display: 'flex', flexDirection: 'column', alignItems: 'center' });
      const num = h('div', Object.assign({ fontFamily: fonts.impact, fontSize: '210px', lineHeight: '1.05', color: '#fff', whiteSpace: 'nowrap', textShadow: '0 12px 34px rgba(0,0,0,.5)', fontVariantNumeric: 'tabular-nums' }, stroke(20, '#0B0B0B')));
      col.appendChild(num);
      let label = null;
      if (p.label) { label = h('div', { fontFamily: fonts.brand, fontWeight: '700', fontSize: '42px', color: '#fff', background: 'rgba(28,24,20,.94)', padding: '10px 30px 12px', borderRadius: '40px', marginTop: '6px' }, p.label); col.appendChild(label); }
      L.front.appendChild(col);
      // shrink long numbers to fit
      const full = p.prefix + KKV.fmt.number(p.to, p) + p.suffix;
      num.textContent = full;
      const wpx = num.offsetWidth; if (wpx > ctx.W * 0.9) num.style.fontSize = (210 * ctx.W * 0.9) / wpx + 'px';
      col.style.top = ctx.clearOfFace(p, p.y * ctx.H, col.offsetHeight) + 'px';
      return { col, num, label, last: '' };
    },
    frame(S, lt, p) {
      const e = inOut(lt, p.dur, 0.2, 0.25);
      const cdur = p.dur * p.count;
      const k = prog(lt, 0.15, cdur);
      const v = lerp(p.from, p.to, ease.out3(k));
      const txt = p.prefix + KKV.fmt.number(k >= 1 ? p.to : v, p) + p.suffix;
      if (txt !== S.last) { S.num.textContent = txt; S.last = txt; }
      const bump = prog(lt, 0.15 + cdur, 0.3);
      S.num.style.color = bump > 0 ? p.accent : '#fff';
      S.col.style.opacity = String(ease.out3(e.i) * (1 - e.o));
      S.num.style.transform = `scale(${(lerp(0.8, 1, ease.outBack(e.i)) * (1 + 0.1 * Math.sin(Math.PI * bump))).toFixed(4)})`;
      if (S.label) S.label.style.transform = `translateY(${((1 - ease.out3(prog(lt, 0.1, 0.3))) * 20).toFixed(2)}px)`;
    },
  });

  /* ── comment ──────────────────────────────────────────────── */
  KKV.effect('comment', {
    kind: 'front', dur: 4,
    desc: 'A viewer comment card types itself out, then gets a like.',
    params: { user: 'priya.creates', text: 'Wait, how did you edit this so fast?', y: 0.12, likes: '2,481', accent: brand.violet },
    sfx: (p) => { const td = Math.min(p.dur * 0.45, Array.from(p.text).length * 0.035); return [{ name: 'pop', t: 0, gain: -13 }, { name: 'typing', t: 0.35, dur: td, gain: -18 }, { name: 'pop', t: 0.5 + td, gain: -10 }]; },
    mount(L, p, ctx) {
      const card = h('div', { position: 'absolute', left: '50%', top: p.y * ctx.H + 'px', width: '860px', marginLeft: '-430px', background: '#fff', borderRadius: '34px', padding: '28px 32px 30px', boxShadow: '0 24px 60px rgba(0,0,0,.35)', display: 'flex', gap: '24px', alignItems: 'flex-start', boxSizing: 'border-box', transformOrigin: '50% 100%' });
      const av = h('div', { width: '88px', height: '88px', borderRadius: '50%', flex: 'none', background: `linear-gradient(135deg, ${p.accent}, ${brand.pink})`, color: '#fff', fontFamily: fonts.brand, fontWeight: '700', fontSize: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', textTransform: 'uppercase' }, Array.from(p.user)[0] || 'K');
      const body = h('div', { flex: '1', minWidth: '0' });
      const head = h('div', { fontFamily: fonts.brand, fontWeight: '700', fontSize: '34px', color: brand.ink, lineHeight: '1.3' }, p.user);
      head.appendChild(h('span', { fontWeight: '400', color: '#A8A39C', marginLeft: '14px' }, '2m'));
      const text = h('div', { fontFamily: fonts.brand, fontWeight: '500', fontSize: '42px', lineHeight: '1.28', color: brand.ink, position: 'relative' });
      const vis = h('span'), hid = h('span', { opacity: '0' }, p.text);
      text.appendChild(vis); text.appendChild(hid);
      body.appendChild(head); body.appendChild(text);
      const like = h('div', { flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginTop: '18px', fontFamily: fonts.brand, fontWeight: '500', fontSize: '24px', color: '#6B6560' });
      const s = svg('svg', { viewBox: '0 0 48 48', width: '54', height: '54' });
      const heart = svg('path', { d: 'M24 41 C10 30 5 24 5 16.5 C5 11 9.3 7 14.5 7 C18.2 7 21.6 9 24 12.4 C26.4 9 29.8 7 33.5 7 C38.7 7 43 11 43 16.5 C43 24 38 30 24 41 Z', fill: 'none', stroke: '#A8A39C', 'stroke-width': '3.5', 'stroke-linejoin': 'round' });
      s.appendChild(heart); like.appendChild(s);
      const count = h('span', {}, p.likes); like.appendChild(count);
      card.appendChild(av); card.appendChild(body); card.appendChild(like);
      L.front.appendChild(card);
      card.style.top = ctx.clearOfFace(p, p.y * ctx.H, card.offsetHeight) + 'px';
      const chars = Array.from(p.text);
      return { card, vis, hid, chars, heart, s, count, n: -1, td: Math.min(p.dur * 0.45, chars.length * 0.035) };
    },
    frame(S, lt, p) {
      const e = inOut(lt, p.dur, 0.32, 0.25);
      S.card.style.opacity = String(Math.min(1, e.i * 3) * (1 - e.o));
      S.card.style.transform = `translateY(${((1 - ease.outBack(e.i)) * 70 - e.o * 30).toFixed(2)}px) scale(${lerp(0.9, 1, ease.outBack(e.i)).toFixed(4)})`;
      const n = Math.round(prog(lt, 0.35, S.td) * S.chars.length);
      if (n !== S.n) { S.vis.textContent = S.chars.slice(0, n).join(''); S.hid.textContent = S.chars.slice(n).join(''); S.n = n; }
      const k = prog(lt, 0.5 + S.td, 0.3);
      S.heart.setAttribute('fill', k > 0 ? brand.red : 'none');
      S.heart.setAttribute('stroke', k > 0 ? brand.red : '#A8A39C');
      S.s.style.transform = `scale(${(1 + 0.45 * Math.sin(Math.PI * ease.out3(k))).toFixed(4)})`;
      S.count.style.color = k > 0 ? brand.red : '#6B6560';
    },
  });

  /* ── stamp ────────────────────────────────────────────────── */
  KKV.effect('stamp', {
    kind: 'front', dur: 1.8,
    desc: 'A rubber stamp slams onto the frame: MYTH, FACT, VERIFIED, SOLD OUT…',
    params: { text: 'MYTH', color: brand.red, rotate: -11, x: 0.5, y: 0.3, size: 150 },
    sfx: () => [{ name: 'thud', t: 0.13, gain: -6 }],
    mount(L, p, ctx) {
      const pos = at(p.x * ctx.W, p.y * ctx.H, { width: '0', height: '0' });
      const st = h('div', { position: 'absolute', left: '0', top: '0', border: `14px solid ${p.color}`, borderRadius: '22px', padding: '0 44px 4px', outline: `5px solid ${p.color}`, outlineOffset: '8px', fontFamily: fonts.black, fontSize: p.size + 'px', lineHeight: '1.15', letterSpacing: '0.04em', color: p.color, textTransform: 'uppercase', whiteSpace: 'nowrap', background: 'rgba(255,255,255,.08)', textShadow: '0 0 1px rgba(0,0,0,.25)' }, p.text);
      pos.appendChild(st); L.front.appendChild(pos);
      const wpx = st.offsetWidth; if (wpx > ctx.W * 0.86) { st.style.fontSize = (p.size * ctx.W * 0.86) / wpx + 'px'; }
      return { st };
    },
    frame({ st }, lt, p) {
      const u = prog(lt, 0, 0.15);
      const after = Math.max(0, lt - 0.15);
      const shake = Math.exp(-after * 16);
      const dx = after > 0 ? Math.sin(after * 95) * 9 * shake : 0, dy = after > 0 ? Math.cos(after * 80) * 6 * shake : 0;
      const sc = lerp(3.4, 1, ease.in3(u)) * (after > 0 ? 1 - 0.07 * shake : 1);
      const out = 1 - prog(lt, p.dur - 0.2, 0.2);
      st.style.opacity = String(Math.min(1, u * 2.5) * 0.94 * out);
      st.style.transform = `translate(-50%,-50%) translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px) rotate(${p.rotate}deg) scale(${sc.toFixed(4)})`;
    },
  });

  /* ── progress ─────────────────────────────────────────────── */
  KKV.effect('progress', {
    kind: 'front', dur: 0, // 0 = whole video
    desc: 'A thin retention bar that fills across the top (or bottom) for the length of the reel.',
    params: { pos: 'top', height: 12, accent: brand.yellow },
    mount(L, p, ctx) {
      const track = h('div', { position: 'absolute', left: '0', right: '0', height: p.height + 'px', background: 'rgba(255,255,255,.22)' });
      track.style[p.pos === 'bottom' ? 'bottom' : 'top'] = '0';
      const fill = h('div', { position: 'absolute', left: '0', top: '0', bottom: '0', width: '100%', background: p.accent, transformOrigin: '0 50%' });
      track.appendChild(fill); L.front.appendChild(track);
      return { fill };
    },
    frame({ fill }, lt, p) { fill.style.transform = `scaleX(${clamp(lt / p.dur).toFixed(5)})`; },
  });

  /* ── source-tag ───────────────────────────────────────────── */
  KKV.effect('source-tag', {
    kind: 'front', dur: 3,
    desc: 'A small citation chip for a claim: "Source: RBI Annual Report 2025".',
    params: { text: 'Source: —', x: 0.05, y: 0.855, accent: brand.yellow },
    mount(L, p, ctx) {
      const chip = at(p.x * ctx.W, p.y * ctx.H, { background: 'rgba(28,24,20,.9)', color: brand.cream, fontFamily: fonts.brand, fontWeight: '500', fontSize: '30px', lineHeight: '1.25', padding: '12px 24px 13px 20px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '14px', maxWidth: '760px', border: '2px solid rgba(255,255,255,.1)' });
      chip.appendChild(h('span', { width: '12px', height: '12px', borderRadius: '50%', background: p.accent, flex: 'none' }));
      chip.appendChild(h('span', {}, p.text));
      L.front.appendChild(chip);
      return { chip };
    },
    frame({ chip }, lt, p) {
      const e = inOut(lt, p.dur, 0.25, 0.25);
      chip.style.opacity = String(ease.out3(e.i) * (1 - e.o));
      chip.style.transform = `translateY(${((1 - ease.out3(e.i)) * 16).toFixed(2)}px)`;
    },
  });

  /* ── callout ──────────────────────────────────────────────── */
  KKV.effect('callout', {
    kind: 'front', dur: 2.5,
    desc: 'A hand-drawn arrow and note that point at a spot in the frame (x, y from 0 to 1).',
    params: { text: 'look here', x: 0.7, y: 0.4, from: 'left', color: '#fff' },
    sfx: () => [{ name: 'scribble', t: 0.05, gain: -14 }],
    mount(L, p, ctx) {
      const T = [p.x * ctx.W, p.y * ctx.H];
      const off = p.from === 'right' ? [300, 190] : p.from === 'top' ? [-40, -300] : p.from === 'bottom' ? [40, 300] : [-300, 190];
      const A = [clamp(T[0] + off[0], 150, ctx.W - 150), clamp(T[1] + off[1], 120, ctx.H - 120)];
      const dx = T[0] - A[0], dy = T[1] - A[1], len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const start = [A[0] + ux * 70, A[1] + uy * 70], end = [T[0] - ux * 26, T[1] - uy * 26];
      const mid = [(start[0] + end[0]) / 2 - uy * len * 0.22, (start[1] + end[1]) / 2 + ux * len * 0.22];
      const s = svg('svg', { width: ctx.W, height: ctx.H, viewBox: `0 0 ${ctx.W} ${ctx.H}` });
      css(s, { position: 'absolute', left: '0', top: '0', overflow: 'visible', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.6))' });
      const mk = (d) => { const e = svg('path', { d, fill: 'none', stroke: p.color, 'stroke-width': '9', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: '1', 'stroke-dasharray': '1', 'stroke-dashoffset': '1' }); s.appendChild(e); return e; };
      const curve = mk(`M${start[0].toFixed(1)} ${start[1].toFixed(1)} Q${mid[0].toFixed(1)} ${mid[1].toFixed(1)} ${end[0].toFixed(1)} ${end[1].toFixed(1)}`);
      // arrow head follows the curve's end tangent
      const tx = end[0] - mid[0], ty = end[1] - mid[1], tl = Math.hypot(tx, ty) || 1, ax = tx / tl, ay = ty / tl;
      const rot = (c, sn) => [ax * c - ay * sn, ax * sn + ay * c];
      const h1 = rot(-0.82, 0.57), h2 = rot(-0.82, -0.57);
      const head = mk(`M${(end[0] + h1[0] * 46).toFixed(1)} ${(end[1] + h1[1] * 46).toFixed(1)} L${end[0].toFixed(1)} ${end[1].toFixed(1)} L${(end[0] + h2[0] * 46).toFixed(1)} ${(end[1] + h2[1] * 46).toFixed(1)}`);
      L.front.appendChild(s);
      const label = at(A[0], A[1], Object.assign({ fontFamily: fonts.hand, fontWeight: '700', fontSize: '66px', lineHeight: '1.05', color: p.color, whiteSpace: 'nowrap', textShadow: '0 4px 12px rgba(0,0,0,.6)' }, stroke(8, 'rgba(0,0,0,.75)')));
      label.textContent = p.text;
      L.front.appendChild(label);
      return { curve, head, label, s };
    },
    frame({ curve, head, label, s }, lt, p) {
      const out = 1 - prog(lt, p.dur - 0.25, 0.25);
      const a = ease.out3(prog(lt, 0, 0.25));
      label.style.opacity = String(a * out);
      label.style.transform = `translate(-50%,-50%) rotate(-4deg) scale(${lerp(0.8, 1, ease.outBack(prog(lt, 0, 0.3))).toFixed(4)})`;
      curve.setAttribute('stroke-dashoffset', (1 - ease.inOut(prog(lt, 0.18, 0.4))).toFixed(4));
      head.setAttribute('stroke-dashoffset', (1 - ease.out3(prog(lt, 0.55, 0.16))).toFixed(4));
      s.style.opacity = String(out);
    },
  });

  /* ── follow-cta ───────────────────────────────────────────── */
  KKV.effect('follow-cta', {
    kind: 'front', dur: 3,
    desc: 'End card: your handle with a Follow button that gets tapped and flips to Following.',
    params: { handle: '@kkcreate', text: 'Follow for more', initials: 'KK', y: 0.42, accent: brand.violet },
    sfx: (p) => [{ name: 'pop', t: 0, gain: -12 }, { name: 'click', t: p.dur * 0.45, gain: -8 }, { name: 'success', t: p.dur * 0.45 + 0.08, gain: -14 }],
    mount(L, p, ctx) {
      const card = h('div', { position: 'absolute', left: '50%', top: p.y * ctx.H + 'px', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: '70px', padding: '22px 26px 22px 24px', display: 'flex', alignItems: 'center', gap: '24px', boxShadow: '0 26px 64px rgba(0,0,0,.4)', whiteSpace: 'nowrap' });
      card.appendChild(h('div', { width: '104px', height: '104px', borderRadius: '50%', background: p.accent, color: '#fff', fontFamily: fonts.serif, fontSize: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }, p.initials));
      const col = h('div', { paddingRight: '10px' });
      col.appendChild(h('div', { fontFamily: fonts.brand, fontWeight: '700', fontSize: '46px', color: brand.ink, lineHeight: '1.15' }, p.handle));
      col.appendChild(h('div', { fontFamily: fonts.brand, fontWeight: '500', fontSize: '30px', color: '#6B6560', lineHeight: '1.3' }, p.text));
      card.appendChild(col);
      const btn = h('div', { position: 'relative', fontFamily: fonts.brand, fontWeight: '700', fontSize: '38px', color: '#fff', background: p.accent, padding: '18px 0 20px', borderRadius: '50px', width: '290px', textAlign: 'center', flex: 'none' }, 'Follow');
      const ring = h('div', { position: 'absolute', left: '50%', top: '50%', width: '120px', height: '120px', margin: '-60px 0 0 -60px', borderRadius: '50%', border: '6px solid rgba(28,24,20,.55)', opacity: '0' });
      btn.appendChild(ring);
      card.appendChild(btn);
      L.front.appendChild(card);
      return { card, btn, ring, label: btn.firstChild, on: null };
    },
    frame(S, lt, p) {
      const e = inOut(lt, p.dur, 0.34, 0.25);
      const tp = p.dur * 0.45;
      S.card.style.opacity = String(Math.min(1, e.i * 3) * (1 - e.o));
      S.card.style.transform = `translate(-50%,-50%) scale(${lerp(0.7, 1, ease.outBack(e.i)).toFixed(4)})`;
      const pressed = lt >= tp;
      if (pressed !== S.on) { S.label.nodeValue = pressed ? 'Following ✓' : 'Follow'; S.btn.style.background = pressed ? brand.ink : p.accent; S.on = pressed; }
      const k = prog(lt, tp - 0.08, 0.3);
      S.btn.style.transform = `scale(${(1 - 0.1 * Math.sin(Math.PI * k)).toFixed(4)})`;
      const r = prog(lt, tp, 0.45);
      S.ring.style.opacity = String(r > 0 && r < 1 ? 1 - r : 0);
      S.ring.style.transform = `scale(${lerp(0.4, 2.2, ease.out3(r)).toFixed(4)})`;
    },
  });
})(typeof window !== 'undefined' ? window.KKV : globalThis.KKV);
