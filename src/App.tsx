import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { LoginPage } from './components/LoginPage';
import { Layout } from './components/Layout';
import { DashboardPage } from './components/DashboardPage';
import { ProductsPage } from './components/ProductsPage';
import { MovementsPage } from './components/MovementsPage';
import { InventoryPage } from './components/InventoryPage';
import { ExpiryPage } from './components/ExpiryPage';
import { TransferPage } from './components/TransferPage';
import { UsersPage } from './components/UsersPage';
import { getCurrentMonth } from './lib/utils';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Layout
      currentView={currentView}
      onViewChange={setCurrentView}
      selectedMonth={selectedMonth}
      onMonthChange={setSelectedMonth}
    >
      {currentView === 'dashboard' && <DashboardPage selectedMonth={selectedMonth} />}
      {currentView === 'products' && <ProductsPage />}
      {currentView === 'movements' && <MovementsPage selectedMonth={selectedMonth} />}
      {currentView === 'inventory' && <InventoryPage selectedMonth={selectedMonth} />}
      {currentView === 'expiry' && <ExpiryPage />}
      {currentView === 'transfer' && <TransferPage selectedMonth={selectedMonth} />}
      {currentView === 'users' && <UsersPage />}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
