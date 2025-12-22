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
SECRETS=("AIRTABLE_PAT" "API_AUTH_TOKEN" "OPENAI_API_KEY")
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

# Check service account permissions
echo "Checking service account permissions..."
SERVICE_ACCOUNT=$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --format="value(spec.template.spec.serviceAccountName)" 2>/dev/null || echo "")
if [ -z "$SERVICE_ACCOUNT" ]; then
    SERVICE_ACCOUNT="${PROJECT_ID}-compute@developer.gserviceaccount.com"
fi
echo "Service Account: ${SERVICE_ACCOUNT}"
echo ""

# Grant secret access if needed
for secret in "${SECRETS[@]}"; do
    if ! gcloud secrets get-iam-policy "$secret" --project="$PROJECT_ID" 2>/dev/null | grep -q "${SERVICE_ACCOUNT}"; then
        echo "Granting access to ${secret}..."
        gcloud secrets add-iam-policy-binding "$secret" \
            --member="serviceAccount:${SERVICE_ACCOUNT}" \
            --role="roles/secretmanager.secretAccessor" \
            --project="${PROJECT_ID}" &>/dev/null
        echo "   ✓ Access granted"
    fi
done
echo ""

# Update Cloud Run service with secret references
echo "Updating Cloud Run service with secret references..."
echo "⚠️  Note: This will create a new revision. If deployment fails, check logs:"
echo "   ./troubleshoot-cloud-run.sh"
echo ""

gcloud run services update "${SERVICE_NAME}" \
  --update-secrets=AIRTABLE_PAT=AIRTABLE_PAT:latest \
  --update-secrets=API_AUTH_TOKEN=API_AUTH_TOKEN:latest \
  --update-secrets=OPENAI_API_KEY=OPENAI_API_KEY:latest \
  --region="${REGION}" \
  --project="${PROJECT_ID}"

echo ""
echo "✅ Cloud Run service updated successfully!"
echo ""
echo "Secrets are now injected as environment variables:"
echo "  - AIRTABLE_PAT"
echo "  - API_AUTH_TOKEN"
echo "  - OPENAI_API_KEY"
echo ""
echo "The service will automatically restart with the new configuration."
