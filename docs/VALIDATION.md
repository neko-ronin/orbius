# Validation — 2026-09-08

## Automated checks

`npm test`: eight passing tests covering valid disk round trips; unsupported format/version, invalid numbers and palette values; malformed nodes/fields; multiple inputs and cycles; active-chain-only evaluation; orb source routing; independent preservation of compiled shader and unfinished draft; prototype-name and duplicate-field rejection.

`npm run build`: successful Vite production build. Application JavaScript is approximately 252 KB before gzip (82 KB gzip); CSS approximately 25 KB (7 KB gzip). No build warnings in the final run.

## Browser checks

The official Playwright CLI controlled locally installed Chromium for Testing. Desktop viewport: 1440 × 960. Mobile layout viewport: 390 × 844. Tests exercised the rendered application, not mocked WebGL output.

Passed:

- Hover shows the parameter field note.
- Clicking places a gravity field; `L` switches to colored light; `X` clears fields.
- Pause preserves an identical canvas image across successive frames.
- Show mode hides navigation and increases canvas size to 2160 × 1440; Escape restores the editor.
- Invalid GLSL shows compiler diagnostics while retaining the working renderer.
- Valid GLSL recompiles and the diagnostics clear.
- A downloaded JSON project reopens from disk, restoring the orb workspace and the modified shader source.
- A four-node composition evaluates; reconnecting source directly to output reduces the active chain to two nodes.
- A cycle-producing connection is rejected with feedback.
- Mobile layout does not overflow the viewport horizontally.
- Actual PNG and video downloads succeed.
- WebGL `getError()` returns 0 following export and workspace transitions.

The async file-loading test initially checked the screen before File.text() completed; it was corrected to wait for the restored workspace, then passed. A missing favicon in the first development load was fixed with a local SVG. Deliberately invalid GLSL is an expected compile-failure test, not an uncaught app error.

## Visual and media evidence

The captured images under `output/playwright/` are generated validation artifacts, excluded from git:

- `particles-final.png`: particle authoring workspace.
- `particles-show-final.png`: UI-free particle presentation.
- `orb-show-final.png`: higher-quality orange/gold ray-marched orb.
- `orb-studio.png`: orb controls.
- `node-composer.png`: node wiring and rendering.
- `mobile.png`: narrow-layout inspection.
- `export-4k.png`: verified PNG IHDR dimensions **3840 × 2560**.
- `export-video.webm`: ffprobe verified **VP9, 2160 × 1440, 30/1 FPS**, approximately 1.53 MB for the short test clip. MediaRecorder WebM may omit duration metadata.
- `roundtrip.boast.json`: the exported/reloaded project fixture.

The default 80,000-particle development scene showed about 60 FPS in this browser during the recorded desktop checks. This is an observation on one host, not a cross-device benchmark or a show-mode performance guarantee.

During visual review, floating-point feedback targets replaced the clipping-prone default where supported, pause rendering was fixed, ray-march convergence was improved, and framebuffer resampling was added so quality changes preserve accumulated trails. Historical feedback is resampled rather than retroactively rendered at a higher resolution.

## Coverage limits

No Safari, Firefox, discrete-GPU, context-loss stress, maximum-complexity custom-shader, or sustained 30-second recording soak test was run. Export encoding and performance remain browser/GPU dependent. Touch layout was checked through a narrow viewport; a physical touch device was not used.

## Post-reset smoke check

A fresh browser session also passed keyboard focus trapping and Escape in the guide, pointer exit from show mode, save/load of an unfinished GLSL draft while retaining the compiled renderer, missing-source diagnostics, a dark pixel readback for disconnected output, and a final WebGL error check of 0. The replayable check is `output/playwright/final-smoke.js`.
