#!/bin/bash
# Simple script to run Evacua locally

PORT=3000

echo "Starting Evacua server on http://localhost:$PORT"
echo "Press Ctrl+C to stop"
echo ""

# Use Python's built-in server
python3 -m http.server $PORT

