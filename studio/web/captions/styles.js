/* KK Verse Studio · caption styles.
 * A style is { desc, defaults, build(inner, line, ctx, o) → refs, frame(refs, line, t, ctx, o) }.
 * `line` = { i, s, e, on, off, words:[{ w, s, e, key }] }. Sizes are in design px (short side = 1080).
 * To add a style: copy one block, rename it, change the look. Keep frame() a pure function of t. */
(function (KKV) {
  'use strict';
  const { h, css, stroke, fonts, brand } = KKV;
  const { prog, lerp, ease, clamp } = KKV.m;

  const row = (inner, st) => {
    const r = h('div', Object.assign({
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center',
      maxWidth: '940px', gap: '8px 22px', textAlign: 'center',
    }, st));
    inner.appendChild(r);
    return r;
  };
  const spans = (parent, line, st, map) => line.words.map((w, i) => {
    const s = h('span', Object.assign({ display: 'inline-block', whiteSpace: 'nowrap', willChange: 'transform' }, st), map ? map(w.w) : w.w);
    parent.appendChild(s);
    return s;
  });
  const exit = (line, t, d = 0.08) => 1 - prog(t, line.off - d, d);
  /** index of the word being spoken (the last one that has started), -1 before the first. */
  const activeIdx = (line, t) => { let a = -1; for (let i = 0; i < line.words.length; i++) if (t >= line.words[i].s) a = i; return a; };

  /* 1 ── kk-pop ─────────────────────────────────────────────── */
  KKV.caption('kk-pop', {
    desc: 'Bold caps that pop in word by word; the key word lands on a tilted colour block.',
    defaults: { y: 0.7, maxChars: 15, maxWords: 3, accent: brand.yellow },
    build(inner, line, ctx, o) {
      const r = row(inner, { gap: '12px 28px', maxWidth: '980px' });
      return spans(r, line, Object.assign({
        fontFamily: fonts.impact, fontSize: '132px', lineHeight: '1.1', color: '#fff', textTransform: 'uppercase',
        letterSpacing: '0.01em', textShadow: '0 8px 22px rgba(0,0,0,.5)',
      }, stroke(16, '#0B0B0B'))).map((el, i) => {
        if (line.words[i].key) css(el, {
          background: o.accent, color: '#0B0B0B', '-webkit-text-stroke': '0', padding: '0 20px 2px', borderRadius: '12px',
          textShadow: 'none', boxShadow: '0 10px 0 rgba(0,0,0,.65)',
        });
        return el;
      });
    },
    frame(els, line, t) {
      const ex = exit(line, t);
      els.forEach((el, i) => {
        const w = line.words[i];
        const u = prog(t, w.s - 0.03, 0.17);
        const sc = lerp(0.45, w.key ? 1.08 : 1, ease.outBack(u, 2.2));
        el.style.opacity = u <= 0 ? '0' : String(Math.min(1, u * 3) * ex);
        el.style.transform = `scale(${sc.toFixed(4)}) rotate(${w.key ? -3 : 0}deg)`;
      });
    },
  });

  /* 2 ── karaoke ────────────────────────────────────────────── */
  KKV.caption('karaoke', {
    desc: 'The whole line is on screen; each word lights up as you say it.',
    defaults: { y: 0.72, maxChars: 20, maxWords: 4, accent: brand.yellow },
    build(inner, line) {
      const r = row(inner, { gap: '4px 26px', maxWidth: '960px' });
      return { r, els: spans(r, line, Object.assign({ fontFamily: fonts.sans, fontWeight: '900', fontSize: '80px', lineHeight: '1.18', textShadow: '0 6px 18px rgba(0,0,0,.45)' }, stroke(12, 'rgba(8,8,8,.92)'))) };
    },
    frame({ r, els }, line, t, ctx, o) {
      const a = activeIdx(line, t);
      const u = ease.out3(prog(t, line.on, 0.14));
      r.style.opacity = String(u * exit(line, t));
      r.style.transform = `translateY(${((1 - u) * 16).toFixed(2)}px)`;
      els.forEach((el, i) => {
        const w = line.words[i];
        const live = i === a && t < w.e + 0.12;
        const p = live ? ease.outBack(prog(t, w.s, 0.12)) : 0;
        el.style.color = live ? o.accent : i <= a ? '#fff' : 'rgba(255,255,255,.5)';
        el.style.transform = `scale(${(1 + 0.09 * p).toFixed(4)})`;
      });
    },
  });

  /* 3 ── marker ─────────────────────────────────────────────── */
  KKV.caption('marker', {
    desc: 'Chunky words rise in; a highlighter swipes across the key word.',
    defaults: { y: 0.7, maxChars: 16, maxWords: 3, accent: '#FFE14D' },
    build(inner, line, ctx, o) {
      const r = row(inner, { gap: '10px 30px', maxWidth: '980px' });
      return line.words.map((w) => {
        const wrap = h('span', { display: 'inline-block', position: 'relative', whiteSpace: 'nowrap' });
        let bar = null;
        if (w.key) {
          bar = h('span', { position: 'absolute', left: '-14px', right: '-14px', top: '6px', bottom: '2px', background: o.accent, borderRadius: '6px 16px 8px 14px', transformOrigin: '0 50%', transform: 'scaleX(0) rotate(-1.5deg)' });
          wrap.appendChild(bar);
        }
        const tx = h('span', Object.assign({ position: 'relative', display: 'inline-block', fontFamily: fonts.black, fontSize: '96px', lineHeight: '1.16', color: '#fff', textShadow: '0 6px 18px rgba(0,0,0,.45)' }, stroke(12, '#0B0B0B')), w.w);
        wrap.appendChild(tx);
        r.appendChild(wrap);
        return { wrap, bar, tx };
      });
    },
    frame(refs, line, t) {
      const ex = exit(line, t);
      refs.forEach(({ wrap, bar, tx }, i) => {
        const w = line.words[i];
        const u = ease.out3(prog(t, w.s - 0.03, 0.16));
        wrap.style.opacity = String(u * ex);
        wrap.style.transform = `translateY(${((1 - u) * 20).toFixed(2)}px)`;
        if (bar) {
          const b = ease.out3(prog(t, w.s + 0.02, 0.2));
          bar.style.transform = `scaleX(${b.toFixed(4)}) rotate(-1.5deg)`;
          const inked = b > 0.5;
          tx.style.color = inked ? '#0B0B0B' : '#fff';
          tx.style.webkitTextStroke = inked ? '0px transparent' : '12px #0B0B0B';
          tx.style.textShadow = inked ? 'none' : '0 6px 18px rgba(0,0,0,.45)';
        }
      });
    },
  });

  /* 4 ── typewriter ─────────────────────────────────────────── */
  KKV.caption('typewriter', {
    desc: 'Monospace letters typed in time with your voice, with a blinking caret.',
    defaults: { y: 0.72, maxChars: 20, maxWords: 4, accent: brand.yellow },
    build(inner, line, ctx, o) {
      const box = h('div', { background: 'rgba(12,12,12,.88)', padding: '22px 36px 24px', borderRadius: '10px', borderLeft: `10px solid ${o.accent}`, fontFamily: fonts.mono, fontWeight: '700', fontSize: '58px', lineHeight: '1.3', color: '#fff', maxWidth: '960px', textAlign: 'left', boxShadow: '0 14px 40px rgba(0,0,0,.35)' });
      inner.appendChild(box);
      const caret = h('span', { display: 'inline-block', width: '0', height: '1em', position: 'relative', verticalAlign: 'baseline' });
      const bar = h('span', { position: 'absolute', left: '3px', bottom: '-6px', width: '26px', height: '62px', background: o.accent });
      caret.appendChild(bar);
      const ws = line.words.map((w, i) => {
        const wrap = h('span', { whiteSpace: 'nowrap' });
        const vis = h('span'), hid = h('span', { opacity: '0' });
        wrap.appendChild(vis); wrap.appendChild(hid);
        box.appendChild(wrap);
        if (i < line.words.length - 1) box.appendChild(document.createTextNode(' '));
        return { wrap, vis, hid, at: -1 };
      });
      return { box, caret, bar, ws, cur: -1 };
    },
    frame(R, line, t) {
      const a = Math.max(0, activeIdx(line, t));
      R.box.style.opacity = String(ease.out3(prog(t, line.on, 0.1)) * exit(line, t));
      R.ws.forEach((r, i) => {
        const w = line.words[i], chars = Array.from(w.w);
        const n = Math.round(prog(t, w.s, Math.max(0.06, (w.e - w.s) * 0.75)) * chars.length);
        if (n !== r.at) { r.vis.textContent = chars.slice(0, n).join(''); r.hid.textContent = chars.slice(n).join(''); r.at = n; }
      });
      if (R.cur !== a) { R.ws[a].wrap.insertBefore(R.caret, R.ws[a].hid); R.cur = a; }
      const typing = t >= line.words[a].s && t < line.words[a].e;
      R.bar.style.opacity = typing || Math.floor(t * 2.6) % 2 === 0 ? '1' : '0';
    },
  });

  /* 5 ── newsroom ───────────────────────────────────────────── */
  KKV.caption('newsroom', {
    desc: 'Explainer lower-third: a label tag over a clean white bar, key word in red.',
    defaults: { y: 0.74, maxChars: 22, maxWords: 5, accent: brand.red, label: 'KK VERSE' },
    build(inner, line, ctx, o) {
      const col = h('div', { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '960px' });
      inner.appendChild(col);
      const tag = h('div', { background: o.accent, color: '#fff', fontFamily: fonts.sans, fontWeight: '900', fontSize: '32px', letterSpacing: '0.14em', padding: '8px 18px 7px', textTransform: 'uppercase' }, o.label);
      const bar = h('div', { background: '#fff', color: brand.ink, fontFamily: fonts.sans, fontWeight: '800', fontSize: '64px', lineHeight: '1.2', padding: '14px 32px 16px', borderBottom: `8px solid ${o.accent}`, boxShadow: '0 16px 40px rgba(0,0,0,.35)', display: 'flex', flexWrap: 'wrap', gap: '0 16px' });
      col.appendChild(tag); col.appendChild(bar);
      return { tag, bar, els: spans(bar, line, {}) };
    },
    frame({ tag, bar, els }, line, t, ctx, o) {
      const u = ease.out3(prog(t, line.on, 0.22));
      const ex = exit(line, t, 0.1);
      bar.style.clipPath = `inset(0 ${((1 - u) * 100).toFixed(2)}% 0 0)`;
      bar.style.opacity = tag.style.opacity = String(ex);
      tag.style.transform = `translateY(${((1 - ease.out3(prog(t, line.on, 0.16))) * 14).toFixed(2)}px)`;
      const a = activeIdx(line, t);
      els.forEach((el, i) => {
        el.style.color = line.words[i].key && i <= a ? o.accent : brand.ink;
        el.style.opacity = i <= a ? '1' : '0.32';
      });
    },
  });

  /* 6 ── one-word ───────────────────────────────────────────── */
  KKV.caption('one-word', {
    desc: 'One huge word at a time, dead centre. Fast, punchy, impossible to miss.',
    defaults: { y: 0.66, maxChars: 22, maxWords: 4, accent: brand.yellow },
    lead: 0.02,
    build(inner, line) {
      const box = h('div', { position: 'relative', width: '1000px', height: '260px' });
      inner.appendChild(box);
      return line.words.map((w) => {
        const len = Math.max(1, Array.from(w.w).length);
        const size = Math.min(210, 1900 / len);
        const el = h('span', Object.assign({ position: 'absolute', left: '0', right: '0', top: '50%', textAlign: 'center', fontFamily: fonts.impact, fontSize: size + 'px', lineHeight: '1', textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'none', textShadow: '0 10px 30px rgba(0,0,0,.5)' }, stroke(Math.max(12, size * 0.09), '#0B0B0B')), w.w);
        box.appendChild(el);
        return el;
      });
    },
    frame(els, line, t, ctx, o) {
      const a = Math.max(0, activeIdx(line, t));
      const ex = exit(line, t, 0.06);
      els.forEach((el, i) => {
        if (i !== a) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
        const w = line.words[i];
        const u = ease.out5(prog(t, w.s - 0.02, 0.14));
        el.style.display = 'block';
        el.style.color = w.key ? o.accent : '#fff';
        el.style.opacity = String(Math.min(1, u * 2.5) * ex);
        el.style.transform = `translateY(-50%) scale(${lerp(1.4, 1, u).toFixed(4)}) rotate(${w.key ? -3 : 0}deg)`;
      });
    },
  });

  /* 7 ── pill ───────────────────────────────────────────────── */
  KKV.caption('pill', {
    desc: 'A soft dark pill; words brighten as spoken and the key word gets its own violet chip.',
    defaults: { y: 0.74, maxChars: 22, maxWords: 4, accent: brand.violet },
    build(inner, line) {
      const pill = h('div', { background: 'rgba(28,24,20,.93)', borderRadius: '50px', padding: '22px 46px 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 14px', maxWidth: '960px', boxShadow: '0 18px 44px rgba(0,0,0,.35)', border: '2px solid rgba(255,255,255,.08)' });
      inner.appendChild(pill);
      return { pill, els: spans(pill, line, { fontFamily: fonts.brand, fontWeight: '700', fontSize: '62px', lineHeight: '1.25', borderRadius: '34px', padding: '0 12px' }) };
    },
    frame({ pill, els }, line, t, ctx, o) {
      const u = prog(t, line.on, 0.16);
      pill.style.opacity = String(Math.min(1, u * 2) * exit(line, t));
      pill.style.transform = `scale(${lerp(0.9, 1, ease.outBack(u)).toFixed(4)})`;
      const a = activeIdx(line, t);
      els.forEach((el, i) => {
        const w = line.words[i], said = i <= a;
        el.style.color = said ? '#fff' : 'rgba(255,255,255,.36)';
        if (w.key) {
          const k = ease.out3(prog(t, w.s, 0.14));
          el.style.background = said ? o.accent : 'transparent';
          el.style.transform = `scale(${(1 + 0.06 * Math.sin(Math.PI * k)).toFixed(4)})`;
        }
      });
    },
  });

  /* 8 ── editorial ──────────────────────────────────────────── */
  KKV.caption('editorial', {
    desc: 'Elegant serif that drifts into focus; the key word turns italic with a drawn underline.',
    defaults: { y: 0.7, maxChars: 17, maxWords: 3, accent: '#B4ABFF' },
    build(inner, line, ctx, o) {
      const r = row(inner, { gap: '0 28px', maxWidth: '960px' });
      return line.words.map((w) => {
        const wrap = h('span', { display: 'inline-block', position: 'relative', whiteSpace: 'nowrap', fontFamily: fonts.serif, fontSize: '112px', lineHeight: '1.14', color: brand.cream, textShadow: '0 4px 30px rgba(0,0,0,.7), 0 2px 4px rgba(0,0,0,.55)' }, w.w);
        let ul = null;
        if (w.key) {
          css(wrap, { fontStyle: 'italic', color: o.accent });
          ul = h('span', { position: 'absolute', left: '0', right: '0', bottom: '4px', height: '6px', borderRadius: '3px', background: o.accent, transformOrigin: '0 50%', transform: 'scaleX(0)' });
          wrap.appendChild(ul);
        }
        r.appendChild(wrap);
        return { wrap, ul };
      });
    },
    frame(refs, line, t) {
      const ex = exit(line, t, 0.14);
      refs.forEach(({ wrap, ul }, i) => {
        const w = line.words[i];
        const u = ease.out3(prog(t, w.s - 0.05, 0.32));
        wrap.style.opacity = String(u * ex);
        wrap.style.transform = `translateY(${((1 - u) * 24).toFixed(2)}px)`;
        wrap.style.filter = u < 1 ? `blur(${((1 - u) * 9).toFixed(2)}px)` : 'none';
        if (ul) ul.style.transform = `scaleX(${ease.out3(prog(t, w.s + 0.12, 0.3)).toFixed(4)})`;
      });
    },
  });

  /* 9 ── truck-art ──────────────────────────────────────────── */
  KKV.caption('truck-art', {
    desc: 'Loud desi poster lettering: every word a different colour with a hard offset shadow.',
    defaults: { y: 0.7, maxChars: 13, maxWords: 3, accent: brand.yellow },
    build(inner, line, ctx, o) {
      const pal = [brand.saffron, brand.pink, brand.teal, o.accent];
      const r = row(inner, { gap: '8px 30px', maxWidth: '990px' });
      return spans(r, line, Object.assign({ fontFamily: fonts.desi, fontWeight: '800', fontSize: '122px', lineHeight: '1.12', textTransform: 'uppercase', textShadow: '8px 9px 0 #1C1814' }, stroke(14, '#fff'))).map((el, i) => {
        const w = line.words[i];
        el.style.color = w.key ? '#1C1814' : pal[(line.i + i) % pal.length];
        if (w.key) css(el, { background: o.accent, '-webkit-text-stroke': '0', textShadow: 'none', padding: '0 22px', borderRadius: '14px', border: '7px solid #1C1814', boxShadow: '9px 10px 0 #1C1814' });
        return el;
      });
    },
    frame(els, line, t) {
      const ex = exit(line, t);
      els.forEach((el, i) => {
        const w = line.words[i];
        const u = prog(t, w.s - 0.03, 0.24);
        const b = ease.outBack(u, 2.6);
        const tilt = (i % 2 ? 1 : -1) * (w.key ? 3.5 : 2);
        el.style.opacity = u <= 0 ? '0' : String(Math.min(1, u * 4) * ex);
        el.style.transform = `translateY(${((1 - b) * -70).toFixed(2)}px) rotate(${(tilt * b).toFixed(2)}deg) scale(${w.key ? 1.06 : 1})`;
      });
    },
  });

  /* 10 ── clean ─────────────────────────────────────────────── */
  KKV.caption('clean', {
    desc: 'Quiet, readable subtitles for longer cuts and landscape video.',
    defaults: { y: 0.8, maxChars: 30, maxWords: 7, accent: brand.yellow },
    tail: 0.2,
    build(inner, line, ctx, o) {
      const r = row(inner, { gap: '0 14px', maxWidth: '940px' });
      const els = spans(r, line, { fontFamily: fonts.sans, fontWeight: '600', fontSize: '54px', lineHeight: '1.3', color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,.85), 0 0 3px rgba(0,0,0,.9)' });
      els.forEach((el, i) => { if (line.words[i].key) css(el, { color: o.accent, fontWeight: '800' }); });
      return r;
    },
    frame(r, line, t) {
      r.style.opacity = String(ease.out3(prog(t, line.on, 0.12)) * exit(line, t, 0.1));
    },
  });
})(typeof window !== 'undefined' ? window.KKV : globalThis.KKV);
