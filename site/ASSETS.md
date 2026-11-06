# Assets

Everything on the site is either generated for this project or a licensed typeface.

## Typefaces

| Face | Use | Licence |
| --- | --- | --- |
| Newsreader (variable) | prose, headings | SIL Open Font License 1.1, via `@fontsource-variable/newsreader` |
| IBM Plex Mono | figures, labels, code | SIL Open Font License 1.1, via `@fontsource/ibm-plex-mono` |

Both are self-hosted from `node_modules` at build time. No runtime font CDN.

## Images

| File | Where | Source |
| --- | --- | --- |
| `src/assets/screens/*.png` | landing plates | Screenshots of the Termwise app running on its seeded synthetic database, taken by `scripts/capture.mjs` |
| `public/favicon.svg` | tab icon | Drawn for this project |
| `public/og.png` | link preview | Rendered from the built landing page |

No stock photography, no third-party illustrations, no icon set. The app's own interface is the imagery.

## Screenshots

Names describe the content (`attendance-conflicts-desktop`, `student-marks-phone`). The phone shots are 390x844 at 2x; desktop shots are 1440px wide. All data is synthetic seed data.
