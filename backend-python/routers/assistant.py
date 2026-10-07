"""Website chatbot gateway backed by the same read-only tools exposed through MCP."""

import re
from datetime import datetime, timedelta


from fastapi import APIRouter
from pydantic import BaseModel, Field

from core.public_restaurants import find_available_public_restaurants, find_public_restaurants, get_public_restaurant_menu
from core.assistant_intent import parse_booking_slot, parse_restaurant_request, fold
from core.assistant_llm import extract_llm_filters
from core.booking_capacity import APP_TIME_ZONE


router = APIRouter(prefix="/v1/assistant", tags=["Assistant"])


class AssistantMessage(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    city: str | None = Field(default=None, max_length=100)
    # Recent user messages allow natural follow-up questions such as
    # "ở Quận 1, 6 người" after asking for a buffet restaurant.
    history: list[str] = Field(default_factory=list, max_length=5)


class AssistantReply(BaseModel):
    message: str
    restaurants: list[dict] = Field(default_factory=list)
    menu: dict | None = None


def menu_restaurant_name(message: str) -> str | None:
    """Extract the restaurant name from a direct Vietnamese menu request."""
    text = fold(message)
    match = re.search(r"(?:xem\s+)?(?:menu|thuc don)\s+(?:cua\s+)?(?:(?:nha hang|quan)\s+)?(.+)$", text)
    if not match:
        return None
    candidate = match.group(1).strip(" .?!")
    return candidate if len(candidate) >= 2 else None


@router.post("/chat", response_model=AssistantReply)
def chat_with_assistant(payload: AssistantMessage) -> AssistantReply:
    message = fold(payload.message)
    requested_menu_for = menu_restaurant_name(payload.message)
    if requested_menu_for:
        matches = find_public_restaurants(keyword=requested_menu_for, limit=2)
        if not matches:
            return AssistantReply(
                message="Mình chưa tìm thấy nhà hàng này. Bạn kiểm tra lại tên nhà hàng hoặc chọn nhà hàng từ kết quả tìm kiếm nhé."
            )
        if len(matches) > 1:
            return AssistantReply(
                message="Mình tìm thấy vài nhà hàng có tên gần giống. Bạn chọn đúng nhà hàng để xem thực đơn nhé.",
                restaurants=matches,
            )
        menu = get_public_restaurant_menu(matches[0]["id"])
        if not menu.get("found"):
            return AssistantReply(message=menu["message"])
        if not menu["dishes"]:
            return AssistantReply(
                message=f"{menu['restaurant_name']} chưa có món ăn đang hiển thị.",
                restaurants=matches,
            )
        return AssistantReply(
            message=f"Đây là một số món đang có tại {menu['restaurant_name']}. Bạn có thể mở nhà hàng để xem toàn bộ thực đơn.",
            restaurants=matches,
            menu=menu,
        )
    policies = [
        (("hoan coc", "hoan tien"), "Khi đủ điều kiện hoàn cọc, bạn nhận thông báo và mở đơn đặt bàn để cung cấp ngân hàng, số tài khoản, tên chủ tài khoản rồi xác nhận. Bạn có thể xem tiến trình và minh chứng chuyển tiền ngay trên đơn."),
        (("huy ban", "huy don", "huy dat"), "Chưa xác nhận: bạn có thể tự huỷ trên đơn. Đã xác nhận: gửi yêu cầu huỷ kèm lý do trước ít nhất 1 giờ; nhà hàng chấp nhận thì hoàn cọc. Còn dưới 1 giờ, hãy nhắn tin hoặc gọi hotline nhà hàng. Nếu nhà hàng từ chối, đơn vẫn đã xác nhận và cọc được giữ lại."),
        (("dat coc", "thanh toan", "ma qr"), "Nhà hàng có yêu cầu cọc: bạn có 30 phút để thanh toán. Mỗi phiên QR tồn tại tối đa 10 phút và không vượt thời gian còn lại. Đơn chỉ chuyển sang chờ xác nhận khi hệ thống nhận giao dịch thành công; không cần chuyển thêm nếu giao dịch đang đối soát."),
        (("danh gia",), "Bạn được đánh giá một lần cho mỗi đơn đã hoàn thành, tại trang chi tiết đơn đặt bàn."),
        (("qua han", "xac nhan"), "Nhà hàng phải xác nhận trước giờ dùng bữa 2 giờ. Đơn chưa được phản hồi đúng hạn sẽ quá hạn và cọc đã thanh toán được đưa vào quy trình hoàn lại."),
        (("bao cao", "report"), "Bạn có thể báo cáo đối phương từ đơn đã xác nhận hoặc hoàn thành. Nhà hàng bị báo cáo sẽ tạm ngưng và phải gửi giải trình để admin duyệt. Khách bị báo cáo quá 3 lần trong một tháng sẽ bị cấm vĩnh viễn."),
        (("cach dat ban", "huong dan dat ban"), "Đặt bàn gồm: chọn người lớn, trẻ em, ngày giờ; nhập họ tên, email, điện thoại; chọn món và ghi chú; thanh toán cọc nếu nhà hàng yêu cầu. Nếu không có cọc, đơn hoàn tất sau bước chọn món và chờ nhà hàng xác nhận."),
    ]
    for terms, answer in policies:
        if any(term in message for term in terms):
            return AssistantReply(message=answer)
    recent_context = [item.strip() for item in payload.history[-5:]
                      if isinstance(item, str) and item.strip()]
    # Do not concatenate raw history: two messages such as "dưới 300k" then
    # "dưới 500k" would otherwise look like one contradictory request. A
    # complete new search (one with a keyword) intentionally starts fresh;
    # short follow-ups inherit prior filters and override matching fields.
    intent = parse_restaurant_request(payload.message, payload.city)
    # A recognised cuisine category is also a complete new search. Without
    # this check, "quán nướng Nhật..." could inherit an unrelated keyword
    # from an earlier chat turn and make the query impossible to satisfy.
    if recent_context and not any(intent.filters.get(key) for key in ("keyword", "category")):
        inherited_filters: dict = {}
        inherited_labels: list[str] = []
        inherited_notes: list[str] = []
        for previous_message in recent_context:
            previous = parse_restaurant_request(previous_message, payload.city)
            if previous.question:
                continue
            inherited_filters.update(previous.filters)
            inherited_labels.extend(previous.labels)
            inherited_notes.extend(previous.notes)
        if inherited_filters:
            inherited_filters.update(intent.filters)
            intent.filters = inherited_filters
            intent.labels = list(dict.fromkeys([*inherited_labels, *intent.labels]))
            intent.notes = list(dict.fromkeys([*inherited_notes, *intent.notes]))
            intent.question = None
    llm_filters = extract_llm_filters(payload.message, recent_context)
    if llm_filters:
        # A recognised category (for example "nướng Nhật" -> mon-nhat) is
        # more reliable than a free-text LLM keyword and must not be narrowed
        # away by a different spelling such as "Japanese grill".
        if intent.filters.get("category"):
            llm_filters.pop("keyword", None)
        intent.filters.update(llm_filters)
        intent.question = None
        for value in (llm_filters.get("keyword"), llm_filters.get("district"), llm_filters.get("city")):
            if value and value not in intent.labels:
                intent.labels.append(str(value))
    if intent.question:
        return AssistantReply(message=intent.question)
    slot = parse_booking_slot(payload.message, datetime.now(APP_TIME_ZONE).replace(tzinfo=None))
    seats = intent.filters.get("party_size")
    if slot and isinstance(seats, int):
        date, time = slot
        meal_time = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M").replace(tzinfo=APP_TIME_ZONE)
        if meal_time < datetime.now(APP_TIME_ZONE) + timedelta(hours=2):
            return AssistantReply(message="Khung giờ đặt bàn cần cách thời điểm hiện tại ít nhất 2 tiếng. Bạn chọn giờ khác giúp mình nhé.")
        restaurants = find_available_public_restaurants(date=date, time=time, seats=seats, **intent.filters)
        criteria = "; ".join(intent.labels)
        if restaurants:
            return AssistantReply(
                message=(f"Mình đã kiểm tra chỗ trống cho {seats} người lúc {time}, ngày {date} theo tiêu chí: {criteria}. "
                         "Bấm vào nhà hàng để tiếp tục đặt bàn; nếu nhà hàng yêu cầu cọc, hệ thống sẽ hiển thị QR thanh toán ở bước đặt bàn."),
                restaurants=restaurants,
            )
        return AssistantReply(
            message=(f"Mình chưa tìm thấy nhà hàng còn đủ {seats} chỗ lúc {time}, ngày {date} theo tiêu chí: {criteria}. "
                     "Bạn có thể đổi giờ, khu vực hoặc điều chỉnh món ăn."),
        )
    restaurants = find_public_restaurants(**intent.filters, limit=4)
    criteria = "; ".join(intent.labels)
    if restaurants:
        message = f"Mình tìm được {len(restaurants)} nhà hàng theo tiêu chí: {criteria}. Bạn bấm vào nhà hàng để xem chi tiết nhé."
    else:
        message = f"Mình chưa tìm thấy nhà hàng đáp ứng đồng thời: {criteria}. Bạn có thể đổi khu vực hoặc điều chỉnh ngân sách."
    if intent.notes:
        message += " " + " ".join(dict.fromkeys(intent.notes))
    return AssistantReply(message=message, restaurants=restaurants)
