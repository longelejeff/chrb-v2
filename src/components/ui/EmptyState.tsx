interface EmptyStateProps {
  message?: string;
}

export function EmptyState({ message = 'Aucun résultat trouvé' }: EmptyStateProps) {
  return (
    <div className="text-center py-8 text-slate-500 text-sm">{message}</div>
  );
}
