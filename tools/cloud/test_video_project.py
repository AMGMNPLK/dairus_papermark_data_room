import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).parent

def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / (name + '.py'))
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded

project = module('video_project')
review = module('video_review')


class ProjectTests(unittest.TestCase):
    def test_one_script_drives_render_captions_and_claim_lineage(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / 'script.json'
            source.write_text(json.dumps({'schema': 1, 'synthetic': True, 'candidateSha256': 'a' * 64,
                'beats': [{'text': '<Synthetic> & one', 'claimRefs': ['claim-1']},
                          {'text': 'Progress', 'claimRefs': ['claim-2']},
                          {'text': 'Next steps', 'claimRefs': ['claim-3']}]}, ensure_ascii=False))
            output = root / 'project'
            project.prepare(source, output)
            timeline = json.loads((output / 'timeline.json').read_text())
            review.captions_match(timeline, (output / 'captions.srt').read_text())
            self.assertEqual(timeline['beats'][0]['title'], '<Synthetic> & one')
            self.assertEqual(timeline['beats'][0]['claimRefs'], ['claim-1'])
            self.assertIn('&lt;Synthetic&gt; &amp; one', (output / 'index.html').read_text())
            self.assertEqual(source.read_bytes(), (output / 'script.json').read_bytes())
            manifest = json.loads((output / 'asset-provenance.json').read_text())
            self.assertFalse(manifest['publicationApproved'])
            self.assertEqual(manifest['files']['script.json'], review.sha(source))
            self.assertEqual(output.stat().st_mode & 0o777, 0o700)
            with self.assertRaises(FileExistsError):
                project.prepare(source, output)
            data = json.loads(source.read_text()); data['synthetic'] = False
            source.write_text(json.dumps(data))
            with self.assertRaises(ValueError):
                project.prepare(source, root / 'real')
            self.assertFalse((root / 'real').exists())


if __name__ == '__main__':
    unittest.main()
