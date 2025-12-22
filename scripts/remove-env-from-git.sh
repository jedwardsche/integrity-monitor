#!/bin/bash
# Remove backend/.env from git tracking and commit history

set -e

echo "⚠️  This script will remove backend/.env from git history"
echo "The local file will be preserved (it's already in .gitignore)"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

cd "$(dirname "$0")/.."

# Step 1: Remove from git tracking (but keep local file)
echo ""
echo "Step 1: Removing backend/.env from git tracking..."
git rm --cached backend/.env 2>/dev/null || echo "   (File not in index)"

# Step 2: Commit the removal
echo "Step 2: Committing removal..."
git add .gitignore  # Ensure .gitignore is up to date
git commit -m "Remove backend/.env from git tracking (contains secrets)" || echo "   (No changes to commit)"

# Step 3: Remove from git history using git filter-repo (preferred) or filter-branch
echo ""
echo "Step 3: Removing from git history..."

if command -v git-filter-repo &> /dev/null; then
    echo "   Using git-filter-repo..."
    git filter-repo --path backend/.env --invert-paths --force
    echo "   ✅ History rewritten with git-filter-repo"
elif command -v bfg &> /dev/null; then
    echo "   Using BFG Repo-Cleaner..."
    # BFG requires Java and is more complex, so we'll skip it for now
    echo "   ⚠️  BFG found but not configured. Using filter-branch instead..."
    FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch --force --index-filter \
        'git rm --cached --ignore-unmatch backend/.env' \
        --prune-empty --tag-name-filter cat -- --all
    echo "   ✅ History rewritten with filter-branch"
else
    echo "   Using git filter-branch..."
    FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch --force --index-filter \
        'git rm --cached --ignore-unmatch backend/.env' \
        --prune-empty --tag-name-filter cat -- --all
    echo "   ✅ History rewritten with filter-branch"
fi

# Clean up
echo ""
echo "Step 4: Cleaning up..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "✅ Done! backend/.env has been removed from git history"
echo ""
echo "⚠️  IMPORTANT: You must force push to update the remote:"
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
echo ""
echo "⚠️  WARNING: This rewrites history. Coordinate with your team first!"
