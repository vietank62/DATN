import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { createRestaurant } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import styles from './NewRestaurantPage.module.css';
import ImageUpload from '../components/ImageUpload/ImageUpload';


const NewRestaurantPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, cuisines } = useAuth();  const [formData, setFormData] = useState({
    name: '',
    address: '',
    district: '',
    cuisine: [] as string[],
    phone: '',
    openTime: '10:00',
    closeTime: '22:00',
    totalSeats: 50,
    description: '',
    imageUrl: [] as string[],  // Array of image URLs
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const toggleCuisine = (cuisineId: string) => {
    setFormData((prev) => ({
      ...prev,
      cuisine: prev.cuisine.includes(cuisineId)
        ? prev.cuisine.filter((c) => c !== cuisineId)
        : [...prev.cuisine, cuisineId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('Lỗi xác thực. Vui lòng đăng nhập lại.');
      return;
    }

    if (!formData.name.trim()) {
      setError('Vui lòng nhập tên nhà hàng');
      return;
    }
    if (!formData.address.trim()) {
      setError('Vui lòng nhập địa chỉ');
      return;
    }
    if (!formData.district) {
      setError('Vui lòng chọn quận/huyện');
      return;
    }
    if (formData.cuisine.length === 0) {
      setError('Vui lòng chọn ít nhất một loại ẩm thực');
      return;
    }
    if (!/^0\d{9}$/.test(formData.phone)) {
      setError('Số điện thoại không hợp lệ');
      return;
    }

    setLoading(true);
    try {
      await createRestaurant({
        ...formData,
        priceRange: 'Chưa cập nhật',
        rating: 0,
        reviewCount: 0,
        featured: false,
        availableSeats: formData.totalSeats,
        managerID: parseInt(user.id),
      });

      toast.success('Tạo nhà hàng thành công! Đang chuyển đến trang quản lý...');
      navigate('/manager-dashboard');
    } catch (err: any) {
      const msg = err.message || 'Tạo nhà hàng thất bại. Vui lòng thử lại.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const districts = [
    'Quận 1', 'Quận 2', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 6', 'Quận 7', 
    'Quận 8', 'Quận 9', 'Quận 10', 'Quận 11', 'Quận 12', 'Bình Tân', 'Bình Thạnh',
    'Gò Vấp', 'Phú Nhuận', 'Tân Bình', 'Tân Phú', 'Thủ Đức', 'Cần Thơ', 'Hà Nội',
  ];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🏪 Tạo nhà hàng của bạn</h1>
          <p>Hãy điền đầy đủ thông tin để hoàn tất quá trình đăng ký</p>
        </div>

        {error && <div className={styles.errorMsg}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label>Tên nhà hàng *</label>
            <input
              type="text"
              placeholder="Nhập tên nhà hàng"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <label>Địa chỉ *</label>
            <input
              type="text"
              placeholder="Nhập địa chỉ đầy đủ"
              value={formData.address}
              onChange={(e) => updateField('address', e.target.value)}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label>Quận/Huyện *</label>
              <select
                value={formData.district}
                onChange={(e) => updateField('district', e.target.value)}
                className={styles.input}
                required
              >
                <option value="">-- Chọn quận/huyện --</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label>Số điện thoại *</label>
              <input
                type="tel"
                placeholder="0901234567"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className={styles.input}
                required
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label>Loại ẩm thực *</label>
            <div className={styles.cuisineGrid}>
              {cuisines.filter(c => c.id !== 'all').map((cuisine) => (
                <label key={cuisine.id} className={styles.cuisineCheckbox}>
                  <input
                    type="checkbox"
                    checked={formData.cuisine.includes(cuisine.id)}
                    onChange={() => toggleCuisine(cuisine.id)}
                  />
                  <span>{cuisine.icon} {cuisine.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label>Số ghế *</label>
              <input
                type="number"
                placeholder="Tổng số ghế"
                value={formData.totalSeats}
                onChange={(e) => updateField('totalSeats', parseInt(e.target.value))}
                className={styles.input}
                min="10"
                required
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label>Giờ mở cửa</label>
              <input
                type="time"
                value={formData.openTime}
                onChange={(e) => updateField('openTime', e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label>Giờ đóng cửa</label>
              <input
                type="time"
                value={formData.closeTime}
                onChange={(e) => updateField('closeTime', e.target.value)}
                className={styles.input}
              />            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label>Hình ảnh nhà hàng</label>
            <ImageUpload
              images={formData.imageUrl}
              onImagesChange={(urls) => updateField('imageUrl', urls)}
              onError={(error) => setError(error)}
              maxSize={5}
              disabled={loading}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label>Mô tả nhà hàng</label>
            <textarea
              placeholder="Mô tả ngắn về nhà hàng của bạn"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              className={styles.textarea}
              rows={4}
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Đang tạo nhà hàng...' : 'Hoàn tất đăng ký'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default NewRestaurantPage;
