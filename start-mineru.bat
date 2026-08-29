@echo off
wsl -d Ubuntu -e bash -c "cd ~/mineru && source .venv/bin/activate && mineru-api --host 0.0.0.0 --port 8001"
