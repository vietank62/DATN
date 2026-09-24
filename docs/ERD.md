# ERD hệ thống TableNow

Tài liệu này phản ánh schema ở Alembic head `c1d2e3f4a5b6` và các model trong `backend-python/models`. Dùng sơ đồ dưới đây làm cơ sở để vẽ ERD trong đồ án.

```mermaid
erDiagram
    USER ||--o{ BOOKING : creates
    RESTAURANTS ||--o{ BOOKING : receives
    RESTAURANTS ||--|| RESTAURANT_DETAILS : has
    RESTAURANTS ||--o{ RESTAURANT_MENU_LISTS : publishes
    BOOKING ||--o{ BOOKINGITEM : contains
    RESTAURANT_MENU_LISTS ||--o{ BOOKINGITEM : selected_as
    USER ||--o{ FAVORITE : saves
    RESTAURANTS ||--o{ FAVORITE : is_saved
    USER ||--o{ REVIEW : writes
    RESTAURANTS ||--o{ REVIEW : receives
    BOOKING ||--o| REVIEW : permits
    BOOKING ||--o{ DEPOSIT_PAYMENTS : has
    RESTAURANTS ||--o{ DEPOSIT_PAYMENTS : receives
    USER ||--o{ DEPOSIT_PAYMENTS : pays
    BOOKING ||--o{ DEPOSIT_CHECKOUTS : creates
    BOOKING ||--o| DEPOSIT_REFUNDS : may_create
    DEPOSIT_PAYMENTS ||--o| DEPOSIT_REFUNDS : refunds
    USER ||--o{ DEPOSIT_REFUNDS : receives
    RESTAURANTS ||--o{ WITHDRAWAL_REQUESTS : requests
    USER ||--o{ WITHDRAWAL_REQUESTS : processes
    BOOKING ||--o{ BOOKING_FEES : generates
    RESTAURANTS ||--o{ BOOKING_FEES : owes
    BOOKING ||--o{ BOOKING_EMAILS : sends
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ CONVERSATIONS : starts
    RESTAURANTS ||--o{ CONVERSATIONS : participates
    CONVERSATIONS ||--o{ CHAT_MESSAGES : contains
    USER ||--o{ CHAT_MESSAGES : sends
    BOOKING ||--o{ VIOLATION_REPORTS : concerns
    USER ||--o{ VIOLATION_REPORTS : reports_or_is_reported
    RESTAURANTS ||--o{ VIOLATION_REPORTS : may_be_reported
    RESTAURANTS ||--o{ APPROVAL_HISTORIES : changes
    USER ||--o{ APPROVAL_HISTORIES : manages_or_reviews
    USER ||--o| CUSTOMER_PREFERENCES : configures

    USER {
      int userId PK
      string email UK
      string role
      boolean is_suspended
    }
    RESTAURANTS {
      int id PK
      int manager_id FK
      string name
      string approval_status
      boolean is_active
    }
    BOOKING {
      int bookingId PK
      int userId FK
      int restaurantId FK
      string status
      int requestSeats
      int depositAmount
      string depositStatus
    }
    RESTAURANT_MENU_LISTS {
      int id PK
      int restaurant_id FK
      string name
      float price
    }
    BOOKINGITEM {
      int bookingItemId PK
      int bookingId FK
      int itemId FK
      int quantity
    }
    REVIEW {
      int reviewId PK
      int userId FK
      int restaurantId FK
      int bookingId FK
      int rating
    }
    DEPOSIT_PAYMENTS {
      int id PK
      int booking_id FK
      int restaurant_id FK
      int user_id FK
      int amount
      string status
    }
    DEPOSIT_CHECKOUTS {
      int id PK
      int booking_id FK
      string invoice_number UK
      string status
    }
    DEPOSIT_REFUNDS {
      int id PK
      int booking_id FK
      int deposit_payment_id FK
      int customer_id FK
      int processed_by FK
      string status
    }
    CONVERSATIONS {
      int id PK
      int customer_id FK
      int restaurant_id FK
    }
    CHAT_MESSAGES {
      int id PK
      int conversation_id FK
      int sender_id FK
    }
    VIOLATION_REPORTS {
      int id PK
      int booking_id FK
      int reporter_id FK
      int target_user_id FK
      int target_restaurant_id FK
      int admin_id FK
    }
```

## Nhóm bảng

| Nhóm | Bảng |
|---|---|
| Tài khoản và sở thích | `user`, `customer_preferences`, `favorite`, `notification` |
| Nhà hàng và thực đơn | `restaurants`, `restaurant_details`, `restaurant_menu_lists`, `approval_histories` |
| Đặt bàn | `booking`, `bookingitem`, `booking_emails`, `booking_fees`, `review` |
| Thanh toán | `payment`, `deposit_payments`, `deposit_checkouts`, `deposit_refunds`, `withdrawal_requests` |
| Trao đổi và xử lý vi phạm | `conversations`, `chat_messages`, `violation_reports` |

## Quy ước khi vẽ

- `user` là thực thể chung cho khách hàng, quản lý nhà hàng và quản trị viên; phân biệt bằng cột `role`.
- `booking` là trung tâm nghiệp vụ; một booking có thể chọn nhiều món qua `bookingitem`.
- `review` chỉ hợp lệ sau booking hoàn thành và chỉ một lần cho mỗi booking.
- `customer_preferences.user_id`, `notification.bookingId` và `notification.conversationId` là quan hệ nghiệp vụ được ứng dụng duy trì. Khi vẽ ERD, thể hiện chúng bằng đường quan hệ nét đứt nếu muốn phân biệt với foreign key vật lý.
- Một số quan hệ thanh toán là 0..1 theo quy tắc nghiệp vụ (ví dụ booking không yêu cầu cọc sẽ không có `deposit_payments`).