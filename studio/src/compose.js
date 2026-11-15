'use strict';
/* The compositor: reads edit.json, renders the motion layers, and has ffmpeg stack
 *   room  →  back layer  →  the speaker (cut out)  →  front layer
 * with camera moves, colour looks and the sound-effect track mixed under the voice. */
const fs = require('fs');
const path = require('path');
const U = require('./util');
const P = require('./project');
const catalog = require('./catalog');
const sfx = require('./sfx');
const { renderLayers } = require('./layers');
const Camera = require('../web/lib/camera.js');

const n = (v) => Number(v).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const HDR_CHAIN = 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p';

function pickFps(pr, want) {
  if (want) return clamp(Math.round(want), 12, 60);
  const f = Math.round(pr.fps);
  return f > 30 ? (f % 25 === 0 ? 25 : 30) : clamp(f, 12, 30);
}

/** Normalise the effects list against the catalog and the video length. */
function normaliseEffects(edit, duration) {
  const K = catalog.load();
  return (edit.effects || []).map((fx, i) => {
    const def = K.effects[fx.type];
    if (!def) U.fail(`Effect ${i + 1} has an unknown type "${fx.type}". Run: kkv list effects`);
    const at = clamp(+fx.at || 0, 0, duration);
    let dur = +fx.dur > 0 ? +fx.dur : def.dur > 0 ? def.dur : duration - at;
    dur = Math.min(dur, duration - at);
    return Object.assign({}, fx, { at, dur, def, index: i });
  }).filter((fx) => fx.dur > 0.03);
}

const mergeRanges = (rs) => {
  const s = rs.map((r) => [r[0], r[1]]).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const r of s) { const l = out[out.length - 1]; if (l && r[0] <= l[1] + 0.5) l[1] = Math.max(l[1], r[1]); else out.push(r); }
  return out;
};
const covers = (have, need) => !have || need.every((r) => have.some((h) => h[0] <= r[0] + 1e-3 && h[1] >= r[1] - 1e-3));

/**
 * Person cut-out + face track, cached in the project folder.
 * `need` = [[from, to], …] seconds that must be analysed (null = the whole video). Only those
 * stretches are processed, which keeps a short effect on a long video fast.
 */
async function ensureTrack(p, pr, fps, log, need = null) {
  let have;
  if (fs.existsSync(p.trackPath) && fs.existsSync(p.mattePath)) {
    try {
      const t = JSON.parse(fs.readFileSync(p.trackPath, 'utf8'));
      if (Math.abs(t.fps - fps) < 0.01 && t.stamp === pr.stamp) {
        if (need ? covers(t.ranges, need) : !t.ranges) return t;
        have = t.ranges;
      }
    } catch (_) { /* redo */ }
  }
  const py = U.venvPython();
  if (!py) U.fail('The tracking tools are not installed yet. Run the one-time setup: bash studio/setup.sh');
  const s = 432 / Math.min(pr.width, pr.height);
  const mw = U.even(pr.width * s), mh = U.even(pr.height * s);
  let ranges = need ? mergeRanges([...(have || []), ...need]).map((r) => [Math.max(0, U.round(r[0], 2)), Math.min(pr.duration, U.round(r[1], 2))]) : null;
  const secs = ranges ? ranges.reduce((a, r) => a + r[1] - r[0], 0) : pr.duration;
  if (ranges && secs > pr.duration * 0.85) ranges = null;
  log(`Finding you in the frame (person cut-out + face track, about ${Math.round(Math.min(secs, pr.duration) * fps)} frames)…`);
  const args = [path.join(U.ROOT, 'py', 'track.py'), p.video, '--matte', p.mattePath, '--track', p.trackPath, '--fps', String(fps), '--width', String(mw), '--height', String(mh)];
  if (ranges) args.push('--ranges', ranges.map((r) => `${r[0]}-${r[1]}`).join(','));
  if (pr.hdr) args.push('--pre', HDR_CHAIN);
  await U.run(py, args, { onStderr: (d) => { const m = String(d).match(/tracked (\d+) frames/); if (m) log(`  tracked ${m[1]} frames`); } });
  const t = JSON.parse(fs.readFileSync(p.trackPath, 'utf8'));
  t.stamp = pr.stamp;
  fs.writeFileSync(p.trackPath, JSON.stringify(t));
  if (!t.faceFrames) log('  Note: no face was detected, so head position is estimated from the cut-out.');
  return t;
}

function cameraCues(fxs, track) {
  const K = catalog.load();
  const cues = [];
  for (const fx of fxs.filter((f) => f.def.kind === 'camera').sort((a, b) => a.at - b.at)) {
    const p = K.coerce(fx.def.params, fx);
    let cx = 0.5, cy = p.target === 'center' ? 0.5 : 0.4;
    if (p.target !== 'center' && track && track.face && track.face.length) {
      const i0 = clamp(Math.round(fx.at * track.fps), 0, track.face.length - 1);
      const i1 = clamp(Math.round((fx.at + fx.dur) * track.fps), i0, track.face.length - 1);
      let sx = 0, sy = 0, c = 0;
      for (let i = i0; i <= i1; i++) { sx += track.face[i][0]; sy += track.face[i][1]; c++; }
      cx = sx / c; cy = sy / c;
    }
    const zoom = clamp(p.zoom, 1.01, 3);
    const cue = fx.type === 'slow-push'
      ? { at: fx.at, dur: fx.dur, zoom, cx, cy, rise: fx.dur, fall: 0, linear: true }
      : { at: fx.at, dur: fx.dur, zoom, cx, cy, rise: Math.min(p.rise, fx.dur * 0.45), fall: Math.min(p.fall, fx.dur * 0.45) };
    const prev = cues[cues.length - 1];
    if (prev && prev.at + prev.dur > cue.at) { // camera moves cannot overlap: the earlier one hands over
      prev.dur = Math.max(0.05, cue.at - prev.at);
      prev.fall = Math.min(prev.fall, prev.dur * 0.4);
      prev.rise = prev.linear ? prev.dur : Math.min(prev.rise, prev.dur * 0.45);
    }
    cues.push(cue);
  }
  return cues;
}

function soundEvents(edit, fxs) {
  const K = catalog.load();
  const ev = [];
  for (const s of edit.sfx || []) ev.push({ name: s.name, at: +s.at, gain: s.gain == null ? -10 : +s.gain, dur: s.dur == null ? undefined : +s.dur });
  if (edit.fxSound !== false) {
    for (const fx of fxs) {
      if (!fx.def.sfx || fx.sound === false || /^(off|false|no|0)$/i.test(String(fx.sound))) continue;
      const p = Object.assign(K.coerce(fx.def.params || {}, fx), { at: fx.at, dur: fx.dur, ticks: fx.ticks });
      for (const s of fx.def.sfx(p)) ev.push({ name: s.name, at: fx.at + s.t, gain: s.gain, dur: s.dur });
    }
  }
  return ev;
}

/** Everything the render needs, derived from the edit. */
async function prepare(p, opts, log) {
  const pr = await P.info(p);
  const edit = P.loadEdit(p);
  const K = catalog.load();
  const fps = pickFps(pr, opts.fps);
  const cap = opts.draft ? 540 : opts.max || 1080;
  const sc = Math.min(1, cap / Math.min(pr.width, pr.height));
  const W = U.even(pr.width * sc), H = U.even(pr.height * sc);
  const fxs = normaliseEffects(edit, pr.duration);
  if (edit.captions && !K.captions[edit.captions.style]) U.fail(`Unknown caption style "${edit.captions.style}". Run: kkv list captions`);

  const layerFx = fxs.filter((f) => f.def.mount);
  const needMatte = layerFx.some((f) => f.def.needs && f.def.needs.matte);
  const needTrack = needMatte || fxs.some((f) => f.def.needs && f.def.needs.track && !(f.def.kind === 'camera' && String(f.target || f.def.params.target) === 'center'));
  const wantsTrack = (f) => (f.def.mount ? f.def.needs && (f.def.needs.matte || f.def.needs.track) : f.def.needs && f.def.needs.track && String(f.target || f.def.params.target) !== 'center');
  const need = fxs.filter(wantsTrack).map((f) => [f.at - 0.3, f.at + f.dur + 0.3]);
  let track = needTrack ? await ensureTrack(p, pr, fps, log, need) : null;
  if (!track && layerFx.length && fs.existsSync(p.trackPath)) { // already tracked earlier: use it so overlays can keep clear of the face
    try { const t = JSON.parse(fs.readFileSync(p.trackPath, 'utf8')); if (t.stamp === pr.stamp) track = t; } catch (_) { /* ignore */ }
  }
  const camera = cameraCues(fxs, track);

  const comp = {
    W, H, fps, duration: pr.duration,
    captions: edit.captions && edit.captions.lines && edit.captions.lines.length ? edit.captions : null,
    effects: layerFx.map((f) => { const o = Object.assign({}, f); delete o.def; return o; }),
    camera,
    track: track ? { fps: track.fps, face: track.face, top: track.top } : null,
  };
  // file-valued params (images) → file:// URLs the page can load
  for (const fx of comp.effects) {
    const def = K.effects[fx.type];
    for (const key of def.fileParams || []) {
      if (typeof fx[key] !== 'string') continue;
      fx[key] = fx[key].split('|').map((item) => {
        const m = item.trim().match(/^img:(.+)$/i);
        if (!m || /^(https?|file|data):/i.test(m[1])) return item;
        const abs = path.resolve(path.dirname(p.video), m[1].trim());
        if (!fs.existsSync(abs)) U.fail(`Image not found for ${fx.type}: ${m[1]}`);
        return 'img:' + require('url').pathToFileURL(abs).href;
      }).join('|');
    }
  }
  return { pr, edit, fps, W, H, fxs, camera, comp, needMatte, grades: fxs.filter((f) => f.def.kind === 'grade'), events: soundEvents(edit, fxs) };
}

function buildFfmpeg(p, R, { from, frames, front, back, sfxPath, out, still, draft, hasZscale }) {
  const { pr, fps, W, H, camera, grades } = R;
  const K = catalog.load();
  const f0 = Math.round(from * fps);
  const tx = from > 0 ? `(t+${n(from)})` : 't';
  const T = `((on+${f0})/${fps})`;
  const args = [];
  const seek = from > 0 ? ['-ss', n(from)] : [];
  let idx = 0;
  args.push(...seek, '-i', p.video); const iMain = idx++;
  let iFront = -1, iBack = -1, iMatte = -1, iSfx = -1;
  if (front) { args.push('-i', front); iFront = idx++; }
  if (back) { args.push('-i', back); iBack = idx++; args.push(...seek, '-i', p.mattePath); iMatte = idx++; }
  if (sfxPath && !still) { args.push('-i', sfxPath); iSfx = idx++; }

  const cams = camera.map((c) => `${Camera.ffPerspective(c, T)}:enable='gte(${tx},${n(c.at)})*lt(${tx},${n(c.at + c.dur)})'`);
  const base = [];
  if (pr.hdr && hasZscale) base.push(HDR_CHAIN);
  base.push(`fps=${fps}`, `scale=${W}:${H}:flags=bicubic`, 'setsar=1', 'format=yuv420p');
  for (const g of grades) {
    const look = K.looks[String(g.look || g.def.params.look)] || K.looks.moody;
    for (const f of look) base.push(`${f}:enable='gte(${tx},${n(g.at)})*lt(${tx},${n(g.at + g.dur)})'`);
  }
  base.push(...cams);

  const parts = [];
  const layerFmt = `scale=${W}:${H}:flags=bicubic:out_color_matrix=bt709:out_range=tv,format=yuva420p`;
  let cur;
  if (back) {
    parts.push(`[${iMain}:v]${base.join(',')},split[b1][b2]`);
    const blur = Math.max(0.6, (1.3 * Math.min(W, H)) / 1080);
    parts.push(`[${iMatte}:v]${[`fps=${fps}`, `scale=${W}:${H}:flags=bicubic`, 'format=yuv420p', ...cams, 'format=gray', `lut=y='clip((val-30)*1.28,0,255)'`, `gblur=sigma=${n(blur)}`].join(',')}[m]`);
    parts.push('[b2][m]alphamerge[person]');
    parts.push(`[${iBack}:v]${layerFmt}[bk]`);
    parts.push('[b1][bk]overlay=format=yuv420:eof_action=pass[bb]');
    parts.push('[bb][person]overlay=format=yuv420[cc]');
    cur = '[cc]';
  } else {
    parts.push(`[${iMain}:v]${base.join(',')}[cc]`);
    cur = '[cc]';
  }
  if (front) {
    parts.push(`[${iFront}:v]${layerFmt}[fr]`);
    parts.push(`${cur}[fr]overlay=format=yuv420:eof_action=pass[ff]`);
    cur = '[ff]';
  }
  parts.push(`${cur}format=yuv420p[vout]`);

  const maps = ['-map', '[vout]'];
  let audio = [];
  if (!still) {
    if (iSfx >= 0 && pr.hasAudio) {
      parts.push(`[${iMain}:a]aresample=48000[a0];[${iSfx}:a]aresample=48000[sx];[a0][sx]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95:level=0[aout]`);
      maps.push('-map', '[aout]'); audio = ['-c:a', 'aac', '-b:a', '192k'];
    } else if (iSfx >= 0) { maps.push('-map', `${iSfx}:a`); audio = ['-c:a', 'aac', '-b:a', '192k']; }
    else if (pr.hasAudio) {
      maps.push('-map', `${iMain}:a:0`);
      audio = from === 0 && /^(aac|mp3)$/.test(pr.acodec || '') ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '192k'];
    }
  }
  args.push('-filter_complex', parts.join(';'), ...maps);
  if (still) args.push('-frames:v', '1', '-q:v', '3', '-update', '1', out);
  else {
    args.push('-t', n(frames / fps), '-r', String(fps), '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'medium', '-crf', draft ? '27' : '18', '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', ...audio, '-movflags', '+faststart', out);
  }
  return args;
}

let zscaleCache = null;
async function hasZscale() {
  if (zscaleCache == null) { const r = await U.run('ffmpeg', ['-hide_banner', '-filters'], { allowFail: true }); zscaleCache = / zscale /.test(r.stdout) && / tonemap /.test(r.stdout); }
  return zscaleCache;
}

/** Full (or partial) render to an mp4. */
async function render(p, opts = {}, log = () => {}) {
  const R = await prepare(p, opts, log);
  const { pr, fps } = R;
  const from = Math.round(clamp(opts.from == null ? 0 : opts.from, 0, pr.duration) * fps) / fps;
  const to = clamp(opts.to == null ? pr.duration : opts.to, from + 1 / fps, pr.duration);
  const count = Math.max(1, Math.round((to - from) * fps));
  const f0 = Math.round(from * fps);
  const tmp = path.join(p.dir, 'tmp');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  try {
    if (pr.hdr && !(await hasZscale())) log('Note: this is an HDR clip and this ffmpeg cannot tone-map it; colours may look washed out. Re-export it as SDR for best results.');
    const frames = Array.from({ length: count }, (_, i) => f0 + i);
    let lastPct = -1;
    const t0 = Date.now();
    const layers = await renderLayers({
      comp: R.comp, frames, outDir: tmp, mode: 'video',
      onProgress: (d, tot) => { const pct = Math.floor((d / tot) * 10) * 10; if (pct !== lastPct) { lastPct = pct; log(`  graphics ${pct}%`); } },
    });
    const events = R.events.map((e) => Object.assign({}, e, { at: e.at - from })).filter((e) => e.at > -2 && e.at < count / fps);
    let sfxPath = null;
    if (events.length) {
      const m = sfx.mix(events, count / fps);
      if (m.used) { sfxPath = path.join(tmp, 'sfx.wav'); fs.writeFileSync(sfxPath, sfx.wav(m.samples)); }
    }
    const out = path.resolve(opts.out || path.join(path.dirname(p.video), `${p.base}_kkverse${opts.draft ? '_draft' : ''}.mp4`));
    if (out === p.video) U.fail('The output would overwrite the original video. Choose another name with -o.');
    log(`Compositing ${count} frames at ${R.W}×${R.H}, ${fps} fps…`);
    await U.ffmpeg(buildFfmpeg(p, R, { from, frames: count, front: layers.front, back: layers.back, sfxPath, out, draft: opts.draft, hasZscale: await hasZscale() }));
    return { out, frames: count, fps, W: R.W, H: R.H, seconds: (Date.now() - t0) / 1000, sounds: events.length, layers: { front: !!layers.front, back: !!layers.back } };
  } finally {
    if (!opts.keepTmp) fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Composite single frames at the given times and tile them into one check sheet. */
async function stills(p, times, opts = {}, log = () => {}) {
  const R = await prepare(p, Object.assign({ max: 720 }, opts), log);
  const { pr, fps } = R;
  const dir = path.join(p.dir, 'frames');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const idxs = times.map((t) => clamp(Math.round(t * fps), 0, Math.max(0, Math.round(pr.duration * fps) - 1)));
  const uniq = Array.from(new Set(idxs)).sort((a, b) => a - b);
  const layers = await renderLayers({ comp: R.comp, frames: uniq, outDir: dir, mode: 'stills' });
  const zs = await hasZscale();
  const files = [];
  for (const idx of idxs) {
    const out = path.join(dir, `frame_${(idx / fps).toFixed(2)}s.jpg`);
    const st = layers.stills[idx] || {};
    await U.ffmpeg(buildFfmpeg(p, R, { from: idx / fps, frames: 1, front: st.front || null, back: st.back || null, out, still: true, hasZscale: zs }));
    files.push(out);
  }
  let sheet = files[0];
  if (files.length > 1) {
    sheet = path.join(dir, 'sheet.jpg');
    const h = 800;
    const ins = files.flatMap((f) => ['-i', f]);
    const sc = files.map((_, i) => `[${i}:v]scale=-2:${h},pad=iw+8:ih:4:0:black[s${i}]`).join(';');
    await U.ffmpeg([...ins, '-filter_complex', `${sc};${files.map((_, i) => `[s${i}]`).join('')}hstack=inputs=${files.length}[o]`, '-map', '[o]', '-q:v', '3', '-update', '1', sheet]);
  }
  for (const f of fs.readdirSync(dir)) if (/^(front|back)_\d+\.png$/.test(f)) fs.rmSync(path.join(dir, f));
  return { sheet, files, times: idxs.map((i) => i / fps) };
}

module.exports = { render, stills, prepare, ensureTrack, pickFps, normaliseEffects, soundEvents };
