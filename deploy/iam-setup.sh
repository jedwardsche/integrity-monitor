#!/bin/bash

# Set up IAM service accounts and permissions
# Usage: ./iam-setup.sh [dev|staging|prod]

set -e

ENVIRONMENT=${1:-dev}
PROJECT_ID=${GCP_PROJECT_ID:-}
REGION=${CLOUD_RUN_REGION:-us-central1}
SERVICE_NAME="integrity-runner"

if [ -z "$PROJECT_ID" ]; then
    echo "Error: GCP_PROJECT_ID environment variable not set"
    exit 1
fi

echo "Setting up IAM for environment: $ENVIRONMENT"
echo "Project: $PROJECT_ID"

# Service account for Cloud Run
RUNNER_SA="integrity-runner@${PROJECT_ID}.iam.gserviceaccount.com"
echo "Creating service account: ${RUNNER_SA}..."
gcloud iam service-accounts create integrity-runner \
    --display-name="Integrity Monitor Runner" \
    --description="Service account for Cloud Run integrity runner" \
    --project=${PROJECT_ID} \
    2>/dev/null || echo "Service account may already exist"

# Grant Firestore access
echo "Granting Firestore access..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${RUNNER_SA}" \
    --role="roles/datastore.user" \
    --condition=None

# Grant Secret Manager access
echo "Granting Secret Manager access..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${RUNNER_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None

# Service account for Cloud Scheduler
SCHEDULER_SA="cloud-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"
echo "Creating service account: ${SCHEDULER_SA}..."
gcloud iam service-accounts create cloud-scheduler \
    --display-name="Cloud Scheduler Invoker" \
    --description="Service account for Cloud Scheduler to invoke Cloud Run" \
    --project=${PROJECT_ID} \
    2>/dev/null || echo "Service account may already exist"

# Grant Cloud Run Invoker role
echo "Granting Cloud Run Invoker role..."
gcloud run services add-iam-policy-binding ${SERVICE_NAME} \
    --region=${REGION} \
    --member="serviceAccount:${SCHEDULER_SA}" \
    --role="roles/run.invoker" \
    --project=${PROJECT_ID} \
    2>/dev/null || echo "IAM binding may already exist"

echo "IAM setup complete!"
echo "Service accounts:"
echo "  - ${RUNNER_SA} (Cloud Run)"
echo "  - ${SCHEDULER_SA} (Cloud Scheduler)"

