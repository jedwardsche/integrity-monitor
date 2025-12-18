#!/bin/bash
# Pre-commit hook to detect secrets before commit

set -e

echo "🔍 Checking for secrets..."

# Check for common secret patterns
FORBIDDEN_PATTERNS=(
  "VITE_.*KEY"
  "VITE_.*TOKEN"
  "VITE_.*SECRET"
  "VITE_.*PASSWORD"
  "sk-[a-zA-Z0-9]{20,}"        # OpenAI
  "AKIA[0-9A-Z]{16}"            # AWS
  "xoxb-[0-9]+"                 # Slack
  "sk_live_[a-zA-Z0-9]+"        # Stripe
  "pat[a-zA-Z0-9]{20,}"         # Airtable PAT
  "-----BEGIN PRIVATE KEY-----" # Private keys
  "-----BEGIN RSA PRIVATE KEY-----"
)

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  if git diff --cached --diff-filter=d | grep -E "$pattern" > /dev/null 2>&1; then
    echo "❌ ERROR: Forbidden secret pattern detected: $pattern"
    echo "   Remove secrets before committing"
    exit 1
  fi
done

# Check for service account files
if git diff --cached --name-only | grep -E "service.*account.*\.json|credentials.*\.json" > /dev/null 2>&1; then
  echo "❌ ERROR: Service account or credentials file detected"
  echo "   These files should never be committed"
  exit 1
fi

# Check for .env files with actual secrets (not .env.example)
STAGED_ENV_FILES=$(git diff --cached --name-only | grep -E "\.env$|\.env\.[^e]|\.env\.[^x]|\.env\.[^a]|\.env\.[^m]|\.env\.[^p]|\.env\.[^l]|\.env\.[^e]" | grep -v "\.env\.example" || true)
if [ -n "$STAGED_ENV_FILES" ]; then
  echo "❌ ERROR: .env files detected in staged changes:"
  echo "$STAGED_ENV_FILES"
  echo "   Only .env.example files should be committed"
  exit 1
fi

echo "✅ No secrets detected"
exit 0
