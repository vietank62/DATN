import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import styles from './ForgotPasswordPage.module.css';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      toast.success('Đã gửi email khôi phục mật khẩu!');
    }, 1500);
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.leftPanel}>
          <div className={styles.logo}>🍽️ TableNow</div>
          <div className={styles.welcomeText}>
            <h2>Khôi phục mật khẩu</h2>
            <p>Khám phá ẩm thực tuyệt đỉnh. Đặt bàn nhanh chóng và dễ dàng cùng TableNow.</p>
          </div>
        </div>
        
        <div className={styles.rightPanel}>
          <div className={styles.formContainer}>
            <h2>Quên mật khẩu? 🔒</h2>
            
            {submitted ? (
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
                <h3 style={{ marginBottom: '12px' }}>Kiểm tra email của bạn</h3>
                <p style={{ color: '#666', lineHeight: 1.5, marginBottom: '24px' }}>
                  Chúng tôi đã gửi hướng dẫn khôi phục mật khẩu đến email <strong>{email}</strong>. Vui lòng kiểm tra hộp thư đến (hoặc thư mục Spam).
                </p>
                <button 
                  className={styles.submitBtn}
                  onClick={() => setSubmitted(false)}
                  style={{ marginBottom: '16px', background: '#f5f5f5', color: '#333' }}
                >
                  Thử lại với email khác
                </button>
                <p className={styles.registerPrompt}>
                  <Link to="/login">← Quay lại Đăng nhập</Link>
                </p>
              </div>
            ) : (
              <>
                <p style={{ color: '#666', marginBottom: '24px', lineHeight: 1.5 }}>
                  Đừng lo lắng! Hãy nhập email bạn đã đăng ký, chúng tôi sẽ gửi cho bạn một liên kết để đặt lại mật khẩu.
                </p>
                <form className={styles.form} onSubmit={handleSubmit}>
                  <div className={styles.inputGroup}>
                    <label>Email</label>
                    <input 
                      type="email" 
                      placeholder="Nhập email của bạn" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required 
                    />
                  </div>

                  <button type="submit" className={styles.submitBtn} disabled={loading}>
                    {loading ? 'Đang gửi...' : 'Gửi liên kết khôi phục'}
                  </button>
                </form>

                <p className={styles.registerPrompt}>
                  Nhớ mật khẩu? <Link to="/login">Đăng nhập ngay</Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
