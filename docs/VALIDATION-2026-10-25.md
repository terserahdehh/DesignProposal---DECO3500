# Validation record — 25 October 2026

This record describes checks actually performed during the submission audit. It does not claim a new human evaluation, a new physical-band test, or independent verification of historical attendance.

## Application and deployment

- Locked dependency installation (`npm ci`) succeeded.
- `npm test`: **120 passed**, including the two-peer WebRTC integration.
- `npm run test:ui`: production export succeeded and **18 local browser checks passed**.
- The same **18 browser checks passed against `https://pulseband-steel.vercel.app`** after correcting the USB test to select its transport explicitly on hosted HTTPS.
- Both nested-app and repository-root cloud builds succeeded. The root configuration ran `npm ci --prefix prototype`, `npm --prefix prototype run build`, and published `prototype/dist`.
- Final root-based deployment: **Ready**, ID `dpl_61dvUJCc6Sn3Ax42WxA1ZL37Jp2H`, source commit `651432d`.
- Immutable URL: https://pulseband-jhr3y0qoe-andhikanayakaaws-projects.vercel.app
- Public alias: https://pulseband-steel.vercel.app
- `/`, `/phone` and `/phone/` returned HTTP 200. Their browser render produced no uncaught page errors. Both cloud builds exported `AppEntry-1d12ca4c55c087d52dfe5fda58e5b11e.js`.

Browser hardware cases use protocol doubles. No band was flashed, no saved hardware presets were replaced, and no physical location accuracy or radio range was measured by this audit. The new production screenshot shows the companion before hardware connection.

## PDF and artefacts

- Root export: [16_DesignPrototypeDocs.pdf](../16_DesignPrototypeDocs.pdf), **15 A4 pages**, **451,639 bytes**.
- SHA-256: `bac08527a20139d9f1d8eef65448812690c98e3b1e033009b556894012042bc5`.
- Page 1 contains all four supplied full names and exact student numbers, Team 16 / PulseBand and the repository URL.
- All textual blocks from both checked-in wiki sources were found in PDF text extraction. References, risk tables and both figures are included.
- All exported text spans are black and within page margins; **26 PDF link annotations** were detected.
- Pages were rendered and visually inspected, including the cover, figures, references and ethics tables. Heading/table placement was adjusted after inspection.
- The public GitHub raw PDF was downloaded and matched the local export byte for byte.
- The promotional website, prototype, companion, both GitHub video pages, poster page and brochure page each returned HTTP 200.
- The retained poster measured approximately 419.9 × 594.0 mm, one portrait page; brochure has two pages.

## Explicit remaining limits

The GitHub `Vercel` failure belongs to `serafina1/deco3500`, not the verified `pulseband` project. Root-build configuration did not clear that separate failure. This authenticated Vercel account cannot access `serafina1`, so its remaining error is unknown and [issue #2](https://github.com/terserahdehh/DesignProposal---DECO3500/issues/2) remains open. No fabricated success status was posted.

The GitHub Project query was rejected for missing `read:project` / `project` scope. Current tasks were created as repository issues, with Project linking left explicitly open. Historical meeting evidence, evaluation dates, public-release consent and final Blackboard upload still require team action as listed in [the submission checklist](SUBMISSION-CHECKLIST.md).

Serafina's student number remains `s4980036`, exactly as supplied. Its length differs from the other three numbers; the team should verify it before uploading. Everyone's Week 9 / Week 12 attendance is team-confirmed, not independently audited here.
