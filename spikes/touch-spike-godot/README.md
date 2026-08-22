# Godot Touch Spike

Minimal Godot 4.7.2 scene: 2 boards, tap-to-select, single-finger
drag-to-move with 1" grid snap, fixed camera. Built to compare touch feel
against the Three.js/R3F spike — see
`docs/superpowers/specs/2026-08-21-platform-decision-touch-spike-design.md`.

## Running

Desktop (for quick iteration, not a touch-feel test):

```
"$GODOT" --path spikes/touch-spike-godot
```

Android device: open in the Godot editor, connect a device with USB
debugging enabled, use the one-click deploy button or
Project → Export... → Export Project, then `adb install -r <apk>`.

## Tests

```
"$GODOT" --headless --path spikes/touch-spike-godot --script snap_check.gd
```

## Android export status (as of this session)

Configured and verified:
- `export/android/android_sdk_path` = `D:\Android\Sdk` (auto-detected by
  the editor; confirmed present in
  `%APPDATA%\Godot\editor_settings-4.7.tres`).
- `export/android/java_sdk_path` = `C:\Program Files\Java\jdk-17.0.1`
  (set manually this session — the machine only had a `javapath` shim on
  `PATH`, not a real JDK folder, and Godot's Android export needs the
  real JDK root).
- `export_presets.cfg` in this directory — **hand-written**, not
  editor-generated (deviation from the plan: no interactive GUI session
  was available to click through Project → Export...). It defines one
  "Android" preset targeting `arm64-v8a`, non-Gradle build, output path
  `builds/touch-spike-godot.apk`. Verified *accepted* by Godot (a headless
  export attempt got past config parsing and failed only on the
  known-missing piece below — not on a malformed preset).

**Not done — the one missing piece:** Android export templates
(`android_debug.apk` / `android_release.apk`, matching engine version
4.7.2) are not installed. A download was attempted this session
(`Godot_v4.7.2-stable_export_templates.tpz` from the GitHub release — a
~700MB+ archive) but did not finish in the available time and was
abandoned rather than left half-downloaded.

Confirmed failure mode (headless export attempt, this session):

```
ERROR: Cannot export project with preset "Android" due to configuration errors:
No export template found at the expected path:
C:/Users/4D/AppData/Roaming/Godot/export_templates/4.7.2.stable/android_debug.apk
No export template found at the expected path:
C:/Users/4D/AppData/Roaming/Godot/export_templates/4.7.2.stable/android_release.apk
```

## Deploying to a physical Android device (manual step)

This spike must be tested on a **physical Android device** — not an
emulator — per the parent spec's *Device testing* section (simulated
touch is a weak proxy for the thing being judged).

1. **Install the Android export templates** (the one remaining setup
   step) — easiest via the editor: open
   `"$GODOT" --editor --path spikes/touch-spike-godot`, then
   **Editor → Manage Export Templates → Download and Install** for
   version 4.7.2 (must match the installed engine version exactly).
   This downloads to
   `%APPDATA%\Godot\export_templates\4.7.2.stable\` automatically.
   (Alternative: download
   `https://github.com/godotengine/godot/releases/download/4.7.2-stable/Godot_v4.7.2-stable_export_templates.tpz`
   by hand and extract its contents into that folder yourself — it's a
   large file, budget time/bandwidth for it.)
2. **Enable USB debugging on the device**: Settings → About phone → tap
   "Build number" 7 times to unlock Developer options → Settings →
   Developer options → enable "USB debugging".
3. **Connect the device via USB** and accept the "Allow USB debugging?"
   prompt that appears on the device screen.
4. **Confirm the device is visible:**

   ```
   D:\Android\Sdk\platform-tools\adb.exe devices
   ```

   Expected: the device's serial number is listed (not an empty list).
5. **Build and install** — either:
   - In the Godot editor, with the device connected, use the Android
     device icon in the top-right run-target dropdown (one-click
     deploy), or
   - Export manually: **Project → Export... → Android → Export Project**,
     save the APK (e.g. to `spikes/touch-spike-godot/builds/`), then:

     ```
     D:\Android\Sdk\platform-tools\adb.exe install -r spikes/touch-spike-godot/builds/touch-spike-godot.apk
     ```
   - Or from the command line (no editor GUI needed), from
     `spikes/touch-spike-godot/` — this is the exact command already
     verified this session to reach (and correctly stop at) the
     templates check:

     ```
     "$GODOT" --headless --export-debug "Android" builds/touch-spike-godot.apk
     D:\Android\Sdk\platform-tools\adb.exe install -r builds/touch-spike-godot.apk
     ```
6. **Launch the app on the device** and check:
   - Two boards are visible on a ground plane from a fixed angle.
   - Tapping a board highlights it (orange); tapping the other board
     moves the highlight; tapping empty space clears the highlight.
   - Dragging a highlighted board with one finger moves it, snapped to
     visible 1" grid steps, without the board jumping away from your
     finger on first touch (the grab-offset fix from Task 5).
   - The board stays at its resting height while dragged.

Record your subjective impression (responsiveness, snap feel, any
tap-vs-drag misfires) — this is raw material for the final decision
record once the Three.js spike is also ready to compare, per the parent
spec's *Decision method*.
