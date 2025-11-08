import { ReactNode, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Package, Home, TrendingUp, ClipboardList, Calendar,
  AlertTriangle, LogOut, Menu, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import { getCurrentMonth, getPreviousMonth, getNextMonth, formatMonth } from '../lib/utils';

interface LayoutProps {
  children: ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}

export function Layout({ children, currentView, onViewChange, selectedMonth, onMonthChange }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Home },
    { id: 'products', label: 'Produits', icon: Package },
    { id: 'movements', label: 'Mouvements', icon: TrendingUp },
    { id: 'inventory', label: 'Inventaire', icon: ClipboardList },
    { id: 'expiry', label: 'Péremptions', icon: AlertTriangle },
    { id: 'transfer', label: 'Transfert Stock', icon: Calendar },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800">CHRB</h1>
                  <p className="text-xs text-slate-600">Gestion de Stock</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 rounded-lg px-2 sm:px-4 py-2">
                <button
                  onClick={() => onMonthChange(getPreviousMonth(selectedMonth))}
                  className="p-1 hover:bg-white rounded transition-colors"
                >
                  <ChevronLeft className="w-3 sm:w-4 h-3 sm:h-4" />
                </button>
                <span className="font-medium text-slate-700 min-w-[90px] sm:min-w-[120px] text-center text-xs sm:text-sm">
                  {formatMonth(selectedMonth)}
                </span>
                <button
                  onClick={() => onMonthChange(getNextMonth(selectedMonth))}
                  className="p-1 hover:bg-white rounded transition-colors disabled:opacity-50"
                  disabled={selectedMonth >= getCurrentMonth()}
                >
                  <ChevronRight className="w-3 sm:w-4 h-3 sm:h-4" />
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-800">{profile?.nom}</p>
                  <p className="text-xs text-slate-600">{profile?.role}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Déconnexion"
                >
                  <LogOut className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        <aside
          className={`
            fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-white border-r border-slate-200
            transition-transform duration-300 z-20
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onViewChange(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                    ${isActive
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-slate-700 hover:bg-slate-50'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="sm:hidden absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </button>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-10 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
