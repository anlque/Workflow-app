# Reward Dice Media

This page records the source, packaged exports and geometry contract for the
deterministic Reward Dice animation. Runtime playback and Reward-result
presentation belong to RW-006.

## Ownership and source

The animation and final-frame artwork were supplied by the product owner on
2026-10-01. Inspection of the external master identified Blender scene
`Scene.001` and the product-owner working file `blender2.blend`. That master and
the editable `.blend` remain outside the repository. The repository stores a
stream-copied WebM derivative with identifying container metadata removed.

The external master was 2,338,924 bytes with SHA-256
`a7c7efb5f407ed927e056ec277f2e2285a992993bf692d8f8d6aacec4608e4aa`.

| Purpose | File | Metadata | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| Metadata-free animation source | `assets/reward-dice/source/reward-dice-roll.webm` | WebM/VP9 stream copy; 1920×1080; 16:9; 30 FPS; 4.166 s; yuv420p/BT.709; video only | 2,338,810 | `1fb9a4a62e6ff459a3003ddd16e8cb634604cfd1cae90c81f608df700b384e0d` |
| Product-owner final frame | `assets/reward-dice/source/reward-dice-final.png` | PNG; 1080×1080; RGBA; 8-bit sRGB | 555,610 | `a2705bd545d7089124a3abf4626fd167caf84e97f24d722921bed2e24d604c6b` |

The supplied PNG is the approved final frame. It is a square center crop of the
same 1080-pixel-high composition and was preserved byte-for-byte for runtime.

## Packaged exports

| Purpose | File | Metadata | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| Normal-motion animation | `public/video/reward-dice-roll.webm` | WebM/VP9; 1920×1080; 16:9; 30 FPS; 4.400 s; yuv420p/BT.709; about 1.305 Mbps; video only | 717,899 | `f054ea50515d27ac61af86707ee4c07f786a05fef918147819d938331f027a1f` |
| Poster, decode-error/loading fallback and reduced-motion artwork | `public/video/reward-dice-final.png` | PNG; 1080×1080; RGBA; 8-bit sRGB | 555,610 | `a2705bd545d7089124a3abf4626fd167caf84e97f24d722921bed2e24d604c6b` |

The source animation rotated into the approved face but then faded the entire
dice. The packaged WebM removes that unwanted terminal fade and clones the
stable final frame for approximately 500 ms. It is re-encoded because a stream
copy cannot remove the fade or add the required hold. Metadata containing the
product owner's local path is stripped. No audio stream is mapped.

The PNG must not replace the last frame during ordinary playback. RW-006 uses
it only as poster/error/loading fallback and as the reduced-motion artwork.

## Result overlay geometry

The selected face is the large front-center dark-green face. Its baked logo
center is:

- source/runtime video pixel coordinate: `(960, 580)` in 1920×1080;
- fallback PNG pixel coordinate: `(540, 580)` in 1080×1080;
- normalized coordinate for both: **`(0.500000, 0.537037)`**, measured from the
  top-left of the displayed media.

The matching normalized coordinate is intentional: the PNG is the video's
center crop, so responsive scaling preserves the same face center when the
media itself is scaled without distortion.

RW-006 will gradually reveal a fog-like `#00401FFF` radial cloud centered on
this anchor. It has no border or shadow: an opaque core covers the baked logo,
then the same green fades broadly to full transparency. The approved geometry
preview uses a 280 px diameter at 1080 px media height, an approximately 73 px
opaque core radius and a fade to transparency at the 140 px outer radius. These
map to `0.259259`, `0.067593` and `0.129630` of rendered media height. A small
8 px (`0.007407`) blur may soften gradient banding but must not read as a
separate shadow. The cloud forms the backing for the HTML/SVG Reward icon;
the cloud appears through a combined center-origin scale-up and opacity fade.
RW-006 owns the exact timing and easing, keeps the settled geometry above, and
shows the settled cloud without entrance motion under reduced motion. The icon
itself also remains an RW-006 concern.

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
  -i assets/reward-dice/source/reward-dice-roll.webm \
  -map_metadata -1 -an \
  -vf "trim=end=3.9,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=0.5,fps=30,format=yuv420p" \
  -c:v libvpx-vp9 -b:v 0 -crf 32 -deadline good -cpu-used 2 -row-mt 1 \
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

- the repository source is a VP9 stream copy of the external master: decoded
  frame SHA-256 is `91662de75668a3e395c4469a8ef849049b0766de22ff0a10b229016d7cd4ed84`
  for both files;
- ffprobe and `strings` find no local path, `blender2.blend` or `Scene.001` in
  the repository source;
- the packaged WebM has exactly one VP9 video stream and no audio stream;
- Chromium reports VP9 support as `probably`, reaches media `readyState` 4 and
  decodes the file as 1920×1080 with duration 4.4 s;
- Chromium decodes the PNG as 1080×1080;
- the final animation frame and approved PNG show the same stable dice pose and
  selected face;
- the normalized anchor lands on the baked logo in both aspect ratios;
- the packaged pair adds 1,273,509 bytes before extension-container overhead.

The product owner visually approved the animation, fallback, overlay anchor and
fog-like backing treatment on 2026-10-01.
