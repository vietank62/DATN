import { ChevronLeft, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

const policySections = [
  {
    title: "1. Điều kiện hợp tác",
    content: "Đối tác cam kết cung cấp thông tin nhà hàng, giấy phép kinh doanh và mã số thuế chính xác, hợp pháp và còn hiệu lực.",
  },
  {
    title: "2. Quy trình xét duyệt",
    content: "Hồ sơ mới hoặc các thay đổi về thông tin quan trọng sẽ được TableNow xét duyệt. Trong thời gian chờ duyệt, nhà hàng không hiển thị công khai với khách hàng.",
  },
  {
    title: "3. Nội dung vận hành",
    content: "Đối tác chịu trách nhiệm về thực đơn, giá bán, sức chứa, khung giờ nhận khách, ưu đãi và thông tin được công bố trên trang nhà hàng.",
  },
  {
    title: "4. Quản lý đặt bàn",
    content: "Đối tác cần cập nhật tình trạng đơn đặt bàn kịp thời và bảo đảm khả năng phục vụ theo số chỗ còn lại trong từng khung giờ.",
  },
  {
    title: "5. Bảo mật và tuân thủ",
    content: "Đối tác không được sử dụng dữ liệu khách hàng cho mục đích ngoài việc phục vụ đơn đặt bàn và phải tuân thủ pháp luật hiện hành.",
  },
];

export default function PartnerPolicy() {
  const navigate = useNavigate();

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition hover:text-red-600"
      >
        <ChevronLeft className="h-4 w-4" />
        Quay lại
      </button>

      <article className="mt-6 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
        <header className="bg-linear-to-br from-red-500 to-amber-600 px-6 py-8 text-white sm:px-10">
          <ShieldCheck className="h-9 w-9" />
          <h1 className="mt-4 text-3xl font-black">Chính sách đối tác TableNow</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/85">
            Quy định cơ bản áp dụng khi nhà hàng đăng ký và vận hành trên nền tảng.
          </p>
        </header>

        <div className="space-y-6 px-6 py-8 sm:px-10">
          {policySections.map((section) => (
            <section key={section.title}>
              <h2 className="text-base font-bold text-gray-900">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">{section.content}</p>
            </section>
          ))}

          <p className="border-t border-gray-100 pt-5 text-xs leading-5 text-gray-500">
            Bằng việc đánh dấu đồng ý và gửi hồ sơ, đối tác xác nhận đã đọc, hiểu và chấp thuận chính sách này.
          </p>
        </div>
      </article>
    </section>
  );
}
