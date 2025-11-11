import { ReactNode, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Package, Home, TrendingUp, ClipboardList, Calendar,
  AlertTriangle, LogOut, Menu, X, ChevronLeft, ChevronRight, Users
} from 'lucide-react';
import { getCurrentMonth, getPreviousMonth, getNextMonth, formatMonth, formatMonthShort } from '../lib/utils';

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

  const isAdmin = profile?.role === 'ADMIN';

  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Home },
    { id: 'products', label: 'Produits', icon: Package },
    { id: 'movements', label: 'Mouvements', icon: TrendingUp },
    { id: 'inventory', label: 'Inventaire', icon: ClipboardList },
    { id: 'expiry', label: 'Péremptions', icon: AlertTriangle },
    { id: 'transfer', label: 'Transfert Stock', icon: Calendar },
    ...(isAdmin ? [{ id: 'users', label: 'Utilisateurs', icon: Users }] : []),
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
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
                aria-label="Toggle menu"
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              
              {/* Title as pill/badge with accent */}
              <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 hover:bg-slate-200 transition-colors max-w-[200px] sm:max-w-none">
                <div className="w-1 h-3.5 rounded-full bg-blue-600 flex-shrink-0" aria-hidden="true"></div>
                <div className="min-w-0">
                  <h1 className="text-base font-semibold text-slate-800 tracking-tight truncate">
                    CHRB
                  </h1>
                  <p className="text-xs text-slate-600 hidden sm:block truncate">Gestion de Stock</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {/* Month selector as pill */}
              <div 
                className="inline-flex items-center gap-1.5 sm:gap-2 bg-slate-100 rounded-full px-3 py-1.5 hover:bg-slate-200 transition-colors"
                aria-label={formatMonth(selectedMonth)}
              >
                <button
                  onClick={() => onMonthChange(getPreviousMonth(selectedMonth))}
                  className="p-0.5 sm:p-1 hover:bg-white rounded-full transition-colors"
                  aria-label="Mois précédent"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-700" />
                </button>
                <span className="font-medium text-slate-700 text-xs sm:text-sm whitespace-nowrap max-w-[40vw] sm:max-w-none overflow-hidden text-ellipsis">
                  <span className="md:hidden">{formatMonthShort(selectedMonth)}</span>
                  <span className="hidden md:inline">{formatMonth(selectedMonth)}</span>
                </span>
                <button
                  onClick={() => onMonthChange(getNextMonth(selectedMonth))}
                  className="p-0.5 sm:p-1 hover:bg-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={selectedMonth >= getCurrentMonth()}
                  aria-label="Mois suivant"
                >
                  <ChevronRight className="w-4 h-4 text-slate-700" />
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
                  aria-label="Déconnexion"
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
