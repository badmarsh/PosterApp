@echo off
wsl -d Ubuntu -e bash -c "cd ~/mineru && source .venv/bin/activate && mineru-api --port 8001"
