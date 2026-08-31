import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/Navbar/navbar';
import { Footer } from '../components/Footer/footer';
import { TableNowChatbot } from '../components/Chatbot/TableNowChatbot';

export default function MainLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header dùng chung */}
      <Navbar />

      {/* Thành phần KHÁC NHAU ở mỗi trang sẽ được React Router bơm vào <Outlet /> */}
      <main className="grow bg-gray-50">
        <Outlet />
      </main>

      {/* Footer dùng chung */}
      <Footer />
      <TableNowChatbot />
    </div>
  );
}
