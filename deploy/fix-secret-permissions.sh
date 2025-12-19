#!/bin/bash
# Quick fix for Secret Manager permissions

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

SERVICE_ACCOUNT="${PROJECT_ID}-compute@developer.gserviceaccount.com"

echo "Granting Secret Manager access to: ${SERVICE_ACCOUNT}"
echo "Project: ${PROJECT_ID}"
echo ""

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"

echo ""
echo "✓ Permissions granted successfully!"
echo "You can now retry the deployment."
