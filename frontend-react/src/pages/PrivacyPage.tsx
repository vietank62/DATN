import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './LegalPage.module.css';

const sections = [
  {
    id: 'overview',
    icon: '🔒',
    title: '1. Tổng quan',
    content: `TableNow cam kết bảo vệ quyền riêng tư của bạn. Chính sách Bảo mật này giải thích cách chúng tôi thu thập, sử dụng, tiết lộ và bảo vệ thông tin cá nhân khi bạn sử dụng nền tảng đặt bàn của chúng tôi.

Bằng cách sử dụng dịch vụ TableNow, bạn đồng ý với việc thu thập và sử dụng thông tin theo chính sách này. Nếu bạn không đồng ý, vui lòng không sử dụng dịch vụ của chúng tôi.`,
  },
  {
    id: 'collection',
    icon: '📥',
    title: '2. Thông tin chúng tôi thu thập',
    content: `Chúng tôi thu thập các loại thông tin sau:

**Thông tin bạn cung cấp trực tiếp:**
• Họ tên, địa chỉ email, số điện thoại khi đăng ký tài khoản
• Thông tin đặt bàn: ngày, giờ, số lượng khách, ghi chú đặc biệt
• Đánh giá và nhận xét về nhà hàng
• Thông tin liên lạc khi bạn liên hệ với chúng tôi

**Thông tin thu thập tự động:**
• Dữ liệu sử dụng: trang đã truy cập, thời gian xem, hành động thực hiện
• Thông tin thiết bị: loại trình duyệt, hệ điều hành, địa chỉ IP
• Cookie và công nghệ theo dõi tương tự

**Thông tin từ bên thứ ba:**
• Dữ liệu xác thực nếu bạn đăng nhập bằng mạng xã hội (Google, Facebook)`,
  },
  {
    id: 'usage',
    icon: '🎯',
    title: '3. Cách chúng tôi sử dụng thông tin',
    content: `Chúng tôi sử dụng thông tin thu thập được để:

• Cung cấp, vận hành và cải thiện dịch vụ TableNow
• Xử lý và xác nhận đặt bàn của bạn
• Gửi thông báo quan trọng liên quan đến đặt bàn
• Cá nhân hóa trải nghiệm và đề xuất nhà hàng phù hợp
• Phân tích xu hướng sử dụng để cải thiện tính năng
• Gửi thông tin khuyến mãi (nếu bạn đã đăng ký nhận)
• Phát hiện và ngăn chặn gian lận, bảo đảm an toàn hệ thống
• Tuân thủ các nghĩa vụ pháp lý`,
  },
  {
    id: 'sharing',
    icon: '🤝',
    title: '4. Chia sẻ thông tin',
    content: `Chúng tôi không bán thông tin cá nhân của bạn. Chúng tôi chỉ chia sẻ thông tin trong các trường hợp:

**Với nhà hàng đối tác:** Khi bạn thực hiện đặt bàn, thông tin liên lạc cơ bản (tên, điện thoại) sẽ được chia sẻ với nhà hàng để xác nhận và chuẩn bị.

**Với nhà cung cấp dịch vụ:** Các đối tác kỹ thuật hỗ trợ vận hành hệ thống (lưu trữ đám mây, thanh toán, phân tích) cam kết bảo mật theo tiêu chuẩn của chúng tôi.

**Theo yêu cầu pháp lý:** Khi có lệnh của cơ quan có thẩm quyền hoặc cần thiết để bảo vệ quyền lợi hợp pháp của chúng tôi.

**Chuyển nhượng doanh nghiệp:** Trong trường hợp sáp nhập hoặc mua lại, thông tin người dùng có thể được chuyển giao và sẽ được thông báo trước.`,
  },
  {
    id: 'cookies',
    icon: '🍪',
    title: '5. Cookie và công nghệ theo dõi',
    content: `Chúng tôi sử dụng cookie và các công nghệ tương tự để:

• Ghi nhớ đăng nhập và tùy chỉnh cài đặt của bạn
• Phân tích lưu lượng truy cập và hành vi người dùng
• Cung cấp tính năng mạng xã hội và quảng cáo liên quan

**Các loại cookie chúng tôi sử dụng:**
• Cookie thiết yếu: cần thiết để trang web hoạt động
• Cookie phân tích: giúp chúng tôi hiểu cách người dùng sử dụng dịch vụ
• Cookie tiếp thị: hiển thị quảng cáo phù hợp

Bạn có thể kiểm soát cookie thông qua cài đặt trình duyệt. Tuy nhiên, tắt cookie có thể ảnh hưởng đến một số tính năng.`,
  },
  {
    id: 'security',
    icon: '🛡️',
    title: '6. Bảo mật dữ liệu',
    content: `Chúng tôi áp dụng các biện pháp bảo mật kỹ thuật và tổ chức phù hợp để bảo vệ thông tin của bạn:

• Mã hóa SSL/TLS cho tất cả dữ liệu truyền tải
• Mã hóa mật khẩu bằng thuật toán Argon2
• Kiểm soát truy cập nội bộ nghiêm ngặt
• Giám sát hệ thống 24/7
• Kiểm tra bảo mật định kỳ

Tuy nhiên, không có phương pháp truyền tải qua internet nào là hoàn toàn an toàn. Chúng tôi sẽ thông báo kịp thời nếu xảy ra sự cố bảo mật ảnh hưởng đến dữ liệu của bạn.`,
  },
  {
    id: 'rights',
    icon: '⚖️',
    title: '7. Quyền của bạn',
    content: `Bạn có các quyền sau đối với dữ liệu cá nhân:

• **Quyền truy cập:** Yêu cầu bản sao thông tin cá nhân chúng tôi đang lưu trữ
• **Quyền chỉnh sửa:** Cập nhật thông tin không chính xác qua trang Hồ sơ cá nhân
• **Quyền xóa:** Yêu cầu xóa tài khoản và dữ liệu liên quan
• **Quyền phản đối:** Phản đối một số hoạt động xử lý dữ liệu nhất định
• **Quyền hạn chế:** Yêu cầu hạn chế xử lý trong một số trường hợp
• **Quyền di chuyển dữ liệu:** Nhận dữ liệu ở định dạng có thể đọc được

Để thực hiện các quyền này, vui lòng liên hệ: privacy@tablenow.vn`,
  },
  {
    id: 'retention',
    icon: '🗄️',
    title: '8. Lưu trữ dữ liệu',
    content: `Chúng tôi lưu trữ dữ liệu cá nhân của bạn trong thời gian cần thiết để cung cấp dịch vụ và tuân thủ nghĩa vụ pháp lý:

• Dữ liệu tài khoản: trong suốt thời gian tài khoản hoạt động
• Lịch sử đặt bàn: 3 năm kể từ ngày đặt
• Cookie phân tích: tối đa 2 năm
• Nhật ký hệ thống: tối đa 90 ngày

Sau khi bạn xóa tài khoản, chúng tôi sẽ xóa hoặc ẩn danh hóa dữ liệu trong vòng 30 ngày, trừ trường hợp pháp luật yêu cầu lưu trữ lâu hơn.`,
  },
  {
    id: 'contact',
    icon: '📧',
    title: '9. Liên hệ về bảo mật',
    content: `Nếu bạn có câu hỏi hoặc khiếu nại về Chính sách Bảo mật này:

• Email: privacy@tablenow.vn
• Hotline bảo mật: 1900 5678
• Địa chỉ: Tầng 10, Tòa nhà ABC, 123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh

Chúng tôi cam kết phản hồi trong vòng 5 ngày làm việc kể từ khi nhận được yêu cầu.`,
  },
];

const PrivacyPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  return (
    <div className={styles.page}>
      <div className={`${styles.hero} ${styles.heroPrivacy}`}>
        <div className={styles.heroContent}>
          <span className={styles.heroTag}>🔒 Bảo mật</span>
          <h1>Chính sách Bảo mật</h1>
          <p>Cập nhật lần cuối: 01/05/2026 • Hiệu lực từ: 01/05/2026</p>
        </div>
      </div>

      <div className={styles.container}>
        <div className={styles.layout}>
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
                <Link to="/terms">📄 Điều khoản sử dụng</Link>
                <Link to="/cancellation">❌ Chính sách huỷ bàn</Link>
              </div>
            </div>
          </aside>

          <main className={styles.content}>
            <div className={styles.intro}>
              <p>
                Tại <strong>TableNow</strong>, chúng tôi coi trọng quyền riêng tư của bạn và cam kết
                bảo vệ thông tin cá nhân theo tiêu chuẩn cao nhất.
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

export default PrivacyPage;
