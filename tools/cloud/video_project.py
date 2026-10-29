#!/usr/bin/env python3
"""Prepare a private short video project from one claim-linked script.

This creates no approval or publication and does not establish reviewer identity.
The output is an authoring candidate and must be separately reviewed and rendered.
"""
import argparse
import hashlib
import html
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

SAMPLE = Path(__file__).resolve().parents[2] / 'development' / 'motion-sample'
IDS = ('dairus', 'updates', 'review')


def prepare(script_path, output):
    source = script_path.read_bytes()
    script = json.loads(source)
    if set(script) != {'schema', 'synthetic', 'candidateSha256', 'beats'} or script['schema'] != 1 or script['synthetic'] is not True:
        raise ValueError('invalid script schema')
    if not re.fullmatch(r'[a-f0-9]{64}', script['candidateSha256']):
        raise ValueError('candidateSha256 must identify the script candidate')
    if not isinstance(script['beats'], list) or len(script['beats']) != 3:
        raise ValueError('exactly three beats are required')
    for beat in script['beats']:
        if (set(beat) != {'text', 'claimRefs'} or not isinstance(beat['text'], str)
                or not 1 <= len(beat['text']) <= 42 or any(ord(c) < 32 for c in beat['text'])
                or not isinstance(beat['claimRefs'], list) or not beat['claimRefs']
                or any(not isinstance(ref, str) or not re.fullmatch(r'[A-Za-z0-9._:-]{1,100}', ref) for ref in beat['claimRefs'])):
            raise ValueError('each beat needs short plain text and claim references')
    output.mkdir(mode=0o700, parents=False, exist_ok=False)
    (output / 'assets').mkdir(mode=0o700)
    original = (SAMPLE / 'index.html').read_text()
    for name, beat in zip(IDS, script['beats']):
        pattern = rf'(<h1 class="beat-title clip" id="beat-{name}"[^>]*>).*?(</h1>)'
        original, count = re.subn(pattern, lambda m: m.group(1) + html.escape(beat['text']) + m.group(2), original, count=1)
        if count != 1:
            raise ValueError('motion template changed unexpectedly')
    original = original.replace('DAIRUS</span>', 'COMPANY</span>')
    original = original.replace('Synthetic motion test · Private preview', 'Synthetic candidate · Review required')
    (output / 'index.html').write_text(original)
    for name in ('styles.css', 'motion.js', 'generate-audio.py'):
        shutil.copyfile(SAMPLE / name, output / name)
    subprocess.run([sys.executable, str(output / 'generate-audio.py')], check=True)
    timeline = json.loads((SAMPLE / 'timeline.json').read_text())
    timeline['privateSyntheticLabel']['text'] = 'Synthetic candidate · Review required'
    for beat, supplied in zip(timeline['beats'], script['beats']):
        beat['title'] = supplied['text']
        beat['claimRefs'] = supplied['claimRefs']
    (output / 'timeline.json').write_text(json.dumps(timeline, ensure_ascii=False, indent=2) + '\n')
    def timestamp(ms):
        return f'00:00:{ms // 1000:02d},{ms % 1000:03d}'
    captions = '\n\n'.join(f'{i + 1}\n{timestamp(round(beat["start"] * 1000))} --> {timestamp(round(beat["end"] * 1000))}\n{beat["title"]}' for i, beat in enumerate(timeline['beats'])) + '\n'
    (output / 'captions.srt').write_text(captions)
    (output / 'script.json').write_bytes(source)
    inputs = ['index.html', 'styles.css', 'motion.js', 'generate-audio.py', 'timeline.json', 'captions.srt', 'script.json',
              'assets/cue-identity.wav', 'assets/cue-clarity.wav', 'assets/cue-review.wav']
    provenance = {'schema': 1, 'state': 'private_unreviewed', 'publicationApproved': False,
                  'source': 'development/motion-sample revision 3', 'candidateSha256': script['candidateSha256'],
                  'files': {name: hashlib.sha256((output / name).read_bytes()).hexdigest() for name in inputs},
                  'rights': 'Original sample CSS and deterministic procedural audio; review all rights before use.'}
    (output / 'asset-provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--script', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    prepare(args.script, args.output)
    print('Private candidate prepared; render and all reviews remain required.')


if __name__ == '__main__':
    main()
