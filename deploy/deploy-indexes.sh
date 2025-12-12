#!/bin/bash

# Deploy Firestore indexes
# Usage: ./deploy-indexes.sh

set -e

PROJECT_ID=${GCP_PROJECT_ID:-}

if [ -z "$PROJECT_ID" ]; then
    echo "Error: GCP_PROJECT_ID environment variable not set"
    exit 1
fi

echo "Deploying Firestore indexes to project: $PROJECT_ID"

# Deploy indexes from configuration file
gcloud firestore indexes create --project ${PROJECT_ID} --index-file=firestore.indexes.json

echo ""
echo "Firestore indexes deployment initiated!"
echo "Note: Index creation can take several minutes to complete."
echo "Check status at: https://console.cloud.google.com/firestore/indexes?project=${PROJECT_ID}"
