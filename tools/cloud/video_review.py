#!/usr/bin/env python3
"""Create a private, unsigned review packet for an exact rendered video.

A packet records bytes and technical checks. It does not attest that a renderer
used the supplied inputs, that a person reviewed them, or that sharing is allowed.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(part)
    return h.hexdigest()


def captions_match(timeline, captions):
    blocks = re.split(r'\n\s*\n', captions.strip())
    beats = timeline['beats']
    if len(blocks) != len(beats):
        raise ValueError('caption count differs from timeline')
    def ms(value):
        h, m, rest = value.split(':')
        s, milli = rest.split(',')
        return ((int(h) * 60 + int(m)) * 60 + int(s)) * 1000 + int(milli)
    for block, beat in zip(blocks, beats):
        lines = block.splitlines()
        if len(lines) != 3 or not lines[0].isdigit() or ' --> ' not in lines[1]:
            raise ValueError('invalid captions')
        start, end = lines[1].split(' --> ')
        if (ms(start) != round(beat['start'] * 1000) or
            ms(end) != round(beat['end'] * 1000) or lines[2] != beat['title']):
            raise ValueError('captions differ from timeline')


def checked_run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def packet(video, script, timeline_path, captions, provenance, output):
    inputs = [video, script, timeline_path, captions, provenance]
    hashes = [sha(path) for path in inputs]
    timeline = json.loads(timeline_path.read_text())
    captions_match(timeline, captions.read_text())
    script_text = script.read_text()
    if script.suffix == '.json':
        source_titles = [beat['text'] for beat in json.loads(script_text)['beats']]
        matches = source_titles == [beat['title'] for beat in timeline['beats']]
    else:
        matches = all(beat['title'] in script_text for beat in timeline['beats'])
    if not matches:
        raise ValueError('transcript lacks timeline text')
    probe = json.loads(checked_run(['ffprobe', '-v', 'error', '-of', 'json',
        '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate,sample_rate,channels,pix_fmt', str(video)]).stdout)
    streams = probe.get('streams', [])
    videos = [s for s in streams if s.get('codec_type') == 'video']
    audios = [s for s in streams if s.get('codec_type') == 'audio']
    if len(videos) != 1 or len(audios) != 1:
        raise ValueError('expected one video and one audio stream')
    v, a = videos[0], audios[0]
    if (v.get('codec_name') != 'h264' or v.get('pix_fmt') != 'yuv420p' or
        v.get('width') != timeline['width'] or v.get('height') != timeline['height'] or
        v.get('avg_frame_rate') != f"{timeline['fps']}/1" or
        a.get('codec_name') != 'aac' or a.get('sample_rate') != '48000' or a.get('channels') != 2 or
        abs(float(probe['format']['duration']) - timeline['duration']) > 1 / timeline['fps']):
        raise ValueError('render properties differ from expected timeline or format')
    checked_run(['ffmpeg', '-v', 'error', '-i', str(video), '-f', 'null', '-'])
    audio = checked_run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(video), '-vn',
                         '-af', 'volumedetect', '-f', 'null', '-']).stderr
    peak = re.search(r'max_volume: (-?[\d.]+) dB', audio)
    if not peak or float(peak.group(1)) <= -90 or float(peak.group(1)) >= 0:
        raise ValueError('audio missing, silent or clipped')
    # Exclusive directory: never replace a previously reviewed packet.
    output.mkdir(mode=0o700, parents=False, exist_ok=False)
    times = timeline['reviewSampleTimes']
    if not times or len(times) > 100:
        raise ValueError('review timestamps must contain between 1 and 100 samples')
    for index, second in enumerate(times):
        if not 0 <= second < timeline['duration']:
            raise ValueError('review timestamp outside video')
        checked_run(['ffmpeg', '-v', 'error', '-ss', str(second), '-i', str(video),
                     '-frames:v', '1', '-y', str(output / f'frame-{index:02d}.png')])
    if [sha(path) for path in inputs] != hashes:
        raise ValueError('an input changed while generating the review packet')
    manifest = {
        'schema': 1, 'state': 'private_unreviewed', 'publicationApproved': False,
        'candidateVideo': {'sha256': hashes[0], 'scriptSha256': hashes[1],
                           'timelineSha256': hashes[2], 'captionsSha256': hashes[3],
                           'assetProvenanceSha256': hashes[4]},
        'probe': probe,
        'audioPeakDb': float(peak.group(1)),
        'frames': [{'seconds': t, 'file': f'frame-{i:02d}.png',
                    'sha256': sha(output / f'frame-{i:02d}.png')} for i, t in enumerate(times)],
        'reviewRequired': ['verify script, claims and asset provenance', 'inspect timestamped frames',
                           'listen to final audio', 'verify render derives from these inputs',
                           'review exact final video and audience/visibility'],
    }
    with (output / 'manifest.json').open('x') as stream:
        json.dump(manifest, stream, indent=2)
        stream.write('\n')
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ('video', 'script', 'timeline', 'captions', 'provenance', 'output'):
        parser.add_argument('--' + flag, type=Path, required=True)
    args = parser.parse_args()
    packet(args.video, args.script, args.timeline, args.captions, args.provenance, args.output)
    print('Private unsigned review packet created; no approval or publication performed.')


if __name__ == '__main__':
    main()
