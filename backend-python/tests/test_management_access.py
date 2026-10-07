import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
from fastapi import HTTPException
from core.management_access import credential_fingerprint, verify_management_token
from routers.management_access import unlock, UnlockRequest
from routers.management_access import validate_session
from core.security import create_access_token, decode_token
from datetime import timedelta


class ManagementAccessTests(unittest.TestCase):
    def setUp(self):
        self.user = SimpleNamespace(userId=4, password="login-hash")
        self.record = SimpleNamespace(password_hash="management-hash", failed_attempts=0, locked_until=0)
        self.session = Mock()
        self.session.get.return_value = self.record

    @patch("core.management_access.decode_token")
    def test_valid_token_and_password_change_revocation(self, decode):
        decode.return_value = {"type": "management", "uid": 4, "credential": credential_fingerprint(self.user, self.record)}
        verify_management_token("token", self.user, self.session)
        self.record.password_hash = "changed"
        with self.assertRaises(HTTPException) as error:
            verify_management_token("token", self.user, self.session)
        self.assertEqual(error.exception.status_code, 403)

    @patch("core.management_access.decode_token")
    def test_other_user_and_wrong_token_type(self, decode):
        for payload in ({"type": "management", "uid": 9}, {"type": "refresh", "uid": 4}):
            decode.return_value = payload
            with self.assertRaises(HTTPException):
                verify_management_token("token", self.user, self.session)

    @patch("routers.management_access.verify_password", return_value=False)
    def test_failed_attempts_lock_after_five(self, verify):
        self.session.exec.return_value.first.return_value = self.user
        for _ in range(5):
            with self.assertRaises(HTTPException):
                unlock(UnlockRequest(password="wrong"), self.user, self.session)
        self.assertGreater(self.record.locked_until, 0)
        with self.assertRaises(HTTPException) as error:
            unlock(UnlockRequest(password="wrong"), self.user, self.session)
        self.assertEqual(error.exception.status_code, 429)

    def test_login_password_change_invalidates_fingerprint(self):
        before = credential_fingerprint(self.user, self.record)
        self.user.password = "changed-login-hash"
        self.assertNotEqual(before, credential_fingerprint(self.user, self.record))

    def test_restore_keeps_original_expiration(self):
        token = create_access_token({"type": "management", "uid": 4, "credential": credential_fingerprint(self.user, self.record)}, timedelta(minutes=10))
        expected = decode_token(token)["exp"]
        restored = validate_session(self.user, self.session, token)
        self.assertTrue(restored["valid"])
        self.assertEqual(restored["expires_at"], expected)

    def test_expired_session_is_rejected(self):
        token = create_access_token({"type": "management", "uid": 4, "credential": credential_fingerprint(self.user, self.record)}, timedelta(seconds=-1))
        with self.assertRaises(HTTPException) as error:
            validate_session(self.user, self.session, token)
        self.assertEqual(error.exception.status_code, 403)
