#!/bin/bash
# deploy.sh — Déploie yzegenerique vers Foundry ET push sur Git
# Usage: ./deploy.sh [chemin_foundry_data]
# Exemple: ./deploy.sh ~/foundrydata/Data/systems

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FOUNDRY_SYSTEMS="${1:-$HOME/foundrydata/Data/systems}"
DEST="$FOUNDRY_SYSTEMS/yzegenerique"

echo "🎲 YZE Générique — Deploy"
echo "  Source : $SCRIPT_DIR"
echo "  Dest   : $DEST"

# ── Copie vers Foundry ─────────────────────────────────────────────
if [ -d "$FOUNDRY_SYSTEMS" ]; then
  echo ""
  echo "📁 Copying to Foundry..."
  rsync -av --delete \
    --exclude='.git' \
    --exclude='deploy.sh' \
    --exclude='*.zip' \
    --exclude='.DS_Store' \
    "$SCRIPT_DIR/" "$DEST/"
  echo "✓ Foundry copy done"
else
  echo "⚠  Foundry systems dir not found: $FOUNDRY_SYSTEMS"
  echo "   Pass the path as argument: ./deploy.sh /path/to/systems"
fi

# ── Git push ───────────────────────────────────────────────────────
cd "$SCRIPT_DIR"
if [ -d ".git" ]; then
  echo ""
  echo "🔀 Git push..."
  git add -A
  MSG="${2:-update}"
  git commit -m "$MSG" 2>/dev/null || echo "  (nothing to commit)"
  git push
  echo "✓ Git push done"
else
  echo "⚠  No .git directory found — skipping git push"
fi

echo ""
echo "✅ Deploy complete!"
