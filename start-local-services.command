#!/bin/zsh
set -e
project_dir=${0:A:h}
cd "$project_dir"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
mkdir -p logs
if ! curl -fsS --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
 OLLAMA_MODELS="$project_dir/models/ollama" OLLAMA_HOST=127.0.0.1:11434 nohup ollama serve > logs/ollama-local.log 2>&1 &
fi
if ! curl -fsS --max-time 2 http://127.0.0.1:12393/docs >/dev/null 2>&1; then
 nohup .venv/bin/python run_server.py > logs/avatar-local.log 2>&1 &
fi
for attempt in {1..80}; do
 if curl -fsS --max-time 2 http://127.0.0.1:12393/docs >/dev/null 2>&1; then
  exit 0
 fi
 sleep 1
done
print "Emma could not start. Check logs/avatar-local.log."
exit 1
