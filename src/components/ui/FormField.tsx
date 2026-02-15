interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}

export function FormField({ label, required, error, children, className = '', hint }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-slate-500 text-xs mt-1">{hint}</p>}
      {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
    </div>
  );
}
