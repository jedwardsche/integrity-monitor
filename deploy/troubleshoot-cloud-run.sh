#!/bin/bash
# Troubleshoot Cloud Run deployment failures

set -e

PROJECT_ID=${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || echo "")}
if [ -z "$PROJECT_ID" ]; then
    if [ -f "../.firebaserc" ]; then
        PROJECT_ID=$(grep -o '"default":\s*"[^"]*"' "../.firebaserc" | cut -d'"' -f4)
    fi
fi

if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID not found"
    exit 1
fi

REGION=${CLOUD_RUN_REGION:-us-central1}
SERVICE_NAME="integrity-runner"

echo "Troubleshooting Cloud Run service: ${SERVICE_NAME}"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo ""

# Check if service exists
echo "1. Checking if service exists..."
if ! gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "   ❌ Service does not exist"
    exit 1
fi
echo "   ✅ Service exists"
echo ""

# Check secrets
echo "2. Checking secrets in Secret Manager..."
SECRETS=("AIRTABLE_PAT" "API_AUTH_TOKEN" "OPENAI_API_KEY")
for secret in "${SECRETS[@]}"; do
    if gcloud secrets describe "$secret" --project="$PROJECT_ID" &>/dev/null; then
        echo "   ✅ $secret exists"
    else
        echo "   ❌ $secret MISSING"
    fi
done
echo ""

# Check service account permissions
echo "3. Checking service account permissions..."
SERVICE_ACCOUNT=$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --format="value(spec.template.spec.serviceAccountName)" 2>/dev/null || echo "")
if [ -z "$SERVICE_ACCOUNT" ]; then
    SERVICE_ACCOUNT="${PROJECT_ID}-compute@developer.gserviceaccount.com"
fi
echo "   Service Account: ${SERVICE_ACCOUNT}"

for secret in "${SECRETS[@]}"; do
    if gcloud secrets get-iam-policy "$secret" --project="$PROJECT_ID" 2>/dev/null | grep -q "${SERVICE_ACCOUNT}"; then
        echo "   ✅ $secret: Service account has access"
    else
        echo "   ❌ $secret: Service account MISSING access"
        echo "      Grant access with:"
        echo "      gcloud secrets add-iam-policy-binding $secret \\"
        echo "        --member=\"serviceAccount:${SERVICE_ACCOUNT}\" \\"
        echo "        --role=\"roles/secretmanager.secretAccessor\" \\"
        echo "        --project=\"${PROJECT_ID}\""
    fi
done
echo ""

# Get latest revision logs
echo "4. Fetching latest revision logs..."
LATEST_REVISION=$(gcloud run revisions list --service="${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --limit=1 --format="value(name)" 2>/dev/null || echo "")
if [ -n "$LATEST_REVISION" ]; then
    echo "   Latest revision: ${LATEST_REVISION}"
    echo ""
    echo "   Recent logs (last 50 lines):"
    gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=${SERVICE_NAME} AND resource.labels.revision_name=${LATEST_REVISION}" \
        --limit=50 \
        --project="${PROJECT_ID}" \
        --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
        --freshness=1h 2>&1 | head -60 || echo "   (Could not fetch logs)"
else
    echo "   ❌ No revisions found"
fi
echo ""

# Check current service configuration
echo "5. Current service configuration:"
gcloud run services describe "${SERVICE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --format="yaml(spec.template.spec.containers[0].env,spec.template.spec.containers[0].image)" 2>/dev/null || echo "   (Could not fetch configuration)"
echo ""

echo "════════════════════════════════════════"
echo "Next steps:"
echo "1. If secrets are missing, create them:"
echo "   cd deploy && ./create-secrets.sh"
echo ""
echo "2. If permissions are missing, grant access (see above)"
echo ""
echo "3. If container is failing, check logs URL:"
echo "   https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}/logs?project=${PROJECT_ID}"
echo ""
echo "4. Try rolling back to previous revision:"
echo "   gcloud run services update-traffic ${SERVICE_NAME} \\"
echo "     --to-revisions=PREVIOUS_REVISION=100 \\"
echo "     --region=${REGION} \\"
echo "     --project=${PROJECT_ID}"
