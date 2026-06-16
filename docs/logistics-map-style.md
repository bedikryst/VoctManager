# Logistics map — Ethereal "Vellum Atlas" skin & 3D setup

The logistics maps (`LocationsAtlas`, `LocationMapPicker`, `LocationPreview`) render a
**vector** Google map referenced by `VITE_GOOGLE_MAP_ID`. With a `mapId` present the
map's visual style is **cloud-based** — it lives in the Google Cloud Console attached to
that map id, **not** in the React code (the `styles` map option is ignored whenever a
`mapId` is set, and `AdvancedMarker` requires a `mapId`, so we cannot drop it).

That means the parchment skin and the 3D tilt are both configured **once, in the console**.
This file is the source of truth for that configuration.

## 1. Apply the Vellum Atlas style

The refined style lives in [`logistics-map-style.json`](./logistics-map-style.json). It is
the **new** Cloud-based map styling format (the `variant` + `styles[]` editor), tuned to the
Ethereal palette: warm vellum land (`#efe9dc`), gilded roads, a desaturated dusty-blue
water, gold place-of-worship labels (churches matter for a choir), and POI clutter removed
(our own markers carry the venues).

1. Google Cloud Console → **Google Maps Platform → Map Styles**.
2. Open the style bound to the map id in `VITE_GOOGLE_MAP_ID` (or create one and bind it).
3. Switch to the **JSON** tab and paste the contents of `logistics-map-style.json`.
4. **Save**, then **Publish**. Propagation to live tiles can take a few minutes.

> The in-app `MapAtmosphere` overlay (vignette + warm corners + top sheen) makes the surface
> feel on-brand even before the cloud style propagates, so dev never looks broken.

## 2. Make the map a Vector map with tilt + rotation (this is what fixes "3D")

The 3D dive (`tilt3D` toggle in `LocationsAtlas`, and the cinematic dive in
`cameraFlight.ts`) calls `map.setTilt()` / `map.setHeading()`. These are **silently ignored
on a raster map**, which is the usual reason "3D doesn't work". To enable it:

1. In the same Map style / Map ID settings, set **Map type = Vector** (not Raster).
2. Enable **Tilt** and **Rotation** (a.k.a. "Tilt & heading interactions").
3. Save + Publish.

Tilt only engages at close zoom (≈ z15+); the atlas dives to `CINEMATIC.FOCUS_ZOOM` (16.4)
on selection, so once the map is Vector + tilt-enabled the dive renders real 3D building
extrusions. No code change is required.

### Checklist if 3D still looks flat
- `VITE_GOOGLE_MAPS_FRONTEND_KEY` and `VITE_GOOGLE_MAP_ID` are both set in the frontend env.
- The map id is **Vector** and **Tilt + Rotation** are on.
- You are zoomed in far enough (selecting a venue does this automatically).
- The Maps JS **WebGL** features are available (no `WebGL` block by the browser/GPU).

## 3. Optional future: photorealistic 3D tiles

`@vis.gl/react-google-maps` ships an experimental `Map3D` / `Marker3D` (Photorealistic 3D
Tiles). It is a genuine "drop the conductor off their chair" view of a concert hall, but it
is a separate, more expensive API surface and a different component tree. Treat it as a
deliberate future upgrade for a single-venue "approach" view, not a replacement for the
atlas overview.
