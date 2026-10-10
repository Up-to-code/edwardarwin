# Nori native glass

An 85 KiB Node-API bridge applies Apple's public NSGlassEffectView to measured control rectangles, rather than blurring the entire floating character window. macOS 26+ uses regular glass; macOS 27 also enables effectIsInteractive. No private glass variants are used. Native views return nil from hitTest so the existing keyboard and drag controls keep working.

Build on Apple Silicon with the macOS 26+ SDK:

    native/glass/build.sh

The script downloads official Node 24.12.0 headers if missing and writes resources/nori-glass.node, which electron-builder copies outside the ASAR. Header downloads are ignored by Git. The renderer measures surfaces with ResizeObserver / MutationObserver; the main process validates their bounds and sender before touching AppKit. Other platforms retain translucent CSS controls.

Native container insertion was adapted from Meridius Labs' MIT electron-liquid-glass project. See LICENSE and https://github.com/Meridius-Labs/electron-liquid-glass .
