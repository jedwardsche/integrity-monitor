#!/bin/bash

cd "$(dirname "$0")/frontend"

export CI=true
export npm_config_progress=false

# Try to use system Node.js instead of Firebase's bundled version
# Firebase's Node.js (pkg-bundled) may have ES module issues
SYSTEM_NODE=""
if command -v /usr/local/bin/node >/dev/null 2>&1; then
    SYSTEM_NODE="/usr/local/bin/node"
elif command -v /opt/homebrew/bin/node >/dev/null 2>&1; then
    SYSTEM_NODE="/opt/homebrew/bin/node"
elif [ -x "/usr/bin/node" ]; then
    SYSTEM_NODE="/usr/bin/node"
fi

# Use system Node.js if available, otherwise fall back to PATH node
NODE_CMD="${SYSTEM_NODE:-node}"

VITE_BIN="node_modules/.bin/vite"
VITE_JS="node_modules/vite/bin/vite.js"

BUILD_EXIT=1

# Check if dist already exists - if so, skip build (allows pre-building)
if [ -d "dist" ] && [ -n "$(ls -A dist 2>/dev/null)" ]; then
    echo "Frontend already built, skipping..."
    BUILD_EXIT=0
elif [ -f "$VITE_BIN" ]; then
    # Run with timeout if available, otherwise run directly
    # Timeout prevents hanging (5 minutes should be enough for a build)
    if command -v timeout >/dev/null 2>&1; then
        timeout 300 "$NODE_CMD" "$VITE_BIN" build < /dev/null
        BUILD_EXIT=$?
    else
        "$NODE_CMD" "$VITE_BIN" build < /dev/null
        BUILD_EXIT=$?
    fi
else
    echo "Error: Vite not found. Run 'npm install' in the frontend directory first." >&2
    BUILD_EXIT=1
fi

# If that failed, try direct vite.js as fallback
if [ $BUILD_EXIT -ne 0 ] && [ -f "$VITE_JS" ]; then
    "$NODE_CMD" "$VITE_JS" build < /dev/null
    BUILD_EXIT=$?
fi

if [ $BUILD_EXIT -ne 0 ]; then
    exit $BUILD_EXIT
fi

