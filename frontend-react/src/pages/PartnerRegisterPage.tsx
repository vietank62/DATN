import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { registerPartner, uploadImage } from '../services/api';
import styles from './RegisterPage.module.css'; // Reusing RegisterPage styles
import partnerStyles from './PartnerRegisterPage.module.css'; // Additional styles
import { useAuth } from '../contexts/AuthContext';
import ImageUpload from '../components/ImageUpload/ImageUpload';

const DISTRICTS = [
  'Quận 1', 'Quận 2', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 6', 'Quận 7',
  'Quận 8', 'Quận 9', 'Quận 10', 'Quận 11', 'Quận 12', 
  'Bình Tân', 'Bình Thạnh', 'Gò Vấp', 'Phú Nhuận', 'Tân Bình', 'Tân Phú', 'Thủ Đức',
  'Huyện Bình Chánh', 'Huyện Cần Giờ', 'Huyện Củ Chi', 'Huyện Hóc Môn', 'Huyện Nhà Bè'
];

const PartnerRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { cuisines } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: User Info, 2: Restaurant Info, 3: Verification

  const [form, setForm] = useState({
    // User Info
    userName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    // Restaurant Info
    resName: '',
    address: '',
    district: '',
    cuisine: [] as string[],
    resPhone: '',
    totalSeats: 20,
    openTime: '09:00',
    closeTime: '22:00',
    description: '',
    images: [] as string[],
    // Verification
    businessLicenseUrl: '',
    taxId: '',
  });

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const nextStep = () => {
    if (step === 1) {
      if (!form.userName || !form.email || !form.phone || !form.password) {
        setError('Vui lòng điền đầy đủ thông tin tài khoản');
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError('Mật khẩu xác nhận không khớp');
        return;
      }
    } else if (step === 2) {
      if (!form.resName || !form.address || !form.district || form.cuisine.length === 0) {
        setError('Vui lòng điền đầy đủ thông tin nhà hàng');
        return;
      }
    }
    setStep(step + 1);
    setError('');
  };

  const prevStep = () => setStep(step - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessLicenseUrl || !form.taxId) {
      setError('Vui lòng cung cấp thông tin pháp lý để xác minh');
      return;
    }

    setLoading(true);
    try {
      await registerPartner({
        user: {
          name: form.userName,
          email: form.email,
          phone: form.phone,
          password: form.password,
        },
        restaurant: {
          name: form.resName,
          address: form.address,
          district: form.district,
          cuisine: form.cuisine,
          imageUrl: form.images,
          description: form.description,
          openTime: form.openTime,
          closeTime: form.closeTime,
          phone: form.resPhone || form.phone,
          totalSeats: Number(form.totalSeats),
          availableSeats: Number(form.totalSeats),
          businessLicenseUrl: form.businessLicenseUrl,
          taxId: form.taxId,
        }
      });

      toast.success('Đăng ký thành công! Vui lòng chờ Admin phê duyệt hồ sơ.');
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Đăng ký thất bại');
      toast.error(err.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container} style={{ maxWidth: '1100px' }}>
        <div className={styles.imageSection} style={{ background: 'linear-gradient(135deg, rgba(13, 71, 161, 0.95), rgba(21, 101, 192, 0.95)), url("https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&fit=crop")', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'flex-end', padding: '48px' }}>
          <div className={styles.imageOverlay}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', lineHeight: 1.3, marginBottom: '8px' }}>Đối tác<br />TableNow</h2>
            <p style={{ fontSize: '15px', color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>Đăng ký trở thành đối tác kinh doanh ngay hôm nay để quản lý nhà hàng thông minh, tối ưu hóa ghế trống và tăng trưởng doanh thu vượt bậc cùng TableNow.</p>
          </div>
        </div>

        <div className={styles.formSection}>
          <div className={styles.formWrapper} style={{ maxWidth: '600px' }}>
            <Link to="/" className={styles.backLink}>← Về trang chủ</Link>
            <div className={styles.header}>
              <h1 style={{ color: '#0d47a1' }}>🏪 TableNow Partner</h1>
              <h2>Đăng ký kinh doanh</h2>
              <p>Trở thành đối tác và tiếp cận hàng triệu khách hàng</p>
            </div>

            <div className={partnerStyles.stepper}>
              <div className={`${partnerStyles.step} ${step >= 1 ? partnerStyles.active : ''}`}>Tài khoản</div>
              <div className={`${partnerStyles.step} ${step >= 2 ? partnerStyles.active : ''}`}>Nhà hàng</div>
              <div className={`${partnerStyles.step} ${step >= 3 ? partnerStyles.active : ''}`}>Xác minh</div>
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}

            <form onSubmit={handleSubmit} className={styles.form}>
              {step === 1 && (
                <div className={partnerStyles.stepContent}>
                  <h3>Thông tin tài khoản quản lý</h3>
                  <div className={styles.fieldGroup}>
                    <label>Họ và tên</label>
                    <input type="text" value={form.userName} onChange={(e) => updateField('userName', e.target.value)} placeholder="Nhập Họ và Tên" className={styles.input} />
                  </div>
                  <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                      <label>Email</label>
                      <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="Nhập Email" className={styles.input} />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label>Số điện thoại</label>
                      <input type="tel" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="Nhập Số điện thoại" className={styles.input} />
                    </div>
                  </div>
                  <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                      <label>Mật khẩu</label>
                      <input type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder="Nhập mật khẩu" className={styles.input} />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label>Xác nhận mật khẩu</label>
                      <input type="password" value={form.confirmPassword} onChange={(e) => updateField('confirmPassword', e.target.value)} placeholder="Nhập lại mật khẩu" className={styles.input} />
                    </div>
                  </div>
                  <div className={partnerStyles.btnRow}>
                    <button type="button" onClick={nextStep} className={styles.submitBtn}>Tiếp theo</button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className={partnerStyles.stepContent}>
                  <h3>Thông tin nhà hàng</h3>
                  <div className={styles.fieldGroup}>
                    <label>Tên nhà hàng</label>
                    <input type="text" value={form.resName} onChange={(e) => updateField('resName', e.target.value)} placeholder="Nhập tên nhà hàng" className={styles.input} />
                  </div>
                  <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                      <label>Địa chỉ</label>
                      <input type="text" value={form.address} onChange={(e) => updateField('address', e.target.value)} className={styles.input} />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label>Quận/Huyện</label>
                      <input 
                        type="text" 
                        value={form.district} 
                        onChange={(e) => updateField('district', e.target.value)} 
                        placeholder="Nhập hoặc chọn quận/huyện" 
                        className={styles.input}
                        list="districts-list"
                        required
                      />
                      <datalist id="districts-list">
                        {DISTRICTS.map(d => <option key={d} value={d} />)}
                      </datalist>
                    </div>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Loại ẩm thực</label>
                    <div className={partnerStyles.cuisineGrid}>
                      {cuisines.filter(c => c.id !== 'all').map(c => (
                        <label key={c.id} className={partnerStyles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={form.cuisine.includes(c.id)}
                            onChange={() => {
                              const newCuisine = form.cuisine.includes(c.id)
                                ? form.cuisine.filter(id => id !== c.id)
                                : [...form.cuisine, c.id];
                              updateField('cuisine', newCuisine);
                            }}
                          />
                          <span>{c.icon} {c.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                      <label>Giờ mở cửa</label>
                      <input type="time" value={form.openTime} onChange={(e) => updateField('openTime', e.target.value)} className={styles.input} />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label>Giờ đóng cửa</label>
                      <input type="time" value={form.closeTime} onChange={(e) => updateField('closeTime', e.target.value)} className={styles.input} />
                    </div>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Hình ảnh nhà hàng</label>
                    <span style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '6px', display: 'block' }}>
                      💡 Lưu ý: Hình ảnh sẽ được hiển thị trên trang chính của nhà hàng
                    </span>
                    <ImageUpload
                      images={form.images}
                      onImagesChange={(urls) => updateField('images', urls)}
                    />
                  </div>
                  <div className={partnerStyles.btnRow}>
                    <button type="button" onClick={prevStep} className={partnerStyles.backBtn}>Quay lại</button>
                    <button type="button" onClick={nextStep} className={styles.submitBtn}>Tiếp theo</button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className={partnerStyles.stepContent}>
                  <h3>Xác minh pháp lý</h3>
                  <p className={partnerStyles.hint}>Thông tin này chỉ dùng để Admin xác thực và sẽ không hiển thị công khai.</p>

                  <div className={styles.fieldGroup}>
                    <label>Mã số thuế (Tax ID) *</label>
                    <input
                      type="text"
                      value={form.taxId}
                      onChange={(e) => updateField('taxId', e.target.value)}
                      placeholder="Nhập mã số thuế doanh nghiệp"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label>Ảnh Giấy phép kinh doanh *</label>
                    <div className={partnerStyles.licenseUpload}>
                      {form.businessLicenseUrl ? (
                        <div className={partnerStyles.licensePreview}>
                          <img src={form.businessLicenseUrl} alt="Giấy phép" />
                          <button type="button" onClick={() => updateField('businessLicenseUrl', '')}>Gỡ bỏ</button>
                        </div>
                      ) : (
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            if (e.target.files && e.target.files[0]) {
                              const toastId = toast.loading('Đang tải ảnh lên...');
                              try {
                                const res = await uploadImage(e.target.files[0]);
                                updateField('businessLicenseUrl', res.url);
                                toast.success('Tải ảnh lên thành công', { id: toastId });
                              } catch (err) {
                                toast.error('Lỗi khi tải ảnh', { id: toastId });
                              }
                            }
                          }}
                        />
                      )}
                    </div>
                  </div>

                  <div className={partnerStyles.btnRow}>
                    <button type="button" onClick={prevStep} className={partnerStyles.backBtn}>Quay lại</button>
                    <button type="submit" className={styles.submitBtn} disabled={loading}>
                      {loading ? 'Đang gửi hồ sơ...' : 'Gửi yêu cầu đăng ký'}
                    </button>
                  </div>
                </div>
              )}
            </form>

            <p className={styles.loginLink}>
              Đã có tài khoản đối tác? <Link to="/login">Đăng nhập ngay</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerRegisterPage;
