'use strict';
/* kkv · the KK Verse Studio command line. Claude drives this from the /kk-* skills;
 * it is also perfectly usable by hand. Run `kkv help`. */
const fs = require('fs');
const path = require('path');
const U = require('./util');
const P = require('./project');
const catalog = require('./catalog');
const sfx = require('./sfx');

const log = (s = '') => console.log(s);

function parse(argv) {
  const pos = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o') { flags.out = argv[++i]; continue; }
    if (a.startsWith('--') && a.length > 2) {
      const eq = a.indexOf('=');
      if (eq > 0) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
      const k = a.slice(2), nx = argv[i + 1];
      if (nx === undefined || (nx.startsWith('--') && nx.length > 2) || nx === '-o') flags[k] = true;
      else { flags[k] = nx; i++; }
      continue;
    }
    pos.push(a);
  }
  return { pos, flags };
}
const num = (v, name) => { const x = parseFloat(v); if (!Number.isFinite(x)) U.fail(`--${name} needs a number, got "${v}"`); return x; };
const camel = (k) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/* ───────────── words ───────────── */
async function transcribe(p, flags) {
  const py = U.venvPython();
  if (!py) U.fail('The speech tools are not installed yet. Run the one-time setup: bash studio/setup.sh');
  log('Listening to the audio…');
  await U.ffmpeg(['-i', p.video, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', p.audioPath]).catch(() => U.fail('This video has no audio track to transcribe.'));
  const args = [path.join(U.ROOT, 'py', 'transcribe.py'), p.audioPath, p.wordsPath, '--model', String(flags.model || process.env.KKV_WHISPER_MODEL || 'small'), '--lang', String(flags.lang || 'auto')];
  if (flags.prompt) args.push('--prompt', String(flags.prompt));
  await U.run(py, args, { onStderr: (d) => { for (const ln of String(d).split('\n')) if (ln.includes('…')) log(ln); } });
  fs.rmSync(p.audioPath, { force: true });
  return P.loadWords(p);
}

function printTranscript(doc) {
  const words = doc.words;
  let line = [], start = 0;
  const flush = () => { if (line.length) log(`  ${U.fmtT(start).padStart(7)}  ${line.join(' ')}`); line = []; };
  words.forEach((w, i) => {
    if (!line.length) start = w.s;
    line.push(w.w);
    const nx = words[i + 1];
    if (line.length >= 12 || /[.?!।]$/u.test(w.w) || (nx && nx.s - w.e > 0.7)) flush();
  });
  flush();
}

async function cmdWords(p, flags) {
  let doc = P.loadWords(p, false);
  if (flags.import) {
    const j = JSON.parse(fs.readFileSync(path.resolve(String(flags.import)), 'utf8'));
    const arr = Array.isArray(j) ? j : j.words;
    if (!Array.isArray(arr)) U.fail('--import expects JSON: [{"w":"word","s":0.1,"e":0.4}, …] or {"words":[…]}');
    doc = { language: j.language || '', words: arr.map((w) => ({ w: String(w.w != null ? w.w : w.word != null ? w.word : w.text).trim(), s: +(w.s != null ? w.s : w.start), e: +(w.e != null ? w.e : w.end) })) };
    P.saveWords(p, doc);
  } else if (!doc || flags.force) doc = await transcribe(p, flags);
  else log('(using the saved transcript; add --force to listen again)');
  const edit = P.loadEdit(p);
  if (edit.captions) { P.rebuildCaptions(p, edit, doc.words); P.saveEdit(p, edit); }
  const last = doc.words[doc.words.length - 1];
  log(`\nLanguage: ${doc.language || '?'} · ${doc.words.length} words · speech ends at ${last ? U.fmtT(last.e) : '0'}s\n`);
  printTranscript(doc);
  log(`\nTranscript: ${p.wordsPath}`);
  log('Read it for mistakes (names, brands, numbers). Fix with: kkv fix <video> "wrong words=right words"');
}

async function cmdText(p) {
  const doc = P.loadWords(p);
  const edit = P.loadEdit(p);
  if (edit.captions && edit.captions.lines) {
    log(`Captions · style ${edit.captions.style} · ${edit.captions.lines.length} lines (*key words*)\n`);
    edit.captions.lines.forEach((ln, i) => log(`  ${String(i + 1).padStart(3)}  ${U.fmtT(ln.words[0].s).padStart(7)}  ${ln.words.map((w) => (w.key ? `*${w.w}*` : w.w)).join(' ')}`));
  } else printTranscript(doc);
}

async function cmdFix(p, pos) {
  const doc = P.loadWords(p);
  if (!pos.length) U.fail('Usage: kkv fix <video> "wrong words=right words" ["another=fix" …]');
  for (const pair of pos) {
    const i = pair.indexOf('=');
    if (i < 1) U.fail(`"${pair}" should look like "wrong=right"`);
    const c = P.fixWords(doc, pair.slice(0, i), pair.slice(i + 1));
    log(`  ${c ? '✓' : '·'} "${pair.slice(0, i)}" → "${pair.slice(i + 1)}"  (${c} place${c === 1 ? '' : 's'})`);
  }
  P.saveWords(p, doc);
  const edit = P.loadEdit(p);
  if (edit.captions) { P.rebuildCaptions(p, edit, doc.words); P.saveEdit(p, edit); log('Captions rebuilt with the corrected words.'); }
}

/* ───────────── captions ───────────── */
async function cmdCaptions(p, pos, flags) {
  const K = catalog.load();
  const edit = P.loadEdit(p);
  const style = pos[0] || flags.style || (edit.captions && edit.captions.style);
  if (style === 'off' || style === 'none') { edit.captions = null; P.saveEdit(p, edit); return log('Captions removed.'); }
  if (!style) U.fail('Which style? e.g. kkv captions <video> kk-pop   (see: kkv list captions)');
  if (!K.captions[style]) U.fail(`No caption style called "${style}". Available: ${Object.keys(K.captions).join(', ')}`);
  let doc = P.loadWords(p, false);
  if (!doc) doc = await transcribe(p, flags);
  const cap = edit.captions && !flags.fresh ? edit.captions : {};
  if (cap.style !== style) { delete cap.maxChars; delete cap.maxWords; delete cap.accent; delete cap.y; }
  cap.style = style;
  for (const [flag, key, isNum] of [['y', 'y', 1], ['scale', 'scale', 1], ['max-chars', 'maxChars', 1], ['max-words', 'maxWords', 1], ['accent', 'accent', 0], ['label', 'label', 0]]) {
    if (flags[flag] != null && flags[flag] !== true) cap[key] = isNum ? num(flags[flag], flag) : String(flags[flag]);
  }
  if (flags.key != null) cap.keys = flags.key === true ? [] : String(flags.key).split(',').map((s) => s.trim()).filter(Boolean);
  if (flags['auto-key']) cap.autoKey = true;
  if (flags['no-auto-key'] || flags['no-key']) { cap.autoKey = false; if (flags['no-key']) cap.keys = []; }
  if (flags['keep-punct']) cap.keepPunct = true;
  if (flags.unlock) delete cap.locked;
  edit.captions = cap;
  P.rebuildCaptions(p, edit, doc.words);
  P.saveEdit(p, edit);
  const d = K.captions[style].defaults || {};
  log(`Captions set: ${style} · ${cap.lines.length} lines · y=${cap.y == null ? d.y : cap.y} · accent ${cap.accent || d.accent}${cap.locked ? ' · LOCKED (hand-edited lines kept)' : ''}\n`);
  cap.lines.forEach((ln, i) => log(`  ${String(i + 1).padStart(3)}  ${U.fmtT(ln.words[0].s).padStart(7)}  ${ln.words.map((w) => (w.key ? `*${w.w}*` : w.w)).join(' ')}`));
  log('\n*starred* words are highlighted. Choose your own with --key "word,another phrase" (or --no-key for none).');
}

/* ───────────── effects ───────────── */
const fxLine = (fx, i) => {
  const extra = Object.keys(fx).filter((k) => !['type', 'at', 'dur'].includes(k)).map((k) => `${k}=${JSON.stringify(fx[k])}`).join(' ');
  return `  ${String(i + 1).padStart(2)}  ${fx.type.padEnd(12)} at ${U.fmtT(+fx.at).padStart(6)}  for ${fx.dur ? U.fmtT(+fx.dur) + 's' : 'whole video'}  ${extra}`;
};

async function cmdFx(p, pos, flags) {
  const K = catalog.load();
  const edit = P.loadEdit(p);
  const pr = await P.info(p);
  const sub = pos[0] || 'list';
  const doc = P.loadWords(p, false);
  const words = doc ? doc.words : null;
  const T = (spec, what) => P.resolveTime(spec, words, pr.duration, what);

  if (sub === 'list') {
    if (!edit.effects.length) return log('No effects yet. Add one: kkv fx <video> add punch-in --at "@a phrase"');
    return edit.effects.forEach((fx, i) => log(fxLine(fx, i)));
  }
  if (sub === 'clear') { edit.effects = []; P.saveEdit(p, edit); return log('All effects removed.'); }
  if (sub === 'rm') {
    const i = parseInt(pos[1], 10) - 1;
    if (!(i >= 0 && i < edit.effects.length)) U.fail(`Give the effect number from "kkv fx <video> list" (1–${edit.effects.length}).`);
    const [gone] = edit.effects.splice(i, 1);
    P.saveEdit(p, edit); return log(`Removed ${gone.type}.`);
  }
  let fx, def;
  if (sub === 'add') {
    def = K.effects[pos[1]];
    if (!def) U.fail(`No effect called "${pos[1] || ''}". Available: ${Object.keys(K.effects).join(', ')}`);
    fx = { type: pos[1], at: 0, dur: def.dur || 0 };
    if (flags.at == null && def.dur !== 0) U.fail(`When should ${pos[1]} happen? Add --at 3.2 or --at "@phrase from the video".`);
    edit.effects.push(fx);
  } else if (sub === 'set') {
    const i = parseInt(pos[1], 10) - 1;
    fx = edit.effects[i];
    if (!fx) U.fail(`Give the effect number from "kkv fx <video> list" (1–${edit.effects.length}).`);
    def = K.effects[fx.type];
  } else U.fail('Usage: kkv fx <video> add <effect> --at … | list | set <n> … | rm <n> | clear');

  if (flags.at != null) fx.at = U.round(Math.max(0, T(flags.at, '--at')));
  if (fx.at >= pr.duration) U.fail(`--at ${U.fmtT(fx.at)}s is past the end of the video (${U.fmtT(pr.duration)}s long).`);
  if (flags.until != null) fx.dur = U.round(T(flags.until, '--until') - fx.at);
  if (flags.dur != null) fx.dur = num(flags.dur, 'dur');
  if (fx.dur < 0) U.fail('--until must be after --at.');
  const allowed = new Set([...Object.keys(def.params || {}), ...(def.timeParams || []), 'sound']);
  for (const [rawKey, v] of Object.entries(flags)) {
    const k = camel(rawKey);
    if (['at', 'until', 'dur'].includes(k)) continue;
    if (!allowed.has(k)) U.fail(`${fx.type} has no option --${rawKey}. Options: ${[...allowed].map((x) => '--' + x).join(' ')}`);
    if ((def.timeParams || []).includes(k)) fx[k] = String(v).split(',').map((s) => U.round(T(s.trim(), '--' + rawKey) - fx.at));
    else if (k === 'sound') fx.sound = !/^(off|false|no|0)$/i.test(String(v));
    else fx[k] = typeof (def.params || {})[k] === 'number' ? num(v, rawKey) : v === true ? true : String(v);
  }
  edit.effects.sort((a, b) => a.at - b.at);
  P.saveEdit(p, edit);
  log(`${sub === 'add' ? 'Added' : 'Updated'}:`);
  log(fxLine(fx, edit.effects.indexOf(fx)));
  if (def.needs && def.needs.matte) log('  (sits behind you: the first render will take a little longer while it finds you in the frame)');
}

/* ───────────── sound ───────────── */
async function cmdSfx(p, pos, flags) {
  const edit = P.loadEdit(p);
  const pr = await P.info(p);
  const sub = pos[0] || 'list';
  const doc = P.loadWords(p, false);
  const words = doc ? doc.words : null;
  if (sub === 'list') {
    log(`Effect sounds: ${edit.fxSound === false ? 'OFF' : 'on'} (toggle: kkv sfx <video> fx on|off)`);
    if (!edit.sfx.length) return log('No extra sounds placed.');
    return edit.sfx.forEach((s, i) => log(`  ${String(i + 1).padStart(2)}  ${s.name.padEnd(9)} at ${U.fmtT(s.at).padStart(6)}  ${s.gain == null ? -10 : s.gain} dB${s.dur ? '  dur ' + s.dur : ''}`));
  }
  if (sub === 'clear') { edit.sfx = []; P.saveEdit(p, edit); return log('Placed sounds removed.'); }
  if (sub === 'fx') { edit.fxSound = !/^(off|false|no|0)$/i.test(String(pos[1])); P.saveEdit(p, edit); return log(`Effect sounds ${edit.fxSound ? 'on' : 'off'}.`); }
  if (sub === 'rm') {
    const i = parseInt(pos[1], 10) - 1;
    if (!(i >= 0 && i < edit.sfx.length)) U.fail('Give the sound number from "kkv sfx <video> list".');
    edit.sfx.splice(i, 1); P.saveEdit(p, edit); return log('Removed.');
  }
  if (sub === 'keys') {
    if (!edit.captions || !edit.captions.lines) U.fail('Add captions first; this places a sound on every highlighted word.');
    const name = String(flags.name || 'pop'); if (!sfx.SOUNDS[name]) U.fail(`No sound called "${name}".`);
    const gain = flags.gain != null ? num(flags.gain, 'gain') : -14;
    edit.sfx = edit.sfx.filter((s) => !s.auto);
    let c = 0;
    for (const ln of edit.captions.lines) for (const w of ln.words) if (w.key) { edit.sfx.push({ name, at: U.round(w.s), gain, auto: true }); c++; }
    edit.sfx.sort((a, b) => a.at - b.at); P.saveEdit(p, edit);
    return log(`Placed "${name}" on ${c} highlighted words (${gain} dB).`);
  }
  if (sub === 'add') {
    const name = pos[1];
    if (!sfx.SOUNDS[name]) U.fail(`No sound called "${name || ''}". Available: ${Object.keys(sfx.SOUNDS).join(', ')}`);
    if (flags.at == null) U.fail('When? Add --at 3.2 or --at "@phrase". Several at once: --at "1.2,@myth,end-1"');
    for (const spec of String(flags.at).split(',')) {
      const s = { name, at: U.round(P.resolveTime(spec.trim(), words, pr.duration, '--at') + (flags.offset ? num(flags.offset, 'offset') : 0)) };
      if (s.at >= pr.duration) U.fail(`${U.fmtT(s.at)}s is past the end of the video (${U.fmtT(pr.duration)}s long).`);
      if (flags.gain != null) s.gain = num(flags.gain, 'gain');
      if (flags.dur != null) s.dur = num(flags.dur, 'dur');
      edit.sfx.push(s);
      log(`  + ${name} at ${U.fmtT(s.at)}s`);
    }
    edit.sfx.sort((a, b) => a.at - b.at); P.saveEdit(p, edit);
    return;
  }
  U.fail('Usage: kkv sfx <video> add <sound> --at … | keys | list | rm <n> | clear | fx on|off');
}

/* ───────────── render / frames ───────────── */
async function cmdRender(p, flags) {
  const C = require('./compose');
  const pr = await P.info(p);
  const doc = P.loadWords(p, false);
  const T = (v, w) => P.resolveTime(v, doc && doc.words, pr.duration, w);
  const opts = { draft: !!flags.draft, out: flags.out && flags.out !== true ? String(flags.out) : null };
  if (flags.from != null) opts.from = T(flags.from, '--from');
  if (flags.to != null) opts.to = T(flags.to, '--to');
  if (flags.fps != null) opts.fps = num(flags.fps, 'fps');
  if (flags['4k']) opts.max = 2160;
  const r = await C.render(p, opts, log);
  const mb = (fs.statSync(r.out).size / 1e6).toFixed(1);
  log(`\n✓ Saved ${r.out}`);
  log(`  ${r.W}×${r.H} · ${r.fps} fps · ${(r.frames / r.fps).toFixed(1)}s · ${mb} MB · rendered in ${r.seconds.toFixed(0)}s · ${r.sounds} sound cue${r.sounds === 1 ? '' : 's'}${opts.draft ? ' · DRAFT quality' : ''}`);
  log('  The original video is untouched.');
}

async function cmdFrames(p, flags) {
  const C = require('./compose');
  const pr = await P.info(p);
  const doc = P.loadWords(p, false);
  const edit = P.loadEdit(p);
  let times;
  if (flags.at != null && flags.at !== true) times = String(flags.at).split(',').map((s) => P.resolveTime(s.trim(), doc && doc.words, pr.duration, '--at'));
  else {
    times = [];
    for (const fx of edit.effects) if (fx.type !== 'progress') times.push(+fx.at + Math.min(0.7, (+fx.dur || 2) * 0.5));
    const lines = (edit.captions && edit.captions.lines) || [];
    for (const k of [0.12, 0.5, 0.88]) { const ln = lines[Math.floor(lines.length * k)]; if (ln) times.push(ln.words[ln.words.length - 1].e - 0.02); }
    if (!times.length) times = [0.2, 0.5, 0.8].map((k) => pr.duration * k);
    times = Array.from(new Set(times.map((t) => U.round(t, 2)))).sort((a, b) => a - b);
    if (times.length > 6) times = times.filter((_, i) => i % Math.ceil(times.length / 6) === 0).slice(0, 6);
  }
  const r = await C.stills(p, times, {}, log);
  log(`✓ Check sheet: ${r.sheet}`);
  log(`  frames left → right at: ${r.times.map((t) => U.fmtT(t) + 's').join(', ')}`);
  log('  Look at it: is any text covering the face, cut off, or colliding with something else? Fix, then render.');
}

/* ───────────── info ───────────── */
function cmdList(what) {
  const K = catalog.load();
  const sect = (t) => log(`\n${t}\n${'─'.repeat(t.length)}`);
  if (!what || what.startsWith('cap')) {
    sect('CAPTION STYLES  ·  kkv captions <video> <style>');
    for (const [name, d] of Object.entries(K.captions)) log(`  ${name.padEnd(11)} ${d.desc}`);
    log('  options: --key "word,phrase" · --no-key · --accent "#hex" · --y 0..1 · --scale 1.1 · --max-words N · --max-chars N');
  }
  if (!what || what.startsWith('eff') || what === 'fx') {
    sect('EFFECTS  ·  kkv fx <video> add <effect> --at <time> [--dur s | --until <time>]');
    const groups = { camera: 'Camera', behind: 'Behind you', front: 'Overlays', grade: 'Colour' };
    for (const [kind, title] of Object.entries(groups)) {
      log(`  ${title}`);
      for (const [name, d] of Object.entries(K.effects)) {
        if (d.kind !== kind) continue;
        log(`    ${name.padEnd(12)} ${d.desc}`);
        const ps = Object.entries(d.params || {}).map(([k, v]) => `--${k} ${JSON.stringify(v)}`).concat((d.timeParams || []).map((k) => `--${k} t1,t2,…`));
        log(`    ${' '.repeat(12)} ${d.dur ? d.dur + 's' : 'whole video'} · ${ps.join(' ')}`);
      }
    }
    log('  time = seconds (3.2) · m:ss · start · end-2 · "@phrase from the video" · "@phrase>" (when it ends) · "@phrase#2" (2nd time said) · "@phrase+0.3"');
    log('  every effect also takes --sound off');
  }
  if (!what || what.startsWith('s')) {
    sect('SOUNDS  ·  kkv sfx <video> add <sound> --at <time> [--gain dB]');
    for (const [name, d] of Object.entries(sfx.SOUNDS)) log(`  ${name.padEnd(9)} ${d.desc}`);
  }
  log('');
}

async function cmdStatus(p) {
  const pr = await P.info(p);
  const edit = P.loadEdit(p);
  const doc = P.loadWords(p, false);
  log(`${path.basename(p.video)} · ${pr.width}×${pr.height} · ${pr.fps.toFixed(2)} fps · ${U.fmtT(pr.duration)}s${pr.hdr ? ' · HDR' : ''}${pr.hasAudio ? '' : ' · NO AUDIO'}`);
  log(`Transcript: ${doc ? doc.words.length + ' words (' + (doc.language || '?') + ')' : 'not yet (kkv words)'}`);
  log(`Captions:   ${edit.captions ? edit.captions.style + ' · ' + edit.captions.lines.length + ' lines' : 'none'}`);
  log(`Effects:    ${edit.effects.length || 'none'}`);
  edit.effects.forEach((fx, i) => log(fxLine(fx, i)));
  log(`Sounds:     ${edit.sfx.length} placed · effect sounds ${edit.fxSound === false ? 'off' : 'on'}`);
  log(`Edit file:  ${p.editPath}`);
}

async function cmdDoctor() {
  let ok = true;
  const row = (good, name, detail) => { if (!good) ok = false; log(`  ${good ? '✓' : '✗'} ${name.padEnd(22)} ${detail || ''}`); };
  log('KK Verse Studio · health check\n');
  for (const tool of ['ffmpeg', 'ffprobe']) row(!!U.which(tool), tool, U.which(tool) || 'not found: install ffmpeg');
  row(parseInt(process.versions.node, 10) >= 18, 'node', process.versions.node);
  row(fs.existsSync(path.join(U.ROOT, 'node_modules', '@fontsource', 'anton')), 'fonts', 'studio/node_modules/@fontsource');
  const py = U.venvPython();
  row(!!py, 'python environment', py || 'missing: bash studio/setup.sh');
  if (py) {
    const r = await U.run(py, ['-c', 'import faster_whisper, mediapipe, numpy; print(faster_whisper.__version__, mediapipe.__version__)'], { allowFail: true });
    row(r.code === 0, 'speech + tracking libs', r.code === 0 ? r.stdout.trim() : r.stderr.trim().split('\n').pop());
  }
  try { const b = await require('./layers').launchBrowser(); const v = b.version(); await b.close(); row(true, 'browser', 'Chromium ' + v); }
  catch (e) { row(false, 'browser', String(e.userMessage || e.message).split('\n')[0]); }
  const K = catalog.load();
  log(`\n  ${Object.keys(K.captions).length} caption styles · ${Object.keys(K.effects).length} effects · ${Object.keys(sfx.SOUNDS).length} sounds`);
  log(ok ? '\nAll good. Drop in a video and go.' : '\nSomething is missing. Run: bash studio/setup.sh');
  if (!ok) process.exitCode = 1;
}

const HELP = `KK Verse Studio · edit talking-head video from the command line (or let Claude do it: /kk-reel)

  kkv words    <video> [--lang hi|en|auto] [--prompt "names, brands"] [--force]   listen and time every word
  kkv text     <video>                                   show the transcript / caption lines
  kkv fix      <video> "wrong=right" …                   correct misheard words
  kkv captions <video> <style> [--key "a,b"] [--y .7] [--accent "#hex"]           add / restyle captions (off to remove)
  kkv fx       <video> add <effect> --at <time> […] | list | set <n> … | rm <n> | clear
  kkv sfx      <video> add <sound> --at <time> | keys | list | rm <n> | clear | fx on|off
  kkv frames   <video> [--at "1.5,@a phrase,end-1"]        check sheet of stills before you render
  kkv render   <video> [--draft] [--from t --to t] [-o out.mp4] [--4k]
  kkv status   <video>                                   what is in the edit
  kkv reset    <video> [--all]                           start the edit again
  kkv list     [captions|effects|sounds]                 the catalog
  kkv gallery  [-o file.html]                            one-page preview of every caption style and effect
  kkv doctor                                             check the install

Nothing ever changes your original file: the result is saved next to it as <name>_kkverse.mp4.`;

async function main(argv) {
  const { pos, flags } = parse(argv);
  const cmd = pos[0];
  if (!cmd || cmd === 'help' || flags.help) return log(HELP);
  if (cmd === 'list') return cmdList(pos[1]);
  if (cmd === 'doctor') return cmdDoctor();
  if (cmd === 'gallery') return require('./gallery').build(flags.out && flags.out !== true ? String(flags.out) : null, log, !!flags.fragment);
  if (cmd === 'sound') { // audition a sound: kkv sound ding -o ding.wav
    const b = sfx.make(pos[1], { dur: flags.dur ? num(flags.dur, 'dur') : undefined });
    if (!b) U.fail(`No sound called "${pos[1] || ''}". Available: ${Object.keys(sfx.SOUNDS).join(', ')}`);
    const out = path.resolve(flags.out && flags.out !== true ? String(flags.out) : `${pos[1]}.wav`);
    fs.writeFileSync(out, sfx.wav(b)); return log(`✓ ${out}`);
  }
  const known = ['words', 'text', 'fix', 'captions', 'fx', 'sfx', 'frames', 'render', 'status', 'reset', 'track'];
  if (!known.includes(cmd)) U.fail(`Unknown command "${cmd}". Run: kkv help`);
  const p = P.open(pos[1]);
  const rest = pos.slice(2);
  switch (cmd) {
    case 'words': return cmdWords(p, flags);
    case 'text': return cmdText(p);
    case 'fix': return cmdFix(p, rest);
    case 'captions': return cmdCaptions(p, rest, flags);
    case 'fx': return cmdFx(p, rest, flags);
    case 'sfx': return cmdSfx(p, rest, flags);
    case 'frames': return cmdFrames(p, flags);
    case 'render': return cmdRender(p, flags);
    case 'status': return cmdStatus(p);
    case 'track': {
      const C = require('./compose'); const pr = await P.info(p);
      fs.rmSync(p.trackPath, { force: true });
      const t = await C.ensureTrack(p, pr, C.pickFps(pr, flags.fps ? num(flags.fps, 'fps') : null), log);
      return log(`✓ Tracked ${t.frames} frames (face found in ${t.faceFrames}).`);
    }
    case 'reset':
      if (flags.all) { fs.rmSync(p.dir, { recursive: true, force: true }); return log('Edit, transcript and tracking data removed.'); }
      fs.rmSync(p.editPath, { force: true }); return log('Edit cleared (transcript kept).');
    default: return null;
  }
}

module.exports = { main, parse };
