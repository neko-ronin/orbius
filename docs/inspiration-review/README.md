# BOAST inspiration review

9 videos reviewed on 8 September 2026. Two separate deliverables:

- [Standalone implementation-agent brief](AGENT_IMPLEMENTATION_BRIEF.md): individual descriptions of every video, visual/interaction requirements, proposed approaches, and acceptance criteria. Designed to work outside the current codebase.
- [BOAST gap analysis and interview](BOAST_GAP_ANALYSIS_AND_INTERVIEW.md): current source evidence, prioritized proposals, expansive directions, and questions awaiting decisions.

## Evidence inventory

| ID | File (short display name) | Duration | Dimensions | Sampled frames |
|---|---|---:|---|---|
| R01 | Screen Recording … 3.59.27 PM.mov | 56.23 s | 1472 × 1836 | [Overview](contact-sheets/R01.jpg), [detail](contact-sheets/R01-detail.jpg) |
| R02 | Screen Recording … 4.05.14 PM.mov | 78.40 s | 2858 × 1566 | [Overview](contact-sheets/R02.jpg), [detail](contact-sheets/R02-detail.jpg) |
| R03 | Screen Recording … 4.08.04 PM.mov | 45.29 s | 2858 × 1566 | [Overview](contact-sheets/R03.jpg), [detail](contact-sheets/R03-detail.jpg) |
| R04 | Screen Recording … 4.11.13 PM.mov | 17.10 s | 1086 × 806 | [Overview](contact-sheets/R04.jpg) |
| R05 | Screen Recording … 4.12.18 PM.mov | 23.01 s | 1086 × 904 | [Overview](contact-sheets/R05.jpg) |
| R06 | Screen Recording … 4.13.08 PM.mov | 21.86 s | 1086 × 724 | [Overview](contact-sheets/R06.jpg) |
| R07 | Screen Recording … 4.13.56 PM.mov | 17.43 s | 1086 × 724 | [Overview](contact-sheets/R07.jpg) |
| R08 | v09-fuzzy-coral-growth.mov | 16.25 s | 1042 × 1468 | [Overview](contact-sheets/R08.jpg), [detail](contact-sheets/R08-detail.jpg) |
| R09 | v13-glass-sphere-dendrites.mov | 14.97 s | 1388 × 1398 | [Overview](contact-sheets/R09.jpg), [detail](contact-sheets/R09-detail.jpg) |

[Ending frames](contact-sheets/endings.jpg). The [manifest](asset-manifest.json) preserves exact relative filenames, SHA-256 hashes, dimensions, durations, audio presence, and sampling timestamps. The seven screen-recording filenames use a narrow no-break space before PM. Original files remain in `inspirations/` and were not changed.

## Method and limits

Used installed FFprobe/FFmpeg to inspect metadata and extract frames; used the already available Python/Pillow runtime to assemble contact sheets. No new packages were installed. All nine recordings have video at 60 fps and no audio stream. Their total runtime is approximately 4 minutes 51 seconds.

Reviewed nine evenly spaced samples per recording, additional closely spaced sequences for R01/R03/R08/R09, detailed full-resolution editor/gallery samples for R02, and an ending frame from each recording. The supplied sheets contain 135 sampled frames in total, including repeated/overlapping moments. This is a timestamped visual sample review, not uninterrupted playback or frame-by-frame examination of every video frame. It supports descriptions of appearance and sampled evolution, not precise frame-rate, optical correctness, solver identification, or measured transition timing.

Source captions are identified as claims rather than treated as implementation proof. R08 includes a title card and apparent cuts, so no continuous growth or audio response is inferred. R02's app identity was corroborated using the official Orbkit repository. The documents distinguish observed content from proposed techniques and client requirements.

Current-app findings come from source inspection at `da509c8`. No application implementation, dependency installation, or new browser benchmark is part of this review. The earlier app checkpoint remains separate from these review artifacts and the user-added videos.
