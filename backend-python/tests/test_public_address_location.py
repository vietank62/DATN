import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from core import customer_geocoding as lookup
from routers.restaurant import router


class PublicAddressLocationTests(unittest.TestCase):
    def setUp(self):
        lookup._requests.clear()
        lookup._cached.cache_clear()
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)

    @patch.object(lookup, "geocode_address", return_value=[{"latitude": 10.77, "longitude": 106.7}])
    def test_guest_can_search_without_token(self, provider):
        response = self.client.get("/v1/restaurants/address-location", params={"address": "171 Đồng Khởi"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"][0]["latitude"], 10.77)
        provider.assert_called_once()

    @patch.object(lookup, "geocode_address", return_value=[])
    def test_public_search_ignores_invalid_login_token(self, provider):
        response = self.client.get("/v1/restaurants/address-location", params={"address": "171 Đồng Khởi"}, headers={"Authorization": "Bearer expired-token"})
        self.assertEqual(response.status_code, 200)

    @patch.object(lookup, "geocode_address", return_value=[])
    def test_guest_requests_are_rate_limited_even_with_forwarded_header(self, provider):
        for index in range(6):
            response = self.client.get("/v1/restaurants/address-location", params={"address": "171 Đồng Khởi"}, headers={"X-Forwarded-For": f"192.0.2.{index}"})
            self.assertEqual(response.status_code, 200)
        response = self.client.get("/v1/restaurants/address-location", params={"address": "171 Đồng Khởi"})
        self.assertEqual(response.status_code, 429)
        provider.assert_called_once()

    @patch.object(lookup, "geocode_address")
    def test_invalid_address_does_not_call_provider(self, provider):
        response = self.client.get("/v1/restaurants/address-location", params={"address": "abc"})
        self.assertEqual(response.status_code, 422)
        provider.assert_not_called()


if __name__ == "__main__":
    unittest.main()
