#!/usr/bin/env python3
"""
Script to set up admin user in Firestore.

This script creates or updates a user document in Firestore with admin privileges.
"""

import os
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

def setup_admin_user(uid: str, email: str):
    """Set up admin user in Firestore."""

    print("=" * 70)
    print("Admin User Setup Tool")
    print("=" * 70)
    print()

    # Initialize Firebase Admin
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if not os.path.isabs(cred_path):
            cred_path = os.path.join(backend_dir, cred_path)

        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)

        db = firestore.client()
        print(f"✓ Connected to Firestore")

    except Exception as e:
        print(f"✗ Failed to initialize Firebase: {e}")
        return False

    # Create/update user document
    try:
        user_ref = db.collection('users').document(uid)

        # Check if user already exists
        user_doc = user_ref.get()

        user_data = {
            'email': email,
            'isAdmin': True,
            'createdAt': firestore.SERVER_TIMESTAMP,
        }

        if user_doc.exists:
            print(f"→ Updating existing user document...")
            user_ref.update({
                'isAdmin': True,
                'updatedAt': firestore.SERVER_TIMESTAMP,
            })
            print(f"✓ User updated successfully!")
        else:
            print(f"→ Creating new user document...")
            user_ref.set(user_data)
            print(f"✓ User created successfully!")

        print()
        print("=" * 70)
        print("✓ SUCCESS! Admin user is configured!")
        print("=" * 70)
        print(f"\nUser Details:")
        print(f"  Email: {email}")
        print(f"  UID: {uid}")
        print(f"  Admin: true")
        print(f"\nYou can now sign in and access the admin dashboard!")

        return True

    except Exception as e:
        print(f"✗ Failed to create admin user: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    # Default values - can be overridden via command line
    uid = "VREuQrovBgfFchFsblPRJRbvRUx2"  # From test_firebase_auth.py
    email = "jedwards@che.school"

    if len(sys.argv) > 1:
        email = sys.argv[1]
    if len(sys.argv) > 2:
        uid = sys.argv[2]

    print(f"Setting up admin user: {email} (UID: {uid})")
    print()

    success = setup_admin_user(uid, email)
    sys.exit(0 if success else 1)
