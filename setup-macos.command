#!/bin/zsh
set -e
project_dir=${0:A:h}
cd "$project_dir"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if [[ $(uname -m) != arm64 ]]; then
 print 'This release is tested on Apple Silicon. Intel builds are not supported yet.'
 exit 1
fi
for tool in uv npm ollama; do
 command -v "$tool" >/dev/null || { print "Install $tool first. See README.md."; exit 1; }
done
core=live2d-ui/src/renderer/WebSDK/Core/live2dcubismcore.js
if [[ ! -f "$core" ]]; then
 print 'Get the Cubism SDK for Web from Live2D, review its terms, and copy Core/live2dcubismcore.js to:'
 print "$project_dir/$core"
 print 'https://www.live2d.com/en/sdk/download/web/'
 exit 1
fi
mkdir -p backgrounds characters data logs models/voice-samples
[[ -f conf.yaml ]] || cp conf.example.yaml conf.yaml
uv sync --frozen --python 3.12
.venv/bin/python scripts/download_models.py
.venv/bin/python - <<'PY'
from pathlib import Path
import json,sys
root=Path.cwd()
config={'mcp_servers':{'time':{'command':'uvx','args':['mcp-server-time']},'desktop':{'command':sys.executable,'args':[str(root/'emma_desktop_mcp.py')]}}}
(root/'mcp_servers.json').write_text(json.dumps(config,indent=2))
PY
if ! curl -fsS --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
 OLLAMA_MODELS="$project_dir/models/ollama" OLLAMA_HOST=127.0.0.1:11434 nohup ollama serve > logs/ollama-local.log 2>&1 &
fi
for attempt in {1..30}; do
 curl -fsS --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break
 sleep 1
done
ollama pull qwen3:1.7b
cd live2d-ui
npm ci
npm run build:web
print 'Ready. Run ../run-desktop-avatar.command, or install the Mac app from Releases.'
