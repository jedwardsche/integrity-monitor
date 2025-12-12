#!/bin/bash

# Create Cloud Monitoring alert policies
# Usage: ./create-alerts.sh [dev|staging|prod]

set -e

ENVIRONMENT=${1:-dev}
PROJECT_ID=${GCP_PROJECT_ID:-}
REGION=${CLOUD_RUN_REGION:-us-central1}
SERVICE_NAME="integrity-runner"
SLACK_WEBHOOK=${SLACK_WEBHOOK_URL:-}
EMAIL=${ALERT_EMAIL:-}

if [ -z "$PROJECT_ID" ]; then
    echo "Error: GCP_PROJECT_ID environment variable not set"
    exit 1
fi

echo "Creating Cloud Monitoring alerts for environment: $ENVIRONMENT"
echo "Project: $PROJECT_ID"

# Create notification channels (if they don't exist)
NOTIFICATION_CHANNELS=""

if [ -n "$SLACK_WEBHOOK" ]; then
    echo "Creating Slack notification channel..."
    SLACK_CHANNEL=$(gcloud alpha monitoring channels create \
        --display-name="Integrity Monitor Slack" \
        --type=webhook \
        --channel-labels=url=${SLACK_WEBHOOK} \
        --project=${PROJECT_ID} \
        --format='value(name)' 2>/dev/null || \
        gcloud alpha monitoring channels list \
        --filter='displayName="Integrity Monitor Slack"' \
        --format='value(name)' \
        --project=${PROJECT_ID} | head -1)
    if [ -n "$SLACK_CHANNEL" ]; then
        NOTIFICATION_CHANNELS="${NOTIFICATION_CHANNELS} --notification-channels=${SLACK_CHANNEL}"
    fi
fi

if [ -n "$EMAIL" ]; then
    echo "Creating email notification channel..."
    EMAIL_CHANNEL=$(gcloud alpha monitoring channels create \
        --display-name="Integrity Monitor Email" \
        --type=email \
        --channel-labels=email_address=${EMAIL} \
        --project=${PROJECT_ID} \
        --format='value(name)' 2>/dev/null || \
        gcloud alpha monitoring channels list \
        --filter='displayName="Integrity Monitor Email"' \
        --format='value(name)' \
        --project=${PROJECT_ID} | head -1)
    if [ -n "$EMAIL_CHANNEL" ]; then
        NOTIFICATION_CHANNELS="${NOTIFICATION_CHANNELS} --notification-channels=${EMAIL_CHANNEL}"
    fi
fi

if [ -z "$NOTIFICATION_CHANNELS" ]; then
    echo "Warning: No notification channels configured. Alerts will be created but won't send notifications."
fi

# Alert 1: Consecutive Failures
echo "Creating alert: Consecutive Failures..."
gcloud alpha monitoring policies create \
    --display-name="Integrity Run - Consecutive Failures" \
    --condition-display-name="2+ consecutive run failures" \
    --condition-threshold-value=2 \
    --condition-threshold-duration=3600s \
    --condition-aggregations=alignment-period=300s,per-series-aligner=ALIGN_RATE,group-by-fields=resource.service_name \
    --condition-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="'${SERVICE_NAME}'" AND severity>=ERROR' \
    --notification-channels=${NOTIFICATION_CHANNELS} \
    --project=${PROJECT_ID} \
    2>/dev/null || echo "Alert policy may already exist or failed to create"

# Alert 2: Runtime Exceeded
echo "Creating alert: Runtime Exceeded..."
gcloud alpha monitoring policies create \
    --display-name="Integrity Run - Runtime Exceeded" \
    --condition-display-name="Run duration > 15 minutes" \
    --condition-threshold-value=900 \
    --condition-threshold-duration=60s \
    --condition-aggregations=alignment-period=60s,per-series-aligner=ALIGN_DELTA,group-by-fields=resource.service_name \
    --condition-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="'${SERVICE_NAME}'" AND metric.type="run.googleapis.com/request_latencies"' \
    --notification-channels=${NOTIFICATION_CHANNELS} \
    --project=${PROJECT_ID} \
    2>/dev/null || echo "Alert policy may already exist or failed to create"

# Alert 3: High Issue Count (requires Firestore metric or custom metric)
echo "Note: High Issue Count alert requires custom metric setup in Firestore."
echo "This alert should be configured manually via Cloud Console or Terraform."

echo "Alert creation complete!"
echo "Note: Some alerts may require manual configuration in Cloud Console."

