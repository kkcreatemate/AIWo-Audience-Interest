/* KK Verse Studio · camera moves and colour looks.
 * These have no DOM: the compositor (src/compose.js) turns them into ffmpeg filters. */
(function (KKV) {
  'use strict';

  KKV.effect('punch-in', {
    kind: 'camera', needs: { track: true }, dur: 1.2,
    desc: 'A quick zoom onto your face for one line, then back out. target: face | center.',
    params: { zoom: 1.22, rise: 0.16, fall: 0.24, target: 'face' },
    sfx: () => [{ name: 'whoosh', t: -0.06, gain: -13 }],
  });

  KKV.effect('slow-push', {
    kind: 'camera', needs: { track: true }, dur: 4,
    desc: 'A slow cinematic push-in across a whole thought. Cuts back at the end.',
    params: { zoom: 1.14, target: 'face' },
  });

  KKV.effect('grade', {
    kind: 'grade', dur: 3,
    desc: 'A colour look over a stretch of the video. look: moody | warm | cool | punchy | bw.',
    params: { look: 'moody' },
  });

  KKV.looks = {
    moody: ['eq=contrast=1.12:brightness=-0.04:saturation=0.8', 'colorbalance=bs=0.08:rs=-0.04:bh=-0.03'],
    warm: ['colorbalance=rm=0.06:bm=-0.06:rh=0.04:bh=-0.05', 'eq=saturation=1.08'],
    cool: ['colorbalance=bm=0.07:rm=-0.05:bh=0.03', 'eq=saturation=0.94'],
    punchy: ['eq=contrast=1.1:saturation=1.28', 'unsharp=5:5:0.6:5:5:0'],
    bw: ['hue=s=0', 'eq=contrast=1.16'],
  };
})(typeof window !== 'undefined' ? window.KKV : globalThis.KKV);
