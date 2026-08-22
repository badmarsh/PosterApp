#!/bin/bash
# Start MinerU API server - equivalent of start-mineru.bat for Unix/WSL environments
cd ~/mineru && source .venv/bin/activate && mineru-api --port 8001
