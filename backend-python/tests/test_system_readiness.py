"""Authentication, authorization, deployment and request-level regression checks."""
import os
import unittest
from unittest.mock import patch, Mock
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlalchemy import ARRAY, JSON
from sqlmodel import SQLModel, Session, create_engine, select
from pydantic import ValidationError

import main
from database import get_session
from core import security
from core.config import settings
from models.user import User
from models.restaurant import Restaurant
from models.booking import Booking
from models.depositCheckout import DepositCheckout
from models.depositPayment import DepositPayment
from models.notification import Notification
from models.depositRefund import DepositRefund
from models.violationReport import ViolationReport
from routers.deps import require_restaurant_owner
from routers.authentication import refresh_cookie_options
from schemas.bookingSchema import BookingCreate


class SystemReadinessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.password_hash = security.get_password_hash("test-password-123")
        # SQLite fixture represents PostgreSQL arrays as JSON; production types stay unchanged.
        cls.array_types = []
        for model in (Restaurant, ViolationReport):
            for column in model.__table__.columns:
                if isinstance(column.type, ARRAY):
                    cls.array_types.append((column, column.type))
                    column.type = column.type.with_variant(JSON(), "sqlite")

    @classmethod
    def tearDownClass(cls):
        for column, original in cls.array_types:
            column.type = original

    def setUp(self):
        self.env = patch.dict(os.environ, {"VERCEL": "1", "ENABLE_BACKGROUND_WORKERS": "false",
            "FRONTEND_URL": "https://frontend.example.test", "AUTH_COOKIE_SECURE": "true",
            "AUTH_COOKIE_SAMESITE": "none", "CRON_SECRET": "test-cron-secret"})
        self.env.start()
        self.signing = patch.object(settings, "SECRET_KEY", "test-only-jwt-secret-that-is-long-enough-123456")
        self.signing.start()
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread":False}, poolclass=StaticPool)
        SQLModel.metadata.create_all(self.engine, tables=[User.__table__, Booking.__table__,
            DepositPayment.__table__, DepositCheckout.__table__, Notification.__table__,
            Restaurant.__table__, DepositRefund.__table__, ViolationReport.__table__])
        self.session = Session(self.engine)
        self.user = User(name="Test Customer", email="customer@example.test", phone="0900000001",
            password=self.password_hash, role="customer")
        self.session.add(self.user)
        self.session.commit()
        main.app.dependency_overrides[get_session] = lambda: self.session
        self.client = TestClient(main.app, base_url="https://backend.example.test")

    def tearDown(self):
        main.app.dependency_overrides.clear()
        self.client.close()
        self.session.close()
        self.engine.dispose()
        self.signing.stop()
        self.env.stop()

    def token(self, scopes=None, refresh=False):
        if refresh:
            return security.create_refresh_token({"email":self.user.email})
        return security.create_access_token({"email":self.user.email,"scopes":scopes or ["customer"]})

    def headers(self, scopes=None):
        return {"Authorization":"Bearer "+self.token(scopes)}

    def test_health_without_database_access(self):
        with patch.object(self.session, "exec", side_effect=AssertionError("health must not query DB")):
            self.assertEqual(self.client.get("/health").status_code,200)

    def test_serverless_lifespan_does_not_start_background_workers(self):
        with patch("main.create_db_and_tables", return_value=False), patch("main.asyncio.create_task") as start:
            with TestClient(main.app) as client:
                self.assertEqual(client.get("/health").status_code,200)
            start.assert_not_called()

    def test_login_refresh_logout_https_cookie(self):
        login=self.client.post("/v1/auth/login",data={"username":self.user.email,"password":"test-password-123"})
        self.assertEqual(login.status_code,200)
        cookie=login.headers["set-cookie"].lower()
        for value in ["httponly","secure","samesite=none"]:
            self.assertIn(value,cookie)
        self.assertEqual(self.client.post("/v1/auth/refresh").status_code,200)
        self.assertEqual(self.client.post("/v1/auth/logout").status_code,200)
        self.assertEqual(self.client.post("/v1/auth/refresh").status_code,401)

    def test_invalid_login_is_401(self):
        response=self.client.post("/v1/auth/login",data={"username":self.user.email,"password":"wrong"})
        self.assertEqual(response.status_code,401)

    def test_refresh_token_cannot_access_user_api(self):
        response=self.client.get("/v1/users/me",headers={"Authorization":"Bearer "+self.token(refresh=True)})
        self.assertEqual(response.status_code,401)

    def test_customer_cannot_promote_self(self):
        response=self.client.put("/v1/users/me",headers=self.headers(),json={"role":"admin"})
        self.assertEqual(response.status_code,403)
        self.assertEqual(self.session.get(User,self.user.userId).role,"customer")

    def test_customer_can_update_own_name(self):
        response=self.client.put("/v1/users/me",headers=self.headers(),json={"name":"Updated Customer"})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()["name"],"Updated Customer")
        self.assertNotIn("password",response.json())

    def test_old_admin_scope_does_not_override_current_customer_role(self):
        response=self.client.put(f"/v1/users/{self.user.userId}",headers=self.headers(["admin","customer"]),json={"name":"Bad"})
        self.assertEqual(response.status_code,403)

    def test_admin_user_list_never_returns_password_hash(self):
        self.user.role="admin";self.session.add(self.user);self.session.commit()
        response=self.client.get("/v1/users/",headers=self.headers(["admin","customer"]))
        self.assertEqual(response.status_code,200)
        self.assertNotIn("password",response.json()["items"][0])

    def test_write_endpoints_require_authentication(self):
        endpoints=[("put","/v1/users/1"),("post","/v1/restaurants/"),
            ("put","/v1/restaurants/1"),("delete","/v1/restaurants/1"),
            ("post","/v1/menuitems/restaurant/1"),
            ("put","/v1/menuitems/restaurant/1/menuitem/1/availability"),
            ("put","/v1/menuitems/restaurant/1/1"),("delete","/v1/menuitems/restaurant/1/1"),
            ("post","/v1/details/"),("post","/api/upload-image/")]
        for method,path in endpoints:
            with self.subTest(path=path,method=method):
                self.assertEqual(self.client.request(method,path).status_code,401)

    def test_wrong_restaurant_manager_is_forbidden(self):
        session=Mock()
        session.get.return_value=Restaurant(id=1,name="Restaurant",slug="test",address="test",district="test",manager_id=99)
        manager=User(userId=1,name="Manager",email="m@example.test",phone="2",password="unused",role="manager")
        with self.assertRaises(HTTPException) as error:
            require_restaurant_owner(session,1,manager)
        self.assertEqual(error.exception.status_code,403)

    def test_maintenance_requires_its_own_secret(self):
        self.assertEqual(self.client.get("/internal/maintenance").status_code,401)
        self.assertEqual(self.client.get("/internal/maintenance",headers=self.headers()).status_code,401)
        response=self.client.get("/internal/maintenance",headers={"Authorization":"Bearer test-cron-secret"})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()["cancellationAttempts"],0)

    def test_scheduled_maintenance_completes_and_expires_once(self):
        restaurant = Restaurant(id=1, name="Test", slug="test", address="test", district="test")
        self.session.add(restaurant)
        for status, date in [("confirmed", "2000-01-01"), ("pending", "2000-01-01"), ("confirmed", "2099-01-01")]:
            self.session.add(Booking(userId=self.user.userId, restaurantId=1, date=date, time="18:00",
                guestCount=2, requestSeats=2, contactName="Test", contactEmail="t@example.test",
                contactPhone="1", status=status))
        self.session.commit()
        headers = {"Authorization":"Bearer test-cron-secret"}
        response = self.client.get("/internal/maintenance", headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["completedBookings"], 1)
        self.assertEqual(response.json()["unansweredBookings"], 1)
        response = self.client.get("/internal/maintenance", headers=headers)
        self.assertEqual(response.json()["completedBookings"], 0)
        self.assertEqual(response.json()["unansweredBookings"], 0)
        self.assertEqual(self.session.get(Restaurant, 1).late_response_strikes, 1)

    def test_insecure_none_cookie_config_fails_closed(self):
        with patch.dict(os.environ,{"AUTH_COOKIE_SECURE":"false","AUTH_COOKIE_SAMESITE":"none"}):
            with self.assertRaises(HTTPException): refresh_cookie_options()

    def test_cors_allowed_origin_and_unknown_origin(self):
        from main import origins
        allowed=origins[0]
        response=self.client.options("/v1/users/me",headers={"Origin":allowed,"Access-Control-Request-Method":"GET"})
        self.assertEqual(response.headers.get("access-control-allow-origin"),allowed)
        response=self.client.options("/v1/users/me",headers={"Origin":"https://unknown.example.test","Access-Control-Request-Method":"GET"})
        self.assertNotIn("access-control-allow-origin",response.headers)

    def test_invalid_booking_input_rejected(self):
        values={"restaurantId":1,"date":"2030-01-01","time":"18:00","guestCount":2,
            "requestSeats":2,"contactName":"Test","contactEmail":"a@example.test","contactPhone":"1"}
        for key,value in [("guestCount",0),("requestSeats",-1),("date","2030-99-01"),("time","25:00")]:
            with self.subTest(field=key):
                with self.assertRaises(ValidationError): BookingCreate(**{**values,key:value})

    def test_past_booking_rejected_before_restaurant_lookup(self):
        response=self.client.post("/v1/bookings",headers=self.headers(),json={"restaurantId":1,
            "date":"2000-01-01","time":"18:00","guestCount":2,"requestSeats":2,
            "contactName":"Test","contactEmail":"a@example.test","contactPhone":"1"})
        self.assertEqual(response.status_code,422)

    def test_retired_simulation_route_is_not_public(self):
        self.assertEqual(self.client.post("/api/sepay/simulate-webhook?payment_id=1").status_code,404)

    def test_public_write_surface_is_explicit(self):
        allowed={"/v1/auth/register","/v1/auth/partner-register","/v1/auth/login",
            "/v1/auth/refresh","/v1/auth/logout","/v1/assistant/chat","/v1/deposits/sepay/ipn"}
        for path,methods in main.app.openapi()["paths"].items():
            for method,operation in methods.items():
                if method in {"post","put","delete","patch"} and not operation.get("security"):
                    self.assertIn(path,allowed)


if __name__ == "__main__": unittest.main()
