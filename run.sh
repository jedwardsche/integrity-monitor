#!/bin/bash

set -e

BACKEND_PORT=8000
FRONTEND_PORT=5173
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$PROJECT_ROOT/.dev-pids"

cleanup() {
    echo "Cleaning up..."
    if [ -f "$PID_FILE" ]; then
        while read pid; do
            if ps -p "$pid" > /dev/null 2>&1; then
                kill "$pid" 2>/dev/null || true
            fi
        done < "$PID_FILE"
        rm -f "$PID_FILE"
    fi
}

trap cleanup EXIT INT TERM

check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "Port $port is already in use. Please stop existing services first."
        exit 1
    fi
}

check_port $BACKEND_PORT
check_port $FRONTEND_PORT

echo "Starting backend on port $BACKEND_PORT..."
cd "$PROJECT_ROOT/backend"
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt
cd "$PROJECT_ROOT"
PYTHONPATH="$PROJECT_ROOT" uvicorn backend.main:app --reload --host 0.0.0.0 --port $BACKEND_PORT > "$PROJECT_ROOT/.backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID >> "$PID_FILE"
echo "Backend started (PID: $BACKEND_PID)"

echo "Starting frontend on port $FRONTEND_PORT..."
cd "$PROJECT_ROOT/frontend"
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi
VITE_API_BASE="http://localhost:$BACKEND_PORT" npm run dev > "$PROJECT_ROOT/.frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID >> "$PID_FILE"
echo "Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "Services started:"
echo "  Backend:  http://localhost:$BACKEND_PORT"
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo ""
echo "Streaming backend logs (Press Ctrl+C to stop all services)..."
echo ""

tail -f "$PROJECT_ROOT/.backend.log"
