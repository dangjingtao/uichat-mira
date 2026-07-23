from __future__ import annotations

import copy
import tempfile
import unittest
from pathlib import Path

import pptx_runtime


class KimiPptRuntimeTest(unittest.TestCase):
    def make_spec(self) -> dict:
        return {
            "entry": {
                "title": "Mira WenShu Kimi PPT smoke test",
                "size": [1280, 720],
                "theme": {
                    "colors": {"primary": "#C15F3C", "text": "#1F2937"},
                    "textStyles": {
                        "title": {"fontSize": 38, "color": "#C15F3C"},
                        "body": {"fontSize": 22, "color": "#1F2937"},
                    },
                },
                "pages": ["pages/01.page"],
            },
            "pageFiles": {
                "pages/01.page": {
                    "pageType": "content",
                    "background": {"type": "solid", "color": "#FFFFFF"},
                    "elements": [
                        {
                            "elementType": "text",
                            "elementId": "title",
                            "bounds": [90, 80, 1100, 100],
                            "content": {
                                "text": "Mira 文枢：Kimi 原版 DSL 文字烟测",
                                "style": "$title",
                            },
                        },
                        {
                            "elementType": "text",
                            "elementId": "body",
                            "bounds": [90, 220, 1100, 180],
                            "content": {
                                "text": "这段<strong>中文</strong>必须真实写入 PowerPoint。",
                                "style": "$body",
                            },
                        },
                        {
                            "elementType": "icon",
                            "elementId": "rocket",
                            "bounds": [90, 430, 96, 96],
                            "iconName": "fas:rocket",
                            "fill": {"type": "solid", "color": "#C15F3C"},
                        },
                    ],
                }
            },
        }

    def test_creates_and_reads_final_chinese_text(self) -> None:
        spec = self.make_spec()
        validation = pptx_runtime.validate_spec(spec)
        self.assertEqual(validation["errors"], 0)
        with tempfile.TemporaryDirectory(prefix="mira-ppt-smoke-") as temp_dir:
            output = Path(temp_dir) / "smoke.pptx"
            result = pptx_runtime.create_presentation(spec, str(output))
            self.assertTrue(output.is_file())
            self.assertEqual(result["engine"], "kimi_ppt_dsl")
            self.assertEqual(result["inspection"]["slideCount"], 1)
            final_text = result["inspection"]["slides"][0]["text"]
            self.assertIn("Mira 文枢：Kimi 原版 DSL 文字烟测", final_text)
            self.assertIn("这段中文必须真实写入 PowerPoint。", final_text)
            self.assertGreaterEqual(result["inspection"]["slides"][0]["pictures"], 1)

    def test_rejects_legacy_inline_ast(self) -> None:
        with self.assertRaisesRegex(ValueError, "spec.entry"):
            pptx_runtime.validate_spec({"size": [1280, 720], "pages": []})

    def test_checker_blocks_text_without_content(self) -> None:
        spec = copy.deepcopy(self.make_spec())
        del spec["pageFiles"]["pages/01.page"]["elements"][0]["content"]
        validation = pptx_runtime.validate_spec(spec)
        self.assertGreater(validation["errors"], 0)
        self.assertTrue(
            any(issue.get("issue_type") == "MissingFieldError" for issue in validation["issues"])
        )


if __name__ == "__main__":
    unittest.main()
