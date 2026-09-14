import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';

// Route-level code splitting: heavy pages (Recharts, OCR flows) load on demand.
const Landing = lazy(() => import('./pages/Landing.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Upload = lazy(() => import('./pages/Upload.jsx'));
const Invoices = lazy(() => import('./pages/Invoices.jsx'));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail.jsx'));
const Demo = lazy(() => import('./pages/Demo.jsx'));

function PageFallback() {
  return <div className="flex items-center justify-center py-20 text-slate-500">Loading page…</div>;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function NotFound() {
  const location = useLocation();
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-4xl font-bold text-slate-900">404</h1>
      <p className="mt-2 text-slate-600">
        No page at <span className="font-mono">{location.pathname}</span>
      </p>
      <Link to="/dashboard" className="mt-6 inline-block rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">
        Back to dashboard
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <Register />
          </PublicOnly>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnly>
            <ForgotPassword />
          </PublicOnly>
        }
      />
      <Route path="/" element={<Suspense fallback={<PageFallback />}><Landing /></Suspense>} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
        <Route path="upload" element={<Suspense fallback={<PageFallback />}><Upload /></Suspense>} />
        <Route path="invoices" element={<Suspense fallback={<PageFallback />}><Invoices /></Suspense>} />
        <Route path="invoices/:id" element={<Suspense fallback={<PageFallback />}><InvoiceDetail /></Suspense>} />
        <Route path="demo" element={<Suspense fallback={<PageFallback />}><Demo /></Suspense>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
