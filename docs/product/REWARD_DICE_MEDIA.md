# Reward Dice Media

This page records the source, packaged exports, geometry contract and RW-006
runtime use of the deterministic Reward Dice animation.

## Ownership and source

The animation and final-frame artwork were supplied and then shortened by the
product owner on 2026-10-01. The editable `.blend` and identifying master remain
outside the repository. The repository stores a stream-copied WebM derivative
with identifying container metadata removed.

The updated external master was 1,834,817 bytes with SHA-256
`02cb1c41227079112e33730ea99e3a285df9668df7b6304e3355d0af03880ed1`.

| Purpose | File | Metadata | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| Metadata-free animation source | `assets/reward-dice/source/reward-dice-roll.webm` | WebM/VP9 with alpha stream copy; 1080×1080; 1:1; 30 FPS; 3.000 s; yuva420p/BT.709; video only | 1,834,700 | `90ec0941daee4b6f88afebb79235cd69b6f487e88cb2cdbf1aab2d14d8957413` |
| Product-owner final frame | `assets/reward-dice/source/reward-dice-final.png` | PNG; 1080×1080; RGBA; 8-bit sRGB | 543,006 | `a386083fcc028a2197168b646b428a6bd1967212399745d77cf37feb60411757` |

The supplied PNG is the approved final frame and was preserved byte-for-byte
for runtime.

## Packaged exports

| Purpose | File | Metadata | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| Normal-motion animation | `public/video/reward-dice-roll.webm` | WebM/VP9 with alpha; 1080×1080; 1:1; 30 FPS; 3.000 s; yuva420p/BT.709; about 1.421 Mbps; video only | 533,013 | `bb147172e9b2fc90650280e8315d5b85fd3e3d1bbbe37a9312a1c9b4d8ed80a9` |
| Poster, decode-error/loading fallback and reduced-motion artwork | `public/video/reward-dice-final.png` | PNG; 1080×1080; RGBA; 8-bit sRGB | 543,006 | `a386083fcc028a2197168b646b428a6bd1967212399745d77cf37feb60411757` |

The updated source already ends in the approved pose at 3.000 seconds. Runtime
encoding preserves that timing without adding a terminal hold, so the cloud can
start on `ended` without an artificial pause. Metadata containing the product
owner's local path is stripped and no audio stream is mapped.

The PNG does not replace the last frame during ordinary playback. The runtime
retains the ended WebM frame and uses the PNG only for initial/hydrated results,
poster/loading, media fallback and reduced-motion artwork. A rejected `play()`,
media `error` or 3.8-second watchdog completes through that fallback without
blocking an already successful Reward command.

## Result overlay geometry

The selected face is the large front-center dark-green face. Its baked logo
center is:

- source/runtime video pixel coordinate: `(540, 580)` in 1080×1080;
- fallback PNG pixel coordinate: `(540, 580)` in 1080×1080;
- normalized coordinate for both: **`(0.500000, 0.537037)`**, measured from the
  top-left of the displayed media.

The matching normalized coordinate is intentional, so responsive scaling
preserves the same face center across video and fallback artwork.

RW-006 gradually reveals a fog-like `#00401FFF` radial cloud centered on
this anchor. It has no border or shadow: an opaque core covers the baked logo,
then the same green fades broadly to full transparency. The approved geometry
preview uses a 280 px diameter at 1080 px media height, an approximately 73 px
opaque core radius and a fade to transparency at the 140 px outer radius. These
map to `0.259259`, `0.067593` and `0.129630` of rendered media height. A small
8 px (`0.007407`) blur may soften gradient banding but must not read as a
separate shadow. The cloud forms the backing for the HTML/SVG Reward icon;
the cloud appears through a combined center-origin scale-up and opacity fade.
The runtime scales the media and overlay composition to 1.2 inside its clipped
16:9 stage. A static borderless white radial cloud at 18% maximum opacity sits
behind the whole Dice composition to separate it from dark environments. Its
blurred fade spans about 82% of the stage height. The green cloud uses a 200 ms
ease-out scale/opacity entrance; the smaller
icon and Reward copy begin their 360 ms entrances after 150 ms, once the cloud's
core has covered the baked logo. Reduced motion and hydrated results show the
settled composition immediately.

## Reproducible export

The export used FFmpeg 6.0-static from `ffmpeg-static@5.2.0` and ffprobe from
`ffprobe-static@3.1.0`, installed in a temporary directory rather than added to
project dependencies.

```sh
mkdir -p /private/tmp/locusora-pe006-tools
pnpm add --dir /private/tmp/locusora-pe006-tools --save-exact \
  ffmpeg-static@5.2.0 ffprobe-static@3.1.0
cd /private/tmp/locusora-pe006-tools/node_modules/ffmpeg-static && node install.js

FFMPEG_BIN=/private/tmp/locusora-pe006-tools/node_modules/ffmpeg-static/ffmpeg
FFPROBE_BIN=/private/tmp/locusora-pe006-tools/node_modules/ffprobe-static/bin/darwin/arm64/ffprobe
MASTER_WEBM=/path/to/product-owner/reward-dice-roll.webm

cd /path/to/locusora

"$FFMPEG_BIN" -hide_banner -loglevel error -y \
  -i "$MASTER_WEBM" -map 0:v:0 -c copy -map_metadata -1 -map_chapters -1 \
  -metadata title= -metadata comment= -metadata description= \
  -metadata:s:v:0 title= -metadata:s:v:0 comment= \
  assets/reward-dice/source/reward-dice-roll.webm

mkdir -p public/video

"$FFMPEG_BIN" -hide_banner -y \
  -c:v libvpx-vp9 -i assets/reward-dice/source/reward-dice-roll.webm \
  -map_metadata -1 -an \
  -vf "fps=30,format=yuva420p" \
  -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 32 -deadline good -cpu-used 2 -row-mt 1 \
  public/video/reward-dice-roll.webm

cp assets/reward-dice/source/reward-dice-final.png \
  public/video/reward-dice-final.png

"$FFPROBE_BIN" -v error \
  -show_entries \
format=duration,size,bit_rate:stream=index,codec_name,codec_type,width,height,r_frame_rate,avg_frame_rate,pix_fmt \
  -of json public/video/reward-dice-roll.webm

"$FFPROBE_BIN" -v error -show_entries format_tags:stream_tags -of json \
  assets/reward-dice/source/reward-dice-roll.webm

if strings assets/reward-dice/source/reward-dice-roll.webm | \
  grep -Ei 'Users|blender2\.blend|Scene\.001'; then
  echo "Unexpected identifying metadata in repository source" >&2
  exit 1
fi

shasum -a 256 \
  assets/reward-dice/source/reward-dice-roll.webm \
  assets/reward-dice/source/reward-dice-final.png \
  public/video/reward-dice-roll.webm \
  public/video/reward-dice-final.png
```

## Verification record

Inspection on 2026-10-01 confirmed:

- the repository source is a VP9 stream copy of the updated external master;
- ffprobe and `strings` find no local path, Blender filename or `Scene.001` in
  the repository source;
- the packaged WebM has exactly one alpha-bearing VP9 video stream and no audio
  stream; Chrome canvas sampling reports transparent corner pixels;
- Chromium reports VP9 support as `probably`, reaches media `readyState` 4 and
  decodes the file as 1080×1080 with duration 3.0 s;
- Chromium decodes the PNG as 1080×1080;
- the final animation frame and approved PNG show the same stable dice pose and
  selected face;
- the normalized anchor lands on the baked logo in both aspect ratios;
- the packaged pair adds 1,076,019 bytes before extension-container overhead.

The product owner visually approved the animation, fallback, overlay anchor and
fog-like backing treatment on 2026-10-01.
