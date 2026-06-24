import { Outlet } from 'react-router-dom';
import { Auth } from '../components/Navbar/auth';
export default function ManagerLayout() {
    return (
        <div className="flex flex-col min-h-screen">
            {/* Header dùng chung */}
            <Auth />

            {/* Thành phần KHÁC NHAU ở mỗi trang sẽ được React Router bơm vào <Outlet /> */}
            <main className="flex-grow bg-gray-50">
                <Outlet />
            </main>
        </div>
    );
}