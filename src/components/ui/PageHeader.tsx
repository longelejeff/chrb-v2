interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
      <div>
        <h2 className="text-lg sm:text-2xl font-bold text-slate-800">{title}</h2>
        {subtitle && <p className="text-xs sm:text-sm text-slate-600 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="hidden sm:flex items-center gap-2">{actions}</div>}
    </div>
  );
}
