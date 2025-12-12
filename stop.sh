#!/bin/bash

set -e

BACKEND_PORT=8000
FRONTEND_PORT=5173
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$PROJECT_ROOT/.dev-pids"

kill_port() {
    local port=$1
    local pids=$(lsof -ti :$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "Killing processes on port $port..."
        echo "$pids" | xargs kill -9 2>/dev/null || true
    else
        echo "No processes found on port $port"
    fi
}

if [ -f "$PID_FILE" ]; then
    echo "Stopping processes from PID file..."
    while read pid; do
        if ps -p "$pid" > /dev/null 2>&1; then
            kill "$pid" 2>/dev/null || true
        fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
fi

kill_port $BACKEND_PORT
kill_port $FRONTEND_PORT

echo "All services stopped"

