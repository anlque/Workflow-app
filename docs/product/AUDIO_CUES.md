# Production audio cues

This document records the provenance and reproducible processing of the bundled Locusora audio cues selected for PE-005. Source and license pages were accessed on 2026-09-04. This is provenance documentation, not legal clearance.

## License

All source recordings are offered under the [Pixabay Content License](https://pixabay.com/service/license-summary/); the [full terms](https://pixabay.com/service/terms/) permit commercial use and adaptation but restrict standalone redistribution of substantially unchanged content. Attribution is not required. Locusora nevertheless records the credited authors below.

The packaged files are trimmed, repeated, mixed, level-adjusted, downmixed or resampled, and re-encoded derivatives. Original downloads are not bundled.

## Sources

| Use | Asset and author | Original metadata | SHA-256 |
| --- | --- | --- | --- |
| Phase source | [Bell-chime](https://pixabay.com/sound-effects/film-special-effects-bell-chime-238836/) — Amber2023 | MP3; 41.832 s; stereo; 48 kHz; 256 kbps; 1,338,624 bytes | `643471b63672bdcd5e44866cf2c8226d4d3a102d7ab6e63ac5ac6aaae3e2272f` |
| Phase selected excerpt | User-selected `bell clear.wav`, cut from the source above | PCM WAV; 2.969161 s; stereo; 44.1 kHz; 16-bit; 525,602 bytes | `a81c4676f08c722ac4840702ba0bc95a4c7920a28aea63fee0547115784866bb` |
| Dice | [rolling dice 2](https://pixabay.com/sound-effects/film-special-effects-rolling-dice-2-102706/) — nettimato (Freesound), distributed by Freesound Community | MP3; 1.253875 s; mono; 44.1 kHz; 256 kbps; 40,124 bytes | `dcb77fbb6c40563249db034c61a0330113575541dd65d04b54d4f139da3dd739` |
| Reward | [Get Coin](https://pixabay.com/sound-effects/film-special-effects-get-coin-351945/) — KoiRoylers | MP3; 3.082438 s; stereo; 44.1 kHz; 256 kbps; 98,638 bytes; source page marks it AI-generated | `b560c473d1a602fe8c1267e75ba0900f733ca13f6e8fbf167b69e36289202662` |
| Completion music | [Victory Fanfare](https://pixabay.com/sound-effects/musical-victory-fanfare-152480/) — Universfield | MP3; 3.813875 s; stereo; 44.1 kHz; 256 kbps; 122,044 bytes | `3c1c005c2c8140a361b22ac5fa7ee5ec9f597bf44c330afa2bd9ca3433449ca5` |

`Balloon Burst` by Universfield was evaluated as a confetti accent and then removed by listening decision on 2026-09-04. It is not part of any packaged cue.

The selected phase excerpt correlates to the full bell recording near 31.698 seconds, but its GarageBand export includes gain/processing differences. The excerpt checksum, rather than an inferred trim offset, is therefore the reproducible phase input.

## Packaged assets

MP3 container durations include approximately 30–50 ms of encoder delay/padding. Nominal rendered content durations are the values in parentheses.

| Cue | File | Final metadata | Measured level | SHA-256 |
| --- | --- | --- | --- | --- |
| Phase bell | `public/audio/phase-bell.mp3` | MP3; mono; 44.1 kHz; 64 kbps; 23,522 bytes; 2.899592 s container (2.850 s content) | -20.1 LUFS-I; -6.5 dBFS true peak | `01aaa8f7ff43b8af4473701d0c0cc27730957b73ac642dc8ce8d69aad036dc7d` |
| Dice roll | `public/audio/dice-roll.mp3` | MP3; mono; 44.1 kHz; 64 kbps; 20,523 bytes; 2.533878 s container (2.500 s content) | -25.7 LUFS-I; -2.0 dBFS true peak | `d2739d52a4e7b0921f67a17335d512705358e2070f718275cb7fb8b095415236` |
| Reward unlocked | `public/audio/reward-unlocked.mp3` | MP3; stereo; 44.1 kHz; 96 kbps; 13,209 bytes; 1.071020 s container (1.020 s content) | -19.1 LUFS-I; -5.9 dBFS true peak | `18c8c1bba1dbf5a5fae683cdb21e962f0d31be5d0f02ea618114560280522429` |
| Session complete | `public/audio/session-complete.mp3` | MP3; stereo; 44.1 kHz; 112 kbps; 49,414 bytes; 3.500408 s container (3.450 s content) | -18.5 LUFS-I; -5.6 dBFS true peak | `b0bcb60aba9a3db352914eda8bd1f0525b899f79e27e97149fa8d0f3fe8ce4c8` |

Total packaged size: 106,668 bytes.

The dice source is sparse and transient-heavy; its -2.0 dBFS peak ceiling prevents clipping while its three closely joined recorded rolls eliminate silent gaps. LUFS-I is consequently lower than the sustained tonal cues and should not be compared as perceived loudness without listening.

## Transformations

- Phase bell: selected excerpt; leading silence removed at -50 dB; mono downmix; content trimmed to 2.850 s; 8 ms fade-in and 120 ms fade-out; loudness processing; 64 kbps MP3.
- Dice roll: first 1.020 s of the recorded roll repeated three times; two 8 ms equal-power crossfades; content trimmed to exactly 2.500 s; 40 ms terminal fade; peak-constrained loudness processing; 64 kbps MP3. The packaged file covers the complete dice animation and requires no runtime loop.
- Reward unlocked: leading silence removed at -50 dB; principal coin transient retained; content trimmed to 1.020 s; 8 ms fade-in and 120 ms fade-out; level adjustment; 96 kbps MP3.
- Session complete: leading silence removed from the fanfare; content trimmed to 3.450 s; 120 ms terminal fade; loudness processing; 112 kbps MP3. Confetti remains a visual concern for AU-001/RW-006 without a separate balloon accent.

## Reproduction

The production render used `ffmpeg-static@5.2.0`, which supplies FFmpeg 6.0 for macOS arm64, and `ffprobe-static@3.1.0`, which supplies FFprobe 4.4. Install them only in a temporary directory; they are not project dependencies.

```bash
mkdir -p /private/tmp/locusora-pe005-tools /private/tmp/locusora-pe005-sources
pnpm add --dir /private/tmp/locusora-pe005-tools --save-exact ffmpeg-static@5.2.0 ffprobe-static@3.1.0
cd /private/tmp/locusora-pe005-tools/node_modules/ffmpeg-static && node install.js

FFMPEG_BIN=/private/tmp/locusora-pe005-tools/node_modules/ffmpeg-static/ffmpeg
FFPROBE_BIN=/private/tmp/locusora-pe005-tools/node_modules/ffprobe-static/bin/darwin/arm64/ffprobe
SRC_DIR=/private/tmp/locusora-pe005-sources
```

Copy the five checksum-verified inputs from the source archive into `SRC_DIR` using the normalized filenames shown in the commands below. Then render from the repository root:

```bash
mkdir -p public/audio

"$FFMPEG_BIN" -hide_banner -loglevel error -y \
  -i "$SRC_DIR/bell-clear-excerpt.wav" -map_metadata -1 \
  -af "pan=mono|c0=0.5*c0+0.5*c1,silenceremove=start_periods=1:start_silence=0.005:start_threshold=-50dB,aresample=44100,atrim=duration=2.850,afade=t=in:st=0:d=0.008,afade=t=out:st=2.730:d=0.120,loudnorm=I=-20:TP=-3:LRA=7" \
  -c:a libmp3lame -b:a 64k -ar 44100 -ac 1 public/audio/phase-bell.mp3

"$FFMPEG_BIN" -hide_banner -loglevel error -y \
  -i "$SRC_DIR/freesound-community-rolling-dice-2-102706.mp3" \
  -i "$SRC_DIR/freesound-community-rolling-dice-2-102706.mp3" \
  -i "$SRC_DIR/freesound-community-rolling-dice-2-102706.mp3" -map_metadata -1 \
  -filter_complex "[0:a]pan=mono|c0=c0,aresample=44100,atrim=end=1.020,asetpts=N/SR/TB[a];[1:a]pan=mono|c0=c0,aresample=44100,atrim=end=1.020,asetpts=N/SR/TB[b];[2:a]pan=mono|c0=c0,aresample=44100,atrim=end=1.020,asetpts=N/SR/TB[c];[a][b]acrossfade=d=0.008:c1=qsin:c2=qsin[ab];[ab][c]acrossfade=d=0.008:c1=qsin:c2=qsin,atrim=duration=2.500,afade=t=out:st=2.460:d=0.040,loudnorm=I=-19:TP=-1.5:LRA=7[out]" \
  -map "[out]" -c:a libmp3lame -b:a 64k -ar 44100 -ac 1 public/audio/dice-roll.mp3

"$FFMPEG_BIN" -hide_banner -loglevel error -y \
  -i "$SRC_DIR/koiroylers-get-coin-351945.mp3" -map_metadata -1 \
  -af "silenceremove=start_periods=1:start_silence=0.005:start_threshold=-50dB,aresample=44100,atrim=duration=1.020,afade=t=in:st=0:d=0.008,afade=t=out:st=0.900:d=0.120,loudnorm=I=-23:TP=-3:LRA=7,volume=4.3dB" \
  -c:a libmp3lame -b:a 96k -ar 44100 -ac 2 public/audio/reward-unlocked.mp3

"$FFMPEG_BIN" -hide_banner -loglevel error -y \
  -i "$SRC_DIR/universfield-victory-fanfare-152480.mp3" -map_metadata -1 \
  -af "silenceremove=start_periods=1:start_silence=0.005:start_threshold=-50dB,aresample=44100,atrim=duration=3.450,afade=t=out:st=3.330:d=0.120,loudnorm=I=-18:TP=-2:LRA=7" \
  -c:a libmp3lame -b:a 112k -ar 44100 -ac 2 public/audio/session-complete.mp3
```

## Inspection and playback

```bash
"$FFPROBE_BIN" -v error \
  -show_entries format=filename,duration,size,bit_rate \
  -show_entries stream=codec_name,sample_rate,channels,channel_layout \
  -of json public/audio/phase-bell.mp3

"$FFMPEG_BIN" -hide_banner -nostats -i public/audio/phase-bell.mp3 \
  -filter_complex "ebur128=peak=true" -f null -

"$FFMPEG_BIN" -hide_banner -nostats -i public/audio/phase-bell.mp3 \
  -af "silencedetect=noise=-50dB:d=0.05" -f null -

shasum -a 256 public/audio/*.mp3
afplay public/audio/phase-bell.mp3
afplay public/audio/dice-roll.mp3
afplay public/audio/reward-unlocked.mp3
afplay public/audio/session-complete.mp3
```

Runtime playback integration remains explicitly deferred to AU-001/RW-006. The existing synthesized sounds remain the future fallback.
