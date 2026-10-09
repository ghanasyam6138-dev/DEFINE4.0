import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { MainLayout } from './components/layout/MainLayout';
import { RoleGuard } from './components/common/RoleGuard';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { StaffAccessPage } from './pages/StaffAccessPage';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { ParkingDetailPage } from './pages/ParkingDetailPage';
import { BookingPage } from './pages/BookingPage';
import { TicketPage } from './pages/TicketPage';
import { PaymentPage } from './pages/PaymentPage';
import { StaffDashboard } from './pages/StaffDashboard';
import { WalkInCashPage } from './pages/WalkInCashPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { OperationsDashboard } from './pages/OperationsDashboard';
import { LayoutBuilderPage } from './pages/LayoutBuilderPage';
import { BlockedCarPage } from './pages/BlockedCarPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              {/* Public Routes */}
              <Route index element={<LandingPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route
                path="staff/access"
                element={
                  <RoleGuard
                    disallowedRoles={['customer']}
                    allowUnauthenticated={true}
                  >
                    <StaffAccessPage />
                  </RoleGuard>
                }
              />
              <Route path="parking/:id" element={<ParkingDetailPage />} />
              <Route
                path="book/:id"
                element={
                  <RoleGuard
                    allowedRoles={['customer']}
                  >
                    <BookingPage />
                  </RoleGuard>
                }
              />
              <Route path="ticket/:bookingId" element={<TicketPage />} />
              <Route path="pay/:visitId" element={<PaymentPage />} />
              <Route path="blocked-car" element={<BlockedCarPage />} />
              <Route path="settings" element={<SettingsPage />} />

              {/* Customer Protected Route - Customer Only */}
              <Route
                path="customer"
                element={
                  <RoleGuard allowedRoles={['customer']}>
                    <CustomerDashboard />
                  </RoleGuard>
                }
              />

              {/* Staff Protected Route - Staff Only */}
              <Route
                path="staff"
                element={
                  <RoleGuard allowedRoles={['staff']}>
                    <StaffDashboard />
                  </RoleGuard>
                }
              />

              {/* Staff Walk-in Cash Booking */}
              <Route
                path="staff/walkin"
                element={
                  <RoleGuard allowedRoles={['staff']}>
                    <WalkInCashPage />
                  </RoleGuard>
                }
              />

              <Route
                path="admin"
                element={
                  <RoleGuard allowedRoles={['parking_admin', 'platform_admin']}>
                    <AdminDashboard />
                  </RoleGuard>
                }
              />
              <Route
                path="admin/operations"
                element={
                  <RoleGuard allowedRoles={['parking_admin', 'platform_admin']}>
                    <OperationsDashboard />
                  </RoleGuard>
                }
              />
              <Route
                path="builder/:id"
                element={
                  <RoleGuard allowedRoles={['parking_admin', 'platform_admin']}>
                    <LayoutBuilderPage />
                  </RoleGuard>
                }
              />

              {/* Catch-all 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
