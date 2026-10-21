---
name: monk-exercise-illustrator
description: Generate consistent anatomical exercise illustrations for Monk Mode, including start/end movement positions, primary and secondary muscle highlighting, and asset validation.
---

# Monk Exercise Illustrator

Use for one named Monk Mode exercise, a selected list, or a requested batch of missing local illustrations. New media belongs in Open Exercise Atlas; Monk Mode supplies exercise facts and visual references, and receives the result through the pinned Atlas sync. Do not start an all-exercise batch unless asked. Before a batch, report count, expected start/finish assets, available image tools, and likely cost or time; stop if scope or matching is ambiguous.

## Inputs and discovery

Identify the Monk checkout, Atlas checkout, exact exercise ID or name, and intended output scope. Run `python .agents/skills/monk-exercise-illustrator/scripts/exercise_pilot.py plan --monk <path> --atlas <path> --exercise <id-or-name> --out <manifest.json>` to make a source-backed plan. For multiple IDs, run once per ID. The script refuses ambiguous names and reports candidate Atlas records; a name match alone never proves equivalence. Review equipment, grip, mechanics, variation, primary/secondary muscles, existing `legacyIds`, and Atlas ID registry before choosing an Atlas record. Record differences explicitly. Do not change either project's exercise IDs, stored workout `exId` values, muscle classification, source data, or generated JSON merely to make a match.

Read [exercise-data.md](references/exercise-data.md) when resolving data paths or Atlas registration. Read [anatomy-rules.md](references/anatomy-rules.md) to select actual muscle regions and safe poses, then [visual-style.md](references/visual-style.md) for image generation. `primaryMuscles` and `secondaryMuscles` are broad labels, not pixel masks. If anatomical region or equivalence remains uncertain, mark `needs-human-review` and keep the existing record unchanged.

## Generate and review

Produce separate START and FINISH/KEY POSITION prompts from the plan. For isometrics, make frame B explain contraction or grip. Use an available image generation tool to produce original, consistent frames; if none is available, deliver prompts and manifest only. Use the same character, camera, scale and equipment across frames. Do not copy third-party source photographs or imply that reference art has redistribution rights. Keep text outside the image. Optional combined panel is derived only after both individual frames pass review.

Visually inspect both frames at full size and at mobile thumbnail size. Check pose, bar/implement path, joint angles, grip, hands/feet, equipment symmetry, muscle boundaries and primary/secondary color separation. Automated metadata and dimension checks cannot certify anatomy. Failed or uncertain images stay in a review area and are never registered as approved Atlas media. Revise or escalate for a named human anatomy/form review; keep `reviewStatus` unchanged.

Preserve the original PNG masters; create optimized WebP copies without overwriting existing files. Prefer deterministic `<atlas-id>-start.webp` and `<atlas-id>-finish.webp`; inspect an existing path and its hash before writing. Run `exercise_pilot.py validate --atlas <path> --manifest <manifest.json>` after assigning asset paths. It checks identity, formats, dimensions, hashes, duplicate paths and whether the proposed Atlas media fields conform to the current schema shape. Treat visual/anatomical review as a separate gate.

## Atlas registration and integration

Only after asset and rights review, store approved files under `media/exercises/`, add start/finish entries to the existing `data/exercises/<id>.json` `media` array, and document creator, model/method, date, source and redistribution evidence in `docs/media-provenance.md`. Verify all required fields against `schemas/exercise.schema.json`; never invent a license, source URL or rights evidence. CC0 requires an actual rights decision. Preserve existing media unless replacement is explicitly requested. Update `legacyIds` only after variant equivalence is confirmed. Build `dist/` with the repository command; never hand edit it.

Run Atlas `npm run validate`, `npm run data:build`, `npm run data:check`, `npm test`, `npm run lint`, and `npm run build`. Run Monk Mode lint, tests and build when its skill files or integration code change. Report source IDs, matched/unmatched status, asset paths, validation results and unresolved problems. Use separate feature branches and atomic commits/PRs for the two repositories.

Monk Mode already consumes Atlas: after the Atlas commit is pushed, run `npm run data:atlas:update` in Monk Mode (see `docs/atlas-data.md`), review the diff of `public/data/exercises.json` and `public/exercises/`, run its tests and commit the lock file with the generated outputs. A picture with `role: start/finish` is shown only if no `reference` picture exists. Do not alter the UI as part of an illustration run unless requested.
