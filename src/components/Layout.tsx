import { ReactNode, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Package, Home, TrendingUp, ClipboardList, Calendar,
  AlertTriangle, LogOut, Menu, X, ChevronLeft, ChevronRight, Users,
  PanelLeftClose, PanelLeftOpen, Moon, Sun
} from 'lucide-react';
import { getCurrentMonth, getPreviousMonth, getNextMonth, formatMonth, formatMonthShort } from '../lib/utils';
import { useSidebarAlerts } from '../lib/hooks';

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('dark_mode') === 'true';
  });
  const { data: alerts } = useSidebarAlerts();

  const isAdmin = profile?.role === 'ADMIN';

  // Badge counts for sidebar items
  const badgeCounts: Record<string, number> = {
    expiry: alerts?.expiryAlerts || 0,
    products: alerts?.stockAlerts || 0,
  };

  // Close sidebar on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [sidebarOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Persist dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('dark_mode', String(darkMode));
  }, [darkMode]);

  // Persist sidebar collapsed
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 transition-colors duration-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label={sidebarOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                aria-expanded={sidebarOpen}
                aria-controls="sidebar-nav"
              >
                {sidebarOpen ? <X className="w-6 h-6 dark:text-slate-200" /> : <Menu className="w-6 h-6 dark:text-slate-200" />}
              </button>
              
              {/* Title as pill/badge with accent */}
              <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors max-w-[200px] sm:max-w-none">
                <div className="w-1 h-3.5 rounded-full bg-blue-600 flex-shrink-0" aria-hidden="true"></div>
                <div className="min-w-0">
                  <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100 tracking-tight truncate">
                    CHRB
                  </h1>
                  <p className="text-xs text-slate-600 dark:text-slate-400 hidden sm:block truncate">Gestion de Stock</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {/* Dark mode toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title={darkMode ? 'Mode clair' : 'Mode sombre'}
                aria-label={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
              >
                {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
              </button>

              {/* Month selector as pill */}
              <div 
                className="inline-flex items-center gap-1.5 sm:gap-2 bg-slate-100 dark:bg-slate-700 rounded-full px-3 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                aria-label={formatMonth(selectedMonth)}
              >
                <button
                  onClick={() => onMonthChange(getPreviousMonth(selectedMonth))}
                  className="p-0.5 sm:p-1 hover:bg-white dark:hover:bg-slate-500 rounded-full transition-colors"
                  aria-label="Mois précédent"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                </button>
                <span className="font-medium text-slate-700 dark:text-slate-200 text-xs sm:text-sm whitespace-nowrap max-w-[40vw] sm:max-w-none overflow-hidden text-ellipsis">
                  <span className="md:hidden">{formatMonthShort(selectedMonth)}</span>
                  <span className="hidden md:inline">{formatMonth(selectedMonth)}</span>
                </span>
                <button
                  onClick={() => onMonthChange(getNextMonth(selectedMonth))}
                  className="p-0.5 sm:p-1 hover:bg-white dark:hover:bg-slate-500 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={selectedMonth >= getCurrentMonth()}
                  aria-label="Mois suivant"
                >
                  <ChevronRight className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{profile?.nom}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{profile?.role}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Déconnexion"
                  aria-label="Déconnexion"
                >
                  <LogOut className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside
          id="sidebar-nav"
          role="navigation"
          aria-label="Menu principal"
          className={`
            fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] self-stretch bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700
            transition-all duration-300 z-20 overflow-y-auto
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
            ${sidebarOpen ? 'w-64' : 'w-64'}
          `}
        >
          {/* Desktop collapse toggle */}
          <div className="hidden lg:flex items-center justify-end p-2 border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={sidebarCollapsed ? 'Agrandir le menu' : 'Réduire le menu'}
            >
              {sidebarCollapsed
                ? <PanelLeftOpen className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                : <PanelLeftClose className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              }
            </button>
          </div>

          <nav className={`p-2 ${sidebarCollapsed ? 'lg:px-1' : 'lg:p-4'} space-y-1`}>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              const badge = badgeCounts[item.id] || 0;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onViewChange(item.id);
                    setSidebarOpen(false);
                  }}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`
                    w-full flex items-center gap-3 rounded-lg transition-colors
                    ${sidebarCollapsed ? 'lg:justify-center lg:px-0 lg:py-3 px-4 py-3' : 'px-4 py-3'}
                    ${isActive
                      ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className={`flex-1 text-left ${sidebarCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                  {badge > 0 && (
                    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full ${sidebarCollapsed ? 'lg:absolute lg:top-0 lg:right-0 lg:min-w-[16px] lg:h-4 lg:text-[10px]' : 'ml-auto'}`}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="sm:hidden absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </button>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-10 lg:hidden"
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
