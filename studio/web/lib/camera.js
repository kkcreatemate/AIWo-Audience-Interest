/* KK Verse Studio · camera moves (punch-in, slow push).
 * One definition used three ways: Node turns a cue into an ffmpeg expression,
 * the render page uses it to keep face-tracked layers glued to the zoomed picture.
 * A cue: { at, dur, zoom, cx, cy, rise, fall, linear } with cx/cy in 0..1 of the source. */
(function (g) {
  'use strict';
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const ss = (u) => u * u * (3 - 2 * u);

  function env(cue, t) {
    const a = cue.at, b = cue.at + cue.dur;
    if (t < a || t >= b) return 0;
    if (cue.rise > 0 && t < a + cue.rise) { const u = (t - a) / cue.rise; return cue.linear ? u : ss(u); }
    if (cue.fall > 0 && t > b - cue.fall) return ss((b - t) / cue.fall);
    return 1;
  }

  /** Camera state at time t → { z, x0, y0 }: zoom and the top-left of the visible window (0..1). */
  function at(cues, t) {
    for (const cue of cues || []) {
      if (t >= cue.at && t < cue.at + cue.dur) {
        const e = env(cue, t);
        const z = 1 + (cue.zoom - 1) * e;
        const cx = 0.5 + (cue.cx - 0.5) * e;
        const cy = 0.5 + (cue.cy - 0.5) * e;
        return { z, x0: clamp(cx - 0.5 / z, 0, 1 - 1 / z), y0: clamp(cy - 0.5 / z, 0, 1 - 1 / z) };
      }
    }
    return { z: 1, x0: 0, y0: 0 };
  }

  /** Source-normalised point → screen-normalised point under camera state. */
  const toScreen = (cam, x, y) => [(x - cam.x0) * cam.z, (y - cam.y0) * cam.z];

  /** ffmpeg `perspective` options for one cue. `T` is an expression for absolute time in seconds. */
  function ffPerspective(cue, T) {
    const n = (v) => Number(v).toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
    const a = n(cue.at), b = n(cue.at + cue.dur);
    let e;
    const rise = cue.rise > 0
      ? (cue.linear ? `(${T}-${a})/${n(cue.rise)}` : `st(9,(${T}-${a})/${n(cue.rise)})*ld(9)*(3-2*ld(9))`)
      : '1';
    const fall = cue.fall > 0 ? `st(9,(${b}-${T})/${n(cue.fall)})*ld(9)*(3-2*ld(9))` : '1';
    if (cue.rise > 0 && cue.fall > 0) e = `if(lt(${T},${n(cue.at + cue.rise)}),${rise},if(gt(${T},${n(cue.at + cue.dur - cue.fall)}),${fall},1))`;
    else if (cue.rise > 0) e = `if(lt(${T},${n(cue.at + cue.rise)}),${rise},1)`;
    else if (cue.fall > 0) e = `if(gt(${T},${n(cue.at + cue.dur - cue.fall)}),${fall},1)`;
    else e = '1';
    // st(0)=envelope (clamped) · st(1)=zoom · st(2)=window left · st(3)=window top
    const pre = `st(0,clip(${e},0,1));st(1,1+${n(cue.zoom - 1)}*ld(0));`;
    const X0 = `st(2,clip(0.5+${n(cue.cx - 0.5)}*ld(0)-0.5/ld(1),0,1-1/ld(1)))`;
    const Y0 = `st(3,clip(0.5+${n(cue.cy - 0.5)}*ld(0)-0.5/ld(1),0,1-1/ld(1)))`;
    const L = `${pre}${X0};W*ld(2)`;
    const R = `${pre}${X0};W*(ld(2)+1/ld(1))`;
    const Tp = `${pre}${Y0};H*ld(3)`;
    const B = `${pre}${Y0};H*(ld(3)+1/ld(1))`;
    return `perspective=x0='${L}':y0='${Tp}':x1='${R}':y1='${Tp}':x2='${L}':y2='${B}':x3='${R}':y3='${B}':sense=source:eval=frame:interpolation=cubic`;
  }

  const api = { env, at, toScreen, ffPerspective };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  g.KKVCamera = api;
})(typeof window !== 'undefined' ? window : globalThis);
