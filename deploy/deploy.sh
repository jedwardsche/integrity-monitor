#!/bin/bash

#########################################
# CHE Data Integrity Monitor Deployment Script
#
# This script handles deployment of both
# frontend and backend to production.
#########################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || echo "")}
if [ -z "$PROJECT_ID" ]; then
    # Try to get from .firebaserc
    if [ -f "$PROJECT_ROOT/.firebaserc" ]; then
        PROJECT_ID=$(grep -o '"default":\s*"[^"]*"' "$PROJECT_ROOT/.firebaserc" | cut -d'"' -f4)
    fi
fi

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: PROJECT_ID not found${NC}"
    echo "Set GCP_PROJECT_ID environment variable or configure gcloud:"
    echo "  export GCP_PROJECT_ID=your-project-id"
    echo "  gcloud config set project your-project-id"
    exit 1
fi

REGION=${CLOUD_RUN_REGION:-us-central1}
SERVICE_NAME="integrity-runner"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   CHE Data Integrity Monitor          ║${NC}"
echo -e "${BLUE}║   Deployment Script                   ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo ""

# Function to print colored status messages
print_status() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

#########################################
# Git Commit and Push to Feature Branch
#########################################
commit_and_push() {
    print_status "Checking for uncommitted changes..."
    
    # Check if there are any changes
    if [ -z "$(git status --porcelain)" ]; then
        print_warning "No changes to commit"
        return 0
    fi
    
    print_success "Found uncommitted changes"
    
    # Show git status
    echo ""
    git status --short
    echo ""
    
    # Automatic commit message
    COMMIT_MESSAGE="new features"
    
    # Generate feature branch name with timestamp
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BRANCH_NAME="feature/deploy_${TIMESTAMP}"
    
    print_status "Creating and switching to branch: ${BRANCH_NAME}"
    
    # Create and checkout new branch
    if git checkout -b "$BRANCH_NAME" 2>/dev/null; then
        print_success "Created new branch: ${BRANCH_NAME}"
    else
        # Branch might already exist, try to checkout
        if git checkout "$BRANCH_NAME" 2>/dev/null; then
            print_warning "Switched to existing branch: ${BRANCH_NAME}"
        else
            print_error "Failed to create or checkout branch"
            exit 1
        fi
    fi
    
    # Add all changes
    print_status "Adding all changes..."
    git add -A
    print_success "Changes staged"
    
    # Commit
    print_status "Committing changes with message: \"${COMMIT_MESSAGE}\""
    if git commit -m "$COMMIT_MESSAGE"; then
        print_success "Changes committed"
    else
        print_error "Failed to commit changes"
        exit 1
    fi
    
    # Push to origin
    print_status "Pushing to origin/${BRANCH_NAME}..."
    if git push -u origin "$BRANCH_NAME"; then
        print_success "Pushed to origin/${BRANCH_NAME}"
        echo ""
        print_success "Branch URL: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/tree/${BRANCH_NAME}"
    else
        print_error "Failed to push to origin"
        exit 1
    fi
    
    echo ""
}

# Check if we're in the right directory
cd "$PROJECT_ROOT"
if [ ! -f "package.json" ] || [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    print_error "Error: Must run this script from the project root directory"
    exit 1
fi

# Parse command line arguments
DEPLOY_FRONTEND=false
DEPLOY_BACKEND=false
DEPLOY_RULES=false
SKIP_TESTS=false
COMMIT_AND_PUSH=false

if [ $# -eq 0 ]; then
    # No arguments, commit, push, and deploy everything
    COMMIT_AND_PUSH=true
    DEPLOY_FRONTEND=true
    DEPLOY_BACKEND=true
    DEPLOY_RULES=true
else
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --frontend|-f)
                DEPLOY_FRONTEND=true
                shift
                ;;
            --backend|-b)
                DEPLOY_BACKEND=true
                shift
                ;;
            --rules|-r)
                DEPLOY_RULES=true
                shift
                ;;
            --commit|-c)
                COMMIT_AND_PUSH=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --help|-h)
                echo "Usage: ./deploy/deploy.sh [OPTIONS]"
                echo ""
                echo "Deploy CHE Data Integrity Monitor to production"
                echo ""
                echo "Default behavior (no arguments):"
                echo "  - Automatically commits all changes with message 'new features'"
                echo "  - Pushes to feature branch with timestamp: feature/deploy_YYYYMMDD_HHMMSS"
                echo "  - Deploys frontend, backend, and Firestore rules"
                echo ""
                echo "Options:"
                echo "  --frontend, -f     Deploy frontend only (no auto-commit)"
                echo "  --backend, -b      Deploy backend only (no auto-commit)"
                echo "  --rules, -r        Deploy Firestore rules only (no auto-commit)"
                echo "  --commit, -c       Commit all changes and push to feature branch"
                echo "  --skip-tests       Skip TypeScript compilation check"
                echo "  --help, -h         Show this help message"
                echo ""
                echo "Examples:"
                echo "  ./deploy/deploy.sh                    # Auto-commit, push, and deploy everything"
                echo "  ./deploy/deploy.sh --frontend         # Deploy frontend only (no commit)"
                echo "  ./deploy/deploy.sh --backend          # Deploy backend only (no commit)"
                echo "  ./deploy/deploy.sh -f -b              # Deploy frontend and backend (no commit)"
                echo "  ./deploy/deploy.sh --commit           # Commit and push only (no deploy)"
                echo "  ./deploy/deploy.sh -c -f              # Commit, push, then deploy frontend"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
fi

echo ""
print_status "Deployment plan:"
echo "  Commit & Push: $([ "$COMMIT_AND_PUSH" = true ] && echo -e "${GREEN}YES${NC}" || echo -e "${YELLOW}NO${NC}")"
echo "  Frontend:      $([ "$DEPLOY_FRONTEND" = true ] && echo -e "${GREEN}YES${NC}" || echo -e "${YELLOW}NO${NC}")"
echo "  Backend:       $([ "$DEPLOY_BACKEND" = true ] && echo -e "${GREEN}YES${NC}" || echo -e "${YELLOW}NO${NC}")"
echo "  Rules:         $([ "$DEPLOY_RULES" = true ] && echo -e "${GREEN}YES${NC}" || echo -e "${YELLOW}NO${NC}")"
echo "  Project ID:    ${BLUE}${PROJECT_ID}${NC}"
echo "  Region:        ${BLUE}${REGION}${NC}"
echo ""

# If no deployment tasks selected, exit
if [ "$COMMIT_AND_PUSH" = false ] && [ "$DEPLOY_FRONTEND" = false ] && [ "$DEPLOY_BACKEND" = false ] && [ "$DEPLOY_RULES" = false ]; then
    print_warning "No tasks selected. Use --help for usage information"
    exit 0
fi

echo ""
print_status "Starting tasks..."
echo ""

#########################################
# Commit and Push (if requested)
#########################################
if [ "$COMMIT_AND_PUSH" = true ]; then
    commit_and_push
fi

#########################################
# Deploy Firestore Rules
#########################################
if [ "$DEPLOY_RULES" = true ]; then
    print_status "Deploying Firestore rules..."

    if firebase deploy --only firestore:rules --project "$PROJECT_ID"; then
        print_success "Firestore rules deployed successfully"
    else
        print_error "Failed to deploy Firestore rules"
        exit 1
    fi

    echo ""
fi

#########################################
# Deploy Backend
#########################################
if [ "$DEPLOY_BACKEND" = true ]; then
    print_status "Deploying backend to Cloud Run..."

    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI not found. Please install it first:"
        echo "  https://cloud.google.com/sdk/docs/install"
        exit 1
    fi

    # Check if backend files exist
    if [ ! -f "backend/main.py" ] || [ ! -f "backend/Dockerfile" ]; then
        print_error "Backend files not found"
        exit 1
    fi

    print_status "Building and deploying backend container..."

    # Check if custom service account exists
    CUSTOM_SERVICE_ACCOUNT="integrity-runner@${PROJECT_ID}.iam.gserviceaccount.com"
    SERVICE_ACCOUNT="${PROJECT_ID}-compute@developer.gserviceaccount.com"
    
    if gcloud iam service-accounts describe "$CUSTOM_SERVICE_ACCOUNT" --project "$PROJECT_ID" &>/dev/null; then
        SERVICE_ACCOUNT="$CUSTOM_SERVICE_ACCOUNT"
        print_status "Using custom service account: ${SERVICE_ACCOUNT}"
    else
        print_status "Using default compute service account: ${SERVICE_ACCOUNT}"
    fi

    # Build base deploy command
    DEPLOY_CMD=(
        "gcloud" "run" "deploy" "$SERVICE_NAME"
        "--source" "backend"
        "--region" "$REGION"
        "--platform" "managed"
        "--allow-unauthenticated"
        "--memory" "1Gi"
        "--cpu" "1"
        "--timeout" "15m"
        "--min-instances" "0"
        "--max-instances" "10"
        "--set-env-vars" "ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-*}"
        "--set-secrets" "AIRTABLE_API_KEY=AIRTABLE_API_KEY:latest"
        "--set-secrets" "API_AUTH_TOKEN=API_AUTH_TOKEN:latest"
        "--set-secrets" "AT_STUDENTS_BASE=AT_STUDENTS_BASE:latest"
        "--set-secrets" "AT_STUDENTS_TABLE=AT_STUDENTS_TABLE:latest"
        "--set-secrets" "AT_PARENTS_BASE=AT_PARENTS_BASE:latest"
        "--set-secrets" "AT_PARENTS_TABLE=AT_PARENTS_TABLE:latest"
        "--set-secrets" "AT_CONTRACTORS_BASE=AT_CONTRACTORS_BASE:latest"
        "--set-secrets" "AT_CONTRACTORS_TABLE=AT_CONTRACTORS_TABLE:latest"
        "--set-secrets" "AT_CLASSES_BASE=AT_CLASSES_BASE:latest"
        "--set-secrets" "AT_CLASSES_TABLE=AT_CLASSES_TABLE:latest"
        "--set-secrets" "AT_ATTENDANCE_BASE=AT_ATTENDANCE_BASE:latest"
        "--set-secrets" "AT_ATTENDANCE_TABLE=AT_ATTENDANCE_TABLE:latest"
        "--set-secrets" "AT_TRUTH_BASE=AT_TRUTH_BASE:latest"
        "--set-secrets" "AT_TRUTH_TABLE=AT_TRUTH_TABLE:latest"
        "--set-secrets" "AT_PAYMENTS_BASE=AT_PAYMENTS_BASE:latest"
        "--set-secrets" "AT_PAYMENTS_TABLE=AT_PAYMENTS_TABLE:latest"
        "--set-secrets" "AT_DATA_ISSUES_BASE=AT_DATA_ISSUES_BASE:latest"
        "--set-secrets" "AT_DATA_ISSUES_TABLE=AT_DATA_ISSUES_TABLE:latest"
        "--project" "$PROJECT_ID"
    )

    # Add service account only if it's the custom one
    if [ "$SERVICE_ACCOUNT" != "${PROJECT_ID}-compute@developer.gserviceaccount.com" ]; then
        DEPLOY_CMD+=("--service-account" "$SERVICE_ACCOUNT")
    fi

    # Try deployment
    set +e
    "${DEPLOY_CMD[@]}"
    DEPLOY_STATUS=$?
    set -e

    # If deployment failed with custom service account, retry without it
    if [ $DEPLOY_STATUS -ne 0 ] && [ "$SERVICE_ACCOUNT" != "${PROJECT_ID}-compute@developer.gserviceaccount.com" ]; then
        print_warning "Deployment with custom service account failed, retrying without explicit service account..."
        # Remove service account from args
        DEPLOY_CMD=(
            "gcloud" "run" "deploy" "$SERVICE_NAME"
            "--source" "backend"
            "--region" "$REGION"
            "--platform" "managed"
            "--allow-unauthenticated"
            "--memory" "1Gi"
            "--cpu" "1"
            "--timeout" "15m"
            "--min-instances" "0"
            "--max-instances" "10"
            "--set-env-vars" "ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-*}"
            "--set-secrets" "AIRTABLE_API_KEY=AIRTABLE_API_KEY:latest"
            "--set-secrets" "API_AUTH_TOKEN=API_AUTH_TOKEN:latest"
            "--set-secrets" "AT_STUDENTS_BASE=AT_STUDENTS_BASE:latest"
            "--set-secrets" "AT_STUDENTS_TABLE=AT_STUDENTS_TABLE:latest"
            "--set-secrets" "AT_PARENTS_BASE=AT_PARENTS_BASE:latest"
            "--set-secrets" "AT_PARENTS_TABLE=AT_PARENTS_TABLE:latest"
            "--set-secrets" "AT_CONTRACTORS_BASE=AT_CONTRACTORS_BASE:latest"
            "--set-secrets" "AT_CONTRACTORS_TABLE=AT_CONTRACTORS_TABLE:latest"
            "--set-secrets" "AT_CLASSES_BASE=AT_CLASSES_BASE:latest"
            "--set-secrets" "AT_CLASSES_TABLE=AT_CLASSES_TABLE:latest"
            "--set-secrets" "AT_ATTENDANCE_BASE=AT_ATTENDANCE_BASE:latest"
            "--set-secrets" "AT_ATTENDANCE_TABLE=AT_ATTENDANCE_TABLE:latest"
            "--set-secrets" "AT_TRUTH_BASE=AT_TRUTH_BASE:latest"
            "--set-secrets" "AT_TRUTH_TABLE=AT_TRUTH_TABLE:latest"
            "--set-secrets" "AT_PAYMENTS_BASE=AT_PAYMENTS_BASE:latest"
            "--set-secrets" "AT_PAYMENTS_TABLE=AT_PAYMENTS_TABLE:latest"
            "--set-secrets" "AT_DATA_ISSUES_BASE=AT_DATA_ISSUES_BASE:latest"
            "--set-secrets" "AT_DATA_ISSUES_TABLE=AT_DATA_ISSUES_TABLE:latest"
            "--project" "$PROJECT_ID"
        )
        "${DEPLOY_CMD[@]}"
        DEPLOY_STATUS=$?
    fi

    if [ $DEPLOY_STATUS -eq 0 ]; then
        print_success "Backend deployed successfully"

        # Get the service URL
        SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
            --region "$REGION" \
            --project "$PROJECT_ID" \
            --format="value(status.url)")

        echo ""
        print_success "Backend URL: $SERVICE_URL"

        # Check if frontend .env needs updating
        if [ -f "frontend/.env" ]; then
            CURRENT_API_BASE=$(grep "VITE_API_BASE=" frontend/.env | cut -d'=' -f2)
            if [ "$CURRENT_API_BASE" != "$SERVICE_URL" ]; then
                print_warning "Note: Update VITE_API_BASE in frontend/.env to: $SERVICE_URL"
                print_warning "Then rebuild and redeploy frontend"
            fi
        fi
    else
        print_error "Failed to deploy backend"
        exit 1
    fi

    echo ""
fi

#########################################
# Deploy Frontend
#########################################
if [ "$DEPLOY_FRONTEND" = true ]; then
    print_status "Deploying frontend to Firebase Hosting..."

    # Check if frontend directory exists
    if [ ! -d "frontend" ]; then
        print_error "Frontend directory not found"
        exit 1
    fi

    # Check if node_modules exists
    if [ ! -d "frontend/node_modules" ]; then
        print_warning "node_modules not found. Running npm install..."
        cd frontend
        npm install
        cd ..
    fi

    # TypeScript compilation check (unless skipped)
    if [ "$SKIP_TESTS" = false ]; then
        print_status "Running TypeScript compilation check..."
        cd frontend
        if npm run build:check 2>/dev/null || npm run build; then
            print_success "TypeScript compilation passed"
        else
            print_error "TypeScript compilation failed"
            print_warning "Fix errors or use --skip-tests to skip this check"
            exit 1
        fi
        cd ..
    else
        # Build without strict type checking
        print_status "Building frontend (skipping type checks)..."
        cd frontend
        npm run build
        cd ..
    fi

    print_status "Deploying to Firebase Hosting..."

    if firebase deploy --only hosting --project "$PROJECT_ID"; then
        print_success "Frontend deployed successfully"
        FRONTEND_URL=$(firebase hosting:sites:list --project "$PROJECT_ID" --json 2>/dev/null | grep -o '"defaultHosting":\s*"[^"]*"' | cut -d'"' -f4 || echo "data-integrity-monitor.web.app")
        if [ -n "$FRONTEND_URL" ]; then
            print_success "Frontend URL: https://${FRONTEND_URL}"
        fi
    else
        print_error "Failed to deploy frontend"
        exit 1
    fi

    echo ""
fi

#########################################
# Tasks Complete
#########################################
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Tasks Complete!                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

print_success "All tasks completed successfully"

# Show relevant information based on what was done
if [ "$DEPLOY_FRONTEND" = true ] || [ "$DEPLOY_BACKEND" = true ]; then
    echo ""
    echo "Production URLs:"
    if [ "$DEPLOY_FRONTEND" = true ]; then
        FRONTEND_URL=$(firebase hosting:sites:list --project "$PROJECT_ID" --json 2>/dev/null | grep -o '"defaultHosting":\s*"[^"]*"' | cut -d'"' -f4 || echo "data-integrity-monitor.web.app")
        echo "  Frontend: ${BLUE}https://${FRONTEND_URL}${NC}"
    fi
    if [ "$DEPLOY_BACKEND" = true ]; then
        SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
            --region "$REGION" \
            --project "$PROJECT_ID" \
            --format="value(status.url)" 2>/dev/null || echo "")
        if [ -n "$SERVICE_URL" ]; then
            echo "  Backend:  ${BLUE}$SERVICE_URL${NC}"
        fi
    fi
    
    echo ""
    echo "Next steps:"
    echo "  1. Test the deployed application"
    if [ "$DEPLOY_BACKEND" = true ]; then
        echo "  2. Check logs: ${BLUE}gcloud run logs read --service=$SERVICE_NAME --region=$REGION --project=$PROJECT_ID${NC}"
        echo "  3. Monitor: ${BLUE}https://console.cloud.google.com/run?project=$PROJECT_ID${NC}"
    fi
fi

echo ""
print_success "Script finished"
