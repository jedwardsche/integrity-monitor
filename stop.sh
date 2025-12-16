#!/bin/bash

BACKEND_PORT=8000
FRONTEND_PORT=5173
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$PROJECT_ROOT/.dev-pids"
LOCK_FILE="$PROJECT_ROOT/.dev-lock"

kill_port() {
    local port=$1
    local pids=$(lsof -ti :$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "Killing processes on port $port..."
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 2
        # Force kill if still running
        pids=$(lsof -ti :$port 2>/dev/null || true)
        if [ -n "$pids" ]; then
            echo "$pids" | xargs kill -9 2>/dev/null || true
            sleep 1
        fi
        echo "Port $port cleared"
    else
        echo "No processes found on port $port"
    fi
}

# Stop processes from PID file
if [ -f "$PID_FILE" ]; then
    echo "Stopping processes from PID file..."
    while read pid; do
        [ -z "$pid" ] && continue
        if ps -p "$pid" > /dev/null 2>&1; then
            echo "Stopping process $pid..."
            kill -TERM "$pid" 2>/dev/null || true
        fi
    done < "$PID_FILE"
    
    # Wait for graceful shutdown
    sleep 2
    
    # Force kill any remaining processes from PID file
    while read pid; do
        [ -z "$pid" ] && continue
        if ps -p "$pid" > /dev/null 2>&1; then
            echo "Force killing process $pid..."
            kill -9 "$pid" 2>/dev/null || true
        fi
    done < "$PID_FILE"
    
    rm -f "$PID_FILE"
    echo "PID file cleaned up"
fi

# Kill any processes on our ports (in case PID file is missing or stale)
kill_port $BACKEND_PORT
kill_port $FRONTEND_PORT

# Kill any uvicorn processes that might be running
echo "Checking for any remaining uvicorn processes..."
UVICORN_PIDS=$(pgrep -f "uvicorn.*backend.main" 2>/dev/null || true)
if [ -n "$UVICORN_PIDS" ]; then
    echo "Killing remaining uvicorn processes..."
    echo "$UVICORN_PIDS" | xargs kill -TERM 2>/dev/null || true
    sleep 2
    UVICORN_PIDS=$(pgrep -f "uvicorn.*backend.main" 2>/dev/null || true)
    if [ -n "$UVICORN_PIDS" ]; then
        echo "$UVICORN_PIDS" | xargs kill -9 2>/dev/null || true
    fi
fi

# Kill any vite processes that might be running
echo "Checking for any remaining vite processes..."
VITE_PIDS=$(pgrep -f "vite.*dev" 2>/dev/null || true)
if [ -n "$VITE_PIDS" ]; then
    echo "Killing remaining vite processes..."
    echo "$VITE_PIDS" | xargs kill -TERM 2>/dev/null || true
    sleep 2
    VITE_PIDS=$(pgrep -f "vite.*dev" 2>/dev/null || true)
    if [ -n "$VITE_PIDS" ]; then
        echo "$VITE_PIDS" | xargs kill -9 2>/dev/null || true
    fi
fi

# Remove lock file
rm -f "$LOCK_FILE"

echo ""
echo "All services stopped"
