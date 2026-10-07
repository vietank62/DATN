import unittest
import main  # Register all relationship models before compiling ORM queries.
from sqlalchemy.dialects import postgresql
from sqlmodel import select
from models.restaurant import Restaurant
from core.restaurant_search import suitability_in_search, utility_ids_in_search, apply_restaurant_filters


class NaturalFilterTests(unittest.TestCase):
    def test_date_request(self):
        tags, rest = suitability_in_search("địa điểm hẹn hò")
        utilities, rest = utility_ids_in_search(rest)
        self.assertEqual(tags, ["hen-ho"])
        self.assertEqual(rest, "")
        self.assertEqual(utilities, [])

    def test_amenities(self):
        for keyword, expected in [("quán có Wifi", 15), ("nhà hàng có chỗ đậu xe", 5), ("địa điểm có phòng riêng", 7), ("bàn ngoài trời", 18)]:
            ids, rest = utility_ids_in_search(keyword)
            self.assertEqual(ids, [expected])
            self.assertEqual(rest, "")

    def test_combined_request(self):
        tags, rest = suitability_in_search("địa điểm hẹn hò có phòng riêng và wifi")
        ids, rest = utility_ids_in_search(rest)
        self.assertEqual(tags, ["hen-ho"])
        self.assertEqual(ids, [7, 15])
        self.assertEqual(rest, "")

    def test_sql_builds_without_fulltext_for_date(self):
        sql = str(apply_restaurant_filters(select(Restaurant), search="địa điểm hẹn hò").compile(dialect=postgresql.dialect()))
        self.assertIn("suitable_for", sql)
        self.assertNotIn("search_document", sql)

    def test_utility_query_builds(self):
        sql = str(apply_restaurant_filters(select(Restaurant), search="có wifi").compile(dialect=postgresql.dialect()))
        self.assertIn("utilities", sql)
        self.assertNotIn("search_document", sql)
