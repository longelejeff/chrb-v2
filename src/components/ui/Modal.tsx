import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ title, onClose, children, maxWidth = 'max-w-2xl' }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className={`bg-white rounded-xl shadow-xl w-full ${maxWidth} my-8`}>
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200">
          <h3 className="text-lg sm:text-xl font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
