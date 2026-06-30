from typing import List
from pydantic import BaseModel  # type: ignore


# ── Manager KPIs ──────────────────────────────────────────────────────────────

class ManagerStats(BaseModel):
    totalBookings: int
    todayBookings: int
    totalRevenue: float
    avgRating: float
    pendingBookings: int
    confirmedBookings: int


# ── Admin KPIs ────────────────────────────────────────────────────────────────

class AdminStats(BaseModel):
    totalRestaurants: int
    totalUsers: int
    totalBookings: int
    totalRevenue: float
    activeRestaurants: int
    newUsersThisMonth: int


# ── Booking chart ─────────────────────────────────────────────────────────────

class MonthlyBookingStat(BaseModel):
    month: int
    count: int
    label: str


class BookingChartResponse(BaseModel):
    monthly: List[MonthlyBookingStat]
    totalYear: int
    year: int


# ── Menu distribution chart ───────────────────────────────────────────────────

class MenuDistributionStat(BaseModel):
    category: str
    count: int
    percentage: float


class MenuChartResponse(BaseModel):
    distribution: List[MenuDistributionStat]
    totalItems: int


# ── Booking status chart ──────────────────────────────────────────────────────

class BookingStatusStat(BaseModel):
    status: str
    count: int
    percentage: float


class StatusChartResponse(BaseModel):
    distribution: List[BookingStatusStat]
    totalBookings: int
