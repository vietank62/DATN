import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { registerUser, createRestaurant } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import styles from './RegisterPage.module.css';
import ImageUpload from '../components/ImageUpload/ImageUpload';
import type { UserRole } from '../types';



const DISTRICTS = [
  'Quận 1', 'Quận 2', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 6', 'Quận 7',
  'Quận 8', 'Quận 9', 'Quận 10', 'Quận 11', 'Quận 12', 'Bình Tân', 'Bình Thạnh',
  'Gò Vấp', 'Phú Nhuận', 'Tân Bình', 'Tân Phú', 'Thủ Đức',
];

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { login: contextLogin } = useAuth();

  // State: Account form
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '', role: 'customer',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!agreedToTerms) {
      setError('Vui lòng đồng ý với điều khoản sử dụng'); return;
    }
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.password.trim()) {
      setError('Vui lòng điền đầy đủ thông tin'); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Email không hợp lệ'); return;
    }
    if (!/^0\d{9}$/.test(form.phone)) {
      setError('Số điện thoại không hợp lệ'); return;
    }
    if (form.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự'); return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp'); return;
    }

    setLoading(true);
    try {
      await registerUser({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: 'customer' as UserRole
      });

      toast.success('Đăng ký tài khoản thành công! Hãy đăng nhập.');
      navigate('/login');
    } catch (err: any) {
      const msg = err.message || 'Đăng ký thất bại. Vui lòng thử lại.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.imageSection}>
          <div className={styles.imageOverlay}>
            <h2>Tham gia<br />TableNow</h2>
            <p>Đăng ký ngay để đặt bàn tại hàng nghìn nhà hàng chất lượng và uy tín.</p>
          </div>
        </div>

        <div className={styles.formSection}>
          <div className={styles.formWrapper}>
            <Link to="/" className={styles.backLink}>← Về trang chủ</Link>

            <div className={styles.header}>
              <h1>🍽️ TableNow</h1>
              <h2>Tạo tài khoản</h2>
              <p>Đăng ký miễn phí và bắt đầu khám phá ẩm thực.</p>
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}

            <form onSubmit={handleRegisterSubmit} className={styles.form}>
              <div className={styles.fieldGroup}>
                <label>Họ và tên</label>
                <input
                  type="text"
                  placeholder="Nhập Họ và Tên"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.row}>
                <div className={styles.fieldGroup}>
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="Nhập Email"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Số điện thoại</label>
                  <input
                    type="tel"
                    placeholder="Nhập Số điện thoại"
                    value={form.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label>Mật khẩu</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Nhập mật khẩu"
                    value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    className={styles.input}
                    style={{ width: '100%', paddingRight: '40px', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: 0 }}
                  >
                    {showPassword ? '👁️' : '🔒'}
                  </button>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label>Xác nhận mật khẩu</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Nhập lại mật khẩu"
                    value={form.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                    className={styles.input}
                    style={{ width: '100%', paddingRight: '40px', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: 0 }}
                  >
                    {showPassword ? '👁️' : '🔒'}
                  </button>
                </div>
              </div>

              <div className={styles.terms}>
                <label>
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    required
                  />
                  <span>Tôi đồng ý với <Link to="/terms" target="_blank">điều khoản sử dụng</Link></span>
                </label>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Đang đăng ký...' : 'Đăng ký'}
              </button>
            </form>

            <div className={styles.partnerContainer}>
              <div className={styles.partnerDivider}>Bạn sở hữu nhà hàng?</div>
              <button
                type="button"
                className={styles.partnerBtn}
                onClick={() => setShowTermsModal(true)}
              >
                🏪 Đăng ký làm đối tác kinh doanh
              </button>
            </div>

            <p className={styles.loginLink}>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
          </div>
        </div>
      </div>

      {/* Partner Terms and Policies Modal */}
      {showTermsModal && (
        <div className={styles.modalOverlay} onClick={() => setShowTermsModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>🏪 Điều khoản & Chính sách Đối tác TableNow</h3>
            </div>
            <div className={styles.modalBody}>
              <p>Chào mừng bạn đến với mạng lưới đối tác của TableNow. Trước khi tiến hành đăng ký, vui lòng đọc kỹ các điều khoản và chính sách hoạt động của chúng tôi:</p>

              <h4>1. Quy trình phê duyệt tài khoản đối tác</h4>
              <p>Mọi hồ sơ đăng ký kinh doanh đều trải qua quy trình xác minh tính pháp lý từ ban quản trị TableNow:</p>
              <ul>
                <li>Đối tác cam kết cung cấp đúng và chính xác <strong>Mã số thuế doanh nghiệp (Tax ID)</strong> và ảnh chụp <strong>Giấy phép kinh doanh</strong> hợp lệ.</li>
                <li>Hồ sơ sau khi gửi sẽ được phê duyệt trong vòng <strong>24 - 48 giờ làm việc</strong>. Trong thời gian chờ duyệt, đối tác chưa thể hiển thị công khai trên ứng dụng.</li>
              </ul>

              <h4>2. Trách nhiệm cập nhật thông tin nhà hàng</h4>
              <ul>
                <li>Đảm bảo các thông tin như địa chỉ, số điện thoại, hình ảnh thực tế, menu, giờ mở/đóng cửa và sức chứa ghế trống luôn chính xác.</li>
                <li>Nếu có sự thay đổi đột xuất về sức chứa hoặc đóng cửa tạm thời, đối tác phải cập nhật ngay lập tức trên hệ thống hoặc thông báo cho bộ phận CSKH của TableNow.</li>
              </ul>

              <h4>3. Chính sách đặt giữ chỗ và đón tiếp khách hàng</h4>
              <ul>
                <li>Đối tác cam kết giữ chỗ trống và đón tiếp khách hàng chu đáo theo đúng thông tin thời gian, số khách trên lịch đặt bàn đã xác nhận.</li>
                <li>Không tự ý hủy lịch của khách hàng khi không có lý do bất khả kháng. Trường hợp khẩn cấp, đối tác bắt buộc phải thông báo cho khách hàng và quản trị viên TableNow trước giờ hẹn tối thiểu <strong>2 tiếng</strong>.</li>
              </ul>

              <h4>4. Chính sách phí dịch vụ 6.000đ và Xác nhận hoàn thành</h4>
              <ul>
                <li>TableNow áp dụng mức phí dịch vụ là <strong>6.000đ cho mỗi đơn đặt bàn thành công</strong>.</li>
                <li>Phí dịch vụ chỉ được tính khi nhà hàng <strong>xác nhận khách hàng đã dùng bữa thành công (ấn nút Hoàn thành)</strong> trên trang quản trị.</li>
                <li>Nhà hàng có nghĩa vụ đối soát và thanh toán phí đặt bàn tích lũy định kỳ thông qua cổng thanh toán tích hợp trên trang quản lý.</li>
              </ul>

              <h4>5. Bảo mật dữ liệu và An toàn thông tin</h4>
              <p>TableNow cam kết tuyệt mật toàn bộ dữ liệu kinh doanh, thông tin cá nhân của chủ nhà hàng và chỉ sử dụng cho hoạt động vận hành dịch vụ trên nền tảng của dự án.</p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalDeclineBtn}
                onClick={() => setShowTermsModal(false)}
              >
                Từ chối
              </button>
              <button
                type="button"
                className={styles.modalAcceptBtn}
                onClick={() => {
                  setShowTermsModal(false);
                  navigate('/register-partner');
                }}
              >
                Đồng ý & Tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisterPage;
