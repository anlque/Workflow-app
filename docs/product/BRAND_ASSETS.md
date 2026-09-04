# Locusora Brand Assets

## Identity

Locusora uses the **Growth Rings** mark: nested organic rings around a warm
centre. The protected outer locus represents a personal focus environment; the
open inner rings represent a Workflow deepening through repeated practice. The
warm centre is a restrained reference to Reward rituals.

The editable source of truth is
[`assets/brand/source/locusora-growth-rings.svg`](../../assets/brand/source/locusora-growth-rings.svg).
Manifest PNGs and Store artwork are exports, not independent artwork.

## Provenance and Licence

| Resources | Origin and method | Created | Rights |
| --- | --- | --- | --- |
| Growth Rings mark and lockups | Original hand-authored SVG produced by OpenAI Codex under product-owner direction; visual direction selected by the product owner | 2026-09-04 | Copyright © 2026 project owner; all rights reserved unless the project owner applies another licence |
| Small Store promo tile | Original composition derived only from the Growth Rings source | 2026-09-04 | Same as the master mark |
| Manifest, favicon and Store PNG exports | Deterministic Playwright/Chromium rendering of project-owned SVG sources | 2026-09-04 | Same as their SVG sources |
| Store screenshots | Automated captures of the locally built Locusora extension using deterministic project-owned fixture content | 2026-09-04 | Application UI and capture are project-owned; emoji glyph appearance is supplied by the local browser/system font |

No stock artwork, external logo, icon pack, embedded font file or generative
image model output is included. The lockup requests the application's existing
system sans-serif stack and distributes no font software. This provenance record
does not constitute legal trademark clearance.

## Inventory

### Editable vector sources

- `assets/brand/source/locusora-growth-rings.svg` — 1024-square master mark.
- `assets/brand/source/locusora-lockup-light.svg` — horizontal light-ground
  lockup, `1440×420` viewBox.
- `assets/brand/source/locusora-lockup-dark.svg` — horizontal dark-ground
  lockup, `1440×420` viewBox.
- `assets/brand/source/locusora-promo-small.svg` — Store promo composition,
  `440×280` viewBox.

### Extension resources

- `public/brand/icon-16.png` — toolbar/favicon-class icon, 16×16 RGBA PNG.
- `public/brand/icon-32.png` — toolbar/Windows icon, 32×32 RGBA PNG.
- `public/brand/icon-48.png` — extensions-management icon, 48×48 RGBA PNG.
- `public/brand/icon-128.png` — installation icon, 128×128 RGBA PNG.
- `public/brand/favicon-16.png` — entrypoint favicon, 16×16 RGBA PNG.
- `public/brand/locusora-mark.svg` — public copy of the master mark.
- `public/brand/locusora-lockup-light.svg` and
  `public/brand/locusora-lockup-dark.svg` — public lockups.

The public mark is also rendered in the idle Focus launcher, Options header and
Side Panel header. The active Focus session remains visually quiet.

### Chrome Web Store resources

- `store-assets/locusora-store-icon-128.png` — 128×128 RGBA PNG with the mark
  occupying 96×96 and 16 px transparent padding on each side.
- `store-assets/locusora-promo-small-440x280.png` — required 440×280 RGB/RGBA
  PNG small promo tile.
- `store-assets/screenshots/locusora-01-focus-light-1280x800.png` — real running
  Focus Session in the light system theme.
- `store-assets/screenshots/locusora-02-workflow-settings-1280x800.png` — real
  Workflow editor with a two-Phase configuration.
- `store-assets/screenshots/locusora-03-reward-ritual-dark-1280x800.png` — real
  Reward result in the dark system theme.

The optional 1400×560 marquee image is intentionally absent.

## Colour Tokens

| Name | Value |
| --- | --- |
| Forest | `#29483A` |
| Primary green | `#2F7B5C` |
| Growth green | `#78C29B` |
| Bright green | `#82D2A9` |
| Mint | `#C2E9D3` |
| Pale green | `#E4F2EA` |
| Warm reward | `#F2B86B` |
| Light ground | `#F6FAF7` |
| Dark ground | `#1B2823` |
| Light wordmark | `#EDF7F1` |

Do not recolour individual exports. Change the approved SVG sources, review the
result on both backgrounds, then regenerate the entire export set.

## Reproduction

Run from the repository root with dependencies and Playwright Chromium already
installed:

```bash
pnpm brand:export
pnpm build
pnpm brand:capture-screenshots
pnpm brand:verify
```

- `brand:export` renders exact PNG sizes and copies approved public SVGs.
- `brand:capture-screenshots` rebuilds the extension, creates an isolated
  Chromium profile, configures a real Workflow through the UI and captures real
  extension pages at 1280×800.
- `brand:verify` validates PNG signatures, dimensions, transparency requirements,
  SVG viewBoxes and production manifest icon mappings.

Generated files are intentionally committed so an unpacked extension and Store
submission do not require the export toolchain at use time.

## Manual Review

After regeneration:

1. View the 16, 32, 48 and 128 px icons at native scale on `#F6FAF7` and
   `#1B2823`.
2. Load `.output/chrome-mv3` through `chrome://extensions`.
3. Pin Locusora and inspect the toolbar icon under light and dark Chrome themes.
4. Confirm the 16 px icon preserves the outer locus, inner open ring and warm
   centre without clipping.
5. Inspect every Store screenshot at native 1280×800 and after downscaling to
   640×400.
6. Confirm every screenshot depicts current application behaviour and contains
   no obsolete product name.

## Chrome Requirements Evidence

Requirements were checked on 2026-09-03 against official documentation:

- [Configure extension icons](https://developer.chrome.com/docs/extensions/develop/ui/configure-icons)
- [Manifest icons](https://developer.chrome.com/docs/extensions/reference/manifest/icons)
- [Supplying Store images](https://developer.chrome.com/docs/webstore/images)
- [Complete listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Creating a great listing](https://developer.chrome.com/docs/webstore/best-listing)

At that check, Chrome required a 128×128 Store icon, at least one 1280×800
screenshot and a 440×280 small promo tile. The 1400×560 marquee image was
optional. Recheck requirements when preparing the actual Store release.
