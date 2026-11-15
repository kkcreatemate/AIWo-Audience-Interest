'use strict';
/* A project is one video plus a `<name>.kkv/` folder next to it holding the transcript,
 * the edit (edit.json) and cached tracking data. Nothing ever modifies the original video. */
const fs = require('fs');
const path = require('path');
const { fail, probe, round } = require('./util');
const { buildLines, norm } = require('./lines');
const catalog = require('./catalog');

function open(videoArg) {
  if (!videoArg) fail('Give me the video file, e.g. kkv words my-clip.mp4');
  const video = path.resolve(videoArg);
  if (!fs.existsSync(video)) fail(`Video not found: ${videoArg}`);
  const base = path.basename(video).replace(/\.[^.]+$/, '');
  const dir = path.join(path.dirname(video), base + '.kkv');
  fs.mkdirSync(dir, { recursive: true });
  const p = {
    video, base, dir,
    wordsPath: path.join(dir, 'words.json'),
    editPath: path.join(dir, 'edit.json'),
    audioPath: path.join(dir, 'audio.wav'),
    mattePath: path.join(dir, 'matte.mp4'),
    trackPath: path.join(dir, 'track.json'),
    probePath: path.join(dir, 'probe.json'),
  };
  return p;
}

async function info(p) {
  const st = fs.statSync(p.video);
  const stamp = `${st.size}:${Math.round(st.mtimeMs)}`;
  if (fs.existsSync(p.probePath)) {
    try { const c = JSON.parse(fs.readFileSync(p.probePath, 'utf8')); if (c.stamp === stamp) return c; } catch (_) { /* re-probe */ }
  }
  const pr = Object.assign(await probe(p.video), { stamp });
  fs.writeFileSync(p.probePath, JSON.stringify(pr, null, 2));
  return pr;
}

const blankEdit = () => ({ version: 1, captions: null, effects: [], sfx: [], fxSound: true });
function loadEdit(p) {
  if (!fs.existsSync(p.editPath)) return blankEdit();
  try { return Object.assign(blankEdit(), JSON.parse(fs.readFileSync(p.editPath, 'utf8'))); }
  catch (e) { fail(`edit.json is not valid JSON (${e.message}). Fix it or run: kkv reset "${p.video}"`); }
}
const saveEdit = (p, edit) => fs.writeFileSync(p.editPath, JSON.stringify(edit, null, 2) + '\n');

function loadWords(p, required = true) {
  if (!fs.existsSync(p.wordsPath)) {
    if (required) fail(`No transcript yet. Run: kkv words "${p.video}"`);
    return null;
  }
  const j = JSON.parse(fs.readFileSync(p.wordsPath, 'utf8'));
  return Array.isArray(j) ? { language: '', words: j } : j;
}
const saveWords = (p, w) => fs.writeFileSync(p.wordsPath, JSON.stringify(w, null, 1) + '\n');

/* ---------- phrases and time specs ---------- */
function findPhrase(words, phrase, nth = 1) {
  const want = String(phrase).split(/\s+/).map(norm).filter(Boolean);
  if (!want.length) return null;
  let seen = 0;
  for (let i = 0; i + want.length <= words.length; i++) {
    if (want.every((k, j) => norm(words[i + j].w) === k)) { if (++seen === nth) return { i, n: want.length, s: words[i].s, e: words[i + want.length - 1].e }; }
  }
  return null;
}

/**
 * Time spec → seconds.  12.5 · 1:05.2 · start · end · end-2 · @phrase · @phrase#2 · @phrase> (end of phrase) · @phrase+0.3
 */
function resolveTime(spec, words, duration, what = 'time') {
  if (typeof spec === 'number') return spec;
  const s = String(spec).trim();
  let m;
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  if ((m = s.match(/^(\d+):(\d+(?:\.\d+)?)$/))) return parseInt(m[1], 10) * 60 + parseFloat(m[2]);
  if ((m = s.match(/^(start|end)\s*([+-]\s*\d+(?:\.\d+)?)?$/i))) {
    const base = m[1].toLowerCase() === 'end' ? duration : 0;
    return base + (m[2] ? parseFloat(m[2].replace(/\s+/g, '')) : 0);
  }
  if (s[0] === '@') {
    m = s.slice(1).match(/^(.*?)(?:#(\d+))?(>)?(?:([+-]\d+(?:\.\d+)?))?$/);
    const phrase = m[1].trim().replace(/^["']|["']$/g, '');
    if (!words) fail(`"${s}" needs a transcript. Run kkv words first.`);
    const hit = findPhrase(words, phrase, m[2] ? parseInt(m[2], 10) : 1);
    if (!hit) fail(`Could not find "${phrase}"${m[2] ? ' (occurrence ' + m[2] + ')' : ''} in the transcript. Run kkv text to see the exact words.`);
    return round((m[3] ? hit.e : hit.s) + (m[4] ? parseFloat(m[4]) : 0));
  }
  fail(`Could not read ${what} "${spec}". Use seconds (3.2), m:ss (1:05), start/end/end-2, or "@a phrase from the video".`);
}

/* ---------- captions ---------- */
function rebuildCaptions(p, edit, words) {
  const cap = edit.captions;
  if (!cap) return null;
  if (cap.locked) return cap;
  const def = catalog.load().captions[cap.style];
  if (!def) fail(`Unknown caption style "${cap.style}". Run: kkv list captions`);
  const d = def.defaults || {};
  cap.lines = buildLines(words, {
    maxChars: cap.maxChars || d.maxChars, maxWords: cap.maxWords || d.maxWords,
    keys: cap.keys || [], autoKey: cap.autoKey !== false && !(cap.keys && cap.keys.length && cap.autoKey !== true),
    keepPunct: !!cap.keepPunct,
  });
  return cap;
}

/** Replace a phrase everywhere in the transcript, spreading the timing over the new words. */
function fixWords(wordsDoc, from, to) {
  const words = wordsDoc.words;
  const want = from.split(/\s+/).map(norm).filter(Boolean);
  const repl = to.trim().split(/\s+/).filter(Boolean);
  if (!want.length) return 0;
  let count = 0;
  for (let i = 0; i + want.length <= words.length; i++) {
    if (!want.every((k, j) => norm(words[i + j].w) === k)) continue;
    const s = words[i].s, e = words[i + want.length - 1].e;
    const trail = (String(words[i + want.length - 1].w).match(/[,.;:?!।…]+$/u) || [''])[0];
    const total = repl.reduce((a, r) => a + Array.from(r).length, 0) || 1;
    let t = s;
    const out = repl.map((r, k) => {
      const d = ((e - s) * Array.from(r).length) / total;
      const w = { w: r + (k === repl.length - 1 && !/[,.;:?!।…]$/u.test(r) ? trail : ''), s: round(t), e: round(t + d) };
      t += d;
      return w;
    });
    words.splice(i, want.length, ...out);
    i += out.length - 1;
    count++;
  }
  return count;
}

module.exports = { open, info, loadEdit, saveEdit, loadWords, saveWords, findPhrase, resolveTime, rebuildCaptions, fixWords, blankEdit };
