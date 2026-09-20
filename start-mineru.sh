#!/bin/bash
# Start MinerU API server - equivalent of start-mineru.bat for Unix/WSL environments
fuser -k 8002/tcp || true
cd ~/mineru
source .venv/bin/activate
mineru-api --port 8002
