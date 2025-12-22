#!/bin/bash

# Script to check why a schedule didn't execute
# Usage: ./scripts/check_schedule_execution.sh [schedule_id]

set -e

echo "=== Schedule Execution Debugging ==="
echo ""

# Check if schedule ID provided
if [ -z "$1" ]; then
  echo "Usage: $0 <schedule_id>"
  echo ""
  echo "To find schedule IDs, check Firestore 'schedules' collection"
  exit 1
fi

SCHEDULE_ID=$1

echo "Checking schedule: $SCHEDULE_ID"
echo ""

# Check Cloud Function logs
echo "1. Checking Cloud Function logs (last 50 entries)..."
echo "   Run: firebase functions:log --only runScheduledScans --limit 50"
echo ""

# Check if schedule exists and its status
echo "2. Checking schedule in Firestore..."
echo "   Go to Firebase Console → Firestore → schedules → $SCHEDULE_ID"
echo "   Check these fields:"
echo "   - enabled: should be true"
echo "   - next_run_at: should be a timestamp in the past"
echo "   - lock: should be null (or locked_at should be > 5 minutes ago)"
echo "   - timezone: verify it matches your expected timezone"
echo "   - time_of_day: should be in HH:mm format (e.g., '14:00' for 2pm)"
echo ""

# Check for execution records
echo "3. Checking schedule_executions collection..."
echo "   Go to Firebase Console → Firestore → schedule_executions"
echo "   Filter by: schedule_id == $SCHEDULE_ID"
echo "   Check for recent executions and their status"
echo ""

# Check Cloud Function deployment
echo "4. Verifying Cloud Function is deployed..."
echo "   Run: firebase functions:list | grep runScheduledScans"
echo ""

# Check secrets
echo "5. Verifying secrets are set..."
echo "   Run: firebase functions:secrets:access INTEGRITY_RUNNER_URL"
echo "   Run: firebase functions:secrets:access API_AUTH_TOKEN"
echo ""

echo "=== Quick Fixes ==="
echo ""
echo "If schedule is locked:"
echo "  1. Go to Firestore → schedules → $SCHEDULE_ID"
echo "  2. Set 'lock' field to null"
echo ""
echo "If next_run_at is in the future:"
echo "  1. Go to Firestore → schedules → $SCHEDULE_ID"
echo "  2. Set 'next_run_at' to a timestamp 1-2 minutes in the past"
echo "  3. The Cloud Function should pick it up within 1 minute"
echo ""
echo "To manually trigger a test:"
echo "  1. Set next_run_at to current time minus 1 minute"
echo "  2. Wait up to 1 minute for Cloud Function to run"
echo "  3. Check schedule_executions collection for new execution record"
echo ""
