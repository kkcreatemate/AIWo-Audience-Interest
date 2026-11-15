---
name: kk-captions
description: KK Verse Studio captions. Burns animated, word-timed captions onto a video in one of ten styles (kk-pop, karaoke, marker, typewriter, newsroom, one-word, pill, editorial, truck-art, clean), English, Hindi or Hinglish. Use for "/kk-captions pop", "add captions", "subtitle this reel", "change the caption style".
argument-hint: "[style] [video] [tweaks: colour, position, which words to highlight]"
---

# /kk-captions · captions timed to the voice

Request: $ARGUMENTS

## Find the studio and the video

```bash
KKV="$(command -v kkv || true)"
for d in "${CLAUDE_PROJECT_DIR:-$PWD}/studio" "$PWD/studio" "$HOME/.kkverse/studio"; do [ -z "$KKV" ] && [ -x "$d/bin/kkv" ] && KKV="$d/bin/kkv"; done
"$KKV" doctor      # anything missing → bash "$(dirname "$KKV")/../setup.sh" (one time), then continue
```

The video is the path in the user's message or their attachment; if there is none, use the newest video in the working folder or ask.

## Steps

1. **Listen**: `"$KKV" words <video>` (add `--lang hi` for Hindi/Hinglish, `--prompt "names, brands"` to help it spell them). Read the transcript and fix mistakes: `"$KKV" fix <video> "wrong words=right words"`.
   For Roman Hinglish when the transcript is in Devanagari: rewrite each `"w"` in `<name>.kkv/words.json` in Roman letters, leaving every `s`/`e` and the number of entries untouched.
2. **Style**: `"$KKV" captions <video> <style> --key "word,another phrase"`.
   Pick the highlighted words yourself: the number, the name, the twist in each sentence; at most one per line; never filler. `--no-key` for none.
3. **Check**: `"$KKV" frames <video>`, open the sheet with the Read tool, and look. Captions must not cover the mouth or sit in the bottom 15% (app buttons). Adjust and re-check.
4. **Render**: `"$KKV" render <video>` → `<name>_kkverse.mp4` beside the original. Tell the user where it is and what you highlighted.

## Styles

| Style | Look | Good for |
| --- | --- | --- |
| `kk-pop` | Bold caps pop in word by word; key word on a tilted yellow block | High-energy reels (the house style) |
| `karaoke` | Whole line visible, each word lights up as spoken | Explainers, teaching |
| `marker` | Chunky words, highlighter swipes the key word | Tips, how-tos |
| `typewriter` | Monospace typing with a caret | Tech, AI, screen-led videos |
| `newsroom` | Label tag over a white bar, key word in red | News, India-beat explainers |
| `one-word` | One huge word at a time | Fast hooks, punchlines |
| `pill` | Dark pill, key word in a violet chip | Calm explainers, brand content |
| `editorial` | Serif that drifts into focus, italic key word | Stories, reflective pieces |
| `truck-art` | Loud multi-colour desi poster lettering | Fun, festive, desi humour |
| `clean` | Quiet subtitles | Long-form, landscape, podcasts |

`"$KKV" list captions` prints the same list.

## What the user says → what you change

| They say | You run |
| --- | --- |
| "a bit higher / lower" | `--y 0.62` (0 = top, 1 = bottom; default about 0.7) |
| "bigger / smaller" | `--scale 1.15` |
| "coral highlights", "use our violet" | `--accent "#FF6B5E"` (KK violet is `#5B4FE8`) |
| "fewer words at a time" | `--max-words 2` or `--max-chars 12` |
| "highlight X and Y" | `--key "X,Y"` |
| "it says the wrong word" | `kkv fix <video> "wrong=right"` |
| "newsroom tag should say KK EXPLAINS" | `--label "KK EXPLAINS"` (newsroom only) |
| "remove captions" | `kkv captions <video> off` |

Options stack and are remembered: re-running `kkv captions <video> <style>` with one new flag keeps the rest. For full hand control, edit `captions.lines` in `<name>.kkv/edit.json` and set `"locked": true` there so later commands do not rebuild the lines.

Captions add to whatever effects and sounds are already in the edit; they do not replace them.
