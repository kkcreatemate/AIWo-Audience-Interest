'use strict';
/* Smoke test: builds a 3-second synthetic clip, captions it, adds effects and sounds, renders a
 * draft and checks the result. Needs ffmpeg, the fonts and a browser; no speech or tracking models.
 *   npm test   (from studio/) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const assert = require('assert');

const kkv = path.join(__dirname, '..', 'bin', 'kkv');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kkv-smoke-'));
const clip = path.join(dir, 'clip.mp4');
const run = (...args) => execFileSync(process.execPath, [kkv, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

try {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=540x960:rate=30:duration=3',
    '-f', 'lavfi', '-i', 'sine=frequency=220:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', clip]);
  const words = 'This costs just ₹500 not 45 lakh'.split(' ').map((w, i) => ({ w, s: 0.2 + i * 0.36, e: 0.5 + i * 0.36 }));
  fs.writeFileSync(path.join(dir, 'w.json'), JSON.stringify({ language: 'en', words }));

  assert.match(run('words', clip, '--import', path.join(dir, 'w.json')), /7 words/);
  assert.match(run('fix', clip, 'costs just=is only'), /1 place/);
  const caps = run('captions', clip, 'kk-pop', '--key', '₹500,45 lakh');
  assert.match(caps, /\*₹500\*/); assert.match(caps, /\*45\* \*lakh\*/);
  run('fx', clip, 'add', 'progress');
  run('fx', clip, 'add', 'stamp', '--at', '@₹500', '--text', 'FACT');
  run('fx', clip, 'add', 'counter', '--at', '1.2', '--dur', '1.5', '--to', '4500000', '--prefix', '₹');
  run('fx', clip, 'add', 'punch-in', '--at', '0.5', '--target', 'center');
  run('fx', clip, 'add', 'grade', '--at', '2', '--dur', '1', '--look', 'bw');
  run('sfx', clip, 'add', 'ding', '--at', 'end-0.5');
  assert.throws(() => run('fx', clip, 'add', 'stamp', '--at', '99'), /past the end/);
  assert.match(run('frames', clip, '--at', '1.0,2.4'), /Check sheet/);
  assert.match(run('render', clip, '--draft'), /Saved/);

  const out = path.join(dir, 'clip_kkverse_draft.mp4');
  const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-count_frames', out], { encoding: 'utf8' }));
  const v = info.streams.find((s) => s.codec_type === 'video'), a = info.streams.find((s) => s.codec_type === 'audio');
  assert.strictEqual(Number(v.nb_read_frames), 90, 'frame count');
  assert.ok(a, 'audio track present');
  assert.ok(fs.statSync(path.join(dir, 'clip.mp4')).size > 0, 'original untouched');

  for (const style of ['karaoke', 'marker', 'typewriter', 'newsroom', 'one-word', 'pill', 'editorial', 'truck-art', 'clean']) {
    run('captions', clip, style);
    assert.match(run('frames', clip, '--at', '1.5'), /Check sheet/, style);
  }
  console.log('✓ smoke test passed');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
