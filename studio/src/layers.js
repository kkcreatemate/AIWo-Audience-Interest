'use strict';
/* Renders the motion layers (captions + effects) in headless Chrome, one transparent PNG per
 * video frame, and hands them to ffmpeg. Frames that look identical to the previous one are
 * reused instead of re-captured, and several pages work in parallel. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { ROOT, fail } = require('./util');
const catalog = require('./catalog');

const FONT_CSS = [
  ['anton', ['400']], ['archivo-black', ['400']], ['baloo-2', ['500', '700', '800']],
  ['dm-sans', ['400', '500', '700']], ['dm-serif-display', ['400', '400-italic']],
  ['inter', ['400', '600', '800', '900']], ['kalam', ['400', '700']],
  ['noto-sans-devanagari', ['400', '700', '900']], ['space-mono', ['400', '700']],
];

function fontAssets() {
  const base = path.join(ROOT, 'node_modules', '@fontsource');
  if (!fs.existsSync(base)) fail('Fonts are not installed yet. Run the one-time setup: bash studio/setup.sh');
  const urls = [];
  for (const [pkg, files] of FONT_CSS) for (const f of files) {
    const p = path.join(base, pkg, f + '.css');
    if (fs.existsSync(p)) urls.push(pathToFileURL(p).href);
  }
  // Heavy Devanagari that answers at weight 400, so Hindi words stay bold next to single-weight display faces.
  const deva = path.join(base, 'baloo-2', 'files', 'baloo-2-devanagari-800-normal.woff2');
  const alias = fs.existsSync(deva)
    ? `@font-face{font-family:'KKV Deva Heavy';src:url('${pathToFileURL(deva).href}') format('woff2');font-weight:400;font-style:normal;unicode-range:U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+25CC,U+A830-A839,U+A8E0-A8FF;}`
    : '';
  return { urls, alias };
}

async function launchBrowser() {
  let pw = null;
  for (const name of ['playwright', 'playwright-core']) { try { pw = require(name); break; } catch (_) { /* next */ } }
  if (!pw) fail('The browser driver is missing. Run the one-time setup: bash studio/setup.sh');
  const args = ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text', '--hide-scrollbars', '--allow-file-access-from-files'];
  const attempts = [{}];
  if (process.env.KKV_BROWSER) attempts.unshift({ executablePath: process.env.KKV_BROWSER });
  attempts.push({ channel: 'chrome' }, { channel: 'msedge' });
  for (const p of ['/opt/pw-browsers/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (fs.existsSync(p)) attempts.push({ executablePath: p });
  }
  let last = null;
  for (const a of attempts) {
    try { return await pw.chromium.launch(Object.assign({ headless: true, args }, a)); } catch (e) { last = e; }
  }
  fail('Could not start a browser to draw the graphics. Install Google Chrome, or run: npx playwright-core install chromium\n' + String(last && last.message).split('\n')[0]);
}

async function openPage(browser, comp) {
  const context = await browser.newContext({ viewport: { width: comp.W, height: comp.H }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(catalog.WEB, 'render.html')).href);
  const fonts = fontAssets();
  for (const url of fonts.urls) await page.addStyleTag({ url });
  if (fonts.alias) await page.addStyleTag({ content: fonts.alias });
  const files = catalog.webFiles();
  for (const f of [...files.lib, files.runtime, ...files.modules]) await page.addScriptTag({ path: f });
  const meta = await page.evaluate((c) => window.KKV.init(c), comp);
  if (errors.length) fail('Graphics error: ' + errors[0]);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  const shot = async () => Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })).data, 'base64');
  return { page, context, shot, meta, errors, last: { front: { sig: null, buf: null }, back: { sig: null, buf: null } } };
}

/** ffmpeg process that receives PNG frames on stdin and stores them as a video with alpha. */
function pngSink(file, fps) {
  const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', 'pipe:0', '-c:v', 'copy', '-f', 'mov', file], { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  child.stderr.on('data', (d) => { err += d; });
  child.stdin.on('error', () => { /* surfaced on close */ });
  const closed = new Promise((res, rej) => child.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg (layer) failed: ' + err.trim().split('\n').slice(-4).join(' | '))))));
  return {
    write: (b) => (child.stdin.write(b) ? null : new Promise((r) => child.stdin.once('drain', r))),
    end: () => { child.stdin.end(); return closed; },
  };
}

/**
 * @param comp    composition for the page (see compose.js)
 * @param frames  absolute frame indices to draw (time = index / comp.fps)
 * @param mode    'video' → front.mov/back.mov · 'stills' → front_<i>.png/back_<i>.png
 * @returns {{front:string|null, back:string|null, stills?:object}}
 */
async function renderLayers({ comp, frames, outDir, mode = 'video', workers, onProgress }) {
  const hasCaps = comp.captions && comp.captions.lines && comp.captions.lines.length;
  const K = catalog.load();
  const layerFx = (comp.effects || []).filter((fx) => K.effects[fx.type] && K.effects[fx.type].mount);
  if (!hasCaps && !layerFx.length) return { front: null, back: null, stills: {} };
  const wantBack = layerFx.some((fx) => K.effects[fx.type].back);
  const layers = wantBack ? ['front', 'back'] : ['front'];

  const n = Math.max(1, Math.min(workers || Math.max(1, Math.min(4, os.cpus().length)), Math.ceil(frames.length / 12)));
  const browser = await launchBrowser();
  try {
    const pool = await Promise.all(Array.from({ length: n }, () => openPage(browser, comp)));
    await pool[0].page.evaluate(() => window.KKV.show('none'));
    const EMPTY = await pool[0].shot();

    const paths = { front: path.join(outDir, 'front.mov'), back: wantBack ? path.join(outDir, 'back.mov') : null };
    const sinks = mode === 'video' ? { front: pngSink(paths.front, comp.fps), back: wantBack ? pngSink(paths.back, comp.fps) : null } : null;
    const stills = {};
    const any = { front: false, back: false };

    const BLOCK = 16;
    const blocks = [];
    for (let i = 0; i < frames.length; i += BLOCK) blocks.push(frames.slice(i, i + BLOCK));
    const done = new Map();
    let next = 0, writeAt = 0, written = 0, chain = Promise.resolve();

    const drawBlock = async (w, idxs) => {
      const out = [];
      for (const idx of idxs) {
        const sig = await w.page.evaluate((t) => window.KKV.seek(t), idx / comp.fps);
        const fr = { idx };
        for (const layer of layers) {
          const s = sig[layer];
          if (s == null) { fr[layer] = EMPTY; continue; }
          any[layer] = true;
          if (w.last[layer].sig === s) { fr[layer] = w.last[layer].buf; continue; }
          await w.page.evaluate((l) => window.KKV.show(l), layer);
          const b = await w.shot();
          w.last[layer] = { sig: s, buf: b };
          fr[layer] = b;
        }
        out.push(fr);
      }
      if (w.errors.length) throw new Error('Graphics error: ' + w.errors[0]);
      return out;
    };
    const flush = async () => {
      while (done.has(writeAt)) {
        const block = done.get(writeAt); done.delete(writeAt); writeAt++;
        for (const fr of block) {
          for (const layer of layers) {
            if (mode === 'video') { const p = sinks[layer].write(fr[layer]); if (p) await p; }
            else if (fr[layer] !== EMPTY) { const f = path.join(outDir, `${layer}_${fr.idx}.png`); fs.writeFileSync(f, fr[layer]); (stills[fr.idx] = stills[fr.idx] || {})[layer] = f; }
          }
          written++;
        }
        if (onProgress) onProgress(written, frames.length);
      }
    };
    const loop = async (w) => {
      for (;;) {
        const b = next++;
        if (b >= blocks.length) return;
        while (b - writeAt > n * 3) await new Promise((r) => setTimeout(r, 15)); // keep memory bounded
        done.set(b, await drawBlock(w, blocks[b]));
        chain = chain.then(flush);
        await chain;
      }
    };
    await Promise.all(pool.map(loop));
    await chain;
    if (mode === 'video') {
      await sinks.front.end();
      if (sinks.back) await sinks.back.end();
      if (!any.front) { fs.rmSync(paths.front, { force: true }); paths.front = null; }
      if (wantBack && !any.back) { fs.rmSync(paths.back, { force: true }); paths.back = null; }
      return { front: paths.front, back: paths.back, stills };
    }
    return { front: null, back: null, stills };
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = { renderLayers, launchBrowser, openPage, fontAssets };
