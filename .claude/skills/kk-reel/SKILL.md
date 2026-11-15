---
name: kk-reel
description: KK Verse Studio full edit. Turns a raw talking-head clip into a finished short-form video (captions timed to the voice, effects, sound design) and saves it next to the original. Use when the user drops in a video and says "edit this", "make this a reel", "/kk-reel", or asks for captions + effects + sound together.
argument-hint: "[video] [what you want, in plain words]"
---

# /kk-reel · the full KK Verse edit

You are the editor. The user gives you a talking-head clip; you return a finished vertical video.
The engine is the `kkv` command (KK Verse Studio). It never changes the original file.

Request: $ARGUMENTS

## 0. Find the studio and the video

```bash
KKV="$(command -v kkv || true)"
for d in "${CLAUDE_PROJECT_DIR:-$PWD}/studio" "$PWD/studio" "$HOME/.kkverse/studio"; do [ -z "$KKV" ] && [ -x "$d/bin/kkv" ] && KKV="$d/bin/kkv"; done
"$KKV" doctor
```

- If `doctor` reports anything missing, run `bash "$(dirname "$KKV")/../setup.sh"` once (2 to 4 minutes; tell the user it is a one-time setup), then continue.
- The video is the path in the user's message, or a file they attached. If there is none, look for the newest video in the working folder; if that is ambiguous, ask which one.
- `"$KKV" status <video>` shows what is already in the edit. If an edit exists, build on it unless the user asks to start over (`kkv reset <video>`).

## 1. Listen

```bash
"$KKV" words <video> --prompt "KK Create, Kavya, Shubham"   # add names and brands the speaker uses
```

- Hindi or Hinglish speaker: add `--lang hi`. English: `--lang en`. Unsure: leave it out.
- Read the transcript it prints. Fix what was misheard, especially names, brands and numbers:
  `"$KKV" fix <video> "kk creates=KK Create" "clod=Claude"`
- Hinglish in Roman letters: if the transcript came out in Devanagari and the creator posts in Roman Hinglish, open `<name>.kkv/words.json` and rewrite each `"w"` in Roman script. Keep every `s`/`e` and the number of entries exactly as they are. Ask which script they want if you do not know.

## 2. Plan like an editor (decide before you add anything)

Read the transcript and mark the moments. Use only what the words earn:

| Moment in the script | Reach for |
| --- | --- |
| First 3 seconds, the hook | `headline` |
| The strongest line of a thought | `punch-in` (at most one every 6 to 8 seconds) |
| One word that carries the idea | `big-word` behind the head, or `stamp` for MYTH / FACT |
| A list ("three things…") | `checklist`, ticks timed to each item with `--ticks "@item one,@item two"` |
| A number | `counter` (`--format indian` gives 12,34,567 · `compact` gives 1.2 Cr) |
| A factual claim | `source-tag` with the real source. Never invent one. If the `kkcreate-fact-check` skill is available, offer to run it first |
| A viewer question or objection | `comment` |
| A reflective or serious beat | `spotlight`, `slow-push`, or `grade` |
| Tools, topics, examples being listed fast | `orbit` |
| Who is speaking (first appearance) | `lower-third` |
| The ask at the end | `follow-cta` |

Restraint is the craft: roughly one effect every 3 to 4 seconds at most, never two cards at the top at the same time, one behind-the-head moment per 15 seconds. If the user asked for a specific vibe, follow them over these defaults.

Caption style by content: `kk-pop` or `one-word` for high-energy reels · `karaoke` or `pill` for explainers · `newsroom` for news and India-beat explainers · `editorial` for stories and reflective pieces · `truck-art` for fun desi content · `marker` for tips · `typewriter` for tech · `clean` for long or landscape video.

## 3. Build

```bash
"$KKV" list                                    # full catalog with every option
"$KKV" captions <video> kk-pop --key "myth,three things,45 lakh"   # you choose the highlighted words
"$KKV" fx <video> add headline --at 0.2 --dur 3 --text "You don't need|an editing team"
"$KKV" fx <video> add punch-in --at "@that is a myth"
"$KKV" fx <video> add checklist --at "@here are" --until "@one command>+0.5" --items "Captions|Effects|Sound" --ticks "@captions,@effects,@sound design"
```

- Times: seconds (`3.2`), `m:ss`, `start`, `end-2`, or `"@phrase from the video"` (when the phrase starts). `"@phrase>"` is the moment it ends, `"@phrase#2"` its second occurrence, `"@phrase+0.3"` an offset. Always wrap an `@` time in double quotes. Prefer `@phrases` over raw seconds: they are exact to the word.
- Highlight (`--key`) the words a viewer must not miss: numbers, names, the twist. One per line at most. Not filler.
- Effects bring their own matched sound. `--sound off` on one effect, or `kkv sfx <video> fx off` for all. For extra sound cues see `/kk-sfx`.

## 4. Check before you render (do not skip)

```bash
"$KKV" frames <video>            # or --at "1.5,@myth,end-1" for exact moments
```

Open the sheet it prints with the Read tool and actually look:
- Is anything covering the face or the mouth? (Overlays move clear of the face on their own unless you set `--y`.)
- Is text cut off at an edge, or do captions collide with a card? Move one: captions `--y 0.62`, effects `--y`, or change the timing.
- Keep the bottom 15% and the right edge clear: Instagram and YouTube put their buttons there.
- Does the highlighted word in each line deserve it?

Fix with `kkv fx <video> set <n> --y 0.2` (numbers from `kkv fx <video> list`), `kkv fx <video> rm <n>`, or re-run `kkv captions` with new options. Check again.

## 5. Render and hand over

```bash
"$KKV" render <video>            # add --draft for a fast low-res preview of long clips
```

The result is `<name>_kkverse.mp4` beside the original. Tell the user:
1. where the file is (send or attach it if your environment lets you),
2. what you did, as a short timeline ("0:00 hook title · 0:05 MYTH behind your head · …"),
3. what you corrected in the transcript, and anything you were unsure of,
4. that they can now say what looks wrong ("captions higher", "drop the stamp", "make the zoom at 'forty five lakh' stronger") and you will adjust and re-render.

It drafts, they approve. Make the change they ask for with `fx set` / `captions` and render again; do not start over.

## If something fails

- No speech found, or the transcript is gibberish: say so and ask about the language; retry with `--lang`.
- Speech model cannot download (blocked network): tell the user plainly; captions need it. Effects that use only times in seconds still work.
- HDR iPhone footage looks washed out: ask them to export as SDR (Settings → Camera → Formats → Most Compatible).
- A behind-the-head effect looks wrong around hair or hands: shorten it, or switch to an overlay.
