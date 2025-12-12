#!/bin/bash
set -e

echo "Running Backend Tests..."
cd backend
python3 -m pytest tests/
cd ..

echo "Running Frontend Linting..."
cd frontend
npm run lint
cd ..

echo "All checks passed!"
