"""Website chatbot gateway backed by the same read-only tools exposed through MCP."""


from fastapi import APIRouter
from pydantic import BaseModel, Field

from core.public_restaurants import find_public_restaurants
from core.assistant_intent import parse_restaurant_request, fold


router = APIRouter(prefix="/v1/assistant", tags=["Assistant"])


class AssistantMessage(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    city: str | None = Field(default=None, max_length=100)


class AssistantReply(BaseModel):
    message: str
    restaurants: list[dict] = Field(default_factory=list)


@router.post("/chat", response_model=AssistantReply)
def chat_with_assistant(payload: AssistantMessage) -> AssistantReply:
    message = fold(payload.message)
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
    intent = parse_restaurant_request(payload.message, payload.city)
    if intent.question:
        return AssistantReply(message=intent.question)
    restaurants = find_public_restaurants(**intent.filters, limit=4)
    criteria = "; ".join(intent.labels)
    if restaurants:
        message = f"Mình tìm được {len(restaurants)} nhà hàng theo tiêu chí: {criteria}. Bạn bấm vào nhà hàng để xem chi tiết nhé."
    else:
        message = f"Mình chưa tìm thấy nhà hàng đáp ứng đồng thời: {criteria}. Bạn có thể đổi khu vực hoặc điều chỉnh ngân sách."
    if intent.notes:
        message += " " + " ".join(dict.fromkeys(intent.notes))
    return AssistantReply(message=message, restaurants=restaurants)
