# VoctManager app identity

Status: Community-role thesis accepted. Latest user direction: cut musical notes into the V. Two raster treatments are saved for review; open cuts merit further drawing. No visual direction or production asset is approved (2026-09-29).

## Scope

Design a new identity for the installed VoctManager app: its compact mark, app icon, opening motion, and the two notification graphics. The user also asked to replace the weak line-shaped VoctEnsemble site icon; coordinate the two as one family while keeping their applications distinct. The site's full mark and preloader remain separate.

The app mark must be visibly related to VoctEnsemble's house glyph without shrinking that tall, fine-lined glyph into a square. Its recognizable features are split arms, a continuous vertical axis, and a detached tilted note head. The installed app should express this family in compact, optically weighted geometry.

The desired visual character is contemporary for the second half of 2026: sparse, decisive geometry that survives a 24-pixel rendering and can carry a restrained motion sequence. The house glyph supplies a family signature, not a requirement to repeat its exact V.

## Current implementation

- The installed PWA uses `frontend/public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, and `apple-touch-icon.png` through `frontend/public/manifest.webmanifest` and `frontend/index.html`.
- `frontend/src/sw.ts` supplies `icon-192.png` as a notification `icon` and `badge.png` as its small monochrome `badge`. The platform chooses how to display them. The application icon count is a separate mechanism.
- `frontend/src/widgets/panel-shell/DesktopSidebar.tsx` uses `frontend/public/logo_gold.png`. `frontend/src/features/auth/components/AuthBrand.tsx` builds the name with typography and a one-shot halo.
- Android's native PWA splash is generated from the manifest's icon and colors. App-controlled motion can begin only after the page loads. `frontend/src/shared/ui/kinematics/EtherealBackground.tsx` already has a session-gated entrance; `EtherealLoader.tsx` is used for many ordinary loading states.
- `frontend/scripts/generate-pwa-icons.mjs` expects `frontend/public/logo_biale.png`, which is missing from the checkout. Its outputs are currently not reproducible. `frontend/index.html` declares a PNG favicon with an SVG MIME type.

## Visual exploration — 2026-09-29

Every study file lives in `brand-lab/` at the repository root, which git ignores: `scripts/` holds the renderers (they borrow `sharp` from `frontend/`, and run from anywhere), `exploration/` the first rounds, and `voctmanager-identity/` the later studies with their own `render.mjs`, prompts and reviews. Only what a settled direction produces for the app enters git (step 4 of the plan).

The first three editable pairs and comparison remain in `brand-lab/exploration/` as rejected evidence. The user judged them superficial and amateurish; that assessment is supported by their 24-pixel output. Confluence reads like a media control, Score Fold like a document, and Axis like a generic Y. Do not implement the earlier Confluence recommendation or its launch study. The later monochrome sketches in `round-2/`, `round-3/`, and `round-4/` also fail: they become ordinary V/Y/M letterforms, a road sign, or lose their cuts at notification size. They are experiments, not deliverables.

The source glyph in `web/public/voct-mark.svg` carries a specific high-contrast calligraphic V, a continuous fine axis, and a detached tilted ellipse. A prior monoline simplification was rejected in `docs/web-landing-guardrails.md` because it resembled an arrow. The earlier app sketches repeated that error. The ensemble's story in `web/src/content/pages/o-nas.yaml` describes a changing cast around a fixed core and musical exchange emerging from silence. These are design inputs, not a claimed historical explanation of the house mark.

`brand-lab/voctmanager-identity/` contains one responsive-family **study**, with an app icon, monochrome badge, compact site favicon, and a rendered size comparison. It reuses the actual source V contour and gives it optical weight for small sizes. It is a useful family baseline, but it is still a plain V; it has not solved how VoctManager owns a distinct sign. It is not an approved direction or a replacement for three genuinely different concepts.

The next exploration should begin with a concise identity thesis and build a distinctive visual system from it. Show each serious direction beside the real house glyph and the VoctManager name, then inspect its app icon, 24-pixel monochrome badge, and 16-pixel site favicon. Judge the black-and-white shapes before palette and motion. The three vectors must express different ideas rather than three costumes for the same V. An honest two strong directions are preferable to a padded third; record the shortfall rather than promote a weak sketch.

Only after a static mark survives should its app entrance be storyboarded. The native PWA splash cannot animate. Start after page load, avoid delaying usable content, coordinate with the existing `EtherealBackground` entrance, and provide a complete static mark under reduced motion. The site's separate favicon task is tracked in `docs/specs/voctensemble-site-icon-2026-09.md`.

## Design and implementation plan

### Current stage: community meaning — 2026-09-29

**Latest steering:** The user accepted the community-role thesis below and asked to continue in this same chat. Fresh visual work may proceed from that meaning. The preceding correction was to establish the application's role before drawing. The image-assisted Weave, Chamber, and Register exploration in `directions-2026-09-29/` remains unapproved evidence and gains no retrospective rationale from the accepted thesis. Better small-size readability does not establish a meaningful identity; Chamber was never selected.

**Accepted thesis (2026-09-29):** VoctManager gives people dependable support in preparing music together. It connects each singer's own preparation and participation with the ensemble's shared musical work, during rehearsals and performances as well as between them. The user accepted this direction and explicitly requested continuation in the same chat. Acceptance applies to the meaning, not to any existing or future sketch.

The earlier emphasis on memory, belonging and continuity was too broad to distinguish this application from any organisation's shared workspace. The more specific starting point is the relationship between a person's own musical part and the people with whom they sing. The ensemble's published account in `web/src/content/pages/o-nas.yaml` describes mutual listening, a changing cast around a stable core, and discipline held together with tenderness. These are inputs to the proposed application role; they do not establish how members currently experience the software.

**Intended experience:** A singer can understand what the ensemble is preparing, locate their own contribution, and rely on shared material and decisions when preparing it. The emotional aim is a sense of having support and being able to contribute. This remains a design hypothesis, not user-research evidence or finished product copy.

The existing product provides concrete grounds for that hypothesis:

- **Taking part:** project invitations, participation responses and casting make a person's contribution explicit. They can support agency and clarity about commitments; an assignment or attendance record does not measure belonging.
- **Preparing together:** scores, practice recordings and shared musical annotations connect individual practice to a common interpretation. The intended benefit is confidence that one's preparation serves the same musical undertaking as everyone else's.
- **Keeping one another informed:** rehearsal arrangements and project communication give people a shared reference for their participation. The intended benefit is consideration for other people's time and preparation, with fewer matters held only in someone's memory.

The archive and recurring project structure support continuity across changing casts. Continuity is a supporting consequence of the role above, not a claim that every singer has access to every project or that the software contains the choir's entire shared life. Friendship, trust and artistic belonging grow through people's encounters; the application can support their practical conditions. Neither digital activity nor participation in the current concert defines a person's worth to the community.

**Identity consequence:** Carry the relationship between an individual contribution and sustained collective music-making into the next brief. Give the application a character of attentiveness, dependability and musical focus. Shared responsibility should feel supported, not policed. Keep this at the level of meaning for now: no particular enclosure, weave, letter, note or other geometry follows automatically from it, and none of the existing sketches acquires a rationale from this thesis.

**Evidence boundary:** The thesis defines the desired role. Any stronger claim that members already experience the application as their common home requires their account of that experience.

### Active visual stage: community studies

Work in `brand-lab/voctmanager-identity/community-2026-09-29/`. Explore three starting ideas: Common measure (individual preparation shares a musical reference), Reciprocity (contributions respond to one another), and Held part (each contribution has dependable support). These are briefs written before drawing, not explanations of the old sketches.

Planned files: `image-prompts.md`; exploratory PNGs; one `mark.svg`, `badge.svg`, and `app.svg` per viable direction; a local `render.mjs`; `comparison.svg` and `comparison.png`; `pixel-proof.png`; a short `review.md` and `validation.json`. Show the actual house glyph and the VoctManager name alongside the new studies. Keep the previous site favicon studies as labelled family references. If fewer than three concepts survive, report that without padding the set. Update this specification and the connected site specification only for the stage outcome. No application code changes or launch motion belong to this pass.

**Stage outcome:** Common measure and Held part did not advance beyond raster exploration. A separately briefed Common chord direction uses musical notation itself as shared support for distinct contributions. Two vector studies now exist: `01-common-chord/` and `02-reciprocity/`. Chord preserves three heads at 24/16 pixels but lacks demonstrated distinctiveness; Reciprocity loses the independence of its lower part at small sizes. This is not a set of three strong directions. See the local `review.md`, `comparison.png`, and `pixel-proof.png`. Both app crops pass the maskable safety check. The next design decision is whether to refine Chord's identity; no launch or production integration has begun.

### Common chord refinement — 2026-09-29

The user asked to develop Common chord further and linked `community-2026-09-29/image-common-chord.png`. This is a request to pursue its character, not approval of the current geometry. The linked raster alternates heads on both sides of its axis; the existing vector puts three identical heads on one side and is not an equivalent refinement.

**Diagnosis:** The raster's alternating balance has more character than the regular vector stack, but its long axis, soft branch junctions and widely separated oval heads suggest a plant. The vector avoids that association by sacrificing the opposing rhythm. Develop the relationship between the heads and shared axis, keeping the alternating composition as the starting point. Family resemblance should come from angled oval stress, upright poise and calligraphic contour contrast.

**Latest steering:** The user suggested cutting the notes into the V. Pursue this combination explicitly. The V supplies the shared structure and direct family recognition; three notehead counterforms give the application its musical contributions. Its arms need optical widening relative to the house glyph to contain those cuts.

**Pass outcome:** The stem refinements remained too close to the original branch shape; serif caps and a detached lower head did not establish a distinct identity. A negative-space trial introduced the useful cutting technique but had a heavy rectangular body. Those are intermediate experiments, not retained deliverables. The saved comparison is [Chord in V](../../brand-lab/voctmanager-identity/community-2026-09-29/chord-in-v-board.png): **01** has closed notehead counters; **02** opens them to the outer edges of the V. The latter deserves further drawing because the notes shape its outline. This is an assistant assessment, not user approval.

**Limits and next stage:** The generated board reverses the left notehead's tilt and opens the cuts outward, although the brief requested parallel noteheads and inward cuts. Its V is an interpretation, not the exact house contour. Study the outward-cut construction deliberately; align the notehead stress, reduce the heavy upper terminals and balance the remaining bridges when drawing the vector. Compare against the actual house glyph and VoctManager name, then render monochrome 24/16-pixel proofs and app crops. No small-size or maskable claim is supported by this raster board. Production integration and motion remain later stages.

**Image generation:** Built-in imagegen. Reference 1: `directions-2026-09-29/house-reference.png`; reference 2: the intermediate rectangular negative-notehead study, used only to communicate the cutting technique. This pass edits only this specification and saves the final comparison PNG. Exact prompt for the saved board:

> Use case: logo-brand. Create ONE clean landscape comparison board with TWO sophisticated black-and-white refinements of a bespoke app logomark for VoctManager. The user's specific direction: CUT THE MUSICAL NOTES INTO THE V. Reference image 1 is the real VoctEnsemble house mark: its high-contrast calligraphic V is the source family. Reference image 2 demonstrates the negative-notehead technique only; its solid rectangular outer shape is NOT wanted. The new outer silhouette must be a clear, beautiful, broad, compact CAPITAL V. Interpret the real reference V with wider optically strong arms so it has enough black body to carry musical negative spaces. Preserve calligraphic contrast, deliberate angled terminals and a decisive lower point. Do NOT place notes beside, beneath, behind or on top of a V. The noteheads must be physically CUT OUT OF THE BLACK ARMS OF THE V as white counterforms. The V itself is the common support for the different musical voices. Exactly three slanted oval notehead-shaped cuts in each version, optically balanced across both arms at different heights, all tilted upward to the right. Not literal miniature complete notes with long stems, no music staff. Left design labelled 01: three generous CLOSED WHITE NOTEHEAD COUNTERS punched into the thick black arms, one in the left arm and two in the right arm, retain substantial uninterrupted black bridges around each. Right design labelled 02: three OPEN NOTEHEAD INCISIONS carved from the INNER EDGES of the broad V arms, the oval bodies entering the black and opening to the central white V through short generous diagonal mouths. One on the left and two on the right, with staggered heights; the notches are an essential part of the contour. Keep the overall V unmistakable and the three musical voices individually readable. The open counterform treatment should feel like a confident custom engraved ligature rather than a V with decoration. Both marks share the same family character and comparable overall dimensions. Prioritize harmonious drawing, a compact silhouette and legibility without explanation. A single horizontal white board, two equally spaced large black marks, ample margins, small quiet sans-serif labels 01 and 02 under their respective marks, no other text. Flat pure black and white only. No grey, gradients, textures, shadow, mockup, frame, tile, circle, detached dot, extra staff or long vertical axis. These are exploration sketches, not final vector files.

The image-assisted work under `brand-lab/voctmanager-identity/directions-2026-09-29/` remains unapproved evidence. Record any new image prompt and distinguish raster exploration from vector deliverables. Use the existing rendering tools for size proofs. Deliver the comparison and static marks first; storyboard a launch only after a static direction survives review.

Limit the active visual stage to the identity asset directory and these two identity specifications. Production icons, application code, and the house glyph remain outside this stage. Evaluate topology, counterspace, family resemblance, and raster survival before motion. Record weaknesses explicitly; no direction is approved by being rendered.

1. Explore distinct vector marks from a clear product idea, without treating the current V as mandatory. Judge each at app-icon size and at the small monochrome notification size before selecting a direction.
2. Refine one family: a full-color app icon, a simplified single-color badge, and a mark that works beside the VoctManager name on light and dark grounds. Keep the badge's geometry deliberately simpler when needed.
3. Storyboard a short, session-gated entrance using the chosen mark after the native splash. Respect reduced-motion settings and avoid delaying usable content. Keep ordinary route and data loaders separate from the launch sequence.
4. Store editable vector masters under `frontend/public/brand/`. Update `frontend/scripts/generate-pwa-icons.mjs` to produce the five committed raster assets from those masters. Update `frontend/src/widgets/panel-shell/DesktopSidebar.tsx`, `frontend/src/features/auth/components/AuthBrand.tsx`, and the chosen launch integration in `frontend/src/widgets/panel-shell/DashboardLayout.tsx` or `frontend/src/app/App.tsx`. Update `frontend/public/manifest.webmanifest` if the icon backdrop changes and correct the favicon type in `frontend/index.html`.
5. Keep the existing notification file paths consumed by `frontend/src/sw.ts` and `frontend/src/features/settings/components/DeliveryPreviewModal.tsx`, so both display the new icon without changing notification behavior.

## Verification

- Inspect the mark at 24, 72, 192, and 512 pixels and inside a maskable crop; verify light and dark surfaces and reduced motion.
- Run the icon generator once after the vectors are final, then run `npm run typecheck` and `npm run build` from `frontend/` at the end of the implementation stage.
- Review the installed icon, actual device notification, and app opening in the developer's browser and phone.
