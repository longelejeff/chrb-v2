import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ title, onClose, children, maxWidth = 'max-w-2xl' }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center sm:p-4 z-50 overflow-y-auto">
      <div className={`bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full ${maxWidth} sm:my-8 max-h-[90vh] sm:max-h-[85vh] flex flex-col`}>
        <div className="flex items-center justify-between p-3 sm:p-4 md:p-6 border-b border-slate-200 flex-shrink-0">
          <h3 className="text-base sm:text-lg md:text-xl font-bold text-slate-800 truncate pr-2">{title}</h3>
          <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
