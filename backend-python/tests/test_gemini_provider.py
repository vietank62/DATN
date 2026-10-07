import json
import unittest
from unittest.mock import patch

import httpx
from core import llm_provider as provider
from core import taste_recommendations as taste
from core.assistant_llm import extract_llm_filters


def response(text='{"matches": []}', reason="STOP", status=200):
    body = {"candidates": [{"finishReason": reason, "content": {"parts": [{"text": text}]}}]}
    if status != 200:
        body = {"error": {"code": status, "status": "RESOURCE_EXHAUSTED"}}
    return httpx.Response(status, json=body, request=httpx.Request("POST", "https://generativelanguage.googleapis.com/test"))


class GeminiProviderTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict("os.environ", {"LLM_PROVIDER": "gemini", "GEMINI_API_KEY": "test-gemini-key",
                                        "GEMINI_MODEL": "gemini-3.5-flash-lite", "OPENAI_API_KEY": "must-not-use"})
        env.start()
        self.addCleanup(env.stop)

    @patch.object(provider.httpx, "post")
    def test_survey_uses_gemini_schema_and_server_header_only(self, post):
        post.return_value = response('{"matches":[{"id":1,"reasons":["Có món Việt"]}]}')
        matches = taste.rank_batch({"favorites": "Món Việt"}, [{"id": 1}])
        self.assertEqual(matches[0]["id"], 1)
        url = post.call_args.args[0]
        kwargs = post.call_args.kwargs
        self.assertTrue(url.endswith("gemini-3.5-flash-lite:generateContent"))
        self.assertNotIn("test-gemini-key", url)
        self.assertEqual(kwargs["headers"], {"x-goog-api-key": "test-gemini-key"})
        self.assertEqual(kwargs["json"]["generationConfig"]["responseMimeType"], "application/json")
        self.assertEqual(kwargs["json"]["generationConfig"]["responseJsonSchema"], taste.Matches.model_json_schema())
        self.assertNotIn("Authorization", kwargs["headers"])

    @patch.object(provider.httpx, "post")
    def test_missing_key_never_falls_back_to_openai(self, post):
        with patch.dict("os.environ", {"GEMINI_API_KEY": ""}):
            with self.assertRaisesRegex(RuntimeError, "GEMINI_API_KEY"):
                taste.rank_batch({}, [{"id": 1}])
        post.assert_not_called()

    @patch.object(provider.httpx, "post")
    def test_model_cannot_inject_endpoint(self, post):
        with patch.dict("os.environ", {"GEMINI_MODEL": "../../other?key=secret"}):
            with self.assertRaises(RuntimeError):
                taste.rank_batch({}, [{"id": 1}])
        post.assert_not_called()

    @patch.object(provider.httpx, "post")
    def test_rate_limit_is_not_retried_or_sent_to_openai(self, post):
        post.return_value = response(status=429)
        with self.assertRaises(httpx.HTTPStatusError):
            taste.rank_batch({}, [{"id": 1}])
        self.assertEqual(post.call_count, 1)

    @patch.object(provider.httpx, "post")
    def test_incomplete_and_blocked_outputs_rejected(self, post):
        for reason in ("MAX_TOKENS", "SAFETY", "RECITATION"):
            with self.subTest(reason=reason):
                post.return_value = response(reason=reason)
                with self.assertRaises(ValueError):
                    taste.rank_batch({}, [{"id": 1}])
        post.return_value = httpx.Response(200, json={"promptFeedback": {"blockReason": "SAFETY"}},
                                          request=httpx.Request("POST", "https://example.test"))
        with self.assertRaises(ValueError):
            taste.rank_batch({}, [{"id": 1}])

    @patch.object(provider.httpx, "post")
    def test_chatbot_uses_gemini_and_sanitizes_filters(self, post):
        post.return_value = response(json.dumps({"keyword": "phở", "rating": 9, "party_size": 4}))
        filters = extract_llm_filters("Tìm phở cho 4 người", [])
        self.assertEqual(filters["party_size"], 4)
        self.assertNotIn("rating", filters)
        self.assertEqual(post.call_args.kwargs["timeout"], 8.0)

    @patch.object(provider.httpx, "post")
    def test_chatbot_failure_keeps_rule_based_fallback(self, post):
        post.return_value = response(status=429)
        self.assertIsNone(extract_llm_filters("Tìm món Việt", []))

    @patch.object(taste, "rank_batch", return_value=[])
    @patch.object(taste, "ThreadPoolExecutor", wraps=taste.ThreadPoolExecutor)
    def test_gemini_batches_run_with_one_worker(self, pool, rank):
        taste.recommend_taste({}, [{"id": i} for i in range(61)])
        pool.assert_called_once_with(max_workers=1)
        self.assertEqual(rank.call_count, 3)


if __name__ == "__main__":
    unittest.main()
