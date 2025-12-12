#!/bin/bash

# Create Cloud Scheduler jobs for integrity runs
# Usage: ./create-scheduler.sh [dev|staging|prod]

set -e

ENVIRONMENT=${1:-dev}
PROJECT_ID=${GCP_PROJECT_ID:-}
REGION=${CLOUD_RUN_REGION:-us-central1}
SERVICE_NAME="integrity-runner"
SERVICE_URL=${CLOUD_RUN_SERVICE_URL:-}
INVOKER_SA="cloud-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"

if [ -z "$PROJECT_ID" ]; then
    echo "Error: GCP_PROJECT_ID environment variable not set"
    exit 1
fi

if [ -z "$SERVICE_URL" ]; then
    echo "Fetching service URL..."
    SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)' --project ${PROJECT_ID})
    if [ -z "$SERVICE_URL" ]; then
        echo "Error: Could not determine Cloud Run service URL"
        exit 1
    fi
fi

echo "Creating Cloud Scheduler jobs for environment: $ENVIRONMENT"
echo "Project: $PROJECT_ID"
echo "Service URL: $SERVICE_URL"

# Nightly job (02:00 AM)
echo "Creating nightly job..."
gcloud scheduler jobs create http integrity-nightly \
    --location=${REGION} \
    --schedule="0 2 * * *" \
    --uri="${SERVICE_URL}/integrity/run?mode=incremental" \
    --http-method=POST \
    --oidc-service-account-email=${INVOKER_SA} \
    --oidc-token-audience=${SERVICE_URL} \
    --attempt-deadline=20m \
    --max-retry-attempts=3 \
    --min-backoff-duration=1m \
    --max-backoff-duration=15m \
    --max-doublings=3 \
    --time-zone="America/New_York" \
    --headers="X-CloudScheduler-Source=nightly" \
    --project=${PROJECT_ID} \
    --description="Nightly incremental integrity scan" \
    2>/dev/null || gcloud scheduler jobs update http integrity-nightly \
    --location=${REGION} \
    --schedule="0 2 * * *" \
    --uri="${SERVICE_URL}/integrity/run?mode=incremental" \
    --http-method=POST \
    --oidc-service-account-email=${INVOKER_SA} \
    --oidc-token-audience=${SERVICE_URL} \
    --attempt-deadline=20m \
    --max-retry-attempts=3 \
    --min-backoff-duration=1m \
    --max-backoff-duration=15m \
    --max-doublings=3 \
    --time-zone="America/New_York" \
    --headers="X-CloudScheduler-Source=nightly" \
    --project=${PROJECT_ID}

# Weekly job (Sunday 03:00 AM)
echo "Creating weekly job..."
gcloud scheduler jobs create http integrity-weekly \
    --location=${REGION} \
    --schedule="0 3 * * 0" \
    --uri="${SERVICE_URL}/integrity/run?mode=full" \
    --http-method=POST \
    --oidc-service-account-email=${INVOKER_SA} \
    --oidc-token-audience=${SERVICE_URL} \
    --attempt-deadline=20m \
    --max-retry-attempts=3 \
    --min-backoff-duration=1m \
    --max-backoff-duration=15m \
    --max-doublings=3 \
    --time-zone="America/New_York" \
    --headers="X-CloudScheduler-Source=weekly" \
    --project=${PROJECT_ID} \
    --description="Weekly full integrity scan" \
    2>/dev/null || gcloud scheduler jobs update http integrity-weekly \
    --location=${REGION} \
    --schedule="0 3 * * 0" \
    --uri="${SERVICE_URL}/integrity/run?mode=full" \
    --http-method=POST \
    --oidc-service-account-email=${INVOKER_SA} \
    --oidc-token-audience=${SERVICE_URL} \
    --attempt-deadline=20m \
    --max-retry-attempts=3 \
    --min-backoff-duration=1m \
    --max-backoff-duration=15m \
    --max-doublings=3 \
    --time-zone="America/New_York" \
    --headers="X-CloudScheduler-Source=weekly" \
    --project=${PROJECT_ID}

# Weekly KPI sampling job (Sunday 04:00 AM, after weekly scan)
echo "Creating weekly KPI sampling job..."
gcloud scheduler jobs create http integrity-kpi-weekly \
    --location=${REGION} \
    --schedule="0 4 * * 0" \
    --uri="${SERVICE_URL}/integrity/kpi/sample" \
    --http-method=POST \
    --oidc-service-account-email=${INVOKER_SA} \
    --oidc-token-audience=${SERVICE_URL} \
    --attempt-deadline=20m \
    --max-retry-attempts=3 \
    --min-backoff-duration=1m \
    --max-backoff-duration=15m \
    --max-doublings=3 \
    --time-zone="America/New_York" \
    --headers="X-CloudScheduler-Source=kpi-weekly" \
    --project=${PROJECT_ID} \
    --description="Weekly KPI sampling for anomaly detection measurement" \
    2>/dev/null || gcloud scheduler jobs update http integrity-kpi-weekly \
    --location=${REGION} \
    --schedule="0 4 * * 0" \
    --uri="${SERVICE_URL}/integrity/kpi/sample" \
    --http-method=POST \
    --oidc-service-account-email=${INVOKER_SA} \
    --oidc-token-audience=${SERVICE_URL} \
    --attempt-deadline=20m \
    --max-retry-attempts=3 \
    --min-backoff-duration=1m \
    --max-backoff-duration=15m \
    --max-doublings=3 \
    --time-zone="America/New_York" \
    --headers="X-CloudScheduler-Source=kpi-weekly" \
    --project=${PROJECT_ID}

echo "Scheduler jobs created successfully!"
echo "Nightly job: integrity-nightly (runs at 02:00 AM)"
echo "Weekly job: integrity-weekly (runs Sunday at 03:00 AM)"
echo "KPI sampling job: integrity-kpi-weekly (runs Sunday at 04:00 AM)"

