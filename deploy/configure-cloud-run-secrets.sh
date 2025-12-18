#!/bin/bash
# Configure Cloud Run service to inject secrets from Secret Manager

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

REGION=${CLOUD_RUN_REGION:-us-central1}
SERVICE_NAME="integrity-runner"

echo "Configuring Cloud Run service: ${SERVICE_NAME}"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo ""

# Check if secrets exist
echo "Verifying secrets exist in Secret Manager..."
SECRETS=("AIRTABLE_PAT" "API_AUTH_TOKEN")
MISSING_SECRETS=()

for secret in "${SECRETS[@]}"; do
    if ! gcloud secrets describe "$secret" --project="$PROJECT_ID" &>/dev/null; then
        MISSING_SECRETS+=("$secret")
    fi
done

if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
    echo "❌ Error: The following secrets are missing from Secret Manager:"
    for secret in "${MISSING_SECRETS[@]}"; do
        echo "   - ${secret}"
    done
    echo ""
    echo "Create them first using:"
    echo "  cd deploy && ./create-secrets.sh"
    exit 1
fi

echo "✅ All required secrets found in Secret Manager"
echo ""

# Update Cloud Run service with secret references
echo "Updating Cloud Run service with secret references..."
gcloud run services update "${SERVICE_NAME}" \
  --update-secrets=AIRTABLE_PAT=AIRTABLE_PAT:latest \
  --update-secrets=API_AUTH_TOKEN=API_AUTH_TOKEN:latest \
  --region="${REGION}" \
  --project="${PROJECT_ID}"

echo ""
echo "✅ Cloud Run service updated successfully!"
echo ""
echo "Secrets are now injected as environment variables:"
echo "  - AIRTABLE_PAT"
echo "  - API_AUTH_TOKEN"
echo ""
echo "The service will automatically restart with the new configuration."
