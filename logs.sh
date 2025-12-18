#!/bin/bash

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

show_usage() {
    echo "Usage: ./logs.sh [backend|frontend|both]"
    echo ""
    echo "Options:"
    echo "  backend   - Show backend logs only"
    echo "  frontend  - Show frontend logs only"
    echo "  both      - Show both logs (default)"
    echo ""
    echo "Press Ctrl+C to stop viewing logs"
}

# Parse argument
MODE="${1:-both}"

case "$MODE" in
    backend)
        echo "Streaming backend logs (Press Ctrl+C to stop)..."
        tail -f "$PROJECT_ROOT/.backend.log"
        ;;
    frontend)
        echo "Streaming frontend logs (Press Ctrl+C to stop)..."
        tail -f "$PROJECT_ROOT/.frontend.log"
        ;;
    both)
        echo "Streaming both backend and frontend logs (Press Ctrl+C to stop)..."
        echo "=========================================="
        echo "Backend logs will be prefixed with [B]"
        echo "Frontend logs will be prefixed with [F]"
        echo "=========================================="
        echo ""
        tail -f "$PROJECT_ROOT/.backend.log" | sed 's/^/[B] /' &
        BACKEND_TAIL_PID=$!
        tail -f "$PROJECT_ROOT/.frontend.log" | sed 's/^/[F] /' &
        FRONTEND_TAIL_PID=$!

        # Wait for Ctrl+C
        trap "kill $BACKEND_TAIL_PID $FRONTEND_TAIL_PID 2>/dev/null; exit 0" INT TERM
        wait
        ;;
    -h|--help|help)
        show_usage
        ;;
    *)
        echo "Error: Invalid argument '$MODE'"
        echo ""
        show_usage
        exit 1
        ;;
esac
