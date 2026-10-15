# Starter Media Pack

## Purpose and Boundary

SEED-002 packages five backgrounds and three ambient loops for a later first-run
seed service. The catalog in `src/app/seeds/starterAssetSeeds.ts` is data-only:
it performs no IndexedDB writes and does not alter existing user Assets.

All runtime files work offline. The original PNG renders and downloaded MP3s
remain outside the repository; only the optimized application-specific exports
below are distributed.

## Packaged Inventory

| Name | Runtime file | Kind | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| Mosswood Canopy | `public/seed/backgrounds/mosswood-canopy.webp` | WebP, 2560×1600 | 305,348 | `8b73b2c4af216ac8b045526aa24dcdb8869c9a1e61adf2be00328c06298ab940` |
| Rainlit Window | `public/seed/backgrounds/rainlit-window.webp` | WebP, 2560×1600 | 264,996 | `d2a7347920539c8c84ebc002bbe0bf25758f8b72956f4e0a3bdcb3eaae80fda8` |
| Deep Tide | `public/seed/backgrounds/deep-tide.webp` | WebP, 2560×1600 | 88,982 | `edd67f634c6396191ac09008d16d6a025a61c6facc50f51f8c84ca1ebe14d356` |
| Amber Library | `public/seed/backgrounds/amber-library.webp` | WebP, 2560×1600 | 149,032 | `21eff3d64cd6f736aee1fcda664a578343e2cc79099922950db1e4fc09fff911` |
| Starlit Ridge | `public/seed/backgrounds/starlit-ridge.webp` | WebP, 2560×1600 | 100,032 | `3fca3e2ad7cf349972de8908c50f1ae978de756e7854db41fe174ad8fb21b93b` |
| Cozy Bedroom Rain | `public/seed/audio/cozy-bedroom-rain.ogg` | Opus/Ogg, stereo 48 kHz, 30.0065 s | 175,723 | `38fbd217bca77cce062560bfcf29740dd1ba16958b395a4ec647f9550c7b95a3` |
| Lofi Chill | `public/seed/audio/lofi-chill.ogg` | Opus/Ogg, stereo 48 kHz, 30.0065 s | 267,884 | `36b1fe3d9d320d546ea802a051d406992063c708a477b87e4aa841d29b30a655` |
| Healing Bowl | `public/seed/audio/healing-bowl.ogg` | Opus/Ogg, stereo 48 kHz, 30.0065 s | 191,222 | `f0186f0a3023a43371b3611948ae27957012532c237a62afad96ec98c42c8f53` |

Total packaged media: **1,543,219 bytes**. The approved media limit is
2,097,152 bytes; the approved final unpacked extension limit is 4,194,304
bytes.

## Background Provenance and Composition

The five sources were generated specifically for Locusora on 2026-10-14 with
OpenAI's built-in `image_gen` tool. The tool did not expose its backing model or
model revision, so no more specific model identifier can be verified. The
applicable published terms were checked on 2026-10-15: the
[OpenAI Terms of Use](https://openai.com/policies/terms-of-use/) and
[Service Terms](https://openai.com/policies/service-terms/). They do not
incorporate a selected third-party stock asset. Generation is not a claim of
exclusive rights or legal clearance.

The exact submitted prompt strings were not retained. The table therefore
records only the contemporaneous prompt directions that survived in the work
log; they are not reconstructed exact prompts. The original generator PNGs were
not retained after export. Their dimensions, byte sizes and SHA-256 values were
captured while they were available. Resized 2560×1600 PNG intermediates may
still exist under `/private/tmp/locusora-seed-images/`, but this temporary
directory is not durable provenance and those files are not the originals.

| Name | Preserved prompt direction | Original PNG | Source SHA-256 |
| --- | --- | --- | --- |
| Mosswood Canopy | Ancient moss forest, emerald diffused light, quiet central clearing | 1672×941, 3,002,884 bytes | `f6d7ea1a14349afbea4d95e4dd7c8b703aa86c428e408b41da5f98f503927e31` |
| Rainlit Window | Rain-streaked window, blue-green garden, muted amber reflections | 1672×941, 2,519,007 bytes | `694b550aa73c48651f6ea2272fb53f1485c52efb3d0ebe32717e5596f038a54d` |
| Deep Tide | Abstract underwater depth, layered currents, restrained pearl light | 1672×941, 1,899,835 bytes | `16b6869ed475466b45a92430c83a220e19dc458472a5077741ab16be7fcb3335` |
| Amber Library | Warm shelves and lamplight framing a dark, quiet center | 1448×1086, 1,973,670 bytes | `068b13e0bb590f56ed8c9203653bf424582d78fab95350109ee19da1561d1beb` |
| Starlit Ridge | Quiet mountain ridge, restrained stars, dark central sky | 1448×1086, 2,265,957 bytes | `0a6cb62a341819ea899153b120a040f8d4bf8e9e3aca783a3c1d98b39f112cc4` |

Every prompt prohibited people, text, logos, watermarks and central focal
objects. The meaningful safe zone is normalized `x = 0.40–0.60`,
`y = 0.12–0.88`. Centered `cover` crops were checked at 1600×700, 1024×768
and 390×844. On 2026-10-15 the product owner approved all five backgrounds in
the wide, 4:3 and portrait crops.

### Background export

The production render used `/opt/homebrew/bin/magick` from ImageMagick
**7.1.2-27** and `/opt/homebrew/bin/cwebp` **1.6.0**. The installed binaries
predate the 2026-10-14 exports and are the binaries invoked by the recorded
commands. For each source:

```sh
magick SOURCE.png -auto-orient -gravity center -resize '2560x1600^' \
  -extent 2560x1600 -strip /private/tmp/locusora-seed-images/NAME.png
cwebp -quiet -q QUALITY -m 6 -metadata none \
  /private/tmp/locusora-seed-images/NAME.png \
  -o public/seed/backgrounds/NAME.webp
```

`QUALITY` is 66 for Mosswood Canopy and 68 for the other four exports.

The exact upstream versions can be obtained reproducibly from their release
archives. Verify the archives before following their included build
instructions; this reproduces the tool versions, not a bit-identical Homebrew
bottle:

```sh
mkdir -p /private/tmp/locusora-image-tools
cd /private/tmp/locusora-image-tools

curl -L \
  https://storage.googleapis.com/downloads.webmproject.org/releases/webp/libwebp-1.6.0.tar.gz \
  -o libwebp-1.6.0.tar.gz
echo 'e4ab7009bf0629fd11982d4c2aa83964cf244cffba7347ecd39019a9e38c4564  libwebp-1.6.0.tar.gz' \
  | shasum -a 256 -c -

curl -L \
  https://github.com/ImageMagick/ImageMagick/releases/download/7.1.2-27/ImageMagick-7.1.2-27.7z \
  -o ImageMagick-7.1.2-27.7z
echo 'dcfbdd8294b3ad6d07fc0edaa2c2071ffa6085b1207b525929b70ffb067300ae  ImageMagick-7.1.2-27.7z' \
  | shasum -a 256 -c -
```

## Audio Provenance and License

The audio sources were accessed on 2026-10-14. Each exact asset page states
that the source is free for use under the
[Pixabay Content License](https://pixabay.com/service/license-summary/).
Pixabay permits adaptation but prohibits standalone redistribution in
substantially unchanged form. Locusora distributes only selected, rearranged,
crossfaded, normalized and re-encoded 30-second derivatives as components of
the extension. This record is provenance, not legal trademark or copyright
clearance.

| Runtime name | Author and exact asset page | Original metadata | Original SHA-256 | Processing |
| --- | --- | --- | --- | --- |
| Cozy Bedroom Rain | CeleronBeats — [Cozy Bedroom Rain & Ambient Sounds](https://pixabay.com/music/ambient-cozy-bedroom-rain-amp-ambient-sounds-574987/) | MP3, stereo 48 kHz, 146.472 s, 4,687,104 bytes | `6f1e00602753bac25e8d57fd22ec7a75d4662e612b1df07cf88bc6cbbcea4cf6` | Source 30–61 s; 48 kbps Opus target |
| Lofi Chill | alex-morgan — [Lofi Chill Vlog Beats](https://pixabay.com/music/lofi-lofi-chill-vlog-beats-573883/) | AI-generated; MP3, stereo 48 kHz, 145.392 s, 4,652,544 bytes | `dec75f4d540f918f5d3dc60ffde125a35642e9e7e25a64cf1296aba23d9ae0a2` | Source 45–76 s; 64 kbps Opus target |
| Healing Bowl | BerryDeep — [Healing Bowl](https://pixabay.com/music/meditationspiritual-healing-bowl-563776/) | MP3, stereo 44.1 kHz, 420.153469 s, 13,444,911 bytes | `c4fdd6b0da2e54664a504c016e7c5161dc15a1750d381c7253c7dcbe3db791fb` | Source 60–91 s; 48 kbps Opus target |

Measured final loudness is -27.4 LUFS-I / -8.1 dBFS true peak for Rain,
-27.6 LUFS-I / -14.2 dBFS for Lofi and -27.6 LUFS-I / -16.2 dBFS for
Healing Bowl. The quieter peaks are intentional characteristics of these
continuous ambient beds rather than cue sounds.

### Reproducible audio render

Install exact tools only into a temporary directory:

```sh
mkdir -p /private/tmp/locusora-seed-tools
pnpm add --dir /private/tmp/locusora-seed-tools --save-exact \
  ffmpeg-static@5.2.0 ffprobe-static@3.1.0
cd /private/tmp/locusora-seed-tools/node_modules/ffmpeg-static && node install.js
```

With `SOURCE_START` set to 30, 45 or 60 seconds and `BITRATE` set as recorded
above:

```sh
FFMPEG=/private/tmp/locusora-seed-tools/node_modules/ffmpeg-static/ffmpeg
FILTER='[0:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=3[a][b][c];[a]atrim=start=1:end=30,asetpts=PTS-STARTPTS[mid];[b]atrim=start=30:end=31,asetpts=PTS-STARTPTS[tail];[c]atrim=start=0:end=1,asetpts=PTS-STARTPTS[head];[tail][head]acrossfade=d=1:c1=qsin:c2=qsin[seam];[mid][seam]concat=n=2:v=0:a=1,aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-28:TP=-3:LRA=7[out]'
"$FFMPEG" -ss "$SOURCE_START" -t 31 -i SOURCE.mp3 \
  -filter_complex "$FILTER" -map '[out]' -t 30 -c:a libopus \
  -b:a "$BITRATE" -vbr on -application audio -map_metadata -1 OUTPUT.ogg
```

The output begins and ends at the same source-time boundary: source seconds
1–30 form the body, while seconds 30–31 crossfade into seconds 0–1. Manual
listening was completed on 2026-10-15: the product owner listened to each of the
three loops for at least five repetitions on speakers and headphones and
confirmed that no audible seam, click, pause or level jump was present.

## Build Accounting

The pre-SEED-002 production build measured 1,862,665 bytes. The production
build with this pack measures **3,405,884 bytes**, an exact **1,543,219-byte**
increase matching the eight packaged files byte-for-byte. It remains 788,420
bytes below the approved 4,194,304-byte ceiling.
