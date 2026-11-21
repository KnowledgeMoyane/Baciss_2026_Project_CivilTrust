import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import MunicipalDashboard from './pages/MunicipalDashboard';
import CreateFundTender from './pages/CreateFundTender';
import ActiveTenders from './pages/ActiveTenders';
import ContractorDashboard from './pages/ContractorDashboard';
import WardCommittee from './pages/WardCommittee';
import CitizenScanner from './pages/CitizenScanner';
import useWallet from './hooks/useWallet';

const BG_IMAGE = 'https://lh3.googleusercontent.com/aida/ALJJyrAJM8z7ZyQHT-JZrDDecGvFrhYLw5tUClB50Dgk57s30tgUKgjW1GHkXyRbpRhZ_Wi0RbpbQwJgQmmrcKNXyqAQPQQuX6ucSZRz-KI9GPGwk0uVbRx9aaqshjoeFYVArPB_sIHh4QxGCP47eumyok3zNniSPlUsuC-16jWud7YaH2wO88MPn1mJ_3NO0q9K5jhnJjokuiIa8cja-KooHBeWPRKlM1RzFDby8mZ0RDWBgQ';

// Route guard — redirects to login if no wallet connected or wrong role
function RequireRole({ allowed, children }) {
  const { isConnected, role } = useWallet();

  if (!isConnected) return <Navigate to="/login" replace />;
  if (!allowed.includes(role)) return <Navigate to="/login" replace />;

  return children;
}

export default function App() {
  const { shortAddress, role } = useWallet();

  return (
    <Routes>
      {/* Login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Municipal Pages (requires municipal role) */}
      <Route element={
        <RequireRole allowed={['municipal']}>
          <DashboardLayout sidebarVariant="municipal" userName={shortAddress} role="Municipal Official" bgImage={BG_IMAGE} />
        </RequireRole>
      }>
        <Route path="/dashboard" element={<MunicipalDashboard />} />
        <Route path="/create-tender" element={<CreateFundTender />} />
        <Route path="/tenders" element={<ActiveTenders />} />
      </Route>

      {/* Contractor (requires contractor role) */}
      <Route element={
        <RequireRole allowed={['contractor']}>
          <DashboardLayout sidebarVariant="contractor" userName={shortAddress} role="Contractor" compact />
        </RequireRole>
      }>
        <Route path="/contractor" element={<ContractorDashboard />} />
      </Route>

      {/* Ward Committee (requires ward role) */}
      <Route element={
        <RequireRole allowed={['ward']}>
          <DashboardLayout sidebarVariant="ward" userName={shortAddress} role="Ward Committee Rep" compact />
        </RequireRole>
      }>
        <Route path="/ward-committee" element={<WardCommittee />} />
      </Route>

      {/* Citizen Scanner — OPEN ACCESS, no wallet needed */}
      <Route element={<DashboardLayout sidebarVariant="citizen" userName="" role="" compact />}>
        <Route path="/citizen" element={<CitizenScanner />} />
      </Route>

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
