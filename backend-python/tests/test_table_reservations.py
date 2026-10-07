import unittest
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import main
from fastapi import HTTPException
from core.table_reservations import due_reservations, reservation_conflicts, validate_reserved_orders, sync_table_reservations
from core.booking_capacity import APP_TIME_ZONE


class TableReservationTests(unittest.TestCase):
    @patch("core.table_reservations.due_reservations")
    def test_preordered_food_imported_without_kitchen_confirmation(self, due):
        import json
        due.return_value = [self.hold()]
        session = MagicMock()
        session.execute.return_value.first.return_value = None
        session.execute.return_value.all.return_value = []
        session.exec.return_value.all.return_value = [(SimpleNamespace(price=45000, quantity=2), SimpleNamespace(id=9, name="Cơm", category="Món chính", image_url=None, is_available=True))]
        sync_table_reservations(session, SimpleNamespace(id=1, vat_enabled=True))
        writes = [call for call in session.execute.call_args_list if "INSERT INTO cashier_workspaces" in str(call.args[0])]
        order = json.loads(writes[0].args[1]["data"])["orders"]["3"]
        self.assertEqual(order["lines"][0]["quantity"], 2)
        self.assertEqual(order["lines"][0]["price"], 45000)
        self.assertTrue(order["preordersImported"])
        self.assertNotIn("kitchenConfirmedAt", order)
        self.assertNotIn("kitchenLines", order)

    @patch("core.table_reservations.due_reservations")
    def test_preorders_not_reimported_after_cashier_removes_them(self, due):
        due.return_value = [self.hold()]
        session = MagicMock()
        session.execute.return_value.first.return_value = SimpleNamespace(data={"orders": {"3": {"bookingId": 7, "preordersImported": True, "lines": []}}, "shifts": []})
        session.execute.return_value.all.return_value = []
        sync_table_reservations(session, SimpleNamespace(id=1, vat_enabled=True))
        session.exec.assert_not_called()
        self.assertFalse(any("INSERT INTO cashier_workspaces" in str(call.args[0]) for call in session.execute.call_args_list))

    @patch("core.table_reservations.due_reservations")
    def test_due_empty_table_opens_order(self, due):
        import json
        due.return_value = [self.hold()]
        session = MagicMock()
        session.execute.return_value.first.return_value = None
        session.execute.return_value.all.return_value = []
        sync_table_reservations(session, SimpleNamespace(id=1, vat_enabled=True))
        writes = [call for call in session.execute.call_args_list if "INSERT INTO cashier_workspaces" in str(call.args[0])]
        self.assertEqual(len(writes), 1)
        order = json.loads(writes[0].args[1]["data"])["orders"]["3"]
        self.assertEqual(order["bookingId"], 7)
        self.assertEqual(order["guests"], 4)
        self.assertEqual(order["lines"], [])

    def hold(self):
        return {"booking_id":7,"table_id":3,"table_name":"A1","customer":"Khách","seats":4,"meal_at":"2026-10-04T19:00:00+07:00"}

    def test_hold_only_at_meal_time(self):
        session=MagicMock()
        booking=SimpleNamespace(bookingId=7,date="2026-10-04",time="19:00",contactName="Khách",requestSeats=4,attendance="arrived")
        session.exec.return_value.all.return_value=[(booking,None,SimpleNamespace(id=3,name="A1"))]
        self.assertEqual(due_reservations(session,1,datetime(2026,10,4,18,59,tzinfo=APP_TIME_ZONE)),[])
        self.assertEqual(len(due_reservations(session,1,datetime(2026,10,4,19,0,tzinfo=APP_TIME_ZONE))),1)
        self.assertEqual(due_reservations(session,1,datetime(2026,10,4,19,0,tzinfo=APP_TIME_ZONE))[0]["attendance"],"arrived")

    def test_empty_table_reserved_without_conflict(self):
        self.assertFalse(reservation_conflicts([self.hold()],{})[0]["conflict"])

    def test_existing_bill_conflicts_but_linked_bill_does_not(self):
        self.assertTrue(reservation_conflicts([self.hold()],{"3":{"lines":[{}]}})[0]["conflict"])
        self.assertFalse(reservation_conflicts([self.hold()],{"3":{"lines":[{}],"bookingId":7}})[0]["conflict"])

    def test_wrong_guest_rejected(self):
        with self.assertRaises(HTTPException):
            validate_reserved_orders([self.hold()],{}, {"3":{"lines":[{}]}})
        validate_reserved_orders([self.hold()],{}, {"3":{"lines":[{}],"bookingId":7}})

    def test_existing_bill_cannot_be_relabelled(self):
        with self.assertRaises(HTTPException):
            validate_reserved_orders([self.hold()],{"3":{"lines":[{}]}},{"3":{"lines":[{}],"bookingId":7}})
        validate_reserved_orders([self.hold()],{"3":{"lines":[{}]}},{"3":{"lines":[{},{}]}})

    def test_multiple_due_bookings_conflict(self):
        second={**self.hold(),"booking_id":8}
        self.assertTrue(reservation_conflicts([self.hold(),second],{})[1]["conflict"])
        with self.assertRaises(HTTPException):
            validate_reserved_orders([self.hold(),second],{}, {"3":{"lines":[{}],"bookingId":7}})

    def test_conflict_notifies_once(self):
        for inserted, count in [(True, 1), (False, 0)]:
            session = MagicMock()
            workspace = SimpleNamespace(data={"orders":{"3":{"lines":[{}]}}})
            insert = SimpleNamespace(id=1, inserted=inserted)
            session.execute.side_effect = [
                MagicMock(first=MagicMock(return_value=workspace)),
                MagicMock(first=MagicMock(return_value=insert)),
                MagicMock(all=MagicMock(return_value=[])),
            ]
            with patch("core.table_reservations.due_reservations", return_value=[self.hold()]):
                sync_table_reservations(session, SimpleNamespace(id=1,manager_id=2))
            self.assertEqual(session.add.call_count, count)

    def test_finished_booking_clears_incident(self):
        session = MagicMock()
        session.execute.side_effect = [
            MagicMock(first=MagicMock(return_value=SimpleNamespace(data={"orders":{}}))),
            MagicMock(all=MagicMock(return_value=[SimpleNamespace(id=1,booking_id=7,table_id=3)])),
            MagicMock(),
        ]
        with patch("core.table_reservations.due_reservations", return_value=[]):
            self.assertEqual(sync_table_reservations(session, SimpleNamespace(id=1,manager_id=2)), [])
        self.assertIn("state='cleared'", str(session.execute.call_args.args[0]))
        session.add.assert_not_called()
