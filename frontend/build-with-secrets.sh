#!/bin/bash
# Build frontend with Firebase config secrets from Secret Manager

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PROJECT_ID=${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || echo "")}
if [ -z "$PROJECT_ID" ]; then
    if [ -f "../.firebaserc" ]; then
        PROJECT_ID=$(grep -o '"default":\s*"[^"]*"' "../.firebaserc" | cut -d'"' -f4)
    fi
fi

if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID not found"
    echo "Set GCP_PROJECT_ID environment variable or configure gcloud"
    exit 1
fi

echo "Building frontend with secrets from Secret Manager..."
echo "Project: ${PROJECT_ID}"
echo "Working directory: $(pwd)"
echo ""

# Fetch Firebase config secrets from Secret Manager
echo "Fetching Firebase config secrets..."

export VITE_FIREBASE_API_KEY=$(gcloud secrets versions access latest --secret="FIREBASE_API_KEY" --project="$PROJECT_ID" 2>/dev/null || echo "")
export VITE_FIREBASE_AUTH_DOMAIN=$(gcloud secrets versions access latest --secret="FIREBASE_AUTH_DOMAIN" --project="$PROJECT_ID" 2>/dev/null || echo "")
export VITE_FIREBASE_PROJECT_ID=$(gcloud secrets versions access latest --secret="FIREBASE_PROJECT_ID" --project="$PROJECT_ID" 2>/dev/null || echo "")
export VITE_FIREBASE_STORAGE_BUCKET=$(gcloud secrets versions access latest --secret="FIREBASE_STORAGE_BUCKET" --project="$PROJECT_ID" 2>/dev/null || echo "")
export VITE_FIREBASE_MESSAGING_SENDER_ID=$(gcloud secrets versions access latest --secret="FIREBASE_MESSAGING_SENDER_ID" --project="$PROJECT_ID" 2>/dev/null || echo "")
export VITE_FIREBASE_APP_ID=$(gcloud secrets versions access latest --secret="FIREBASE_APP_ID" --project="$PROJECT_ID" 2>/dev/null || echo "")

# Check if any secrets are missing
MISSING_SECRETS=()
[ -z "$VITE_FIREBASE_API_KEY" ] && MISSING_SECRETS+=("FIREBASE_API_KEY")
[ -z "$VITE_FIREBASE_AUTH_DOMAIN" ] && MISSING_SECRETS+=("FIREBASE_AUTH_DOMAIN")
[ -z "$VITE_FIREBASE_PROJECT_ID" ] && MISSING_SECRETS+=("FIREBASE_PROJECT_ID")
[ -z "$VITE_FIREBASE_STORAGE_BUCKET" ] && MISSING_SECRETS+=("FIREBASE_STORAGE_BUCKET")
[ -z "$VITE_FIREBASE_MESSAGING_SENDER_ID" ] && MISSING_SECRETS+=("FIREBASE_MESSAGING_SENDER_ID")
[ -z "$VITE_FIREBASE_APP_ID" ] && MISSING_SECRETS+=("FIREBASE_APP_ID")

if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
    echo "⚠️  Warning: Some Firebase secrets are missing from Secret Manager:"
    for secret in "${MISSING_SECRETS[@]}"; do
        echo "     - ${secret}"
    done
    echo ""
    echo "Falling back to .env.local if available..."
    echo ""
    
    # Fall back to .env.local if it exists
    if [ -f ".env.local" ]; then
        echo "Loading from .env.local..."
        set -a
        source .env.local
        set +a
    fi
fi

# Ensure we're in the frontend directory (should already be there, but be safe)
cd "$SCRIPT_DIR"

# Build the frontend
echo "Building frontend..."
npm run build

echo ""
echo "✅ Build complete!"
