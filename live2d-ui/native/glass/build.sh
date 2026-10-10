#!/bin/zsh
set -eu
cd "$(dirname "$0")/../.."
headers="native/glass/node-v24.12.0/include/node"
if [[ ! -f "$headers/node_api.h" ]]; then
  archive=$(mktemp -t nori-node-headers)
  trap 'rm -f "$archive"' EXIT
  curl -fsSL https://nodejs.org/dist/v24.12.0/node-v24.12.0-headers.tar.gz -o "$archive"
  tar -xzf "$archive" -C native/glass
fi
clang++ -std=c++17 -fobjc-arc -mmacosx-version-min=26.0 -arch arm64 -bundle -undefined dynamic_lookup -I "$headers" -framework AppKit native/glass/glass.mm -o resources/nori-glass.node
