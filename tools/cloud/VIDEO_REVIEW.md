# Private video review packets

The original synthetic source and the pinned local renderer setup are documented in `development/motion-sample/README.md`. Render a private file only after reviewing the script, timeline, captions and source/asset rights. Rendering does not attach, publish, send or approve it. Keep each render and packet in private storage; never commit real content or rendered files.

After a render, this utility checks full decoding, duration, dimensions, frame rate, H.264/yuv420p, AAC stereo 48 kHz, a non-silent, non-clipped audio peak, and matching caption text/timing against the timeline. It produces a mode-0700, non-overwriting directory of timestamped frame samples and an unsigned manifest with SHA-256 hashes of the exact render, script, timeline, captions and asset-provenance record. Example from the repository root, after the sample has been rendered:

```sh
.venv/bin/python tools/cloud/video_review.py \
  --video development/motion-sample/.private/draft-v1.mp4 \
  --script development/motion-sample/transcript.txt \
  --timeline development/motion-sample/timeline.json \
  --captions development/motion-sample/captions.srt \
  --provenance development/motion-sample/ASSET-PROVENANCE.json \
  --output development/motion-sample/.private/draft-v1-review
```

The packet is `private_unreviewed`. Its hashes bind the inputs presented to the checker; they **do not prove** that the renderer used those inputs, that their claims or rights are valid, or that a human reviewed them. Inspect the timestamped frames, listen to the final file, verify production provenance and obtain claim-specific review and exact video/audience/visibility approval independently. Record the exact video, script, timeline and captions hashes in the candidate. A changed byte or audience requires a new candidate and approval. An existing packet is never overwritten. An incomplete directory after an error is not a packet and must not be treated as review evidence.

Run the synthetic technical test with `python -m unittest tools/cloud/test_video_review.py -v`; it requires local FFmpeg and FFprobe. This test is not a video quality or human-review certification.

## Synthetic script-driven candidate

`video_project.py` makes a separate private project using the original three-beat motion template. Its input is a JSON object with `schema: 1`, `synthetic: true`, a 64-character `candidateSha256`, and exactly three `beats`, each with short `text` and nonempty `claimRefs`. The value of `candidateSha256` is a reference, not proof of review or authorization. The generator derives the visible text, timed captions, timeline and claim lineage from that same input and records byte hashes of source and generated assets. It escapes text inserted into HTML and refuses an existing destination. It only accepts explicitly synthetic input. It does not validate the claims, reviewer authority, candidate status or asset rights.

```sh
.venv/bin/python tools/cloud/video_project.py --script path/to/synthetic-script.json --output development/motion-sample/.private/candidate-v1
```

Run the pinned renderer from `development/motion-sample/runtime` against that project, then run the packet command above with the generated `script.json`, `timeline.json`, `captions.srt` and `asset-provenance.json`. A real monthly-video integration, authenticated specialist/founder review of the script and final file, and delivery are separate work; this fixture does not implement them. Run the generator tests with `python -m unittest tools/cloud/test_video_project.py -v`.
