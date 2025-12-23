#!/usr/bin/env python3
"""
Migrate campuses rules to truth table and add student_truth duplicate rule.
"""
import os
import sys
from pathlib import Path
from google.cloud import firestore
from dotenv import load_dotenv

# Load environment variables
backend_dir = Path(__file__).parent
load_dotenv(backend_dir / ".env")

def migrate_campuses_to_truth():
    """Migrate all campuses rules to truth table in Firestore."""
    # Initialize Firestore client
    db = firestore.Client()

    categories = ['duplicates', 'relationships', 'required_fields']
    total_migrated = 0

    print("Starting migration of campuses rules to truth table...")
    print("-" * 60)

    for category in categories:
        collection_path = f'rules/{category}/campuses'
        print(f"\nChecking {collection_path}...")

        # Get all campuses rules in this category
        docs = db.collection(collection_path).stream()
        campuses_rules = []

        for doc in docs:
            campuses_rules.append({
                'id': doc.id,
                'data': doc.to_dict()
            })

        if not campuses_rules:
            print(f"  No campuses rules found in {category}")
            continue

        print(f"  Found {len(campuses_rules)} campuses rule(s)")

        # Migrate each rule to truth collection
        for rule in campuses_rules:
            rule_id = rule['id']
            rule_data = rule['data']

            # Create in truth collection
            truth_collection_path = f'rules/{category}/truth'
            truth_doc_ref = db.collection(truth_collection_path).document(rule_id)

            # Check if already exists in truth
            if truth_doc_ref.get().exists:
                print(f"  ⚠️  Rule {rule_id} already exists in truth, skipping")
                continue

            # Create the rule in truth collection
            truth_doc_ref.set(rule_data)
            print(f"  ✓ Migrated {rule_id} to truth")

            # Delete from campuses collection
            campuses_doc_ref = db.collection(collection_path).document(rule_id)
            campuses_doc_ref.delete()
            print(f"  ✓ Deleted {rule_id} from campuses")

            total_migrated += 1

    print("\n" + "-" * 60)
    print(f"Migration complete! Migrated {total_migrated} rule(s)")
    print("-" * 60)


def create_student_truth_duplicate_rule():
    """Create a duplicate detection rule for student_truth table."""
    db = firestore.Client()

    print("\nCreating student_truth duplicate detection rule...")
    print("-" * 60)

    # Define the duplicate rule for student_truth
    # Checks for duplicate student truth records from the same school year with the same student
    rule_id = "dup.student_truth.same_year_same_student"
    rule_data = {
        "rule_id": rule_id,
        "description": "Detects duplicate student truth records from the same school year with the same student",
        "severity": "likely",
        "conditions": [
            {
                "field": "school_year",
                "match_type": "exact"
            },
            {
                "field": "student",
                "match_type": "exact"
            }
        ],
        "source": "user",
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP
    }

    # Create the rule
    collection_path = "rules/duplicates/student_truth"
    doc_ref = db.collection(collection_path).document(rule_id)

    if doc_ref.get().exists:
        print(f"  ⚠️  Rule {rule_id} already exists, skipping")
    else:
        doc_ref.set(rule_data)
        print(f"  ✓ Created duplicate rule: {rule_id}")
        print(f"     Description: {rule_data['description']}")
        print(f"     Conditions: Same school_year AND same student")

    print("-" * 60)


if __name__ == "__main__":
    try:
        # Step 1: Migrate campuses rules to truth
        migrate_campuses_to_truth()

        # Step 2: Create student_truth duplicate rule
        create_student_truth_duplicate_rule()

        print("\n✓ All tasks completed successfully!")

    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
