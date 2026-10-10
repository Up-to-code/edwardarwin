#!/bin/zsh
set -e
project_dir=${0:A:h}
cd "$project_dir"
./start-local-services.command
if [[ -d "$HOME/Applications/Emma Darwin.app" ]]; then
 exec env -u ELECTRON_RUN_AS_NODE "$HOME/Applications/Emma Darwin.app/Contents/MacOS/Emma Darwin" --pet
fi
cd live2d-ui
exec env -u ELECTRON_RUN_AS_NODE node_modules/electron/dist/Electron.app/Contents/MacOS/Electron . --pet
