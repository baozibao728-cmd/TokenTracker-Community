# Brand icon source

`app-icon.svg` is the production master, faithfully redrawn from
`reference-approved.png`. The reference is documentation only; its pale canvas
and presentation shadow never enter an application resource.

The mark joins a white ring and tilted orbit on a black rounded tile, with an
upper-right opening and separate satellite. `app-mark.svg` is the same shape
without the tile, suitable for a template menu bar icon.

Run from the repository root after `npm ci`:

```sh
npm run gen:brand-icons
npm run validate:brand-icons
node scripts/brand-icon-previews.cjs
```

The generator uses the existing `pngjs` dependency, closed M/L/C/Z paths,
fixed cubic subdivision and supersampling. It rejects unsupported SVG features.
At 16–24 pixels it widens the existing opening and moves the satellite by less
than one output pixel to keep them separate. Larger sizes follow the master
directly. The output manifest records exact bytes and SHA-256 per resource.
Narrow Git LF attributes keep generated SVG bytes reproducible across platforms.

Outputs include web SVG/PNG/ICO, Windows multi-size ICO, the actual macOS
`AppIcon.icon` layer SVGs and fallback ICNS, transparent black menu bar PNGs,
and the Linux/Tauri RGBA PNG. Apple supplies the native outer mask; its
Icon Composer background layer is therefore full bleed. The existing Linux
sync script still derives the Tauri icon from `dashboard/public/icon-512.png`.

The Windows and Swift generation entry points delegate to this master. Optional
Swift output-directory arguments still generate only their respective layer or
menu bar files. The generator does not write pets, animation frames, provider
logos or ordinary feature icons.

Windows pet regeneration now reads its separately preserved
`TokenTrackerWin/assets/tray-mascot-source.png`, rather than the macOS static
brand resource. Its existing light/dark ICOs retain their original bytes.

`previous-icon.png` preserves the former app icon for the comparison only.
`previews/actual-sizes.png` displays 16/32/48/256 pixels without scaling;
`previews/small-pixels.png` enlarges the same small-size pixels with nearest
neighbor for inspection. Neither preview is a production resource.
