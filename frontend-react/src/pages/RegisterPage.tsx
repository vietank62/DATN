import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { registerUser, createRestaurant } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import styles from './RegisterPage.module.css';
import { cuisineTypes } from '../data/restaurants';
import ImageUpload from '../components/ImageUpload/ImageUpload';

const DISTRICTS = [
  'Quận 1', 'Quận 2', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 6', 'Quận 7',
  'Quận 8', 'Quận 9', 'Quận 10', 'Quận 11', 'Quận 12', 'Bình Tân', 'Bình Thạnh',
  'Gò Vấp', 'Phú Nhuận', 'Tân Bình', 'Tân Phú', 'Thủ Đức',
];

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { login: contextLogin } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [registeredUserId, setRegisteredUserId] = useState<number | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState('');

  // Step 1: Account form
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '', role: 'customer',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: Restaurant form
  const [restaurantForm, setRestaurantForm] = useState({
    name: '', address: '', district: '', cuisine: [] as string[],
    phone: '', openTime: '10:00', closeTime: '22:00',
    totalSeats: 50, description: '', imageUrl: [] as string[],
  });
  const [restError, setRestError] = useState('');
  const [restLoading, setRestLoading] = useState(false);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const toggleCuisine = (cuisineId: string) => {
    setRestaurantForm((prev) => ({
      ...prev,
      cuisine: prev.cuisine.includes(cuisineId)
        ? prev.cuisine.filter((c) => c !== cuisineId)
        : [...prev.cuisine, cuisineId],
    }));
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
      const newUser = await registerUser({ name: form.name, email: form.email, phone: form.phone, password: form.password, role: form.role });

      if (form.role === 'manager') {
        // Auto-login using context (stores token + user)
        await contextLogin(form.email, form.password);
        setRegisteredUserId(Number(newUser.id));
        setRegisteredEmail(form.email);
        toast.success('Tạo tài khoản thành công! Hãy điền thông tin nhà hàng.');
        setStep(2);
      } else {
        toast.success('Đăng ký thành công! Hãy đăng nhập.');
        navigate('/login');
      }
    } catch (err: any) {
      const msg = err.message || 'Đăng ký thất bại. Vui lòng thử lại.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestError('');
    if (!restaurantForm.name.trim()) { setRestError('Vui lòng nhập tên nhà hàng'); return; }
    if (!restaurantForm.address.trim()) { setRestError('Vui lòng nhập địa chỉ'); return; }
    if (!restaurantForm.district) { setRestError('Vui lòng chọn quận/huyện'); return; }
    if (restaurantForm.cuisine.length === 0) { setRestError('Vui lòng chọn ít nhất một loại ẩm thực'); return; }
    if (!/^0\d{9}$/.test(restaurantForm.phone)) { setRestError('Số điện thoại nhà hàng không hợp lệ'); return; }
    if (!registeredUserId) { setRestError('Lỗi xác thực. Vui lòng đăng nhập lại.'); return; }

    setRestLoading(true);
    try {
      await createRestaurant({
        ...restaurantForm,
        rating: 0,
        reviewCount: 0,
        featured: false,
        availableSeats: restaurantForm.totalSeats,
        managerID: registeredUserId,
      });
      toast.success('Tạo nhà hàng thành công! Đang chuyển đến trang quản lý...');
      navigate('/manager-dashboard');
    } catch (err: any) {
      const msg = err.message || 'Tạo nhà hàng thất bại. Vui lòng thử lại.';
      setRestError(msg);
      toast.error(msg);
    } finally {
      setRestLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={`${styles.container} ${step === 2 ? styles.containerWide : ''}`}>
        <div className={styles.imageSection}>
          <div className={styles.imageOverlay}>
            <h2>Tham gia<br />TableNow</h2>
            <p>{step === 1 ? 'Đăng ký ngay để đặt bàn tại hàng nghìn nhà hàng chất lượng' : 'Bước cuối cùng — Tạo thông tin nhà hàng của bạn'}</p>
            {step === 2 && (
              <div className={styles.stepIndicator}>
                <div className={`${styles.stepDot} ${styles.stepDone}`}>✓</div>
                <div className={styles.stepLine} />
                <div className={`${styles.stepDot} ${styles.stepActive}`}>2</div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.formSection}>
          <div className={styles.formWrapper}>
            <Link to="/" className={styles.backLink}>← Về trang chủ</Link>

            {step === 1 ? (
              <>
                <div className={styles.header}>
                  <h1>🍽️ TableNow</h1>
                  <h2>Tạo tài khoản</h2>
                  <p>Đăng ký miễn phí và bắt đầu khám phá ẩm thực.</p>
                </div>
                {error && <div className={styles.errorMsg}>{error}</div>}
                <form onSubmit={handleStep1Submit} className={styles.form}>
                  <div className={styles.fieldGroup}>
                    <label>Loại tài khoản</label>
                    <div className={styles.roleSelector}>
                      <label className={`${styles.roleOption} ${form.role === 'customer' ? styles.roleActive : ''}`}>
                        <input type="radio" name="role" value="customer" checked={form.role === 'customer'} onChange={(e) => updateField('role', e.target.value)} />
                        <span>👥 Khách hàng</span>
                      </label>
                      <label className={`${styles.roleOption} ${form.role === 'manager' ? styles.roleActive : ''}`}>
                        <input type="radio" name="role" value="manager" checked={form.role === 'manager'} onChange={(e) => updateField('role', e.target.value)} />
                        <span>🏪 Quản lý nhà hàng</span>
                      </label>
                    </div>
                  </div>
                  {form.role === 'manager' && (
                    <div className={styles.managerNote}>
                      📋 Sau khi tạo tài khoản, bạn sẽ được hướng dẫn thêm thông tin nhà hàng ngay tại đây.
                    </div>
                  )}
                  <div className={styles.fieldGroup}>
                    <label>Họ và tên</label>
                    <input type="text" placeholder="Nguyễn Văn A" value={form.name} onChange={(e) => updateField('name', e.target.value)} className={styles.input} />
                  </div>
                  <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                      <label>Email</label>
                      <input type="email" placeholder="name@example.com" value={form.email} onChange={(e) => updateField('email', e.target.value)} className={styles.input} />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label>Số điện thoại</label>
                      <input type="tel" placeholder="0901234567" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} className={styles.input} />
                    </div>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Mật khẩu</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPassword ? 'text' : 'password'} placeholder="Ít nhất 6 ký tự" value={form.password} onChange={(e) => updateField('password', e.target.value)} className={styles.input} style={{ width: '100%', paddingRight: '40px', boxSizing: 'border-box' }} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: 0 }}>{showPassword ? '👁️' : '👁️‍🗨️'}</button>
                    </div>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Xác nhận mật khẩu</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPassword ? 'text' : 'password'} placeholder="Nhập lại mật khẩu" value={form.confirmPassword} onChange={(e) => updateField('confirmPassword', e.target.value)} className={styles.input} style={{ width: '100%', paddingRight: '40px', boxSizing: 'border-box' }} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: 0 }}>{showPassword ? '👁️' : '👁️‍🗨️'}</button>
                    </div>
                  </div>
                  <button type="submit" className={styles.submitBtn} disabled={loading}>
                    {loading ? 'Đang tạo tài khoản...' : form.role === 'manager' ? 'Tiếp tục →' : 'Đăng ký'}
                  </button>
                </form>
                <p className={styles.loginLink}>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
              </>
            ) : (
              <>
                <div className={styles.header}>
                  <h1>🏪 Thông tin nhà hàng</h1>
                  <h2>Tạo nhà hàng của bạn</h2>
                  <p>Điền đầy đủ thông tin để khách hàng có thể tìm và đặt bàn tại nhà hàng của bạn.</p>
                </div>
                {restError && <div className={styles.errorMsg}>{restError}</div>}
                <form onSubmit={handleStep2Submit} className={styles.form}>
                  <div className={styles.fieldGroup}>
                    <label>Tên nhà hàng *</label>
                    <input type="text" placeholder="Nhập tên nhà hàng" value={restaurantForm.name} onChange={(e) => setRestaurantForm(p => ({ ...p, name: e.target.value }))} className={styles.input} required />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Địa chỉ *</label>
                    <input type="text" placeholder="Nhập địa chỉ đầy đủ" value={restaurantForm.address} onChange={(e) => setRestaurantForm(p => ({ ...p, address: e.target.value }))} className={styles.input} required />
                  </div>
                  <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                      <label>Quận/Huyện *</label>
                      <select value={restaurantForm.district} onChange={(e) => setRestaurantForm(p => ({ ...p, district: e.target.value }))} className={styles.input} required>
                        <option value="">-- Chọn quận/huyện --</option>
                        {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label>Số điện thoại nhà hàng *</label>
                      <input type="tel" placeholder="0901234567" value={restaurantForm.phone} onChange={(e) => setRestaurantForm(p => ({ ...p, phone: e.target.value }))} className={styles.input} required />
                    </div>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Loại ẩm thực *</label>
                    <div className={styles.cuisineGrid}>
                      {cuisineTypes.filter(c => c.id !== 'all').map(cuisine => (
                        <label key={cuisine.id} className={styles.cuisineCheckbox}>
                          <input type="checkbox" checked={restaurantForm.cuisine.includes(cuisine.id)} onChange={() => toggleCuisine(cuisine.id)} />
                          <span>{cuisine.icon} {cuisine.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                      <label>Tổng số ghế *</label>
                      <input type="number" placeholder="50" value={restaurantForm.totalSeats} onChange={(e) => setRestaurantForm(p => ({ ...p, totalSeats: parseInt(e.target.value) || 0 }))} className={styles.input} min="10" required />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label>Giờ mở cửa</label>
                      <input type="time" value={restaurantForm.openTime} onChange={(e) => setRestaurantForm(p => ({ ...p, openTime: e.target.value }))} className={styles.input} />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label>Giờ đóng cửa</label>
                      <input type="time" value={restaurantForm.closeTime} onChange={(e) => setRestaurantForm(p => ({ ...p, closeTime: e.target.value }))} className={styles.input} />
                    </div>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Hình ảnh nhà hàng</label>
                    <ImageUpload images={restaurantForm.imageUrl} onImagesChange={(urls) => setRestaurantForm(p => ({ ...p, imageUrl: urls }))} onError={(err) => setRestError(err)} maxSize={5} disabled={restLoading} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Mô tả nhà hàng</label>
                    <textarea placeholder="Mô tả ngắn về nhà hàng của bạn" value={restaurantForm.description} onChange={(e) => setRestaurantForm(p => ({ ...p, description: e.target.value }))} className={styles.textarea} rows={3} />
                  </div>
                  <button type="submit" className={styles.submitBtn} disabled={restLoading}>
                    {restLoading ? 'Đang tạo nhà hàng...' : '🏪 Hoàn tất đăng ký'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
