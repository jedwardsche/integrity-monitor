#!/bin/bash

# Deployment script for Cloud Run service
# Usage: ./deploy.sh [dev|staging|prod]

set -e

ENVIRONMENT=${1:-dev}
PROJECT_ID=${GCP_PROJECT_ID:-}
REGION=${CLOUD_RUN_REGION:-us-central1}
SERVICE_NAME="integrity-runner"
ARTIFACT_REGISTRY="integrity-monitor"
SERVICE_ACCOUNT="integrity-runner@${PROJECT_ID}.iam.gserviceaccount.com"

if [ -z "$PROJECT_ID" ]; then
    echo "Error: GCP_PROJECT_ID environment variable not set"
    exit 1
fi

echo "Deploying to environment: $ENVIRONMENT"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"

# Set environment-specific values
case $ENVIRONMENT in
    dev)
        MIN_INSTANCES=0
        MAX_INSTANCES=2
        ;;
    staging)
        MIN_INSTANCES=0
        MAX_INSTANCES=5
        ;;
    prod)
        MIN_INSTANCES=0
        MAX_INSTANCES=10
        ;;
    *)
        echo "Error: Invalid environment. Use dev, staging, or prod"
        exit 1
        ;;
esac

# Build and push image
echo "Building Docker image..."
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REGISTRY}/${SERVICE_NAME}:latest ./backend

echo "Pushing to Artifact Registry..."
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REGISTRY}/${SERVICE_NAME}:latest

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REGISTRY}/${SERVICE_NAME}:latest \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --service-account ${SERVICE_ACCOUNT} \
    --memory 1Gi \
    --cpu 1 \
    --timeout 15m \
    --min-instances ${MIN_INSTANCES} \
    --max-instances ${MAX_INSTANCES} \
    --set-env-vars ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-*} \
    --set-secrets AIRTABLE_API_KEY=AIRTABLE_API_KEY:latest \
    --set-secrets API_AUTH_TOKEN=API_AUTH_TOKEN:latest \
    --set-secrets AT_STUDENTS_BASE=AT_STUDENTS_BASE:latest \
    --set-secrets AT_STUDENTS_TABLE=AT_STUDENTS_TABLE:latest \
    --set-secrets AT_PARENTS_BASE=AT_PARENTS_BASE:latest \
    --set-secrets AT_PARENTS_TABLE=AT_PARENTS_TABLE:latest \
    --set-secrets AT_CONTRACTORS_BASE=AT_CONTRACTORS_BASE:latest \
    --set-secrets AT_CONTRACTORS_TABLE=AT_CONTRACTORS_TABLE:latest \
    --set-secrets AT_CLASSES_BASE=AT_CLASSES_BASE:latest \
    --set-secrets AT_CLASSES_TABLE=AT_CLASSES_TABLE:latest \
    --set-secrets AT_ATTENDANCE_BASE=AT_ATTENDANCE_BASE:latest \
    --set-secrets AT_ATTENDANCE_TABLE=AT_ATTENDANCE_TABLE:latest \
    --set-secrets AT_TRUTH_BASE=AT_TRUTH_BASE:latest \
    --set-secrets AT_TRUTH_TABLE=AT_TRUTH_TABLE:latest \
    --set-secrets AT_PAYMENTS_BASE=AT_PAYMENTS_BASE:latest \
    --set-secrets AT_PAYMENTS_TABLE=AT_PAYMENTS_TABLE:latest \
    --set-secrets AT_DATA_ISSUES_BASE=AT_DATA_ISSUES_BASE:latest \
    --set-secrets AT_DATA_ISSUES_TABLE=AT_DATA_ISSUES_TABLE:latest \
    --project ${PROJECT_ID}

echo "Deployment complete!"
echo "Service URL: $(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')"

