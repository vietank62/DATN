import json
import unittest
from unittest.mock import patch, MagicMock
from pydantic import ValidationError
import main
from core.taste_recommendations import TasteSurvey, Matches, rank_batch, recommend_taste
from routers.recommendations import submit_survey
from fastapi import HTTPException
from types import SimpleNamespace

class TasteTests(unittest.TestCase):
    def test_survey_validation(self):
        with self.assertRaises(ValidationError):
            TasteSurvey(favorites="  ")
        self.assertEqual(TasteSurvey(favorites=" Món Nhật ").favorites, "Món Nhật")

    def test_strict_schema(self):
        schema = Matches.model_json_schema()
        self.assertFalse(schema["additionalProperties"])
        self.assertFalse(schema["$defs"]["Match"]["additionalProperties"])

    @patch.dict("os.environ", {"LLM_PROVIDER":"openai","OPENAI_API_KEY":"test-key"})
    @patch("core.taste_recommendations.httpx.post")
    def test_unknown_and_duplicate_ids_removed(self, post):
        post.return_value.json.return_value = {"output_text":json.dumps({"matches":[
            {"id":1,"reasons":[" Có món Nhật "]}, {"id":999,"reasons":["Bịa"]},
            {"id":1,"reasons":["Lặp"]}]})}
        result = rank_batch({"favorites":"Món Nhật"},[{"id":1}])
        self.assertEqual(result,[{"id":1,"reasons":["Có món Nhật"]}])
        payload = post.call_args.kwargs["json"]
        self.assertFalse(payload["store"])
        self.assertNotIn("user_id", payload["input"])

    @patch("core.taste_recommendations.rank_batch")
    def test_all_candidates_considered(self, rank):
        seen = set()
        def fake(survey, candidates):
            seen.update(item["id"] for item in candidates)
            return [{"id":item["id"],"reasons":["Phù hợp"]} for item in candidates[:8]]
        rank.side_effect = fake
        result = recommend_taste({},[{"id":i} for i in range(70)])
        self.assertEqual(seen,set(range(70)))
        self.assertLessEqual(len(result),8)

    def test_no_candidates_no_ai_call(self):
        with patch("core.taste_recommendations.rank_batch") as rank:
            self.assertEqual(recommend_taste({},[]),[])
            rank.assert_not_called()

    def test_ai_failure_does_not_overwrite_previous_survey(self):
        session = MagicMock()
        session.exec.return_value.all.return_value=[]
        with patch("routers.recommendations.recommend_taste",side_effect=RuntimeError("AI chưa sẵn sàng")):
            with self.assertRaises(HTTPException) as error:
                submit_survey(TasteSurvey(favorites="Món Nhật"),SimpleNamespace(userId=1),session)
        self.assertEqual(error.exception.status_code,503)
        session.commit.assert_not_called()
        session.add.assert_not_called()
