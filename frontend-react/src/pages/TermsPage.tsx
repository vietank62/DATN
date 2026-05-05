import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './LegalPage.module.css';

const sections = [
  {
    id: 'acceptance',
    icon: '✅',
    title: '1. Chấp nhận điều khoản',
    content: `Bằng cách truy cập và sử dụng nền tảng TableNow, bạn xác nhận rằng bạn đã đọc, hiểu và đồng ý bị ràng buộc bởi các Điều khoản Sử dụng này. Nếu bạn không đồng ý với bất kỳ điều khoản nào, vui lòng không sử dụng dịch vụ của chúng tôi.

Chúng tôi có quyền cập nhật các điều khoản này vào bất kỳ lúc nào. Việc tiếp tục sử dụng dịch vụ sau khi có thay đổi đồng nghĩa với việc bạn chấp nhận các điều khoản mới.`,
  },
  {
    id: 'service',
    icon: '🍽️',
    title: '2. Mô tả dịch vụ',
    content: `TableNow là nền tảng đặt bàn nhà hàng trực tuyến, kết nối thực khách với các nhà hàng trên toàn quốc. Các dịch vụ bao gồm:

• Tìm kiếm và khám phá nhà hàng theo khu vực, loại ẩm thực, giá cả
• Đặt bàn trực tuyến theo thời gian thực
• Xem và đánh giá nhà hàng
• Quản lý lịch sử đặt bàn cá nhân
• Công cụ quản lý dành cho chủ nhà hàng

Chúng tôi đóng vai trò trung gian và không chịu trách nhiệm trực tiếp về chất lượng dịch vụ của từng nhà hàng.`,
  },
  {
    id: 'account',
    icon: '👤',
    title: '3. Tài khoản người dùng',
    content: `Để sử dụng đầy đủ tính năng của TableNow, bạn cần tạo tài khoản. Khi đăng ký, bạn đồng ý:

• Cung cấp thông tin chính xác, đầy đủ và cập nhật
• Bảo mật thông tin đăng nhập và không chia sẻ với người khác
• Chịu trách nhiệm với mọi hoạt động xảy ra trên tài khoản của bạn
• Thông báo ngay cho chúng tôi nếu phát hiện truy cập trái phép

Mỗi người dùng chỉ được tạo một tài khoản. Chúng tôi có quyền tạm ngừng hoặc chấm dứt tài khoản vi phạm các điều khoản này.`,
  },
  {
    id: 'booking',
    icon: '📋',
    title: '4. Quy định đặt bàn',
    content: `Khi thực hiện đặt bàn qua TableNow:

• Thông tin đặt bàn (ngày, giờ, số lượng khách) phải chính xác
• Bạn có trách nhiệm đến đúng giờ đã đặt hoặc hủy trước thời hạn quy định
• Nhà hàng có quyền từ chối phục vụ nếu bạn đến trễ quá 30 phút mà không thông báo
• TableNow không đảm bảo 100% tính khả dụng của chỗ ngồi trong mọi trường hợp

Xem thêm tại trang Chính sách huỷ bàn để biết chi tiết về các trường hợp huỷ và hoàn tiền.`,
  },
  {
    id: 'conduct',
    icon: '🤝',
    title: '5. Quy tắc ứng xử',
    content: `Người dùng đồng ý không thực hiện các hành vi sau:

• Đăng thông tin sai lệch, gian lận hoặc gây hiểu nhầm
• Gửi đánh giá giả mạo hoặc có động cơ thương mại
• Sử dụng dịch vụ cho mục đích bất hợp pháp
• Can thiệp vào hệ thống hoặc cơ sở hạ tầng của TableNow
• Thu thập thông tin người dùng khác trái phép
• Quấy rối hoặc đe dọa nhà hàng, người dùng khác

Vi phạm các quy tắc này có thể dẫn đến tạm khóa hoặc xóa tài khoản vĩnh viễn.`,
  },
  {
    id: 'intellectual',
    icon: '©️',
    title: '6. Quyền sở hữu trí tuệ',
    content: `Tất cả nội dung trên TableNow, bao gồm logo, thiết kế, văn bản, hình ảnh và phần mềm, đều thuộc quyền sở hữu của TableNow hoặc các đối tác được cấp phép. Nghiêm cấm sao chép, phân phối hoặc sử dụng cho mục đích thương mại mà không có sự đồng ý bằng văn bản.

Khi bạn đăng nội dung (đánh giá, hình ảnh...) lên TableNow, bạn cấp cho chúng tôi quyền sử dụng, hiển thị và phân phối nội dung đó trên nền tảng.`,
  },
  {
    id: 'liability',
    icon: '⚖️',
    title: '7. Giới hạn trách nhiệm',
    content: `TableNow được cung cấp theo nguyên tắc "nguyên trạng". Chúng tôi không đảm bảo dịch vụ luôn hoạt động liên tục, không có lỗi hay bảo mật tuyệt đối.

Trong phạm vi tối đa được pháp luật cho phép, TableNow không chịu trách nhiệm cho các thiệt hại gián tiếp, ngẫu nhiên phát sinh từ việc sử dụng hoặc không thể sử dụng dịch vụ, bao gồm nhưng không giới hạn ở mất doanh thu, mất dữ liệu.`,
  },
  {
    id: 'termination',
    icon: '🚫',
    title: '8. Chấm dứt dịch vụ',
    content: `Bạn có thể ngừng sử dụng dịch vụ bất kỳ lúc nào bằng cách xóa tài khoản.

TableNow có quyền tạm ngừng hoặc chấm dứt quyền truy cập của bạn nếu phát hiện vi phạm điều khoản, gian lận hoặc hành vi gây hại đến nền tảng và cộng đồng người dùng mà không cần thông báo trước.`,
  },
  {
    id: 'contact',
    icon: '📧',
    title: '9. Liên hệ',
    content: `Nếu bạn có câu hỏi về Điều khoản Sử dụng, vui lòng liên hệ:

• Email: legal@tablenow.vn
• Hotline: 1900 1234
• Địa chỉ: Tầng 10, Tòa nhà ABC, 123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh
• Giờ làm việc: Thứ 2 – Thứ 6, 8:00 – 17:30`,
  },
];

const TermsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.heroTag}>📄 Pháp lý</span>
          <h1>Điều khoản Sử dụng</h1>
          <p>Cập nhật lần cuối: 01/05/2026 • Hiệu lực từ: 01/05/2026</p>
        </div>
      </div>

      <div className={styles.container}>
        <div className={styles.layout}>
          {/* Sidebar TOC */}
          <aside className={styles.toc}>
            <div className={styles.tocCard}>
              <h3>Mục lục</h3>
              <ul>
                {sections.map(s => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className={activeSection === s.id ? styles.tocActive : ''}
                      onClick={() => setActiveSection(s.id)}
                    >
                      {s.icon} {s.title.replace(/^\d+\.\s/, '')}
                    </a>
                  </li>
                ))}
              </ul>
              <div className={styles.tocLinks}>
                <Link to="/privacy">🔒 Chính sách bảo mật</Link>
                <Link to="/cancellation">❌ Chính sách huỷ bàn</Link>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className={styles.content}>
            <div className={styles.intro}>
              <p>
                Chào mừng bạn đến với <strong>TableNow</strong>. Vui lòng đọc kỹ các điều khoản
                sử dụng dưới đây trước khi sử dụng dịch vụ của chúng tôi.
              </p>
            </div>

            {sections.map(s => (
              <section key={s.id} id={s.id} className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionIcon}>{s.icon}</span>
                  <h2>{s.title}</h2>
                </div>
                <div className={styles.sectionBody}>
                  {s.content.split('\n\n').map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </section>
            ))}
          </main>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
