import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('video_review', Path(__file__).with_name('video_review.py'))
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)


class VideoPacketTests(unittest.TestCase):
    def test_exact_render_packet_is_unsigned_and_non_overwriting(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            video = root / 'render.mp4'
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=128x72:r=30:d=1',
                            '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1',
                            '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ac', '2',
                            '-shortest', str(video)], check=True)
            script, timeline, captions, provenance = [root / x for x in ('script.txt', 'timeline.json', 'captions.srt', 'provenance.json')]
            script.write_text('Synthetic title')
            timeline.write_text(json.dumps({'width': 128, 'height': 72, 'fps': 30, 'duration': 1,
                'beats': [{'title': 'Synthetic title', 'start': 0, 'end': 1}], 'reviewSampleTimes': [0, 0.5]}))
            captions.write_text('1\n00:00:00,000 --> 00:00:01,000\nSynthetic title\n')
            provenance.write_text('{}')
            output = root / 'private-packet'
            packet = review.packet(video, script, timeline, captions, provenance, output)
            self.assertEqual(packet['state'], 'private_unreviewed')
            self.assertFalse(packet['publicationApproved'])
            self.assertEqual(packet['candidateVideo']['sha256'], review.sha(video))
            self.assertEqual(packet['candidateVideo']['captionsSha256'], review.sha(captions))
            self.assertEqual(len(packet['frames']), 2)
            self.assertTrue(all((output / item['file']).exists() for item in packet['frames']))
            self.assertEqual(output.stat().st_mode & 0o777, 0o700)
            with self.assertRaises(FileExistsError):
                review.packet(video, script, timeline, captions, provenance, output)
            captions.write_text('1\n00:00:00,000 --> 00:00:01,000\nChanged\n')
            with self.assertRaises(ValueError):
                review.packet(video, script, timeline, captions, provenance, root / 'bad')
            self.assertFalse((root / 'bad').exists())


if __name__ == '__main__':
    unittest.main()
