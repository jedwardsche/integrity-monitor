#!/bin/bash
# Simple script to remove backend/.env from git history

set -e

cd "$(dirname "$0")/.."

echo "Removing backend/.env from git history..."
echo ""

# Check if git-filter-repo is available
if command -v git-filter-repo &> /dev/null; then
    echo "Using git-filter-repo (recommended)..."
    git filter-repo --path backend/.env --invert-paths --force
    echo "✅ Done with git-filter-repo"
else
    echo "Using git filter-branch..."
    echo "⚠️  This may take a while and will rewrite all history"
    echo ""
    read -p "Continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Aborted. Install git-filter-repo for a better experience:"
        echo "  pip install git-filter-repo"
        echo "  OR"
        echo "  brew install git-filter-repo"
        exit 1
    fi
    
    FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch --force --index-filter \
        'git rm --cached --ignore-unmatch backend/.env' \
        --prune-empty --tag-name-filter cat -- --all
    
    # Clean up
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
    
    echo "✅ Done with filter-branch"
fi

echo ""
echo "⚠️  IMPORTANT: Force push required:"
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
echo ""
echo "⚠️  WARNING: This rewrites history. Make sure you coordinate with your team!"
