# Integrity Monitor Runbook

Operations guide for the CHE Data Integrity Monitor.

## Deployment

### Prerequisites

- Google Cloud Project with billing enabled
- Artifact Registry repository created
- Secret Manager secrets configured (see `pending-env.md`)
- Service accounts created (run `deploy/iam-setup.sh`)

### Initial Setup

1. **Set environment variables:**

   ```bash
   export GCP_PROJECT_ID="your-project-id"
   export CLOUD_RUN_REGION="us-central1"
   export CLOUD_RUN_SERVICE_URL="https://integrity-runner-xxx.run.app"
   ```

2. **Create service accounts:**

   ```bash
   ./deploy/iam-setup.sh prod
   ```

3. **Deploy Cloud Run service:**

   ```bash
   ./deploy/deploy.sh prod
   ```

4. **Create Cloud Scheduler jobs:**

   ```bash
   ./deploy/create-scheduler.sh prod
   ```

5. **Set up monitoring alerts:**
   ```bash
   export SLACK_WEBHOOK_URL="https://hooks.slack.com/..."
   export ALERT_EMAIL="ops@example.com"
   ./deploy/create-alerts.sh prod
   ```

### Updating Deployment

To update the service with new code:

```bash
./deploy/deploy.sh prod
```

Or use Cloud Build:

```bash
gcloud builds submit --config=deploy/cloudbuild.yaml
```

## Rollback Procedure

1. **Identify previous revision:**

   ```bash
   gcloud run revisions list --service=integrity-runner --region=us-central1
   ```

2. **Rollback to previous revision:**

   ```bash
   gcloud run services update-traffic integrity-runner \
     --to-revisions REVISION_NAME=100 \
     --region=us-central1
   ```

3. **Verify rollback:**
   ```bash
   gcloud run services describe integrity-runner --region=us-central1
   ```

## Alert Response

### Consecutive Failures Alert

**Symptoms:** 2+ consecutive runs failed

**Actions:**

1. Check Cloud Logging for error messages:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --limit=50
   ```
2. Review Firestore `integrity_runs` collection for error details
3. Check Airtable API connectivity and credentials
4. Verify Firestore permissions
5. If transient, wait for next scheduled run
6. If persistent, check service account permissions and secrets

### Runtime Exceeded Alert

**Symptoms:** Run duration > 15 minutes

**Actions:**

1. Check recent run durations in Firestore
2. Review entity counts - may need to optimize fetchers
3. Consider increasing Cloud Run timeout or splitting into smaller jobs
4. Check for Airtable API rate limiting

### High Issue Count Alert

**Symptoms:** Duplicates > 500 (or other threshold)

**Actions:**

1. Review issue breakdown in dashboard
2. Check if legitimate data quality issues or false positives
3. Review rule thresholds in `backend/config/rules.yaml`
4. Consider adjusting thresholds if too sensitive

## Troubleshooting

### Service Won't Start

1. Check service account permissions:

   ```bash
   gcloud projects get-iam-policy PROJECT_ID \
     --flatten="bindings[].members" \
     --filter="bindings.members:serviceAccount:integrity-runner@*"
   ```

2. Verify secrets exist:

   ```bash
   gcloud secrets list
   ```

3. Check Cloud Run logs:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision" --limit=100
   ```

### Scheduler Jobs Not Running

1. Check job status:

   ```bash
   gcloud scheduler jobs describe integrity-nightly --location=us-central1
   ```

2. View scheduler logs:

   ```bash
   gcloud logging read "resource.type=cloud_scheduler_job" --limit=50
   ```

3. Verify service account has `run.invoker` role

### Firestore Write Failures

1. Check service account has `datastore.user` role
2. Verify Firestore API is enabled:
   ```bash
   gcloud services list --enabled | grep firestore
   ```
3. Check Firestore quotas and limits
4. Review Firestore client logs for specific errors

### Airtable API Errors

1. Verify Airtable PAT is valid and not expired
2. Check rate limits - may need to add delays between requests
3. Verify base/table IDs are correct
4. Check Airtable API status page

## Environment Variables Reference

### Required Secrets (in Secret Manager)

- `AIRTABLE_PAT` - Airtable Personal Access Token
- `AT_STUDENTS_BASE` - Students base ID
- `AT_STUDENTS_TABLE` - Students table ID
- `AT_PARENTS_BASE` - Parents base ID
- `AT_PARENTS_TABLE` - Parents table ID
- `AT_CONTRACTORS_BASE` - Contractors base ID
- `AT_CONTRACTORS_TABLE` - Contractors table ID
- `AT_CLASSES_BASE` - Classes base ID
- `AT_CLASSES_TABLE` - Classes table ID
- `AT_ATTENDANCE_BASE` - Attendance base ID
- `AT_ATTENDANCE_TABLE` - Attendance table ID
- `AT_TRUTH_BASE` - Truth base ID
- `AT_TRUTH_TABLE` - Truth table ID
- `AT_PAYMENTS_BASE` - Payments base ID
- `AT_PAYMENTS_TABLE` - Payments table ID
- `GOOGLE_APPLICATION_CREDENTIALS` - Firebase service account JSON (path or content)

### Cloud Run Configuration

- Memory: 1GB
- CPU: 1
- Timeout: 15 minutes
- Min instances: 0 (dev/staging), 0 (prod)
- Max instances: 2 (dev), 5 (staging), 10 (prod)

## Monitoring

### Key Metrics

- Run success rate (should be > 95%)
- Average run duration (target: < 10 minutes)
- Issue counts by type (duplicates, links, attendance, required fields)
- Failed check modules

### Logs

All logs are in Cloud Logging with structured JSON format. Key log fields:

- `run_id` - Unique identifier for each run
- `status` - success/warning/error
- `mode` - incremental/full
- `duration_ms` - Run duration in milliseconds
- `entity_counts` - Records processed per entity
- `failed_checks` - List of failed check modules (if any)

### Dashboards

View run history and metrics in the frontend dashboard or Firestore:

- Collection: `integrity_runs` - Run summaries
- Collection: `integrity_metrics_daily` - Daily aggregated metrics

## QA Process

### Pre-Release Checklist

Before deploying changes to production:

1. **Update test fixtures** (`backend/tests/fixtures/`) to reflect any schema changes
2. **Run test suite:**
   ```bash
   cd backend
   pytest
   ```
   Ensure 100% pass rate
3. **Execute local run** against sandbox Airtable base:
   ```bash
   # Set sandbox environment variables
   export AT_STUDENTS_BASE="sandbox_base_id"
   # Run integrity check
   python -m backend.main
   ```
   Verify Data Issues table matches expected counts
4. **Run regression tests:**
   ```bash
   pytest backend/tests/test_regression.py
   ```
   Compare outputs to golden files in `backend/tests/fixtures/golden/`
5. **Manual dashboard check** - verify metrics display correctly
6. **Document QA results** in release notes (Conventional Commit + tag)

### Test Structure

- **Unit tests** (`backend/tests/test_*.py`): Test individual functions and modules
- **Integration tests** (`backend/tests/test_integrity_runner.py`): Test full run flow with mocked clients
- **Regression tests** (`backend/tests/test_regression.py`): Compare outputs to golden files

### Updating Golden Files

When intentional changes are made to check logic:

1. Run regression tests (they will fail)
2. Review the differences
3. If changes are expected, update golden files:
   ```bash
   # Tests will create new golden files on first run
   pytest backend/tests/test_regression.py -v
   ```
4. Commit updated golden files with the code changes

## KPI Measurement Workflow

### Weekly KPI Sampling

The system automatically generates weekly samples every Sunday at 04:00 AM (after the weekly full scan).

### Manual KPI Calculation

1. **Generate sample** (if not already done):

   ```bash
   # Sample is auto-generated by scheduler, or trigger manually:
   curl -X POST https://integrity-runner.run.app/integrity/kpi/sample
   ```

2. **Review sampled records:**

   - Access sample in Firestore: `integrity_kpi_samples/{weekId}`
   - Review each sampled record in Airtable
   - Label as "anomaly: yes" or "anomaly: no" in Firestore document

3. **Calculate KPI:**

   - KPI = `true_positives / (true_positives + false_negatives) * 100`
   - Target: 90%+
   - If KPI < 90%, review task is auto-created in `integrity_review_tasks`

4. **View KPI in dashboard:**
   - Navigate to dashboard
   - KPI card shows current percentage, trend, and alerts

### KPI Review Process

When KPI < 90%:

1. Review task created in `integrity_review_tasks` collection
2. Analyze false negatives (anomalies reviewer found but monitor missed)
3. Identify which check modules missed anomalies
4. Adjust rules/thresholds or add new checks
5. Re-test and verify KPI improves

## Rule Tuning via Firestore

### Adjusting Thresholds Without Redeploy

Rules can be tuned dynamically via Firestore without code changes:

1. **Access Firestore Console:**

   - Navigate to Firestore in GCP Console
   - Open document: `integrity_config/current`

2. **Update thresholds:**

   ```json
   {
     "attendance_rules": {
       "thresholds": {
         "absence_rate_30d": {
           "warning": 0.15,
           "critical": 0.25
         }
       }
     }
   }
   ```

3. **Changes take effect** on next integrity run (nightly or manual)

4. **Record changes** in `context.md` or dedicated change log

### Flagged Rules Review

Rules with >10% ignored issues are automatically flagged:

1. **View flagged rules** in dashboard "Most Ignored Rules" widget
2. **Review each flagged rule:**
   - Check why issues were ignored
   - Determine if rule is too sensitive or needs adjustment
3. **Adjust rule** via Firestore config or code update
4. **Monitor** ignored percentage decreases in subsequent runs

### Rule Tuning Best Practices

- **Start conservative:** Use higher thresholds initially, lower if needed
- **Monitor feedback:** Review ignored issues weekly
- **Document changes:** Record all threshold adjustments in `context.md`
- **Test changes:** Run local tests before deploying threshold changes
- **Gradual adjustments:** Change thresholds by small increments (e.g., 5-10%)

## Maintenance

### Weekly Tasks

- Review alert history
- Check KPI metrics in dashboard
- Review ignored issues in Airtable Data Issues table
- Review flagged rules widget for rules needing tuning

### Monthly Tasks

- Review and tune rule thresholds based on feedback
- Analyze false positive rates
- Review KPI trend and investigate if below 90%
- Update documentation for any process changes
- Review and update test fixtures if schema changes

## Support Contacts

- Data Ops: [configure in your environment]
- On-call: [configure in your environment]
