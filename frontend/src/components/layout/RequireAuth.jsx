import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-forest-900" />;
  if (!user) return <Navigate to="/admin/login" replace />;
  return children;
}
