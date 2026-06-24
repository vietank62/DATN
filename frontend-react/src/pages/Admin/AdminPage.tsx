import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

function AdminPage() {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return <Navigate to='/' replace />;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-extrabold text-gray-800 mb-4">
        Admin Dashboard
      </h1>
    </div>
  );
}

export default AdminPage;
