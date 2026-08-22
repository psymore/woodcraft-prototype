# Three.js/R3F Touch Spike

Minimal Vite + React + @react-three/fiber scene: 2 boards, tap-to-select,
single-finger drag-to-move with 1" grid snap, fixed camera. Built to
compare touch feel against the Godot spike — see
`docs/superpowers/specs/2026-08-21-platform-decision-touch-spike-design.md`.

## Running

```
npm install
npm run dev -- --host
```

Open the printed `Local:` URL on desktop, or the `Network:` URL from a
phone on the same Wi-Fi.

## Tests

```
npx vitest run
```

## Build

```
npm run build
```
