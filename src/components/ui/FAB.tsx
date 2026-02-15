import { Plus } from 'lucide-react';

interface FABProps {
  onClick: () => void;
  label?: string;
}

export function FAB({ onClick, label = 'Créer' }: FABProps) {
  return (
    <button
      onClick={onClick}
      className="sm:hidden fixed bottom-6 right-6 w-14 h-14 flex items-center justify-center bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all duration-200 z-40 hover:scale-110 print:hidden"
      aria-label={label}
    >
      <Plus className="w-6 h-6" />
    </button>
  );
}
