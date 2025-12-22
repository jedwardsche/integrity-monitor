#!/usr/bin/env python3
"""Debug script to check Firestore issues for a specific run."""

import sys
from google.cloud import firestore

def check_issues(run_id: str):
    """Check issues in Firestore for a specific run_id."""
    db = firestore.Client()

    print(f"\n=== Checking Firestore for run_id: {run_id} ===\n")

    # Query for issues with this run_id
    issues_ref = db.collection('integrity_issues')

    # Check "All Issues" query (run_id only)
    print("1. Query: WHERE run_id == run_id (All Issues tab)")
    all_issues_query = issues_ref.where('run_id', '==', run_id).order_by('created_at', direction=firestore.Query.DESCENDING).limit(5)
    try:
        all_issues = list(all_issues_query.stream())
        print(f"   Found {len(all_issues)} issues (showing first 5)")
        for issue in all_issues:
            data = issue.to_dict()
            print(f"   - {issue.id}: run_id={data.get('run_id')}, first_seen={data.get('first_seen_in_run')}, status={data.get('status')}")
    except Exception as e:
        print(f"   ERROR: {e}")

    # Check "New Issues" query (first_seen_in_run + run_id)
    print("\n2. Query: WHERE first_seen_in_run == run_id AND run_id == run_id (New Issues tab)")
    new_issues_query = issues_ref.where('first_seen_in_run', '==', run_id).where('run_id', '==', run_id).order_by('created_at', direction=firestore.Query.DESCENDING).limit(5)
    try:
        new_issues = list(new_issues_query.stream())
        print(f"   Found {len(new_issues)} issues (showing first 5)")
        for issue in new_issues:
            data = issue.to_dict()
            print(f"   - {issue.id}: run_id={data.get('run_id')}, first_seen={data.get('first_seen_in_run')}, status={data.get('status')}")
    except Exception as e:
        print(f"   ERROR: {e}")

    # Check total count without ordering (to avoid index issues)
    print("\n3. Query: WHERE run_id == run_id (no ordering)")
    simple_query = issues_ref.where('run_id', '==', run_id).limit(1000)
    try:
        simple_results = list(simple_query.stream())
        print(f"   Total found: {len(simple_results)} issues")
        if simple_results:
            sample = simple_results[0].to_dict()
            print(f"   Sample issue fields: {list(sample.keys())}")
            print(f"   Sample issue: run_id={sample.get('run_id')}, first_seen={sample.get('first_seen_in_run')}, status={sample.get('status')}, issue_type={sample.get('issue_type')}")
    except Exception as e:
        print(f"   ERROR: {e}")

    print("\n" + "="*60 + "\n")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python debug_firestore_issues.py <run_id>")
        sys.exit(1)

    run_id = sys.argv[1]
    check_issues(run_id)
