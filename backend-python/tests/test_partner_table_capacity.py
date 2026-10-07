import unittest
import main  # Register all related SQLModel classes before constructing a restaurant.
from models.restaurant import Restaurant
from schemas.partner import PartnerApplicationCreate, PartnerOperationalUpdate


class PartnerCapacityTests(unittest.TestCase):
    def test_new_restaurant_has_meal_duration(self):
        row = Restaurant(name="Nhà hàng",slug="nha-hang",address="Địa chỉ",district="Quận 1")
        self.assertEqual(row.booking_duration_minutes, 120)
        self.assertEqual(str(Restaurant.__table__.c.booking_duration_minutes.server_default.arg), "120")

    def test_application_no_manual_capacity_required(self):
        payload = PartnerApplicationCreate(name="Nhà hàng",address="Địa chỉ nhà hàng",district="Quận 1",city="Hồ Chí Minh",tax_code="12345",policy_accepted=True,category=["mon-viet"],image_url="https://example.com/restaurant.jpg")
        self.assertNotIn("capacity", payload.model_dump())

    def test_legacy_manual_capacity_is_not_used(self):
        payload = PartnerOperationalUpdate(capacity=999, price_avg=200000)
        self.assertNotIn("capacity", payload.model_fields_set)
        self.assertNotIn("capacity", payload.model_dump())
