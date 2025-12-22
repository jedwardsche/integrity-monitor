#!/bin/bash
# Remove OPENAI_API_KEY from git history using git-filter-repo
# 
# Prerequisites:
#   pip install git-filter-repo
#   OR
#   brew install git-filter-repo

set -e

echo "⚠️  WARNING: This will rewrite git history!"
echo "Make sure you have a backup of your repository."
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

# Get the secret value that was exposed (from the error message)
SECRET_VALUE="REDACTED"

echo ""
echo "Removing secret from git history..."

# Use git-filter-repo to remove the secret
git filter-repo --replace-text <(echo "$SECRET_VALUE==>REDACTED") --force

echo ""
echo "✅ Secret removed from git history!"
echo ""
echo "⚠️  IMPORTANT: You must force push to update the remote repository:"
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
echo ""
echo "⚠️  WARNING: This will rewrite history on the remote. Coordinate with your team first!"
