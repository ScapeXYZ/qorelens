# Demo stills

Extracted 2026-11-24 with FFmpeg from the local 1920 × 1080, 165.800-second `QoreLens_Final_With_English_Subtitles.mp4` (SHA-256 `09f96848c339`). Raw PNGs preserve the decoded full-resolution frames, including original subtitles.

| Raw frame                                                   | Timestamp | Visible evidence                                                  | SHA-256        |
| ----------------------------------------------------------- | --------- | ----------------------------------------------------------------- | -------------- |
| [populated-matrix](../docs/images/raw/populated-matrix.png) | 145 s     | Populated matrix, including Message signing and Tamper controls   | `54c73c1cd4f7` |
| [signing-tamper](../docs/images/raw/signing-tamper.png)     | 84 s      | Tamper controls drawer with accepted original and five rejections | `1dbf315cdbcc` |
| [report-build](../docs/images/raw/report-build.png)         | 151 s     | Reports panel with integrity status and build block               | `f485b0289b11` |

## Clean presentation crops

FFmpeg extracted these frames from the local 1920 × 1080 subtitle-free visual master `QoreLens_2m46_visual_rough_cut.mp4` (SHA-256 `b03e7cd4711e`). The previously extracted captioned originals remain in place. Presentation copies crop the frames and add a separate numbered caption in the top margin.

| Frame           |  Time | Clean, full-resolution original                                  | Presentation crop                           |
| --------------- | ----: | ---------------------------------------------------------------- | ------------------------------------------- |
| Matrix          | 145 s | [Original](../docs/images/raw/populated-matrix-clean.png)        | [Crop](../docs/images/populated-matrix.png) |
| Tamper controls |  84 s | [Original](../docs/images/raw/signing-tamper-controls-clean.png) | [Crop](../docs/images/signing-tamper.png)   |
| Reports         | 151 s | [Original](../docs/images/raw/report-build-clean.png)            | [Crop](../docs/images/report-build.png)     |

The supplemental 96 s [frame](../docs/images/raw/signing-tamper-clean.png) shows the drawer after scrolling. The 84 s crop shows more of the controls.
