#!/usr/bin/env python3
"""
Test script to diagnose Firebase Authentication setup issues.

This script helps identify common configuration problems with Firebase Authentication.
"""

import os
import sys
import json
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

def test_firebase_auth():
    """Test Firebase Authentication setup step by step."""

    print("=" * 70)
    print("Firebase Authentication Diagnostic Tool")
    print("=" * 70)
    print()

    # Step 1: Check Firebase Admin SDK
    print("✓ Step 1: Checking Firebase Admin SDK installation...")
    try:
        import firebase_admin
        from firebase_admin import auth as admin_auth, credentials
        print(f"  ✓ Firebase Admin SDK version: {firebase_admin.__version__}")
    except ImportError as e:
        print(f"  ✗ FAILED: {e}")
        print("  → Install with: pip install firebase-admin")
        return False

    # Step 2: Check service account file
    print("\n✓ Step 2: Checking service account credentials...")
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_path:
        print("  ✗ FAILED: GOOGLE_APPLICATION_CREDENTIALS not set")
        print("  → Set it in backend/.env file")
        return False

    # Resolve path
    if not os.path.isabs(cred_path):
        cred_path = os.path.join(backend_dir, cred_path)

    if not os.path.exists(cred_path):
        print(f"  ✗ FAILED: Service account file not found at: {cred_path}")
        print("  → Check the path in GOOGLE_APPLICATION_CREDENTIALS")
        return False

    print(f"  ✓ Service account file found: {cred_path}")

    # Read and validate service account
    try:
        with open(cred_path, 'r') as f:
            sa_data = json.load(f)

        project_id = sa_data.get('project_id', 'unknown')
        client_email = sa_data.get('client_email', 'unknown')

        print(f"  ✓ Project ID: {project_id}")
        print(f"  ✓ Service Account: {client_email}")
    except Exception as e:
        print(f"  ✗ FAILED: Could not parse service account: {e}")
        return False

    # Step 3: Initialize Firebase Admin
    print("\n✓ Step 3: Initializing Firebase Admin SDK...")
    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred, {'projectId': project_id})
        print(f"  ✓ Firebase Admin initialized for project: {project_id}")
    except Exception as e:
        print(f"  ✗ FAILED: {e}")
        return False

    # Step 4: Test user lookup/creation
    print("\n✓ Step 4: Testing Firebase Authentication API...")
    test_email = "jedwards@che.school"

    try:
        # Try to get user by email
        print(f"  → Checking if user exists: {test_email}")
        try:
            user = admin_auth.get_user_by_email(test_email)
            print(f"  ✓ User found! UID: {user.uid}")
            uid = user.uid
        except admin_auth.UserNotFoundError:
            print(f"  → User not found, attempting to create...")
            try:
                user = admin_auth.create_user(email=test_email)
                uid = user.uid
                print(f"  ✓ User created! UID: {uid}")
            except Exception as create_err:
                error_msg = str(create_err)

                # Check for specific errors
                if "CONFIGURATION_NOT_FOUND" in error_msg or "ConfigurationNotFoundError" in str(type(create_err).__name__):
                    print(f"  ✗ FAILED: Firebase Authentication API is not enabled")
                    print(f"\n  → SOLUTION:")
                    print(f"     1. Go to: https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project={project_id}")
                    print(f"     2. Click 'ENABLE' if not already enabled")
                    print(f"     3. Wait 2-3 minutes for the API to propagate")
                    print(f"     4. Verify at: https://console.firebase.google.com/project/{project_id}/authentication")
                    print(f"     5. Enable Email/Password sign-in method")
                    return False
                elif "PERMISSION_DENIED" in error_msg:
                    print(f"  ✗ FAILED: Service account lacks permissions")
                    print(f"\n  → SOLUTION:")
                    print(f"     Run this command to grant permissions:")
                    print(f"     gcloud projects add-iam-policy-binding {project_id} \\")
                    print(f"       --member='serviceAccount:{client_email}' \\")
                    print(f"       --role='roles/firebase.admin'")
                    return False
                else:
                    print(f"  ✗ FAILED: {error_msg}")
                    return False

        # Step 5: Test custom token creation
        print("\n✓ Step 5: Testing custom token generation...")
        try:
            custom_token = admin_auth.create_custom_token(uid)
            token_str = custom_token.decode() if isinstance(custom_token, bytes) else custom_token
            print(f"  ✓ Custom token created successfully!")
            print(f"  ✓ Token (first 50 chars): {token_str[:50]}...")

        except Exception as token_err:
            print(f"  ✗ FAILED: Could not create custom token: {token_err}")
            return False

        print("\n" + "=" * 70)
        print("✓ SUCCESS! Firebase Authentication is properly configured!")
        print("=" * 70)
        print(f"\nYou can now use the auto-login feature with: {test_email}")
        print(f"User UID: {uid}")
        print(f"\nNext step: Add this user as admin in Firestore:")
        print(f"  Collection: users")
        print(f"  Document ID: {uid}")
        print(f"  Fields:")
        print(f"    - email: '{test_email}'")
        print(f"    - isAdmin: true")
        return True

    except Exception as e:
        print(f"  ✗ FAILED: Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_firebase_auth()
    sys.exit(0 if success else 1)
