#!/bin/bash

# Use build-with-secrets.sh which fetches Cloud Run URL and sets VITE_API_BASE
cd "$(dirname "$0")/frontend"

if [ ! -f "build-with-secrets.sh" ]; then
    echo "Error: frontend/build-with-secrets.sh not found" >&2
    exit 1
fi

# Call build-with-secrets.sh which handles fetching Cloud Run URL and building
./build-with-secrets.sh

