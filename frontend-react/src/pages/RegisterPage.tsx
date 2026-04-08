import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../services/api';
import styles from './RegisterPage.module.css';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'customer', // New: role selection
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.password.trim()) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Email không hợp lệ');
      return;
    }
    if (!/^0\d{9}$/.test(form.phone)) {
      setError('Số điện thoại không hợp lệ');
      return;
    }
    if (form.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }    setLoading(true);
    try {
      const response = await registerUser({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      
      // If manager, redirect to restaurant onboarding
      if (form.role === 'manager') {
        navigate('/new-restaurant');
      } else {
        navigate('/login');
      }
    } catch (err: any) {
      setError(err.message || 'Đăng ký thất bại. Vui lòng thử lại.');
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
            <p>Đăng ký ngay để đặt bàn tại hàng nghìn nhà hàng chất lượng</p>
          </div>
        </div>

        <div className={styles.formSection}>
          <div className={styles.formWrapper}>
            <Link to="/" className={styles.backLink}>← Về trang chủ</Link>
            <div className={styles.header}>
              <h1>🍽️ TableNow</h1>
              <h2>Tạo tài khoản</h2>
              <p>Đăng ký miễn phí và bắt đầu khám phá ẩm thực.</p>
            </div>            {error && <div className={styles.errorMsg}>{error}</div>}

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.fieldGroup}>
                <label>Loại tài khoản</label>
                <div className={styles.roleSelector}>
                  <label className={`${styles.roleOption} ${form.role === 'customer' ? styles.roleActive : ''}`}>
                    <input
                      type="radio"
                      name="role"
                      value="customer"
                      checked={form.role === 'customer'}
                      onChange={(e) => updateField('role', e.target.value)}
                    />
                    <span>👥 Khách hàng</span>
                  </label>
                  <label className={`${styles.roleOption} ${form.role === 'manager' ? styles.roleActive : ''}`}>
                    <input
                      type="radio"
                      name="role"
                      value="manager"
                      checked={form.role === 'manager'}
                      onChange={(e) => updateField('role', e.target.value)}
                    />
                    <span>🏪 Quản lý nhà hàng</span>
                  </label>
                </div>
              </div>
              <div className={styles.fieldGroup}>
                <label>Họ và tên</label>
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
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
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Số điện thoại</label>
                  <input
                    type="tel"
                    placeholder="0901234567"
                    value={form.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>
              <div className={styles.fieldGroup}>
                <label>Mật khẩu</label>
                <input
                  type="password"
                  placeholder="Ít nhất 6 ký tự"
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className={styles.input}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label>Xác nhận mật khẩu</label>
                <input
                  type="password"
                  placeholder="Nhập lại mật khẩu"
                  value={form.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  className={styles.input}
                />
              </div>
              <div className={styles.terms}>
                <label>
                  <input type="checkbox" /> Tôi đồng ý với{' '}
                  <a href="#terms">Điều khoản sử dụng</a> và{' '}
                  <a href="#privacy">Chính sách bảo mật</a>
                </label>
              </div>
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
              </button>
            </form>

            <p className={styles.loginLink}>
              Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
