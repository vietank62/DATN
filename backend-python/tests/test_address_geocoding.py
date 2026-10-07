import unittest
from unittest.mock import Mock, patch

import httpx
from fastapi import HTTPException
from core.address_geocoding import geocode_address


class GeocodingTests(unittest.TestCase):
    @patch.dict("os.environ", {"SERPAPI_API_KEY": ""})
    def test_missing_key(self):
        with self.assertRaises(HTTPException) as error:
            geocode_address("171 Đồng Khởi", "Quận 1", "Hồ Chí Minh")
        self.assertEqual(error.exception.status_code, 503)

    @patch.dict("os.environ", {"SERPAPI_API_KEY": "test-key"})
    @patch("core.address_geocoding.httpx.get")
    def test_results_and_payload(self, request):
        response = Mock()
        response.json.return_value = {"local_results": [{"place_id": "one", "address": "Địa chỉ", "gps_coordinates": {"latitude": 10.77, "longitude": 106.7}}]}
        request.return_value = response
        result = geocode_address("171 Đồng Khởi", "Quận 1", "Hồ Chí Minh")
        self.assertEqual(result[0]["latitude"], 10.77)
        self.assertTrue(result[0]["approximate"])
        self.assertEqual(request.call_args.kwargs["params"]["q"], "171 Đồng Khởi, Quận 1, Hồ Chí Minh, Việt Nam")

    @patch.dict("os.environ", {"SERPAPI_API_KEY": "test-key"})
    @patch("core.address_geocoding.httpx.get")
    def test_empty_denied_and_network_error(self, request):
        response = Mock()
        request.return_value = response
        response.json.return_value = {"local_results": []}
        self.assertEqual(geocode_address("Địa chỉ", "Quận 1", "Hồ Chí Minh"), [])
        response.json.return_value = {"error": "Invalid API key"}
        with self.assertRaises(HTTPException) as error:
            geocode_address("Địa chỉ", "Quận 1", "Hồ Chí Minh")
        self.assertEqual(error.exception.status_code, 503)
        request.side_effect = httpx.ConnectError("offline")
        with self.assertRaises(HTTPException) as error:
            geocode_address("Địa chỉ", "Quận 1", "Hồ Chí Minh")
        self.assertEqual(error.exception.status_code, 502)
