"""Admin detail API tests with an isolated database."""
import os
os.environ["URL_DATABASE"] = "postgresql://test:test@localhost/test"
os.environ["UPSTASH_REDIS_REST_URL"] = "https://example.invalid"
os.environ["UPSTASH_REDIS_REST_TOKEN"] = "test"
import unittest
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import ARRAY, JSON
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine
from database import get_session
from models import User, Restaurant
from models.bookingItem import BookingItem
from models.violationReport import ViolationReport
from routers import user, restaurant

for table in SQLModel.metadata.tables.values():
    for column in table.columns:
        if isinstance(column.type, ARRAY):
            column.type = JSON()


class AdminDetailTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        SQLModel.metadata.create_all(self.engine)
        with Session(self.engine) as session:
            admin = User(name="Admin", email="admin@test.com", phone="1", password="secret", role="admin")
            manager = User(name="Manager", email="manager@test.com", phone="2", password="secret", role="manager", report_strikes=2)
            session.add_all([admin, manager])
            session.flush()
            row = Restaurant(name="Restaurant", slug="test", address="Address", district="District", manager_id=manager.userId,
                             is_active=False, approval_status="pending", business_license_url="private-document")
            session.add(row)
            session.commit()
            self.manager_id, self.restaurant_id = manager.userId, row.id
        def db_session():
            with Session(self.engine) as session:
                yield session
        app = FastAPI()
        app.include_router(user.router)
        app.include_router(restaurant.router)
        app.dependency_overrides[get_session] = db_session
        self.client = TestClient(app)
        self.token = patch("routers.deps.decode_token", return_value={"email": "admin@test.com", "scopes": ["admin"]})
        self.decode = self.token.start()
        self.headers = {"Authorization": "Bearer test"}

    def tearDown(self):
        self.token.stop()
        self.client.close()
        self.engine.dispose()

    def test_user_detail_excludes_credentials_and_includes_account_state(self):
        response = self.client.get(f"/v1/users/{self.manager_id}/detail", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertNotIn("password", data)
        self.assertEqual(data["report_strikes"], 2)
        self.assertEqual(data["restaurant"]["id"], self.restaurant_id)
        self.assertFalse(data["is_suspended"])

    def test_restaurant_summary_includes_inactive_and_pending(self):
        response = self.client.get(f"/v1/restaurants/{self.restaurant_id}/admin-detail", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data["is_active"])
        self.assertEqual(data["approval_status"], "pending")
        self.assertEqual(data["manager"]["userId"], self.manager_id)
        for field in ("menus", "detail", "business_license_url", "legal_documents_urls"):
            self.assertNotIn(field, data)
        self.assertNotIn("password", data["manager"])

    def test_missing_records(self):
        for path in ("/v1/users/999/detail", "/v1/restaurants/999/admin-detail"):
            self.assertEqual(self.client.get(path, headers=self.headers).status_code, 404)

    def test_detail_routes_require_admin(self):
        for path in (f"/v1/users/{self.manager_id}/detail", f"/v1/restaurants/{self.restaurant_id}/admin-detail"):
            self.assertEqual(self.client.get(path).status_code, 401)
            self.decode.return_value = {"email": "manager@test.com", "scopes": ["admin", "manager"]}
            self.assertEqual(self.client.get(path, headers=self.headers).status_code, 403)


if __name__ == "__main__":
    unittest.main()
