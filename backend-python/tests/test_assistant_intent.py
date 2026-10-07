import unittest

from datetime import datetime

from core.assistant_intent import parse_booking_slot, parse_restaurant_request
from core.assistant_llm import sanitize_llm_filters
from routers.assistant import menu_restaurant_name


class RestaurantRequestParserTests(unittest.TestCase):
    def test_understands_conversational_location_food_and_party_size(self):
        intent = parse_restaurant_request("Tối nay nhóm mình 6 đứa muốn ăn lẩu ở Q1")
        self.assertEqual(intent.filters["district"], "Quận 1")
        self.assertEqual(intent.filters["party_size"], 6)
        self.assertEqual(intent.filters["keyword"], "lau")

    def test_understands_table_size_wording(self):
        intent = parse_restaurant_request("Tìm quán buffet bàn 4 chỗ ở Hà Nội")
        self.assertEqual(intent.filters["party_size"], 4)
        self.assertEqual(intent.filters["city"], "Hà Nội")
        self.assertEqual(intent.filters["keyword"], "buffet")

    def test_normalizes_everyday_food_wording_for_search(self):
        intent = parse_restaurant_request("Gợi ý quán đồ nướng dưới 500k/người")
        self.assertEqual(intent.filters["keyword"], "nuong")
        self.assertEqual(intent.filters["max_price"], 499_999)

    def test_understands_japanese_grill_and_a_booking_slot(self):
        intent = parse_restaurant_request("Tìm quán nướng Nhật ở Quận 1, còn bàn 4 người lúc 19:00 tối nay")
        self.assertEqual(intent.filters["category"], "mon-nhat")
        self.assertEqual(intent.filters["party_size"], 4)
        self.assertEqual(intent.filters["district"], "Quận 1")
        self.assertEqual(
            parse_booking_slot("lúc 19:00 tối nay", datetime(2026, 10, 2, 10, 0)),
            ("2026-10-02", "19:00"),
        )

    def test_understands_a_combined_follow_up_request(self):
        intent = parse_restaurant_request("Tìm nhà hàng món Hàn ở Quận 1 cho 5 người")
        self.assertEqual(intent.filters["district"], "Quận 1")
        self.assertEqual(intent.filters["party_size"], 5)
        self.assertEqual(intent.filters["keyword"], "mon han")

    def test_never_claims_that_a_table_is_available(self):
        intent = parse_restaurant_request("Quán lẩu nào còn bàn tối nay cho 4 người ở Q1")
        self.assertIn("chưa kiểm tra bàn trống", " ".join(intent.notes))

    def test_extracts_restaurant_name_from_menu_requests(self):
        self.assertEqual(menu_restaurant_name("Cho tôi xem menu của nhà hàng Pizza 4P's"), "pizza 4p's")
        self.assertEqual(menu_restaurant_name("Xem thực đơn Sushi Hokkaido"), "sushi hokkaido")
        self.assertIsNone(menu_restaurant_name("Tìm quán ăn món Nhật"))

    def test_llm_filters_are_limited_to_known_search_values(self):
        filters = sanitize_llm_filters({
            "keyword": "đồ nướng sân vườn", "city": "Hà Nội", "district": "Quận 7",
            "party_size": 4, "min_price": 100_000, "max_price": 300_000,
            "rating": 4.5, "suitable_for": "gia-dinh", "service_type": None,
            "has_exclusive": True,
        })
        self.assertEqual(filters["district"], "Quận 7")
        self.assertEqual(filters["city"], "Hồ Chí Minh")
        self.assertEqual(filters["party_size"], 4)
        self.assertEqual(filters["max_price"], 300_000)

    def test_llm_filters_reject_invalid_values(self):
        filters = sanitize_llm_filters({"city": "Nơi không có", "district": "Quận 99", "party_size": 0})
        self.assertEqual(filters, {})


if __name__ == "__main__":
    unittest.main()
