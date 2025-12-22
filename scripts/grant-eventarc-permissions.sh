#!/bin/bash

# Grant Eventarc Service Agent permissions for Firestore-triggered Cloud Functions
# This fixes the "Permission denied while using the Eventarc Service Agent" error

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

echo "Granting Eventarc Service Agent permissions..."
echo "Project: ${PROJECT_ID}"
echo ""

# Get the project number
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")

if [ -z "$PROJECT_NUMBER" ]; then
    echo "Error: Could not get project number"
    exit 1
fi

EVENTARC_SA="service-${PROJECT_NUMBER}@gcp-sa-eventarc.iam.gserviceaccount.com"

echo "Eventarc Service Agent: ${EVENTARC_SA}"
echo ""

# Grant Eventarc Service Agent role
echo "Granting roles/eventarc.serviceAgent..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${EVENTARC_SA}" \
    --role="roles/eventarc.serviceAgent" \
    --condition=None

echo ""
echo "✓ Permissions granted successfully!"
echo ""
echo "You can now retry the deployment:"
echo "  firebase deploy --only functions:updateScheduleExecutionStatus"
echo ""
echo "Note: It may take a few minutes for permissions to propagate."
