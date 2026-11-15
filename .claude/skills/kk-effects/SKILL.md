---
name: kk-effects
description: KK Verse Studio effects. Adds motion effects to a talking-head clip - camera punch-ins, a giant word or spotlight BEHIND the speaker, items orbiting the head, checklists, counters in lakh/crore, MYTH/FACT stamps, comment cards, source tags, follow buttons. Use for "/kk-effects orbit from 3 to 6 seconds", "zoom in when I say X", "put the word MYTH behind me".
argument-hint: "[effect] [when, in plain words] [video]"
---

# /kk-effects · effects, timed to what is said

Request: $ARGUMENTS

## Find the studio and the video

```bash
KKV="$(command -v kkv || true)"
for d in "${CLAUDE_PROJECT_DIR:-$PWD}/studio" "$PWD/studio" "$HOME/.kkverse/studio"; do [ -z "$KKV" ] && [ -x "$d/bin/kkv" ] && KKV="$d/bin/kkv"; done
"$KKV" doctor      # anything missing → bash "$(dirname "$KKV")/../setup.sh" (one time), then continue
"$KKV" list effects   # every effect with all its options and defaults
```

The video is the path in the user's message or their attachment; if there is none, use the newest video in the working folder or ask.

## Steps

1. **Timing from words.** If the user times anything by what they say ("when I say kill the lights"), make sure a transcript exists: `"$KKV" words <video>`, then use `--at "@kill the lights"`. Plain seconds need no transcript.
2. **Add** each effect:
   ```bash
   "$KKV" fx <video> add orbit --at 3 --until 6
   "$KKV" fx <video> add spotlight --at "@kill the lights" --dur 3
   "$KKV" fx <video> add big-word --at "@kill the lights" --text "LIGHTS"
   ```
3. **Check**: `"$KKV" frames <video>`, open the sheet with the Read tool, and look. Nothing should cover the face or run off the frame; two cards should not overlap; keep the bottom 15% clear. Fix with `"$KKV" fx <video> set <n> --y 0.2 …` (numbers from `fx <video> list`) and check again.
4. **Render**: `"$KKV" render <video>` → `<name>_kkverse.mp4` beside the original. Say where it is and what happens when.

Effects stack with each other and with captions already in the edit. `"$KKV" fx <video> rm <n>` removes one, `clear` removes all.

## The effects

**Camera**
- `punch-in` quick zoom onto the face for one line (`--zoom 1.22`, `--target face|center`)
- `slow-push` slow cinematic push-in over a thought (`--zoom 1.14`)

**Behind the speaker** (the studio cuts the person out and tracks the head; first use on a clip takes a little longer)
- `big-word` one giant word behind the head (`--text`, `--color`)
- `spotlight` room goes dark, warm light stays on the speaker (`--dim`)
- `orbit` emoji, words or images circle the head, passing behind and in front (`--items "🎬|Hook|img:logo.png"`, `--speed`, `--radius`)
- `wall-text` a phrase tiles the wall behind in scrolling rows (`--text`, `--rows`)

**Overlays**
- `headline` hook title bars at the top (`--text "line one|line two"`)
- `lower-third` name card (`--name`, `--title`)
- `checklist` points that tick off (`--items "a|b|c"`, `--ticks "@a,@b,@c"`, `--title`)
- `counter` number counts up (`--to 4500000 --prefix "₹" --format indian|compact|intl|plain`, `--label`)
- `comment` a viewer comment types itself and gets a like (`--user`, `--text`)
- `stamp` rubber stamp slams down (`--text MYTH|FACT|VERIFIED`, `--color`, `--x`, `--y`)
- `callout` hand-drawn arrow and note pointing at a spot (`--text`, `--x`, `--y`, `--from left|right|top|bottom`)
- `source-tag` small citation chip (`--text "Source: …"`). Use a real source only.
- `follow-cta` handle with a Follow button that gets tapped (`--handle "@kkcreate"`)
- `progress` thin bar filling across the top for the whole video

**Colour**
- `grade` a look over a stretch (`--look moody|warm|cool|punchy|bw`)

## Reading the request

| They say | Means |
| --- | --- |
| "from 3 to 6 seconds" | `--at 3 --until 6` |
| "for the first 3 seconds" | `--at 0 --dur 3` |
| "at the end" | `--at end-3` (effect length before the end) |
| "when I say X" | `--at "@X"` (after `kkv words`) |
| "until I finish saying Y" | `--until "@Y>"` |
| "with the word Z behind me" | `big-word --text "Z"` |
| "no sound on that" | add `--sound off` |
| "stronger / subtler zoom" | `--zoom 1.35` / `--zoom 1.12` |

Camera moves cannot overlap each other; if two do, the earlier one hands over to the later one. Behind-the-head effects need the speaker clearly in frame; if the cut-out looks rough around hair or hands in the check sheet, shorten the effect or use an overlay instead.

Each effect plays its own matched sound unless told otherwise. More sound control: `/kk-sfx`.
