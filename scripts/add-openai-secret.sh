#!/bin/bash
# Add OPENAI_API_KEY to Google Secret Manager

set -e

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

SECRET_NAME="OPENAI_API_KEY"

echo "Adding ${SECRET_NAME} to Secret Manager for project: ${PROJECT_ID}"
echo ""
echo "Please enter your OpenAI API key:"
read -s SECRET_VALUE

if [ -z "$SECRET_VALUE" ]; then
    echo "Error: No value provided"
    exit 1
fi

# Check if secret exists
if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" &>/dev/null; then
    echo "📝 ${SECRET_NAME}: Secret exists, creating new version..."
    echo -n "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_NAME" \
        --data-file=- \
        --project="$PROJECT_ID" &>/dev/null
    echo "   ✓ Updated with new version"
else
    echo "✨ ${SECRET_NAME}: Creating new secret..."
    echo -n "$SECRET_VALUE" | gcloud secrets create "$SECRET_NAME" \
        --data-file=- \
        --replication-policy="automatic" \
        --project="$PROJECT_ID" &>/dev/null
    echo "   ✓ Created successfully"
fi

echo ""
echo "✅ Secret added to Secret Manager!"
echo ""
echo "Next steps:"
echo "1. Update Cloud Run service:"
echo "   cd deploy && ./configure-cloud-run-secrets.sh"
echo ""
echo "2. For local development, the secret will be automatically fetched from Secret Manager"
echo "   when the backend starts (if not found in environment variables)."
