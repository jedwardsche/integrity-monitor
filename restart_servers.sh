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

# Stop backend (port 8000)
echo ""
echo "Stopping backend server..."
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
cd "$SCRIPT_DIR/backend"

# Check if .venv exists
if [ ! -d ".venv" ]; then
    echo -e "${RED}✗ Virtual environment not found${NC}"
    echo "  Creating virtual environment..."
    python3 -m venv .venv
    source .venv/bin/activate
    echo "  Installing dependencies..."
    pip install -r requirements.txt
else
    source .venv/bin/activate
fi

# Check if dependencies are installed
if ! python -c "import firebase_admin" 2>/dev/null; then
    echo -e "${YELLOW}Installing missing dependencies...${NC}"
    pip install -r requirements.txt
fi

# Start backend in background
echo "  Starting uvicorn server..."
nohup uvicorn main:app --reload --reload-exclude "*.venv/*" --reload-exclude "*/__pycache__/*" --reload-exclude "*/.git/*" --host 0.0.0.0 --port 8000 > ../logs/backend.log 2>&1 &
BACKEND_PID=$!

# Wait and check if backend started
sleep 3
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend server started on http://localhost:8000${NC}"
    echo "  PID: $BACKEND_PID"
else
    echo -e "${RED}✗ Backend server failed to start${NC}"
    echo "  Check logs: tail -f logs/backend.log"
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
