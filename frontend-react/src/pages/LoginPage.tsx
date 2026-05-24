import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import styles from './LoginPage.module.css';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        toast.success(`Chào mừng trở lại, ${result.name}!`);
        if (result.role === 'admin') navigate('/admin');
        else if (result.role === 'manager') navigate('/manager');
        else navigate('/');
      }
    } catch (err: any) {
      const msg = err.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
      setError(msg);
      toast.error(msg);
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
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={styles.input}
                    style={{ width: '100%', paddingRight: '40px', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: 0 }}
                  >
                    {showPassword ? "👁️" : "🔒"}
                  </button>
                </div>
              </div>
              <div className={styles.options}>
                <label className={styles.remember}>
                  <input type="checkbox" /> Ghi nhớ đăng nhập
                </label>
                <Link to="/forgot-password" className={styles.forgot}>Quên mật khẩu?</Link>
              </div>
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>



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
