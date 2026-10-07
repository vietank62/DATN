"""Survey flow regression tests: mocked provider and DB, no paid API calls."""
import json
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import httpx
import main  # Register all SQLModel relationships before using model instances.
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from core import taste_recommendations as ai
from database import get_session
from models.customerPreference import CustomerPreference
from routers import recommendations as routes
from routers.deps import get_current_user


def provider_response(matches=None, status=200, code=None):
    body = {"output": [{"type": "message", "content": [
        {"type": "output_text", "text": json.dumps({"matches": matches or []})}
    ]}]}
    if status != 200:
        body = {"error": {"code": code, "type": "insufficient_quota"}}
    return httpx.Response(status, json=body, request=httpx.Request("POST", "https://api.openai.com/v1/responses"))


class TasteRankingTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict("os.environ", {"OPENAI_API_KEY": "test-only-not-a-real-key",
                                                     "LLM_PROVIDER": "openai", "OPENAI_MODEL": "gpt-5-mini"})
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_whitespace_favorites_rejected(self):
        with self.assertRaises(ValidationError):
            ai.TasteSurvey(favorites="   ")

    def test_long_answer_rejected(self):
        with self.assertRaises(ValidationError):
            ai.TasteSurvey(favorites="a" * 501)

    @patch.object(ai.httpx, "post")
    def test_missing_api_key_does_not_call_provider(self, post):
        with patch.dict("os.environ", {"OPENAI_API_KEY": ""}):
            with self.assertRaises(RuntimeError):
                ai.rank_batch({}, [{"id": 1}])
        post.assert_not_called()

    @patch.object(ai.httpx, "post")
    def test_wrong_provider_does_not_call_openai(self, post):
        with patch.dict("os.environ", {"LLM_PROVIDER": "other"}):
            with self.assertRaises(RuntimeError):
                ai.rank_batch({}, [{"id": 1}])
        post.assert_not_called()

    @patch.object(ai.httpx, "post")
    def test_success_uses_structured_output_and_preserves_input(self, post):
        post.return_value = provider_response([{"id": 1, "reasons": [" Có món Việt "]}])
        survey = ai.TasteSurvey(favorites="  Thích món Việt  ").model_dump()
        self.assertEqual(ai.rank_batch(survey, [{"id": 1}]), [{"id": 1, "reasons": ["Có món Việt"]}])
        payload = post.call_args.kwargs["json"]
        self.assertEqual(payload["model"], "gpt-5-mini")
        self.assertFalse(payload["store"])
        self.assertTrue(payload["text"]["format"]["strict"])
        self.assertEqual(json.loads(payload["input"])["survey"]["favorites"], "Thích món Việt")

    @patch.object(ai.httpx, "post")
    def test_unknown_duplicate_ids_and_blank_reasons_removed(self, post):
        post.return_value = provider_response([
            {"id": 9, "reasons": ["Invented"]}, {"id": 1, "reasons": ["Valid"]},
            {"id": 1, "reasons": ["Duplicate"]}, {"id": 2, "reasons": ["  "]},
        ])
        self.assertEqual(ai.rank_batch({}, [{"id": 1}, {"id": 2}]), [{"id": 1, "reasons": ["Valid"]}])

    @patch.object(ai.httpx, "post")
    def test_credit_balance_error_not_retried_or_swallowed(self, post):
        post.return_value = provider_response(status=429, code="credit_balance_exhausted")
        with self.assertRaises(httpx.HTTPStatusError) as caught:
            ai.rank_batch({}, [{"id": 1}])
        self.assertEqual(caught.exception.response.json()["error"]["code"], "credit_balance_exhausted")
        self.assertEqual(post.call_count, 1)

    @patch.object(ai.httpx, "post")
    def test_invalid_ai_output_is_rejected(self, post):
        post.return_value = httpx.Response(200, json={"output_text": "not JSON"},
                                          request=httpx.Request("POST", "https://api.openai.com/v1/responses"))
        with self.assertRaises(ValidationError):
            ai.rank_batch({}, [{"id": 1}])

    @patch.object(ai, "rank_batch")
    def test_no_public_restaurants_requires_no_ai(self, rank):
        self.assertEqual(ai.recommend_taste({}, []), [])
        rank.assert_not_called()

    @patch.object(ai, "rank_batch")
    def test_large_catalog_is_batched_then_finalists_ranked(self, rank):
        rank.side_effect = lambda survey, batch: [{"id": batch[0]["id"], "reasons": ["Phù hợp"]}]
        matches = ai.recommend_taste({}, [{"id": i} for i in range(61)])
        self.assertEqual(rank.call_count, 4)  # 3 initial batches, 1 final ranking.
        sizes = [len(call.args[1]) for call in rank.call_args_list]
        self.assertEqual(sorted(sizes), [1, 3, 30, 30])
        self.assertEqual(len(matches), 1)


class SurveyApiTests(unittest.TestCase):
    def setUp(self):
        self.session = MagicMock()
        self.session.exec.return_value.all.return_value = []
        self.user = SimpleNamespace(userId=7)
        self.previous = CustomerPreference(user_id=7, survey={"favorites": "Khảo sát cũ"},
                                           ai_matches=[{"id": 1, "reasons": ["Gợi ý cũ"]}])
        self.session.get.return_value = self.previous
        app = FastAPI()
        app.include_router(routes.router)
        app.dependency_overrides[get_session] = lambda: self.session
        app.dependency_overrides[get_current_user] = lambda: self.user
        self.client = TestClient(app)

    @patch.object(routes, "recommend_taste", return_value=[])
    def test_invalid_survey_returns_422_before_ai_and_db_write(self, recommend):
        response = self.client.post("/v1/recommendations/me/survey", json={"favorites": "  "})
        self.assertEqual(response.status_code, 422)
        recommend.assert_not_called()
        self.session.commit.assert_not_called()

    @patch.object(routes, "recommend_taste", return_value=[])
    def test_success_saves_survey_only_for_current_account(self, recommend):
        self.session.get.return_value = None
        response = self.client.post("/v1/recommendations/me/survey", json={"favorites": "Món Nhật"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"restaurants": []})
        saved = self.session.add.call_args.args[0]
        self.assertEqual(saved.user_id, 7)
        self.assertEqual(saved.survey["favorites"], "Món Nhật")
        self.session.commit.assert_called_once()

    def test_all_ai_failure_branches_preserve_old_survey(self):
        failures = [RuntimeError("AI chưa được cấu hình."),
                    httpx.ConnectError("Connection failed"), httpx.ReadTimeout("Timeout"),
                    ValueError("Invalid output"), TypeError("Invalid payload")]
        for status, code in [(429, "credit_balance_exhausted"), (429, "rate_limit_exceeded"),
                             (401, "invalid_api_key"), (500, "server_error")]:
            response = provider_response(status=status, code=code)
            failures.append(httpx.HTTPStatusError("Test provider failure", request=response.request, response=response))
        for failure in failures:
            with self.subTest(error=type(failure).__name__):
                self.session.reset_mock()
                with patch.object(routes, "recommend_taste", side_effect=failure):
                    result = self.client.post("/v1/recommendations/me/survey", json={"favorites": "Món mới"})
                self.assertEqual(result.status_code, 503)
                self.assertEqual(self.previous.survey, {"favorites": "Khảo sát cũ"})
                self.assertEqual(self.previous.ai_matches, [{"id": 1, "reasons": ["Gợi ý cũ"]}])
                self.session.add.assert_not_called()
                self.session.commit.assert_not_called()

    @patch.object(routes, "resolve_matches", return_value=[])
    @patch.object(routes, "recommend_taste", return_value=[])
    def test_candidates_include_real_restaurant_menu_and_details(self, recommend, resolve):
        restaurant = SimpleNamespace(id=1, name="Quán Việt", city="Hồ Chí Minh", district="Quận 1",
                                     price_avg=150000, category=["mon-viet"], suitable_for=[],
                                     service_types=[], rating=4.5)
        menu = SimpleNamespace(restaurant_id=1, name="Phở bò", category="Món chính", description="Phở")
        detail = SimpleNamespace(restaurant_id=1, description="Quán gia đình", utilities=[], parking_info="Có chỗ gửi xe")
        self.session.exec.side_effect = [MagicMock(all=lambda: [restaurant]),
                                         MagicMock(all=lambda: [menu]), MagicMock(all=lambda: [detail])]
        response = self.client.post("/v1/recommendations/me/survey", json={"favorites": "Thích phở"})
        self.assertEqual(response.status_code, 200)
        candidates = recommend.call_args.args[1]
        self.assertEqual(candidates[0]["id"], 1)
        self.assertEqual(candidates[0]["menu"][0]["name"], "Phở bò")
        self.assertEqual(candidates[0]["description"], "Quán gia đình")
        self.assertNotIn("user_id", candidates[0])

    @patch.object(routes, "recommend_taste", return_value=[])
    def test_db_transaction_released_before_ai(self, recommend):
        recommend.side_effect = lambda survey, candidates: self.assertTrue(self.session.rollback.called) or []
        response = self.client.post("/v1/recommendations/me/survey", json={"favorites": "Món Việt"})
        self.assertEqual(response.status_code, 200)

    @patch.object(routes, "serialize_restaurant", side_effect=lambda row: {"id": row.id})
    def test_stale_matches_excluded_and_ranking_preserved(self, serialize):
        self.session.exec.return_value.all.return_value = [SimpleNamespace(id=2), SimpleNamespace(id=1)]
        result = routes.resolve_matches(self.session, [
            {"id": 1, "reasons": ["First"]}, {"id": 9, "reasons": ["No longer public"]},
            {"id": 2, "reasons": ["Second"]},
        ])
        self.assertEqual([item["id"] for item in result], [1, 2])


if __name__ == "__main__":
    unittest.main()
