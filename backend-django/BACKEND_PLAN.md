# 📋 KẾ HOẠCH BACKEND DJANGO + POSTGRESQL CHO TABLENOW

## Mục lục
1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Cấu trúc thư mục Django](#2-cấu-trúc-thư-mục-django)
3. [Database Schema (PostgreSQL)](#3-database-schema-postgresql)
4. [Django Models chi tiết](#4-django-models-chi-tiết)
5. [API Endpoints (DRF)](#5-api-endpoints-drf)
6. [Serializers](#6-serializers)
7. [Views (ViewSets)](#7-views-viewsets)
8. [Authentication (JWT)](#8-authentication-jwt)
9. [Mapping Frontend → Backend](#9-mapping-frontend--backend)
10. [Seed Data (Migration)](#10-seed-data-migration)
11. [Cấu hình CORS + Settings](#11-cấu-hình-cors--settings)
12. [Deployment Plan](#12-deployment-plan)
13. [Thứ tự triển khai](#13-thứ-tự-triển-khai)

---

## 1. Tổng quan kiến trúc

```
┌─────────────────┐     HTTP/JSON     ┌──────────────────────┐     SQL      ┌──────────────┐
│  React Frontend │ ◄──────────────► │  Django REST API     │ ◄──────────► │  PostgreSQL  │
│  (Vite, TS)     │    CORS enabled   │  (DRF + SimpleJWT)   │   psycopg2   │  Database    │
│  Port 3000      │                   │  Port 8000           │              │  Port 5432   │
└─────────────────┘                   └──────────────────────┘              └──────────────┘
```

**Tech Stack:**
- Python 3.11+
- Django 5.1
- Django REST Framework 3.15
- djangorestframework-simplejwt (JWT Auth)
- django-cors-headers (CORS)
- django-filter (Filtering)
- psycopg2-binary (PostgreSQL driver)
- Pillow (Image handling)
- python-decouple (Environment variables)
- gunicorn (Production server)
- whitenoise (Static files)

---

## 2. Cấu trúc thư mục Django

```
backend-django/
├── manage.py
├── requirements.txt
├── .env                          # DB credentials, SECRET_KEY, DEBUG
├── .env.example
├── .gitignore
│
├── config/                       # Project settings (thay vì tên project)
│   ├── __init__.py
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py               # Settings chung
│   │   ├── development.py        # Dev settings (DEBUG=True, CORS=*)
│   │   └── production.py         # Prod settings (DEBUG=False)
│   ├── urls.py                   # Root URL config
│   ├── wsgi.py
│   └── asgi.py
│
├── apps/
│   ├── __init__.py
│   │
│   ├── accounts/                 # App: User + Auth
│   │   ├── __init__.py
│   │   ├── models.py             # CustomUser (extends AbstractUser)
│   │   ├── serializers.py        # UserSerializer, RegisterSerializer, LoginSerializer
│   │   ├── views.py              # RegisterView, ProfileView, UserViewSet
│   │   ├── urls.py
│   │   ├── admin.py
│   │   ├── managers.py           # CustomUserManager
│   │   ├── permissions.py        # IsAdmin, IsManager, IsOwnerOrAdmin
│   │   └── tests.py
│   │
│   ├── restaurants/              # App: Restaurant management
│   │   ├── __init__.py
│   │   ├── models.py             # Restaurant, CuisineType
│   │   ├── serializers.py        # RestaurantSerializer, RestaurantListSerializer
│   │   ├── views.py              # RestaurantViewSet
│   │   ├── urls.py
│   │   ├── admin.py
│   │   ├── filters.py            # RestaurantFilter (django-filter)
│   │   └── tests.py
│   │
│   ├── bookings/                 # App: Booking management
│   │   ├── __init__.py
│   │   ├── models.py             # Booking
│   │   ├── serializers.py        # BookingSerializer, BookingCreateSerializer
│   │   ├── views.py              # BookingViewSet
│   │   ├── urls.py
│   │   ├── admin.py
│   │   ├── permissions.py        # CanManageBooking
│   │   └── tests.py
│   │
│   └── dashboard/                # App: Stats aggregation
│       ├── __init__.py
│       ├── views.py              # ManagerStatsView, AdminStatsView
│       ├── serializers.py        # StatsSerializers
│       ├── urls.py
│       └── tests.py
│
├── seed/                         # Seed data
│   ├── __init__.py
│   └── seed_data.py              # Management command: python manage.py seed
│
└── media/                        # Uploaded images (dev)
    └── restaurants/
```

---

## 3. Database Schema (PostgreSQL)

### ERD (Entity Relationship Diagram)

```
┌───────────────────┐       ┌────────────────────┐       ┌──────────────────┐
│   cuisine_types   │       │     restaurants     │       │     bookings     │
├───────────────────┤       ├────────────────────┤       ├──────────────────┤
│ id (PK)           │──┐    │ id (PK, UUID)      │──┐    │ id (PK, UUID)    │
│ name (unique)     │  └──► │ cuisine_id (FK)    │  │    │ restaurant (FK)──┤──►restaurants
│ slug (unique)     │       │ manager (FK) ──────┤──┤──► │ customer (FK)────┤──►users (nullable)
│ icon              │       │ name               │  │    │ date             │
│ display_order     │       │ address            │  │    │ time             │
└───────────────────┘       │ district           │  │    │ guest_count      │
                            │ price_range        │  │    │ status           │
┌───────────────────┐       │ rating             │  │    │ contact_name     │
│      users        │       │ review_count       │  │    │ contact_email    │
├───────────────────┤       │ image_url          │  │    │ contact_phone    │
│ id (PK, UUID)     │──┐    │ description        │  │    │ note             │
│ email (unique)    │  │    │ open_time          │  │    │ created_at       │
│ password (hash)   │  │    │ close_time         │  │    │ updated_at       │
│ name              │  │    │ phone              │  │    └──────────────────┘
│ phone             │  │    │ featured           │  │
│ role              │  │    │ is_active          │  │
│ avatar            │  └──► │ created_at         │  │
│ is_active         │       │ updated_at         │  │
│ date_joined       │       └────────────────────┘  │
└───────────────────┘                                │
                                                     │
                            ┌────────────────────┐   │
                            │     reviews        │   │
                            ├────────────────────┤   │
                            │ id (PK, UUID)      │   │
                            │ restaurant (FK) ───┤───┘
                            │ user (FK)          │
                            │ rating (1-5)       │
                            │ comment            │
                            │ created_at         │
                            └────────────────────┘
```

### SQL Schema chi tiết

```sql
-- 1. Users (Django custom user model)
CREATE TABLE accounts_customuser (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password        VARCHAR(128) NOT NULL,           -- Django hashed
    name            VARCHAR(150) NOT NULL,
    phone           VARCHAR(15) DEFAULT '',
    role            VARCHAR(10) NOT NULL DEFAULT 'customer'
                    CHECK (role IN ('customer', 'manager', 'admin')),
    avatar          VARCHAR(500) DEFAULT '',
    is_active       BOOLEAN DEFAULT TRUE,
    is_staff        BOOLEAN DEFAULT FALSE,           -- Django admin access
    is_superuser    BOOLEAN DEFAULT FALSE,
    date_joined     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login      TIMESTAMP WITH TIME ZONE
);

-- 2. Cuisine Types (lookup table)
CREATE TABLE restaurants_cuisinetype (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(50) NOT NULL,             -- 'Hải sản', 'Đồ Âu', ...
    slug            VARCHAR(50) UNIQUE NOT NULL,      -- 'seafood', 'european', ...
    icon            VARCHAR(10) DEFAULT '',            -- emoji: '🦐', '🥩', ...
    display_order   INTEGER DEFAULT 0
);

-- 3. Restaurants
CREATE TABLE restaurants_restaurant (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id      UUID REFERENCES accounts_customuser(id) ON DELETE SET NULL,
    cuisine_id      INTEGER REFERENCES restaurants_cuisinetype(id) ON DELETE SET NULL,
    name            VARCHAR(200) NOT NULL,
    address         VARCHAR(500) NOT NULL,
    district        VARCHAR(50) NOT NULL,
    price_range     VARCHAR(20) NOT NULL
                    CHECK (price_range IN ('Dưới 200K', '200K - 500K', '500K - 1M', 'Trên 1M')),
    rating          DECIMAL(2,1) DEFAULT 0.0,
    review_count    INTEGER DEFAULT 0,
    image_url       VARCHAR(1000) DEFAULT '',
    description     TEXT DEFAULT '',
    open_time       TIME NOT NULL,
    close_time      TIME NOT NULL,
    phone           VARCHAR(20) DEFAULT '',
    featured        BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_restaurant_cuisine ON restaurants_restaurant(cuisine_id);
CREATE INDEX idx_restaurant_district ON restaurants_restaurant(district);
CREATE INDEX idx_restaurant_rating ON restaurants_restaurant(rating DESC);
CREATE INDEX idx_restaurant_featured ON restaurants_restaurant(featured) WHERE featured = TRUE;

-- 4. Bookings
CREATE TABLE bookings_booking (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants_restaurant(id) ON DELETE CASCADE,
    customer_id     UUID REFERENCES accounts_customuser(id) ON DELETE SET NULL,
    date            DATE NOT NULL,
    time            TIME NOT NULL,
    guest_count     INTEGER NOT NULL CHECK (guest_count > 0 AND guest_count <= 50),
    status          VARCHAR(10) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    contact_name    VARCHAR(150) NOT NULL,
    contact_email   VARCHAR(255) NOT NULL,
    contact_phone   VARCHAR(15) NOT NULL,
    note            TEXT DEFAULT '',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_booking_restaurant ON bookings_booking(restaurant_id);
CREATE INDEX idx_booking_customer ON bookings_booking(customer_id);
CREATE INDEX idx_booking_date ON bookings_booking(date);
CREATE INDEX idx_booking_status ON bookings_booking(status);

-- 5. Reviews (mở rộng tương lai)
CREATE TABLE restaurants_review (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants_restaurant(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES accounts_customuser(id) ON DELETE CASCADE,
    rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment         TEXT DEFAULT '',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(restaurant_id, user_id)  -- Mỗi user chỉ review 1 lần
);
```

---

## 4. Django Models chi tiết

### `apps/accounts/models.py`

```python
import uuid
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from .managers import CustomUserManager


class CustomUser(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = (
        ('customer', 'Customer'),
        ('manager', 'Manager'),
        ('admin', 'Admin'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=15, blank=True, default='')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='customer')
    avatar = models.URLField(max_length=500, blank=True, default='')

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        db_table = 'accounts_customuser'
        ordering = ['-date_joined']

    def __str__(self):
        return f"{self.name} ({self.email})"
```

### `apps/accounts/managers.py`

```python
from django.contrib.auth.models import BaseUserManager


class CustomUserManager(BaseUserManager):
    def create_user(self, email, name, password=None, **extra):
        if not email:
            raise ValueError('Email là bắt buộc')
        email = self.normalize_email(email)
        user = self.model(email=email, name=name, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, name, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        extra.setdefault('role', 'admin')
        return self.create_user(email, name, password, **extra)
```

### `apps/restaurants/models.py`

```python
import uuid
from django.db import models
from django.conf import settings


class CuisineType(models.Model):
    name = models.CharField(max_length=50)           # 'Hải sản'
    slug = models.SlugField(max_length=50, unique=True)  # 'seafood'
    icon = models.CharField(max_length=10, blank=True, default='')  # '🦐'
    display_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'restaurants_cuisinetype'
        ordering = ['display_order']

    def __str__(self):
        return f"{self.icon} {self.name}"


class Restaurant(models.Model):
    PRICE_CHOICES = (
        ('Dưới 200K', 'Dưới 200K'),
        ('200K - 500K', '200K - 500K'),
        ('500K - 1M', '500K - 1M'),
        ('Trên 1M', 'Trên 1M'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='restaurants',
        limit_choices_to={'role': 'manager'}
    )
    cuisine = models.ForeignKey(
        CuisineType,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='restaurants'
    )
    name = models.CharField(max_length=200)
    address = models.CharField(max_length=500)
    district = models.CharField(max_length=50)
    price_range = models.CharField(max_length=20, choices=PRICE_CHOICES)
    rating = models.DecimalField(max_digits=2, decimal_places=1, default=0.0)
    review_count = models.IntegerField(default=0)
    image_url = models.URLField(max_length=1000, blank=True, default='')
    description = models.TextField(blank=True, default='')
    open_time = models.TimeField()
    close_time = models.TimeField()
    phone = models.CharField(max_length=20, blank=True, default='')
    featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'restaurants_restaurant'
        ordering = ['-featured', '-rating']

    def __str__(self):
        return self.name
```

### `apps/bookings/models.py`

```python
import uuid
from django.db import models
from django.conf import settings


class Booking(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='bookings'
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='bookings'
    )
    date = models.DateField()
    time = models.TimeField()
    guest_count = models.PositiveIntegerField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')

    # Contact info (cho guest booking không cần đăng nhập)
    contact_name = models.CharField(max_length=150)
    contact_email = models.EmailField()
    contact_phone = models.CharField(max_length=15)
    note = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bookings_booking'
        ordering = ['-created_at']

    def __str__(self):
        return f"Booking {self.id} - {self.restaurant.name} ({self.date})"
```

---

## 5. API Endpoints (DRF)

### URL Pattern tổng hợp

| Method | Endpoint | Mô tả | Auth | Mapping Frontend |
|--------|----------|--------|------|-----------------|
| **AUTH** |
| POST | `/api/auth/register/` | Đăng ký | No | RegisterPage |
| POST | `/api/auth/login/` | Đăng nhập → JWT | No | LoginPage |
| POST | `/api/auth/refresh/` | Refresh token | No | Auto |
| GET | `/api/auth/profile/` | User profile | Yes | Navbar |
| PUT | `/api/auth/profile/` | Update profile | Yes | Settings |
| **RESTAURANTS** |
| GET | `/api/restaurants/` | Danh sách (có filter) | No | `fetchRestaurants()` |
| GET | `/api/restaurants/{id}/` | Chi tiết 1 nhà hàng | No | `fetchRestaurantById()` |
| POST | `/api/restaurants/` | Tạo nhà hàng | Admin | AdminDashboard |
| PUT | `/api/restaurants/{id}/` | Cập nhật nhà hàng | Manager/Admin | ManagerDashboard |
| DELETE | `/api/restaurants/{id}/` | Xóa nhà hàng | Admin | AdminDashboard |
| GET | `/api/restaurants/cuisines/` | Danh sách loại ẩm thực | No | FilterBar |
| GET | `/api/restaurants/districts/` | Danh sách quận | No | FilterBar |
| **BOOKINGS** |
| GET | `/api/bookings/` | Danh sách booking | Yes | `fetchBookings()` |
| POST | `/api/bookings/` | Tạo booking | No* | `createBooking()` |
| GET | `/api/bookings/{id}/` | Chi tiết booking | Yes | - |
| PATCH | `/api/bookings/{id}/status/` | Đổi status | Manager/Admin | `updateBookingStatus()` |
| **DASHBOARD** |
| GET | `/api/dashboard/manager/` | Stats manager | Manager | ManagerDashboard |
| GET | `/api/dashboard/admin/` | Stats admin | Admin | AdminDashboard |
| GET | `/api/dashboard/admin/users/` | Danh sách users | Admin | AdminDashboard |

> *Booking có thể tạo không cần đăng nhập (guest booking) - giữ nguyên flow frontend hiện tại

### Filter Parameters cho `GET /api/restaurants/`

```
GET /api/restaurants/?cuisine=seafood&district=Quận 1&rating_min=4.0&price_range=500K - 1M&featured=true&search=dragon
```

| Param | Type | Mô tả | Mapping FilterOptions |
|-------|------|--------|-----------------------|
| `cuisine` | string | Slug cuisine type | `filters.cuisineType` |
| `district` | string | Tên quận | `filters.area` |
| `rating_min` | float | Rating tối thiểu | `filters.rating` |
| `price_range` | string | Giá | `filters.priceRange` |
| `search` | string | Tìm theo tên | HeroSection search |
| `featured` | bool | Chỉ featured | - |
| `ordering` | string | `-rating`, `name`, `-review_count` | - |
| `page` | int | Pagination | - |
| `page_size` | int | Số items/page (default 12) | - |

---

## 6. Serializers

### `apps/accounts/serializers.py`

```python
from rest_framework import serializers
from .models import CustomUser


class UserSerializer(serializers.ModelSerializer):
    """Trả về thông tin user (không có password)"""
    class Meta:
        model = CustomUser
        fields = ['id', 'name', 'email', 'phone', 'role', 'avatar', 'date_joined']
        read_only_fields = ['id', 'date_joined']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = ['name', 'email', 'phone', 'password', 'password_confirm']

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Mật khẩu không khớp'})
        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        return CustomUser.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()
```

### `apps/restaurants/serializers.py`

```python
from rest_framework import serializers
from .models import Restaurant, CuisineType


class CuisineTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuisineType
        fields = ['id', 'name', 'slug', 'icon', 'display_order']


class RestaurantListSerializer(serializers.ModelSerializer):
    """Dùng cho danh sách (nhẹ hơn)"""
    cuisine = serializers.SlugRelatedField(slug_field='slug', read_only=True)

    class Meta:
        model = Restaurant
        fields = [
            'id', 'name', 'address', 'district', 'cuisine',
            'price_range', 'rating', 'review_count', 'image_url',
            'featured',
        ]


class RestaurantDetailSerializer(serializers.ModelSerializer):
    """Dùng cho chi tiết (đầy đủ)"""
    cuisine = serializers.SlugRelatedField(slug_field='slug', read_only=True)

    class Meta:
        model = Restaurant
        fields = [
            'id', 'name', 'address', 'district', 'cuisine',
            'price_range', 'rating', 'review_count', 'image_url',
            'description', 'open_time', 'close_time', 'phone',
            'featured', 'is_active', 'created_at', 'updated_at',
        ]
```

### `apps/bookings/serializers.py`

```python
from rest_framework import serializers
from .models import Booking


class BookingSerializer(serializers.ModelSerializer):
    """Dùng cho đọc (list, detail)"""
    restaurant_name = serializers.CharField(source='restaurant.name', read_only=True)

    class Meta:
        model = Booking
        fields = [
            'id', 'restaurant', 'restaurant_name', 'customer',
            'date', 'time', 'guest_count', 'status',
            'contact_name', 'contact_email', 'contact_phone',
            'note', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'customer']


class BookingCreateSerializer(serializers.ModelSerializer):
    """Dùng cho tạo booking mới"""
    class Meta:
        model = Booking
        fields = [
            'restaurant', 'date', 'time', 'guest_count',
            'contact_name', 'contact_email', 'contact_phone', 'note',
        ]

    def validate_guest_count(self, value):
        if value < 1 or value > 50:
            raise serializers.ValidationError('Số khách phải từ 1-50')
        return value


class BookingStatusSerializer(serializers.Serializer):
    """Dùng cho cập nhật status"""
    status = serializers.ChoiceField(
        choices=['pending', 'confirmed', 'cancelled', 'completed']
    )
```

---

## 7. Views (ViewSets)

### `apps/restaurants/views.py`

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Restaurant, CuisineType
from .serializers import (
    RestaurantListSerializer,
    RestaurantDetailSerializer,
    CuisineTypeSerializer,
)
from .filters import RestaurantFilter


class RestaurantViewSet(viewsets.ModelViewSet):
    queryset = Restaurant.objects.filter(is_active=True)
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = RestaurantFilter
    search_fields = ['name', 'address', 'description']
    ordering_fields = ['rating', 'review_count', 'name', 'created_at']
    ordering = ['-featured', '-rating']

    def get_serializer_class(self):
        if self.action == 'list':
            return RestaurantListSerializer
        return RestaurantDetailSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'cuisines', 'districts']:
            return [AllowAny()]
        return [IsAuthenticated()]  # create/update/delete cần auth

    @action(detail=False, methods=['get'])
    def cuisines(self, request):
        cuisines = CuisineType.objects.all()
        serializer = CuisineTypeSerializer(cuisines, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def districts(self, request):
        districts = (
            Restaurant.objects
            .values_list('district', flat=True)
            .distinct()
            .order_by('district')
        )
        return Response(list(districts))
```

### `apps/restaurants/filters.py`

```python
import django_filters
from .models import Restaurant


class RestaurantFilter(django_filters.FilterSet):
    cuisine = django_filters.CharFilter(field_name='cuisine__slug')
    district = django_filters.CharFilter(field_name='district')
    rating_min = django_filters.NumberFilter(field_name='rating', lookup_expr='gte')
    price_range = django_filters.CharFilter(field_name='price_range')
    featured = django_filters.BooleanFilter(field_name='featured')

    class Meta:
        model = Restaurant
        fields = ['cuisine', 'district', 'rating_min', 'price_range', 'featured']
```

### `apps/bookings/views.py`

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import Booking
from .serializers import BookingSerializer, BookingCreateSerializer, BookingStatusSerializer


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Booking.objects.select_related('restaurant', 'customer')

        # Admin thấy tất cả
        if user.is_authenticated and user.role == 'admin':
            pass
        # Manager chỉ thấy booking của nhà hàng mình
        elif user.is_authenticated and user.role == 'manager':
            qs = qs.filter(restaurant__manager=user)
        # Customer chỉ thấy booking của mình
        elif user.is_authenticated:
            qs = qs.filter(customer=user)
        else:
            qs = qs.none()

        # Filter theo restaurant_id (query param)
        restaurant_id = self.request.query_params.get('restaurant_id')
        if restaurant_id:
            qs = qs.filter(restaurant_id=restaurant_id)

        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return BookingCreateSerializer
        if self.action == 'update_status':
            return BookingStatusSerializer
        return BookingSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]  # Guest booking cho phép
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        customer = self.request.user if self.request.user.is_authenticated else None
        serializer.save(customer=customer)

    @action(detail=True, methods=['patch'], url_path='status')
    def update_status(self, request, pk=None):
        booking = self.get_object()
        serializer = BookingStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking.status = serializer.validated_data['status']
        booking.save(update_fields=['status', 'updated_at'])
        return Response(BookingSerializer(booking).data)
```

### `apps/dashboard/views.py`

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Sum, Avg, Q
from django.utils import timezone

from apps.restaurants.models import Restaurant
from apps.bookings.models import Booking
from apps.accounts.models import CustomUser


class ManagerStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != 'manager':
            return Response({'error': 'Chỉ manager mới xem được'}, status=403)

        restaurants = Restaurant.objects.filter(manager=user)
        bookings = Booking.objects.filter(restaurant__in=restaurants)
        today = timezone.now().date()

        stats = {
            'totalBookings': bookings.count(),
            'todayBookings': bookings.filter(date=today).count(),
            'totalRevenue': 0,  # Tính từ price nếu có
            'avgRating': restaurants.aggregate(avg=Avg('rating'))['avg'] or 0,
            'pendingBookings': bookings.filter(status='pending').count(),
            'confirmedBookings': bookings.filter(status='confirmed').count(),
        }
        return Response(stats)


class AdminStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Chỉ admin mới xem được'}, status=403)

        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        stats = {
            'totalRestaurants': Restaurant.objects.count(),
            'totalUsers': CustomUser.objects.count(),
            'totalBookings': Booking.objects.count(),
            'totalRevenue': 0,
            'activeRestaurants': Restaurant.objects.filter(is_active=True).count(),
            'newUsersThisMonth': CustomUser.objects.filter(date_joined__gte=month_start).count(),
        }
        return Response(stats)
```

---

## 8. Authentication (JWT)

### Flow

```
1. Register: POST /api/auth/register/
   → Tạo user → Trả về user info (chưa có token)

2. Login: POST /api/auth/login/
   → Validate email/password
   → Trả về { access_token, refresh_token, user }

3. Mỗi request cần auth:
   Header: Authorization: Bearer <access_token>

4. Token hết hạn:
   POST /api/auth/refresh/
   Body: { refresh: <refresh_token> }
   → Trả về { access: <new_access_token> }
```

### `apps/accounts/views.py`

```python
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate

from .models import CustomUser
from .serializers import RegisterSerializer, UserSerializer, LoginSerializer


class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({
            'user': UserSerializer(user).data,
            'message': 'Đăng ký thành công!'
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = authenticate(
            email=serializer.validated_data['email'],
            password=serializer.validated_data['password']
        )
        if not user:
            return Response(
                {'error': 'Email hoặc mật khẩu không đúng'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        })


class ProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
```

### `apps/accounts/urls.py`

```python
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import RegisterView, LoginView, ProfileView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', ProfileView.as_view(), name='profile'),
]
```

### JWT Settings (trong `config/settings/base.py`)

```python
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}
```

---

## 9. Mapping Frontend → Backend

### Thay đổi `src/services/api.ts`

Hiện tại frontend dùng mock data. Khi backend sẵn sàng, thay toàn bộ bằng axios:

```typescript
// src/services/api.ts (SAU KHI CÓ BACKEND)
import axios from 'axios';
import type { Restaurant, Booking, FilterOptions } from '../types';

const API = axios.create({
  baseURL: 'http://localhost:8000/api',
});

// Interceptor: tự gắn token
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor: tự refresh token khi hết hạn
API.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        const { data } = await axios.post('http://localhost:8000/api/auth/refresh/', { refresh });
        localStorage.setItem('access_token', data.access);
        err.config.headers.Authorization = `Bearer ${data.access}`;
        return axios(err.config);
      }
    }
    return Promise.reject(err);
  }
);

/** Map FilterOptions → query params */
const buildFilterParams = (filters?: FilterOptions) => {
  const params: Record<string, string> = {};
  if (!filters) return params;
  if (filters.cuisineType && filters.cuisineType !== 'all') params.cuisine = filters.cuisineType;
  if (filters.area && filters.area !== 'Tất cả') params.district = filters.area;
  if (filters.rating > 0) params.rating_min = String(filters.rating);
  if (filters.priceRange && filters.priceRange !== 'all') {
    const priceMap: Record<string, string> = {
      'under200': 'Dưới 200K',
      '200to500': '200K - 500K',
      '500to1m': '500K - 1M',
      'above1m': 'Trên 1M',
    };
    params.price_range = priceMap[filters.priceRange];
  }
  return params;
};

export const fetchRestaurants = async (filters?: FilterOptions): Promise<Restaurant[]> => {
  const { data } = await API.get('/restaurants/', { params: buildFilterParams(filters) });
  return data.results; // DRF pagination
};

export const fetchRestaurantById = async (id: string): Promise<Restaurant> => {
  const { data } = await API.get(`/restaurants/${id}/`);
  return data;
};

export const createBooking = async (bookingData: any) => {
  const { data } = await API.post('/bookings/', {
    restaurant: bookingData.restaurantId,
    date: bookingData.date,
    time: bookingData.time,
    guest_count: bookingData.guestCount,
    contact_name: bookingData.contactInfo.name,
    contact_email: bookingData.contactInfo.email,
    contact_phone: bookingData.contactInfo.phone,
    note: bookingData.note,
  });
  return { success: true, message: 'Đặt bàn thành công!', booking: data };
};

export const fetchBookings = async (restaurantId?: string): Promise<Booking[]> => {
  const params = restaurantId ? { restaurant_id: restaurantId } : {};
  const { data } = await API.get('/bookings/', { params });
  return data.results;
};

export const updateBookingStatus = async (bookingId: string, status: string) => {
  await API.patch(`/bookings/${bookingId}/status/`, { status });
  return { success: true };
};

// Auth APIs
export const login = async (email: string, password: string) => {
  const { data } = await API.post('/auth/login/', { email, password });
  localStorage.setItem('access_token', data.access);
  localStorage.setItem('refresh_token', data.refresh);
  return data;
};

export const register = async (userData: any) => {
  const { data } = await API.post('/auth/register/', userData);
  return data;
};

export const getProfile = async () => {
  const { data } = await API.get('/auth/profile/');
  return data;
};

export const logout = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};
```

### Field Name Mapping (Frontend ↔ Backend)

| Frontend (camelCase) | Backend (snake_case) | Ghi chú |
|---------------------|---------------------|---------|
| `id` | `id` | UUID string |
| `name` | `name` | Giữ nguyên |
| `imageUrl` | `image_url` | Cần transform |
| `priceRange` | `price_range` | Cần transform |
| `reviewCount` | `review_count` | Cần transform |
| `openTime` | `open_time` | Cần transform |
| `closeTime` | `close_time` | Cần transform |
| `cuisine` (slug) | `cuisine` (slug via serializer) | Giữ nguyên |
| `guestCount` | `guest_count` | Cần transform |
| `restaurantId` | `restaurant` | FK → UUID |
| `restaurantName` | `restaurant_name` | Read-only từ serializer |
| `contactInfo.name` | `contact_name` | Flatten |
| `contactInfo.email` | `contact_email` | Flatten |
| `contactInfo.phone` | `contact_phone` | Flatten |
| `createdAt` | `created_at` | Cần transform |

> **Tip**: Có thể dùng `djangorestframework-camel-case` package để tự động chuyển snake_case → camelCase trong response, giúp frontend không cần transform.

---

## 10. Seed Data (Migration)

### `seed/management/commands/seed.py`

```python
# Chạy: python manage.py seed

from django.core.management.base import BaseCommand
from apps.accounts.models import CustomUser
from apps.restaurants.models import Restaurant, CuisineType
from apps.bookings.models import Booking
from datetime import time, date, datetime
from django.utils import timezone


class Command(BaseCommand):
    help = 'Seed database với data từ frontend mock'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding cuisine types...')
        cuisines_data = [
            ('Hải sản', 'seafood', '🦐', 1),
            ('Đồ Âu', 'european', '🥩', 2),
            ('Buffet', 'buffet', '🍱', 3),
            ('Nhật Bản', 'japanese', '🍣', 4),
            ('Hàn Quốc', 'korean', '🥘', 5),
            ('Việt Nam', 'vietnamese', '🍜', 6),
            ('Lẩu', 'hotpot', '♨️', 7),
            ('Nướng', 'bbq', '🔥', 8),
        ]
        cuisine_map = {}
        for name, slug, icon, order in cuisines_data:
            obj, _ = CuisineType.objects.get_or_create(
                slug=slug, defaults={'name': name, 'icon': icon, 'display_order': order}
            )
            cuisine_map[slug] = obj

        self.stdout.write('Seeding users...')
        admin = CustomUser.objects.create_superuser(
            email='admin@tablenow.vn', name='Admin', password='admin123', phone='0900000000'
        )
        manager = CustomUser.objects.create_user(
            email='manager@tablenow.vn', name='Lê Văn C', password='manager123',
            phone='0923456789', role='manager'
        )
        customer1 = CustomUser.objects.create_user(
            email='a@gmail.com', name='Nguyễn Văn A', password='customer123',
            phone='0901234567', role='customer'
        )
        customer2 = CustomUser.objects.create_user(
            email='b@gmail.com', name='Trần Thị B', password='customer123',
            phone='0912345678', role='customer'
        )

        self.stdout.write('Seeding restaurants...')
        restaurants_data = [
            # (name, address, district, cuisine_slug, price_range, rating, review_count, image_url, description, open, close, phone, featured)
            ('Golden Dragon - Nhà hàng Hải sản', '123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh', 'Quận 1', 'seafood', '500K - 1M', 4.8, 324, 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=400&fit=crop', 'Nhà hàng hải sản cao cấp với không gian sang trọng.', '10:00', '22:00', '028 1234 5678', True),
            ('Le Petit Bistro', '45 Lê Thánh Tôn, Quận 1, TP. Hồ Chí Minh', 'Quận 1', 'european', 'Trên 1M', 4.9, 186, 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&h=400&fit=crop', 'Trải nghiệm ẩm thực Pháp đích thực.', '11:00', '23:00', '028 2345 6789', True),
            ('Sakura Japanese Restaurant', '78 Thảo Điền, Quận 2, TP. Hồ Chí Minh', 'Quận 2', 'japanese', '500K - 1M', 4.7, 256, 'https://images.unsplash.com/photo-1579027989536-b7b1f875659b?w=600&h=400&fit=crop', 'Nhà hàng Nhật Bản chính thống.', '11:00', '22:00', '028 3456 7890', False),
            ('Seoul Garden BBQ', '156 Phạm Văn Đồng, Thủ Đức, TP. Hồ Chí Minh', 'Thủ Đức', 'korean', '200K - 500K', 4.5, 512, 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=400&fit=crop', 'Buffet nướng Hàn Quốc.', '10:00', '23:00', '028 4567 8901', True),
            ('Phở Bà Chiểu - Truyền thống', '23 Bạch Đằng, Bình Thạnh, TP. Hồ Chí Minh', 'Bình Thạnh', 'vietnamese', 'Dưới 200K', 4.6, 1024, 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600&h=400&fit=crop', 'Phở truyền thống Hà Nội.', '06:00', '22:00', '028 5678 9012', False),
            ('Royal Buffet', '300 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh', 'Quận 7', 'buffet', '500K - 1M', 4.4, 789, 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop', 'Buffet hải sản và quốc tế cao cấp.', '11:00', '22:00', '028 6789 0123', True),
            ('Lẩu Wang - Lẩu Đài Loan', '89 Hoàng Văn Thụ, Phú Nhuận, TP. Hồ Chí Minh', 'Phú Nhuận', 'hotpot', '200K - 500K', 4.3, 445, 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=600&h=400&fit=crop', 'Lẩu Đài Loan.', '10:00', '23:30', '028 7890 1234', False),
            ('The Grill Master Steakhouse', '67 Hai Bà Trưng, Quận 3, TP. Hồ Chí Minh', 'Quận 3', 'european', 'Trên 1M', 4.9, 198, 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=400&fit=crop', 'Steakhouse hàng đầu Sài Gòn.', '17:00', '23:00', '028 8901 2345', True),
        ]

        rest_objs = []
        for r in restaurants_data:
            h, m = r[9].split(':')
            ch, cm = r[10].split(':')
            obj = Restaurant.objects.create(
                manager=manager,
                cuisine=cuisine_map[r[3]],
                name=r[0], address=r[1], district=r[2],
                price_range=r[4], rating=r[5], review_count=r[6],
                image_url=r[7], description=r[8],
                open_time=time(int(h), int(m)),
                close_time=time(int(ch), int(cm)),
                phone=r[11], featured=r[12],
            )
            rest_objs.append(obj)

        self.stdout.write('Seeding bookings...')
        Booking.objects.create(
            restaurant=rest_objs[0], customer=customer1,
            date=date(2026, 2, 22), time=time(19, 0), guest_count=4,
            status='confirmed', contact_name='Nguyễn Văn A',
            contact_email='a@gmail.com', contact_phone='0901234567',
            note='Bàn gần cửa sổ',
        )
        Booking.objects.create(
            restaurant=rest_objs[0], customer=customer2,
            date=date(2026, 2, 22), time=time(18, 0), guest_count=2,
            status='pending', contact_name='Trần Thị B',
            contact_email='b@gmail.com', contact_phone='0912345678',
        )
        Booking.objects.create(
            restaurant=rest_objs[1], customer=None,
            date=date(2026, 2, 23), time=time(20, 0), guest_count=6,
            status='pending', contact_name='Lê Văn C',
            contact_email='c@gmail.com', contact_phone='0923456789',
            note='Sinh nhật, cần trang trí bàn',
        )

        self.stdout.write(self.style.SUCCESS('✅ Seed hoàn tất!'))
```

---

## 11. Cấu hình CORS + Settings

### `config/settings/base.py` (trích)

```python
import os
from pathlib import Path
from datetime import timedelta
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config('SECRET_KEY', default='change-me-in-production')
DEBUG = config('DEBUG', default=True, cast=bool)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',

    # Local apps
    'apps.accounts',
    'apps.restaurants',
    'apps.bookings',
    'apps.dashboard',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',      # ← PHẢI ĐẶT ĐẦU TIÊN
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Static files
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

AUTH_USER_MODEL = 'accounts.CustomUser'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 12,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='tablenow'),
        'USER': config('DB_USER', default='postgres'),
        'PASSWORD': config('DB_PASSWORD', default='postgres'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
]
CORS_ALLOW_CREDENTIALS = True
```

### `config/urls.py` (Root URLs)

```python
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/restaurants/', include('apps.restaurants.urls')),
    path('api/bookings/', include('apps.bookings.urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
]
```

### `apps/restaurants/urls.py`

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RestaurantViewSet

router = DefaultRouter()
router.register('', RestaurantViewSet, basename='restaurant')

urlpatterns = [
    path('', include(router.urls)),
]
```

### `apps/bookings/urls.py`

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BookingViewSet

router = DefaultRouter()
router.register('', BookingViewSet, basename='booking')

urlpatterns = [
    path('', include(router.urls)),
]
```

### `apps/dashboard/urls.py`

```python
from django.urls import path
from .views import ManagerStatsView, AdminStatsView

urlpatterns = [
    path('manager/', ManagerStatsView.as_view(), name='manager-stats'),
    path('admin/', AdminStatsView.as_view(), name='admin-stats'),
]
```

---

## 12. Deployment Plan

### Option A: VPS (Ubuntu) — Khuyến nghị cho DATN

```
┌─────────────────────────────────────────────────────┐
│                    Ubuntu VPS                        │
│                                                      │
│  ┌──────────┐   proxy    ┌────────────────────┐     │
│  │  Nginx   │ ─────────► │ Gunicorn (8000)    │     │
│  │  (80/443)│            │ Django WSGI         │     │
│  │          │            └────────┬───────────┘     │
│  │  static/ │                     │                  │
│  │  build/  │            ┌────────▼───────────┐     │
│  └──────────┘            │  PostgreSQL (5432) │     │
│       │                  └────────────────────┘     │
│       │ serves                                       │
│       ▼                                              │
│  React build output (npm run build)                  │
└─────────────────────────────────────────────────────┘
```

**Bước triển khai:**

1. **PostgreSQL**: `sudo apt install postgresql` → tạo DB `tablenow`
2. **Django**: Clone repo → `pip install -r requirements.txt` → migrate → seed
3. **Gunicorn**: `gunicorn config.wsgi:application --bind 0.0.0.0:8000`
4. **React build**: `npm run build` → copy `dist/` vào Nginx
5. **Nginx**: Serve static + proxy `/api/` → Gunicorn
6. **SSL**: Let's Encrypt (certbot)
7. **Systemd**: Tạo service cho Gunicorn

### Option B: Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: tablenow
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend-django
    command: gunicorn config.wsgi:application --bind 0.0.0.0:8000
    environment:
      - DB_HOST=db
      - DB_NAME=tablenow
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DEBUG=False
    depends_on:
      - db
    ports:
      - "8000:8000"

  frontend:
    build: ./frontend-react
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  pgdata:
```

### Option C: Cloud PaaS

| Service | Frontend | Backend | Database |
|---------|----------|---------|----------|
| Railway | ✅ | ✅ | PostgreSQL addon |
| Render | Static site | Web service | PostgreSQL |
| Vercel + Railway | Vercel | Railway | Railway PG |
| Fly.io | CDN | Fly app | Fly PG |

---

## 13. Thứ tự triển khai (Step by step)

### Phase 1: Setup dự án (30 phút)
```bash
# 1. Tạo virtual environment
cd c:\Users\Hoang Minh\DATN\backend-django
python -m venv venv
venv\Scripts\activate

# 2. Install packages
pip install django djangorestframework djangorestframework-simplejwt
pip install django-cors-headers django-filter psycopg2-binary
pip install python-decouple pillow gunicorn whitenoise
pip install djangorestframework-camel-case  # Optional: auto camelCase

# 3. Tạo Django project
django-admin startproject config .

# 4. Tạo apps
mkdir apps
python manage.py startapp accounts apps/accounts
python manage.py startapp restaurants apps/restaurants
python manage.py startapp bookings apps/bookings
python manage.py startapp dashboard apps/dashboard

# 5. Tạo .env
echo SECRET_KEY=your-secret-key-here > .env
echo DB_NAME=tablenow >> .env
echo DB_USER=postgres >> .env
echo DB_PASSWORD=your-password >> .env
```

### Phase 2: Models + Migrations (30 phút)
```bash
# 1. Viết models (CustomUser, CuisineType, Restaurant, Booking)
# 2. Cấu hình AUTH_USER_MODEL trong settings
# 3. Tạo + chạy migrations
python manage.py makemigrations
python manage.py migrate
```

### Phase 3: Serializers + Views + URLs (1 giờ)
```bash
# 1. Viết serializers cho mỗi app
# 2. Viết ViewSets
# 3. Cấu hình URLs
# 4. Test bằng Django REST Framework browsable API
```

### Phase 4: Auth + Permissions (30 phút)
```bash
# 1. Cấu hình SimpleJWT
# 2. Viết Register/Login views
# 3. Viết custom permissions
# 4. Test auth flow
```

### Phase 5: Seed Data (15 phút)
```bash
# 1. Viết management command
# 2. Chạy seed
python manage.py seed
```

### Phase 6: Kết nối Frontend (1 giờ)
```bash
# 1. Cài axios trong frontend
cd ../frontend-react
npm install axios

# 2. Tạo AuthContext + ProtectedRoute
# 3. Thay api.ts mock → axios calls
# 4. Test toàn bộ flow
```

### Phase 7: Deploy (1-2 giờ)
```bash
# 1. Chọn platform (VPS/Docker/Railway)
# 2. Build frontend: npm run build
# 3. Cấu hình production settings
# 4. Deploy + SSL
```

---

## 📝 Tổng kết

| Hạng mục | Công nghệ | Trạng thái |
|----------|-----------|------------|
| Frontend | React + TS + Vite | ✅ Hoàn thành |
| Backend Framework | Django 5.1 + DRF | 📋 Có kế hoạch |
| Database | PostgreSQL 16 | 📋 Có kế hoạch |
| Authentication | JWT (SimpleJWT) | 📋 Có kế hoạch |
| API Design | RESTful, 15+ endpoints | 📋 Có kế hoạch |
| Deployment | VPS/Docker/Railway | 📋 Có kế hoạch |

**Tổng thời gian ước tính**: 4-5 giờ (từ setup → deploy)

**Sẵn sàng triển khai? Chạy lệnh**: `python manage.py seed` sẽ tạo đầy đủ 8 nhà hàng, 4 users, 3 bookings — giống hệt mock data frontend hiện tại.
