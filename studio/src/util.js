'use strict';
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

class UserError extends Error {
  constructor(msg) { super(msg); this.userMessage = msg; }
}
const fail = (msg) => { throw new UserError(msg); };

function which(cmd) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() : null;
}

/** Run a process. Resolves with { code, stdout, stderr }; rejects (with the tail of stderr) on non-zero exit. */
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], cwd: opts.cwd, env: opts.env || process.env });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d; if (opts.onStdout) opts.onStdout(String(d)); });
    child.stderr.on('data', (d) => { stderr += d; if (stderr.length > 400000) stderr = stderr.slice(-200000); if (opts.onStderr) opts.onStderr(String(d)); });
    child.on('error', (e) => reject(new UserError(`Could not start ${cmd}: ${e.message}`)));
    child.on('close', (code) => {
      if (code !== 0 && !opts.allowFail) {
        const tail = stderr.trim().split('\n').slice(-12).join('\n');
        return reject(new UserError(`${path.basename(cmd)} failed (exit ${code})\n${tail}`));
      }
      resolve({ code, stdout, stderr });
    });
    if (opts.input != null) child.stdin.end(opts.input); else child.stdin.end();
  });
}

const ffmpeg = (args, opts) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], opts);

async function probe(file) {
  if (!fs.existsSync(file)) fail(`File not found: ${file}`);
  const { stdout } = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  const j = JSON.parse(stdout);
  const v = (j.streams || []).find((s) => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic));
  if (!v) fail(`No video stream in ${path.basename(file)}`);
  const a = (j.streams || []).find((s) => s.codec_type === 'audio');
  let rot = 0;
  if (v.tags && v.tags.rotate) rot = parseInt(v.tags.rotate, 10) || 0;
  for (const sd of v.side_data_list || []) if (sd.rotation != null) rot = Number(sd.rotation) || 0;
  rot = ((Math.round(rot) % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const ratio = (s) => { if (!s) return 0; const [n, d] = String(s).split('/').map(Number); return d ? n / d : n || 0; };
  const fps = ratio(v.avg_frame_rate) || ratio(v.r_frame_rate) || 30;
  const duration = parseFloat((j.format && j.format.duration) || v.duration || 0);
  return {
    width: swap ? v.height : v.width, height: swap ? v.width : v.height, rotation: rot,
    fps, duration, hasAudio: !!a, codec: v.codec_name, acodec: a ? a.codec_name : '',
    transfer: v.color_transfer || '', hdr: /arib-std-b67|smpte2084/.test(v.color_transfer || ''),
  };
}

function venvPython() {
  const cands = [
    path.join(ROOT, '.venv', 'bin', 'python'),
    path.join(ROOT, '.venv', 'Scripts', 'python.exe'),
  ];
  for (const c of cands) if (fs.existsSync(c)) return c;
  return null;
}

const even = (n) => Math.max(2, Math.round(n / 2) * 2);
const fmtT = (s) => { const m = Math.floor(s / 60); const r = s - m * 60; return (m ? m + ':' + (r < 10 ? '0' : '') : '') + r.toFixed(2); };
const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

module.exports = { ROOT, UserError, fail, which, run, ffmpeg, probe, venvPython, even, fmtT, round };
