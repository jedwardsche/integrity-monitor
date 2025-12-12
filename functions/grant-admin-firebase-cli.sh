#!/bin/bash

# Grant admin access using Firebase CLI
# Requires: firebase CLI installed and authenticated
# Usage: ./grant-admin-firebase-cli.sh

set -e

EMAILS=(
  "jedwards@che.school"
  "systems@che.school"
)

echo "Granting admin access to users..."
echo "Note: Users must sign in to the app first to create their Firebase Auth account."
echo ""

for email in "${EMAILS[@]}"; do
  echo "Processing: $email"
  
  # Get user UID by email (requires Firebase Admin SDK or manual lookup)
  # Since we can't easily get UID from email via CLI, we'll use a workaround:
  # Create a temporary Node script that uses Firebase Admin
  node -e "
    const admin = require('firebase-admin');
    admin.initializeApp();
    const auth = admin.auth();
    const db = admin.firestore();
    
    auth.getUserByEmail('$email')
      .then(user => {
        return db.collection('users').doc(user.uid).set({ isAdmin: true, email: '$email' }, { merge: true });
      })
      .then(() => {
        console.log('✓ Granted admin access to $email');
        process.exit(0);
      })
      .catch(err => {
        if (err.code === 'auth/user-not-found') {
          console.error('✗ User $email not found. User must sign in first.');
        } else {
          console.error('✗ Error:', err.message);
        }
        process.exit(1);
      });
  " || echo "Failed to grant access to $email"
done

echo ""
echo "Done!"
