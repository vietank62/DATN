import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './LegalPage.module.css';

const tiers = [
  {
    time: '> 24 giờ',
    color: '#2e7d32',
    bg: '#e8f5e9',
    label: 'Miễn phí',
    description: 'Huỷ hoàn toàn miễn phí, không mất bất kỳ khoản phí nào.',
  },
  {
    time: '12 – 24 giờ',
    color: '#f57f17',
    bg: '#fffde7',
    label: 'Phí 30%',
    description: 'Áp dụng phí huỷ 30% giá trị đặt cọc (nếu có).',
  },
  {
    time: '4 – 12 giờ',
    color: '#e65100',
    bg: '#fff3e0',
    label: 'Phí 50%',
    description: 'Áp dụng phí huỷ 50% giá trị đặt cọc (nếu có).',
  },
  {
    time: '< 4 giờ',
    color: '#c62828',
    bg: '#ffebee',
    label: 'Phí 100%',
    description: 'Mất toàn bộ đặt cọc hoặc áp dụng phí huỷ tối đa.',
  },
];

const sections = [
  {
    id: 'general',
    icon: '📋',
    title: '1. Chính sách chung',
    content: `TableNow hỗ trợ khách hàng huỷ hoặc thay đổi lịch đặt bàn một cách linh hoạt. Tuy nhiên, để tôn trọng thời gian chuẩn bị của nhà hàng và đảm bảo trải nghiệm tốt nhất cho tất cả thực khách, một số quy định về phí huỷ sẽ được áp dụng tùy thuộc vào thời điểm huỷ.

Chính sách này áp dụng cho tất cả đặt bàn được thực hiện qua nền tảng TableNow. Đối với các nhà hàng có chính sách riêng, chính sách của nhà hàng sẽ được ưu tiên áp dụng.`,
  },
  {
    id: 'free-cancel',
    icon: '✅',
    title: '2. Huỷ miễn phí',
    content: `Bạn có thể huỷ bàn hoàn toàn miễn phí trong các trường hợp sau:

• Huỷ trước ít nhất 24 giờ so với giờ đặt bàn
• Trong vòng 15 phút kể từ lúc đặt bàn (áp dụng cho mọi thời điểm)
• Nhà hàng xác nhận không còn chỗ trống hoặc đóng cửa vì lý do bất khả kháng
• Huỷ do sự cố kỹ thuật từ phía hệ thống TableNow

Chúng tôi khuyến khích bạn huỷ sớm để nhà hàng có thể sắp xếp cho khách khác.`,
  },
  {
    id: 'fees',
    icon: '💰',
    title: '3. Phí huỷ bàn',
    content: `Phí huỷ được tính dựa trên khoảng thời gian từ lúc huỷ đến giờ đặt bàn (xem bảng ở trên). Phí chỉ áp dụng khi bạn đã thanh toán đặt cọc qua TableNow.

Nếu đặt bàn không yêu cầu đặt cọc, không có phí huỷ nào được thu, tuy nhiên việc huỷ muộn ảnh hưởng đến uy tín tài khoản của bạn.

Phí huỷ sẽ được khấu trừ từ khoản đặt cọc. Phần còn lại (nếu có) sẽ được hoàn trả trong vòng 5–7 ngày làm việc qua phương thức thanh toán ban đầu.`,
  },
  {
    id: 'noshow',
    icon: '🚫',
    title: '4. Không đến (No-show)',
    content: `Trường hợp không đến nhà hàng theo giờ đã đặt và không thực hiện huỷ bàn được xử lý như sau:

• Mất toàn bộ khoản đặt cọc (nếu có)
• Ghi nhận 1 lần vi phạm vào lịch sử tài khoản
• Sau 3 lần no-show trong 6 tháng: tài khoản sẽ bị hạn chế chức năng đặt bàn tạm thời

Nếu bạn không thể đến vì lý do khẩn cấp (tai nạn, thiên tai...), vui lòng liên hệ bộ phận hỗ trợ và cung cấp bằng chứng để được xem xét miễn phí huỷ.`,
  },
  {
    id: 'modification',
    icon: '✏️',
    title: '5. Thay đổi đặt bàn',
    content: `Bạn có thể thay đổi thông tin đặt bàn (ngày, giờ, số khách) trong các điều kiện sau:

• Thay đổi trước ít nhất 2 giờ so với giờ đặt bàn gốc
• Không áp dụng phí đối với thay đổi lần đầu tiên
• Từ lần thay đổi thứ 2 trở đi trong cùng một đặt bàn: có thể bị áp dụng phí xử lý 50.000đ
• Thay đổi phụ thuộc vào sự chấp thuận và khả năng sắp xếp của nhà hàng

Nếu nhà hàng không thể đáp ứng yêu cầu thay đổi, bạn sẽ được đề xuất huỷ miễn phí.`,
  },
  {
    id: 'restaurant-cancel',
    icon: '🏪',
    title: '6. Nhà hàng huỷ đặt bàn',
    content: `Trong trường hợp nhà hàng chủ động huỷ đặt bàn của bạn (đóng cửa, sự cố, quá tải...):

• Bạn sẽ được hoàn trả 100% khoản đặt cọc trong vòng 3 ngày làm việc
• Nhận thông báo qua email/SMS ngay lập tức
• Được ưu tiên hỗ trợ tìm nhà hàng thay thế tương tự
• Nhận voucher bồi thường trị giá 50.000đ – 200.000đ tùy tình huống

TableNow sẽ xử lý khiếu nại với nhà hàng và có biện pháp phù hợp để đảm bảo chất lượng dịch vụ.`,
  },
  {
    id: 'refund',
    icon: '💳',
    title: '7. Quy trình hoàn tiền',
    content: `Sau khi huỷ bàn hợp lệ, khoản hoàn tiền sẽ được xử lý như sau:

**Thời gian hoàn tiền:**
• Ví điện tử (MoMo, ZaloPay, VNPay): 1–3 ngày làm việc
• Thẻ ngân hàng nội địa: 3–5 ngày làm việc
• Thẻ quốc tế (Visa, Mastercard): 5–10 ngày làm việc

**Lưu ý:**
• Hoàn tiền về đúng phương thức thanh toán ban đầu
• Không thu phí xử lý hoàn tiền
• Bạn sẽ nhận email xác nhận khi hoàn tiền được xử lý

Nếu không nhận được tiền hoàn sau thời hạn trên, vui lòng liên hệ support@tablenow.vn.`,
  },
  {
    id: 'special',
    icon: '🎉',
    title: '8. Trường hợp đặc biệt',
    content: `Một số trường hợp được xem xét hỗ trợ đặc biệt:

• **Đặt bàn nhóm lớn (≥ 20 người):** Có thể có chính sách huỷ riêng, được thông báo rõ khi đặt
• **Sự kiện đặc biệt (tiệc sinh nhật, kỷ niệm...):** Nhà hàng có thể yêu cầu cam kết riêng
• **Trường hợp bất khả kháng (thiên tai, dịch bệnh):** Miễn phí huỷ toàn bộ kèm hoàn tiền 100%
• **Lỗi hệ thống:** Được xử lý trực tiếp và ưu tiên hỗ trợ

Với mọi trường hợp đặc biệt, đội ngũ hỗ trợ của chúng tôi luôn sẵn sàng lắng nghe và tìm giải pháp tốt nhất cho bạn.`,
  },
  {
    id: 'contact',
    icon: '📧',
    title: '9. Hỗ trợ huỷ bàn',
    content: `Để được hỗ trợ về việc huỷ hoặc thay đổi đặt bàn:

• Email: support@tablenow.vn (phản hồi trong 2 giờ)
• Hotline: 1900 1234 (7:00 – 22:00 mỗi ngày kể cả cuối tuần)
• Chat trực tiếp trên ứng dụng (tính năng sắp ra mắt)

Khi liên hệ, vui lòng cung cấp mã đặt bàn và lý do để được hỗ trợ nhanh nhất.`,
  },
];

const CancellationPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  return (
    <div className={styles.page}>
      <div className={`${styles.hero} ${styles.heroCancellation}`}>
        <div className={styles.heroContent}>
          <span className={styles.heroTag}>❌ Chính sách</span>
          <h1>Chính sách Huỷ bàn</h1>
          <p>Cập nhật lần cuối: 01/05/2026 • Hiệu lực từ: 01/05/2026</p>
        </div>
      </div>

      <div className={styles.container}>
        {/* Fee timeline */}
        <div className={styles.feeTiers}>
          <h2 className={styles.feeTiersTitle}>📊 Biểu phí huỷ bàn</h2>
          <div className={styles.feeTiersGrid}>
            {tiers.map((t, i) => (
              <div key={i} className={styles.feeTierCard} style={{ borderTop: `4px solid ${t.color}` }}>
                <div className={styles.feeTierTime}>{t.time}</div>
                <div className={styles.feeTierLabel} style={{ color: t.color, background: t.bg }}>
                  {t.label}
                </div>
                <p className={styles.feeTierDesc}>{t.description}</p>
              </div>
            ))}
          </div>
        </div>

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
                <Link to="/privacy">🔒 Chính sách bảo mật</Link>
              </div>
            </div>
          </aside>

          <main className={styles.content}>
            <div className={styles.intro}>
              <p>
                Chính sách huỷ bàn của <strong>TableNow</strong> được thiết kế để cân bằng lợi ích
                giữa thực khách và nhà hàng, đảm bảo trải nghiệm công bằng cho tất cả các bên.
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

export default CancellationPage;
