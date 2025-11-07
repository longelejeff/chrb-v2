import { createContext, useContext, useState, ReactNode } from 'react';
import { CheckCircle, Info, AlertTriangle, XCircle, X } from 'lucide-react';

type ToastType = 'success' | 'info' | 'warning' | 'error';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function showToast(type: ToastType, message: string) {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  }

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }

  const iconMap = {
    success: CheckCircle,
    info: Info,
    warning: AlertTriangle,
    error: XCircle,
  };

  const colorMap = {
    success: 'bg-green-50 border-green-200 text-green-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  };

  const iconColorMap = {
    success: 'text-green-600',
    info: 'text-blue-600',
    warning: 'text-amber-600',
    error: 'text-red-600',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {toasts.map((toast) => {
          const Icon = iconMap[toast.type];
          return (
            <div
              key={toast.id}
              className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-slide-in ${colorMap[toast.type]}`}
              role="alert"
            >
              <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconColorMap[toast.type]}`} />
              <p className="flex-1 text-sm font-medium">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 hover:bg-black/5 rounded transition-colors flex-shrink-0"
                aria-label="Fermer la notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
