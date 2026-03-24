import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from './LoginPage.module.css';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        if (result.role === 'admin') navigate('/admin');
        else if (result.role === 'manager') navigate('/manager');
        else navigate('/');
      }
    } catch {
      setError('Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };
  const handleDemoLogin = async (role: 'customer' | 'manager' | 'admin') => {
    const demoAccounts: Record<string, { email: string; password: string }> = {
      customer: { email: 'customer@tablenow.vn', password: 'customer123' },
      manager: { email: 'manager@tablenow.vn', password: 'manager123' },
      admin: { email: 'admin@tablenow.vn', password: 'admin123' },
    };
    const account = demoAccounts[role];
    setError('');
    setLoading(true);
    try {
      const result = await login(account.email, account.password);
      if (result.success) {
        if (result.role === 'admin') navigate('/admin');
        else if (result.role === 'manager') navigate('/manager');
        else navigate('/');
      }
    } catch {
      setError(`Đăng nhập demo thất bại. Tài khoản ${role} chưa được tạo.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.formSection}>
          <div className={styles.formWrapper}>
            <Link to="/" className={styles.backLink}>← Về trang chủ</Link>
            <div className={styles.header}>
              <h1>🍽️ TableNow</h1>
              <h2>Đăng nhập</h2>
              <p>Chào mừng bạn trở lại! Đăng nhập để đặt bàn nhà hàng.</p>
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.fieldGroup}>
                <label>Email</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label>Mật khẩu</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                />
              </div>
              <div className={styles.options}>
                <label className={styles.remember}>
                  <input type="checkbox" /> Ghi nhớ đăng nhập
                </label>
                <a href="#forgot" className={styles.forgot}>Quên mật khẩu?</a>
              </div>
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>

            <div className={styles.divider}>
              <span>hoặc đăng nhập nhanh</span>
            </div>

            <div className={styles.demoButtons}>
              <button className={styles.demoBtn} onClick={() => handleDemoLogin('customer')}>
                👤 Khách hàng
              </button>
              <button className={styles.demoBtn} onClick={() => handleDemoLogin('manager')}>
                🏪 Quản lý NH
              </button>
              <button className={styles.demoBtn} onClick={() => handleDemoLogin('admin')}>
                🛡️ Admin
              </button>
            </div>            <div className={styles.demoInfo}>
              <p><strong>Tài khoản demo:</strong></p>
              <small>Khách hàng: customer@tablenow.vn / customer123</small>
              <small>Quản lý: manager@tablenow.vn / manager123</small>
              <small>Admin: admin@tablenow.vn / admin123</small>
            </div>

            <p className={styles.registerLink}>
              Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
            </p>
          </div>
        </div>

        <div className={styles.imageSection}>
          <div className={styles.imageOverlay}>
            <h2>Khám phá ẩm thực<br />tuyệt vời</h2>
            <p>Đặt bàn tại hơn 1,200+ nhà hàng hàng đầu Việt Nam</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
