# Synthetic audiovisual development sample

This is the reusable source of the earlier private motion preview: **7.2 seconds, 1280 × 720, 30 fps, 216 frames**. Its three beats are “Dairus”, “Clear updates.” and “Ready for review.” The persistent label is “Synthetic motion test · Private preview”. It contains no investor correspondence, metrics, real product footage, external media or speech. It is a development fixture, not an investor report or a publication approval.

The exact original revision-3 HTML, JavaScript, CSS, timing, captions, transcript and procedural audio generator are preserved. The seekable native WAAPI timeline uses absolute composition time, finite fades and 4–8 px movement, with live reduced-motion support. The inline script in `index.html` equals `motion.js`; edit both together because pinned static lint reads the inline registration. There is no GSAP or CDN dependency. This is a composition sample, not a new renderer or a Papermark video integration.

## Portable setup

Requires Python 3, Node 22+, npm, FFmpeg/FFprobe and a locally installed Chromium compatible with the official renderer. These are environment prerequisites, not bundled binaries. Do not assume an existing server browser or local runtime is present in Cloud. No paid account, narration or avatar provider is needed for this fixture.

From this directory:

```bash
python3 -m venv --without-pip .venv
mkdir -p assets .private
.venv/bin/python generate-audio.py
npm ci --prefix runtime
export HYPERFRAMES_NO_TELEMETRY=1
export HYPERFRAMES_NO_UPDATE_CHECK=1
export HYPERFRAMES_SKIP_SKILLS=1
export DO_NOT_TRACK=1
export HYPERFRAMES_BROWSER_PATH=/absolute/path/to/your/installed/chrome
export HYPERFRAMES_FFMPEG_PATH="$(command -v ffmpeg)"
export HYPERFRAMES_FFPROBE_PATH="$(command -v ffprobe)"
```

Replace the explicit browser placeholder with the verified executable in the actual environment. Inspect the managed Cloud network/proxy/CA instructions before dependency installation. `runtime/package-lock.json` pins official **HyperFrames 0.8.149** and transitive dependencies. Use its installed binary directly; do not use an unpinned `npx` invocation or automatically download browsers, models or caption runtimes. `generate-audio.py` writes three original deterministic PCM stereo 48 kHz cues into the pre-created `assets/` directory. WAVs and renders are ignored, not committed.

## Official pinned CLI checks

These are the prior version's command shapes, to verify in the actual Cloud environment before claiming readiness:

```bash
./runtime/node_modules/.bin/hyperframes lint . --json
./runtime/node_modules/.bin/hyperframes check . --json --strict --snapshots --no-browser-gpu
./runtime/node_modules/.bin/hyperframes snapshot . --at 0,0.12,0.24,1.2,2.4,2.52,2.64,4.8,4.92,5.04,7.166667 --no-end --describe false --no-browser-gpu --output .private/contact-review
./runtime/node_modules/.bin/hyperframes render . --quality looks --workers 1 --low-memory-mode --no-browser-gpu --no-best-effort --frames-cache-dir .private/frames-cache --output .private/draft-v1.mp4
ffprobe -v error -of json -show_entries format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate,sample_rate,channels,pix_fmt .private/draft-v1.mp4
ffmpeg -v error -i .private/draft-v1.mp4 -f null -
```

The CLI environment switches and local assets do **not** sandbox networking. For an offline guarantee, run the render in the actual environment's supported network-isolated job after dependencies/browser are installed. Restrict filesystem access to this synthetic project, bound memory/runtime and retain each distinct output version. No permanent watcher, agent gateway, service or production configuration is needed.

## Review checklist and historical proof boundary

- Verify actual browser launch, font fallback, local asset loads, console errors and zero external media requests.
- Seek forwards, backwards and repeatedly to the same timestamps; verify identical frames, settled text, no clipping and finite timing. Test initial and live reduced-motion changes.
- Inspect contact sheets around entrances/exits and decoded first/last frames. Keep the source's comfortable small-text contrast; changing the renderer's system fonts can change layout.
- Verify exact duration, dimensions, frame rate, H.264/yuv420p and AAC stereo 48 kHz, full decode, cue timing and audio level. Audio requires separate listening/measurement; still images do not validate sound.
- Check `captions.srt` and `transcript.txt` against the same timeline. These are on-screen text captions, not a claim of spoken narration, automatic transcription or embedded subtitles.
- Preserve source/asset hashes and exact rendered version. Any real report requires reviewed claims, a separately approved script, final file and audience/visibility approval; do not publish, send, invite or notify from this fixture.

A prior local acceptance on 2026-10-11 reported strict lint/runtime/layout/contrast checks, seek/reduced-motion tests, a network-isolated render and final decode/audio-cue checks. The authoring provenance JSON preserves the source author's earlier “pending parent validation” state; it is historical source provenance, not a Cloud receipt. No prior host runtime, private receipt, screenshot, MP4, session, credential or worker configuration is transferred here. **Cloud installation, browser execution and rendering have not been verified by this import.** Narration, avatars and AI-generated media were not established by that local proof.

## Source and licences

Original synthetic code and procedural cues are community development material under this repository's applicable AGPLv3 terms in `../../LICENSE`; no commercial Papermark implementation is imported. No font binary, sampled audio, external image or third-party media is redistributed. System Arial/Helvetica/sans-serif fallback needs review in the target environment.

HyperFrames is a separate official dependency; its pinned package declares Apache-2.0 and its licence is retained at `runtime/HYPERFRAMES-LICENSE`. Dependency packages retain their individual terms. Node, Chromium and FFmpeg are environment prerequisites: their binaries are not redistributed here. Preserve upstream notices and review any future bundled assets/tools separately. Primary runtime reference: https://github.com/heygen-com/hyperframes . Prefer the installed pinned package's composition, animation, audio and CLI documentation for this sample.
