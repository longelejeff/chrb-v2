import { memo } from 'react';
import { formatDate, getDaysUntilExpiry } from '../lib/utils';
import { Trash2 } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Expiry = Database['public']['Tables']['peremptions']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

interface ExpiryWithProduct extends Expiry {
  products: Pick<Product, 'id' | 'code' | 'nom'>;
}

interface ExpiryRowProps {
  expiry: ExpiryWithProduct;
  onDelete: (id: string) => void;
}

export const ExpiryRow = memo(({ expiry, onDelete }: ExpiryRowProps) => {
  const daysUntil = getDaysUntilExpiry(expiry.date_peremption);
  
  const getExpiryColor = (days: number) => {
    if (days < 0) return 'text-red-600';
    if (days < 90) return 'text-orange-600';
    return 'text-slate-600';
  };

  const getExpiryStatus = (days: number) => {
    if (days < 0) return 'Expiré';
    if (days === 0) return "Expire aujourd'hui";
    if (days === 1) return 'Expire demain';
    return `Expire dans ${days} jours`;
  };

  return (
    <div className="flex items-center justify-between p-4 border-b border-slate-200 hover:bg-slate-50">
      <div className="flex-1">
        <div className="flex items-start">
          <div className="flex-1">
            <h3 className="font-medium">{expiry.products.nom}</h3>
            <p className="text-sm text-slate-500">Code: {expiry.products.code}</p>
            <p className="text-sm text-slate-500">
              Emplacement: {expiry.emplacement || 'Non spécifié'}
            </p>
          </div>
          <div className="text-right">
            <p className={`font-medium ${getExpiryColor(daysUntil)}`}>
              {getExpiryStatus(daysUntil)}
            </p>
            <p className="text-sm text-slate-500">
              {formatDate(expiry.date_peremption)}
            </p>
            <p className="text-sm text-slate-500">
              Quantité: {expiry.quantite}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        <button
          onClick={() => onDelete(expiry.id)}
          className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

ExpiryRow.displayName = 'ExpiryRow';