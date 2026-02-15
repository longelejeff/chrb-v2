import type { LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: LucideIcon;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-slate-600 text-white hover:bg-slate-700',
  success: 'bg-green-600 text-white hover:bg-green-700',
  warning: 'bg-amber-600 text-white hover:bg-amber-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
};

export function Button({ variant = 'primary', icon: Icon, children, className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
      {children}
    </button>
  );
}
