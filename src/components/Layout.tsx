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
      {/* Desktop/Tablet Top Navigation */}
      <nav className="hidden lg:block bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">CHRB</h1>
                <p className="text-xs text-slate-600">Gestion de Stock</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-4 py-2">
                <button
                  onClick={() => onMonthChange(getPreviousMonth(selectedMonth))}
                  className="p-1 hover:bg-white rounded transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-medium text-slate-700 min-w-[120px] text-center text-sm">
                  {formatMonth(selectedMonth)}
                </span>
                <button
                  onClick={() => onMonthChange(getNextMonth(selectedMonth))}
                  className="p-1 hover:bg-white rounded transition-colors disabled:opacity-50"
                  disabled={selectedMonth >= getCurrentMonth()}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3">
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

      {/* Mobile Top Bar */}
      <nav className="lg:hidden bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-800">CHRB</h1>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1.5">
              <button
                onClick={() => onMonthChange(getPreviousMonth(selectedMonth))}
                className="p-1 hover:bg-white rounded transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-medium text-slate-700 text-xs px-2">
                {formatMonth(selectedMonth).split(' ')[0].slice(0, 3)} {formatMonth(selectedMonth).split(' ')[1]}
              </span>
              <button
                onClick={() => onMonthChange(getNextMonth(selectedMonth))}
                className="p-1 hover:bg-white rounded transition-colors disabled:opacity-50"
                disabled={selectedMonth >= getCurrentMonth()}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <LogOut className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block sticky top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-white border-r border-slate-200">
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
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
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-20 lg:pb-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30">
        <div className="grid grid-cols-6 gap-1 px-2 py-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`
                  flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg transition-all
                  ${isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-600 active:bg-slate-100'
                  }
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''}`} />
                <span className="text-[10px] font-medium leading-tight text-center">
                  {item.label.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
