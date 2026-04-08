import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Navbar.module.css';

const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/manager')) {
    return null;
  }

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    navigate('/');
  };

  const handleDashboard = () => {
    setUserMenuOpen(false);
    if (user?.role === 'admin') navigate('/admin');
    else if (user?.role === 'manager') navigate('/manager');
  };

  const getRoleLabel = (role: string) => {
    const map: Record<string, string> = {
      customer: 'Khách hàng',
      manager: 'Quản lý NH',
      admin: 'Admin',
    };
    return map[role] || role;
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>
        <Link to="/">TableNow</Link>
      </div>

      <div className={styles['search-bar']}>
        <input type="text" placeholder="Tìm nhà hàng, món ăn..." className={styles['search-input']} />
      </div>

      <div className={styles['nav-links']}>
        <Link to="/" className={`${styles['nav-link']} ${location.pathname === '/' || location.pathname === '/restaurants' ? styles.active : ''}`}>
          Trang chủ
        </Link>
      </div>

      {isAuthenticated && user ? (
        <div className={styles.userSection} ref={userMenuRef}>
          <button className={styles.userButton} onClick={() => setUserMenuOpen(!userMenuOpen)}>
            <span className={styles.userAvatar}>
              {user.avatar ? <img src={user.avatar} alt="" /> : user.name.charAt(0).toUpperCase()}
            </span>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userArrow}>{userMenuOpen ? '\u25B2' : '\u25BC'}</span>
          </button>
          {userMenuOpen && (
            <div className={styles.userDropdown}>
              <div className={styles.dropdownHeader}>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
                <span className={styles.roleBadge}>{getRoleLabel(user.role)}</span>
              </div>
              <div className={styles.dropdownDivider} />
              {user.role === 'customer' && (
                <button className={styles.dropdownItem} onClick={() => { setUserMenuOpen(false); navigate('/my-bookings'); }}>
                  Đơn đặt bàn của tôi
                </button>
              )}
              {(user.role === 'admin' || user.role === 'manager') && (
                <button className={styles.dropdownItem} onClick={handleDashboard}>
                  {user.role === 'admin' ? 'Trang quản trị' : 'Quản lý nhà hàng'}
                </button>
              )}
              <button className={styles.dropdownItem} onClick={handleLogout}>
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={styles['login-register']}>
          <button className={`${styles.button} ${styles['login-button']}`} onClick={() => navigate('/login')}>
            Đăng nhập
          </button>
          <button className={`${styles.button} ${styles['register-button']}`} onClick={() => navigate('/register')}>
            Đăng ký
          </button>
        </div>
      )}

      {/* Mobile hamburger */}
      <button className={styles.hamburger} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
        {mobileMenuOpen ? '\u2715' : '\u2630'}
      </button>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className={styles.mobileMenu}>
          <Link to="/" onClick={() => setMobileMenuOpen(false)}>Trang chủ</Link>
          {isAuthenticated && user ? (
            <>
              <div className={styles.mobileUserInfo}>
                <strong>{user.name}</strong>
                <small>{getRoleLabel(user.role)}</small>
              </div>
              {user.role === 'customer' && (
                <Link to="/my-bookings" onClick={() => setMobileMenuOpen(false)}>
                  Đơn đặt bàn của tôi
                </Link>
              )}
              {(user.role === 'admin' || user.role === 'manager') && (
                <Link
                  to={user.role === 'admin' ? '/admin' : '/manager'}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {user.role === 'admin' ? 'Trang quản trị' : 'Quản lý NH'}
                </Link>
              )}
              <button
                className={styles.mobileLogout}
                onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Đăng nhập</Link>
              <Link to="/register" onClick={() => setMobileMenuOpen(false)}>Đăng ký</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;