#!/usr/bin/env bash
# KK Verse Studio · install on your own computer so /kk-reel, /kk-captions, /kk-effects and /kk-sfx
# work in every Claude Code session, whatever folder you are in.
#
#   git clone https://github.com/kkcreatemate/AIWo-Audience-Interest ~/.kkverse
#   bash ~/.kkverse/studio/install.sh
set -euo pipefail
STUDIO="$(cd "$(dirname "$0")" && pwd)"
REPO="$(dirname "$STUDIO")"

bash "$STUDIO/setup.sh"

SKILLS="$HOME/.claude/skills"
mkdir -p "$SKILLS"
for s in "$REPO"/.claude/skills/kk-*; do
  name="$(basename "$s")"
  rm -rf "${SKILLS:?}/$name"
  ln -s "$s" "$SKILLS/$name" 2>/dev/null || cp -R "$s" "$SKILLS/$name"   # copy where links are not allowed (Windows)
  echo "  skill /$name installed"
done

# So the skills can find the engine from any folder.
mkdir -p "$HOME/.kkverse"
if [ "$STUDIO" != "$HOME/.kkverse/studio" ]; then
  rm -rf "$HOME/.kkverse/studio"
  ln -s "$STUDIO" "$HOME/.kkverse/studio" 2>/dev/null || echo "  Note: clone the repository to ~/.kkverse so the skills can find the studio from any folder."
fi
if [ -d "$HOME/.local/bin" ]; then ln -sf "$STUDIO/bin/kkv" "$HOME/.local/bin/kkv" 2>/dev/null || true; fi

echo
echo "Done. Restart Claude Code, drag a video into the chat and type:  /kk-reel"
