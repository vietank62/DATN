"""Run all periodic booking maintenance tasks once for Render Cron."""
from sqlmodel import Session

from database import engine
from core.booking_email import deliver_booking_emails
from core.booking_fees import maintain_booking_fees
from core.deposit_checkout import maintain_checkout_sessions
from core.deposit_expiry import expire_unpaid_bookings
from routers.booking import (
    auto_complete_expired_confirmed_bookings,
    expire_unanswered_bookings,
)


if __name__ == "__main__":
    with Session(engine) as session:
        emails_sent = deliver_booking_emails(session)
        maintain_booking_fees(session)
        deposit_expired = expire_unpaid_bookings(session)
        completed = auto_complete_expired_confirmed_bookings(session)
        unanswered = expire_unanswered_bookings(session)
        checkout_result = maintain_checkout_sessions(session)
    print({
        "emailsSent": emails_sent,
        "expiredBookings": deposit_expired,
        "completedBookings": completed,
        "unansweredBookings": unanswered,
        **checkout_result,
    })