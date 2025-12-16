#!/bin/bash
# Script to restart backend and frontend servers with correct configuration

echo "=========================================="
echo "Restarting CHE Integrity Monitor Servers"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Function to kill processes on a port
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}Killing processes on port $port...${NC}"
        kill $pids 2>/dev/null || kill -9 $pids 2>/dev/null
        sleep 1
        echo -e "${GREEN}✓ Port $port freed${NC}"
    else
        echo -e "${GREEN}✓ Port $port is already free${NC}"
    fi
}

# Function to kill all uvicorn/python backend processes
kill_backend_processes() {
    echo -e "${YELLOW}Killing any existing backend processes...${NC}"
    pkill -f "uvicorn backend.main" 2>/dev/null
    pkill -f "uvicorn.*main:app" 2>/dev/null
    pkill -f "python.*uvicorn.*backend.main" 2>/dev/null
    sleep 1
    echo -e "${GREEN}✓ Backend processes cleaned up${NC}"
}

# Stop backend (port 8000)
echo ""
echo "Stopping backend server..."
kill_backend_processes
kill_port 8000

# Stop frontend (port 5173)
echo ""
echo "Stopping frontend server..."
kill_port 5173

# Wait a moment for cleanup
sleep 2

echo ""
echo "=========================================="
echo "Starting servers..."
echo "=========================================="

# Start backend
echo ""
echo "Starting backend server..."
cd "$SCRIPT_DIR"

# Check if backend/.venv exists
if [ ! -d "backend/.venv" ]; then
    echo -e "${RED}✗ Virtual environment not found${NC}"
    echo "  Creating virtual environment..."
    cd backend
    python3 -m venv .venv
    source .venv/bin/activate
    echo "  Installing dependencies..."
    pip install -r requirements.txt
    cd ..
else
    source backend/.venv/bin/activate
fi

# Check if dependencies are installed
if ! python -c "import firebase_admin" 2>/dev/null; then
    echo -e "${YELLOW}Installing missing dependencies...${NC}"
    cd backend
    pip install -r requirements.txt
    cd ..
fi

# Start backend in background (run from project root to allow relative imports)
echo "  Starting uvicorn server..."
# Ensure logs directory exists
mkdir -p logs
# Start uvicorn server with reload enabled, but exclude .env and logs to prevent loops
python -m uvicorn backend.main:app \
    --reload \
    --reload-exclude "**/.venv/**" \
    --reload-exclude "**/__pycache__/**" \
    --reload-exclude "**/.git/**" \
    --reload-exclude "**/node_modules/**" \
    --reload-exclude "**/.env" \
    --reload-exclude "**/*.log" \
    --reload-exclude "**/.dev-pids" \
    --reload-exclude "**/.dev-lock" \
    --host 0.0.0.0 \
    --port 8000 \
    >> logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "  Started process with PID: $BACKEND_PID"

# Wait longer and check multiple times if backend started
echo "  Waiting for server to start..."
STARTED=false
# Wait up to 20 seconds (--reload mode can take longer to fully start)
for i in {1..20}; do
    sleep 1
    # Check if process is still running
    if ! ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo -e "${RED}✗ Backend process died unexpectedly${NC}"
        echo "  Check logs: tail -f logs/backend.log"
        tail -30 logs/backend.log 2>/dev/null || echo "  (log file empty)"
        STARTED=false
        break
    fi
    # Check if server is responding
    # Try multiple times as reloader may restart during startup
    HEALTH_CHECK_PASSED=false
    for j in {1..3}; do
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            HEALTH_CHECK_PASSED=true
            break
        fi
        sleep 0.5
    done
    
    if [ "$HEALTH_CHECK_PASSED" = true ]; then
        echo -e "${GREEN}✓ Backend server started on http://localhost:8000${NC}"
        echo "  PID: $BACKEND_PID"
        STARTED=true
        break
    fi
done

if [ "$STARTED" = false ]; then
    echo -e "${RED}✗ Backend server failed to start after 15 seconds${NC}"
    echo "  Process status:"
    ps -p $BACKEND_PID 2>/dev/null || echo "  Process not found"
    echo "  Check logs: tail -f logs/backend.log"
    echo "  Last 30 lines of log:"
    tail -30 logs/backend.log 2>/dev/null || echo "  (log file empty or not found)"
fi

# Start frontend
echo ""
echo "Starting frontend server..."
cd "$SCRIPT_DIR/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install
fi

# Start frontend in background
echo "  Starting vite dev server..."
nohup npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait and check if frontend started
sleep 5
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend server started on http://localhost:5173${NC}"
    echo "  PID: $FRONTEND_PID"
else
    echo -e "${RED}✗ Frontend server failed to start${NC}"
    echo "  Check logs: tail -f logs/frontend.log"
fi

echo ""
echo "=========================================="
echo "✓ Servers restarted!"
echo "=========================================="
echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Logs:"
echo "  Backend:  tail -f $SCRIPT_DIR/logs/backend.log"
echo "  Frontend: tail -f $SCRIPT_DIR/logs/frontend.log"
echo ""
echo "To test authentication:"
echo "  curl 'http://localhost:8000/auth/dev-token?email=jedwards@che.school'"
echo ""
