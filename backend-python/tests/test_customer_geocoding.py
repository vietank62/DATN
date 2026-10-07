import unittest
from unittest.mock import patch

from fastapi import HTTPException
from core import customer_geocoding as lookup


class CustomerGeocodingTests(unittest.TestCase):
    def setUp(self):
        lookup._requests.clear()
        lookup._cached.cache_clear()

    @patch.object(lookup, "geocode_address", return_value=[{"latitude": 10, "longitude": 106}])
    def test_normalizes_address_and_reuses_cache(self, provider):
        first = lookup.find_customer_address(1, "  171   Đồng Khởi ")
        self.assertEqual(first, lookup.find_customer_address(2, "171 ĐỒNG KHỞI"))
        provider.assert_called_once_with("171 đồng khởi", "", "")

    @patch.object(lookup, "geocode_address", return_value=[])
    def test_limits_requests_per_account(self, provider):
        for _ in range(6):
            lookup.find_customer_address(1, "Đồng Khởi")
        with self.assertRaises(HTTPException) as error:
            lookup.find_customer_address(1, "Đồng Khởi")
        self.assertEqual(error.exception.status_code, 429)
        lookup.find_customer_address(2, "Đồng Khởi")

    @patch.object(lookup.time, "monotonic")
    @patch.object(lookup, "geocode_address", return_value=[])
    def test_limit_resets_after_a_minute(self, provider, clock):
        clock.return_value = 100
        for _ in range(6):
            lookup.find_customer_address(1, "Đồng Khởi")
        clock.return_value = 160
        lookup.find_customer_address(1, "Đồng Khởi")

    def test_rejects_short_address(self):
        with self.assertRaises(HTTPException) as error:
            lookup.find_customer_address(1, "  abc ")
        self.assertEqual(error.exception.status_code, 422)

    @patch.object(lookup, "geocode_address", side_effect=[HTTPException(503, "Unavailable"), []])
    def test_provider_failure_is_not_cached(self, provider):
        with self.assertRaises(HTTPException):
            lookup.find_customer_address(1, "Đồng Khởi")
        self.assertEqual(lookup.find_customer_address(1, "Đồng Khởi"), [])
        self.assertEqual(provider.call_count, 2)


if __name__ == "__main__":
    unittest.main()
