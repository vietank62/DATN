import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Footer.module.css';

const Footer: React.FC = () => {
  const location = useLocation();

  // Ẩn footer trên admin/manager pages
  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/manager')) {
    return null;
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.brand}>
          <h3>🍽️ TableNow</h3>
          <p>Nền tảng đặt bàn nhà hàng hàng đầu Việt Nam. Khám phá hơn 1,200+ nhà hàng chất lượng.</p>
        </div>
        <div className={styles.links}>
          <h4>Khám phá</h4>
          <Link to="/">Trang chủ</Link>
          <Link to="/restaurants">Nhà hàng</Link>
        </div>
        <div className={styles.links}>
          <h4>Chính sách</h4>
          <Link to="/terms">Điều khoản sử dụng</Link>
          <Link to="/privacy">Chính sách bảo mật</Link>
          <Link to="/cancellation">Chính sách huỷ bàn</Link>
        </div>
        <div className={styles.contact}>
          <h4>Liên hệ</h4>
          <p>📍 123 Nguyễn Huệ, Q.1, TP.HCM</p>
          <p>📞 1900 1234</p>
          <p>✉️ info@tablenow.vn</p>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <p>© 2026 TableNow. Tất cả quyền được bảo lưu. Thiết kế với ❤️ tại Việt Nam</p>
      </div>
    </footer>
  );
};

export default Footer;