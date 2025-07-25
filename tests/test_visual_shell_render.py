import subprocess
import unittest
import json

class VisualShellRenderTest(unittest.TestCase):
    def test_render_includes_metadata(self):
        record = {
            "object_id": "obj1",
            "file": "model.gltf",
            "watermark": True,
            "timed_reveal": True,
            "partner_lock": False,
        }
        script = (
            "const vs=require('./visual_shell');"
            f"process.stdout.write(vs.renderModel({json.dumps(record)}))"
        )
        output = subprocess.check_output(['node', '-e', script])
        html = output.decode()
        self.assertIn('model.gltf', html)
        self.assertIn('watermark', html)
        self.assertIn('timed_reveal', html)

if __name__ == '__main__':
    unittest.main()
