'use strict';
/* Turns word timings into caption lines and picks a key word per line. */

const STOP = new Set(('a an the and or but so if then than that this these those is are was were be been being am do does did done have has had ' +
  'i you he she it we they me my your our their his her its us them to of in on at for from with by as about into over up down out off not no yes ' +
  'just very really can could would should will shall may might must also too there here what which who whom when where why how all any some each ' +
  'more most other such only own same now get got go going gonna like okay ok um uh well right actually basically literally one two three ' +
  // common Hinglish / Hindi function words (romanised + Devanagari)
  'hai hain ho hu hoon tha thi the ka ki ke ko se me mein par pe aur ya ki ye yeh wo woh is us ek to toh bhi hi na nahi nahin kya kyu kyun kyunki ' +
  'jo jab tab ab agar lekin magar phir fir bas sirf apna apni apne mera meri mere tera tum aap hum main mai kuch koi sab bahut bohot kar karo karna ' +
  'raha rahi rahe gaya gayi gaye wala wali wale liye saath sath tak ' +
  'है हैं हो हूँ था थी थे का की के को से में पर और या ये यह वो वह इस उस एक तो भी ही न नहीं क्या क्यों क्योंकि जो जब तब अब अगर लेकिन फिर बस सिर्फ ' +
  'अपना अपनी अपने मेरा मेरी मेरे तुम आप हम मैं कुछ कोई सब बहुत कर करो करना रहा रही रहे गया गयी गए वाला वाली वाले लिए साथ तक').split(/\s+/));

const norm = (s) => String(s).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}₹$%]+/gu, '');
const display = (raw, keepPunct) => {
  let s = String(raw).trim();
  if (!keepPunct) s = s.replace(/^[“"'‘(\[]+/, '').replace(/[”"'’)\],.;:।…]+$/u, (m) => (/[?!]/.test(m) ? m.replace(/[^?!]/g, '') : ''));
  return s;
};
const endsSentence = (raw) => /[.?!।…]["”’)]*$/u.test(String(raw).trim());
const endsClause = (raw) => /[,;:–—]["”’)]*$/u.test(String(raw).trim());

function keyScore(w) {
  const n = norm(w);
  if (!n || STOP.has(n)) return -1;
  let s = 0;
  if (/[\d₹$%]/.test(w)) s += 3;
  const len = Array.from(n).length;
  if (len >= 6) s += 1.2; else if (len >= 4) s += 0.6;
  if (/^\p{Lu}{2,}$/u.test(w.replace(/[^\p{L}]/gu, ''))) s += 1; // ACRONYM
  return s;
}

/**
 * @param {Array<{w:string,s:number,e:number}>} words
 * @param {{maxChars:number,maxWords:number,keys?:string[],autoKey?:boolean,keepPunct?:boolean,gap?:number}} o
 */
function buildLines(words, o) {
  const maxChars = o.maxChars || 18, maxWords = o.maxWords || 3, gap = o.gap == null ? 0.55 : o.gap;
  const len = (t) => Array.from(t).length;
  const items = [];
  words.forEach((raw, i) => {
    const text = display(raw.w, o.keepPunct);
    if (!text) return;
    const prev = i > 0 ? words[i - 1] : null;
    items.push({
      w: text, s: raw.s, e: Math.max(raw.e, raw.s + 0.04),
      paused: !!prev && raw.s - prev.e > gap, afterSentence: !!prev && endsSentence(prev.w), afterClause: !!prev && endsClause(prev.w),
    });
  });

  // explicit key words / phrases; a phrase is kept on one line where it fits
  const keys = (o.keys || []).map((k) => String(k).trim()).filter(Boolean).map((k) => k.split(/\s+/).map(norm).filter(Boolean)).filter((k) => k.length);
  let phraseId = 0;
  for (let i = 0; i < items.length; i++) for (const k of keys) {
    if (items[i].key || !k.every((kw, j) => items[i + j] && !items[i + j].key && norm(items[i + j].w) === kw)) continue;
    phraseId++;
    for (let j = 0; j < k.length; j++) { items[i + j].key = true; items[i + j].phrase = phraseId; items[i + j].phraseStart = j === 0; }
  }

  const lines = [];
  let cur = [], chars = 0;
  const flush = () => { if (cur.length) lines.push({ words: cur }); cur = []; chars = 0; };
  items.forEach((it, i) => {
    const inside = it.phrase && !it.phraseStart; // continuing a key phrase: never break here
    if (cur.length && !inside) {
      let need = len(it.w), count = 1;
      if (it.phraseStart) for (let j = i + 1; items[j] && items[j].phrase === it.phrase; j++) { need += 1 + len(items[j].w); count++; }
      const fitsAlone = need <= maxChars * 1.25 && count <= maxWords + 1;
      const tooLong = chars + 1 + len(it.w) > maxChars || cur.length >= maxWords;
      const phraseOverflow = count > 1 && fitsAlone && (chars + 1 + need > maxChars * 1.1 || cur.length + count > maxWords + 1);
      if (tooLong || phraseOverflow || it.paused || it.afterSentence || (it.afterClause && chars >= maxChars * 0.55)) flush();
    }
    const w = { w: it.w, s: it.s, e: it.e };
    if (it.key) w.key = true;
    cur.push(w);
    chars += (cur.length > 1 ? 1 : 0) + len(it.w);
  });
  flush();

  if (o.autoKey) {
    for (const ln of lines) {
      if (ln.words.some((w) => w.key)) continue;
      let best = null, bs = 0.5;
      ln.words.forEach((w, i) => { const sc = keyScore(w.w) + i * 0.05; if (sc > bs) { bs = sc; best = w; } });
      if (best) best.key = true;
    }
  }
  return lines;
}

module.exports = { buildLines, norm, display, STOP };
