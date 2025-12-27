#!/bin/bash
# Check current Cloud Run service configuration

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

echo "Checking Cloud Run service configuration..."
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo ""

# Get current configuration
echo "Current resource configuration:"
gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --format="table(
    spec.template.spec.containers[0].resources.limits.memory,
    spec.template.spec.containers[0].resources.limits.cpu,
    spec.template.spec.containerConcurrency,
    spec.template.spec.timeoutSeconds
  )" 2>&1 || echo "❌ Failed to get service configuration. Service may not exist or you may not have permissions."

echo ""
echo "Current environment variables:"
gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --format="get(spec.template.spec.containers[0].env)" 2>&1 | grep -E "(AIRTABLE_MIN_REQUEST_INTERVAL|ALLOWED_ORIGINS)" || echo "No relevant env vars found"

echo ""
echo "Expected configuration:"
echo "  Memory: 4Gi"
echo "  CPU: 2"
echo "  Concurrency: 80"
echo "  Timeout: 1800s (30m)"
echo "  AIRTABLE_MIN_REQUEST_INTERVAL: 0.05"
echo ""
echo "If these don't match, run: cd deploy && ./redeploy-backend.sh"

