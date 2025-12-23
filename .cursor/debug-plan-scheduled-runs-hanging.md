# Debug Plan: Scheduled Runs Hanging During Record Fetching

## Problem Summary

- **Symptom**: Scheduled runs start successfully but hang during Airtable record fetching when localhost is closed
- **When it works**: When localhost is running, scans complete successfully
- **When it fails**: When localhost is closed (only public/deployed app running), scans hang at "Fetching classes records..."
- **Evidence**: Logs show runs starting at 5:00:02 PM, fetching students/parents/contractors successfully, then hanging at "Fetching classes records..." at 5:05:51 PM

## Architecture Flow

1. Cloud Function (`runScheduledScans`) runs every minute, checks for due schedules
2. Cloud Function triggers backend API via HTTP POST: `${INTEGRITY_RUNNER_URL}/integrity/run`
3. Backend API (`/integrity/run`) starts a background thread and returns immediately
4. Background thread calls `IntegrityRunner.run()` which fetches records from Airtable
5. Record fetching happens in `_fetch_records()` → `fetcher.fetch()` → `AirtableClient._fetch_with_retry()` → `table.all()`

## Key Configuration Values

- **Cloud Function timeout**: 540 seconds (9 minutes)
- **Airtable API timeout**: 30 seconds (`API_TIMEOUT_SECONDS`)
- **Retry logic**: `stop_after_delay(API_TIMEOUT_SECONDS)` - retries for up to 30 seconds total
- **Request throttling**: 0.2 seconds between requests (`MIN_REQUEST_INTERVAL`)

## Hypotheses

### Hypothesis A: Airtable API call hangs indefinitely without exception

**Theory**: The `table.all()` call from pyairtable library hangs indefinitely when network conditions are poor or when running in production environment. The retry decorator only catches `HTTPError` and `RequestException`, but a hanging connection might not raise these exceptions.

**Evidence needed**:

- Logs showing entry into `_fetch_with_retry` for "classes" entity
- Logs showing throttle call completion
- Logs showing API initialization
- Logs showing `table.all()` call start
- No logs showing exception or completion

**Instrumentation points**:

- `backend/clients/airtable.py:_fetch_with_retry()` - entry, before/after throttle, before/after API call, exception handling
- `backend/clients/airtable.py:_throttle_request()` - entry/exit
- `backend/clients/airtable.py:_get_api()` - entry/exit

### Hypothesis B: Network timeout differences between localhost and production

**Theory**: When running in production (Cloud Run), network timeouts or connection limits might be different. The pyairtable library might not have proper timeout configuration, causing hangs.

**Evidence needed**:

- Comparison of timeout settings between localhost and production
- Network-level timeout logs
- Connection establishment logs

**Instrumentation points**:

- Check if pyairtable Api() initialization has timeout parameters
- Add timeout configuration to requests library calls
- Log network connection establishment

### Hypothesis C: Background thread is killed when Cloud Function completes

**Theory**: The Cloud Function makes a fire-and-forget HTTP request to the backend. If the backend is running in the same environment or if there's a connection issue, the background thread might be killed when the Cloud Function completes.

**Evidence needed**:

- Logs showing background thread start
- Logs showing background thread still alive during fetch
- Logs showing thread death or interruption

**Instrumentation points**:

- `backend/main.py:_run_integrity_background()` - thread start, thread alive check
- `backend/services/integrity_runner.py:run()` - entry, periodic alive checks
- `backend/services/integrity_runner.py:_fetch_records()` - entry, entity loop progress

### Hypothesis D: pyairtable's `table.all()` doesn't respect timeout settings

**Theory**: The pyairtable library's `table.all()` method might not properly propagate timeout settings to underlying HTTP requests, causing indefinite hangs.

**Evidence needed**:

- Logs showing pyairtable API initialization
- Logs showing timeout configuration
- Logs showing HTTP request start/completion

**Instrumentation points**:

- `backend/clients/airtable.py:_get_api()` - check timeout configuration
- Wrap `table.all()` with explicit timeout using signal/alarm or threading.Timer
- Log HTTP request details

### Hypothesis E: Large dataset pagination hangs

**Theory**: The "classes" table might be very large, and pagination within `table.all()` might hang on a specific page fetch.

**Evidence needed**:

- Logs showing record count progress during fetch
- Logs showing pagination page numbers
- Logs showing which page hangs

**Instrumentation points**:

- Add pagination progress logging to `table.all()` call
- Log record count as it increases
- Add timeout per page fetch

## Instrumentation Strategy

### Phase 1: Add comprehensive logging to record fetching flow

1. **Entry/exit logging** for all functions in the fetch chain
2. **Timing logs** before/after critical operations
3. **State logging** (entity name, record counts, progress)
4. **Exception logging** with full context
5. **Thread alive checks** during long operations

### Phase 2: Add timeout protection

1. **Explicit timeout wrapper** around `table.all()` call
2. **Timeout configuration** for pyairtable API initialization
3. **Request-level timeout** configuration

### Phase 3: Add health checks

1. **Periodic progress logs** during long fetches
2. **Thread interruption handling**
3. **Connection health checks**

## Files to Instrument

1. `backend/clients/airtable.py`

   - `_fetch_with_retry()` - main fetch function
   - `_throttle_request()` - rate limiting
   - `_get_api()` - API initialization
   - `fetch_records()` - public interface

2. `backend/services/integrity_runner.py`

   - `_fetch_records()` - orchestrates fetching
   - `run()` - main run method

3. `backend/main.py`
   - `_run_integrity_background()` - background thread entry point

## Expected Log Patterns

### Successful fetch:

```
[timestamp] INFO: Fetching {entity} records... (entry)
[timestamp] INFO: Throttle complete (after throttle)
[timestamp] INFO: API initialized (after API init)
[timestamp] INFO: Starting table.all() call (before fetch)
[timestamp] INFO: Fetched {count} {entity} records (success)
```

### Hanging fetch:

```
[timestamp] INFO: Fetching {entity} records... (entry)
[timestamp] INFO: Throttle complete (after throttle)
[timestamp] INFO: API initialized (after API init)
[timestamp] INFO: Starting table.all() call (before fetch)
[NO FURTHER LOGS - HANGS HERE]
```

## Next Steps

1. **Add instrumentation** to all identified points
2. **Clear log file** before reproduction
3. **Reproduce** the issue (close localhost, let schedule run)
4. **Analyze logs** to identify exact hang point
5. **Implement fix** based on evidence
6. **Verify** with post-fix logs
