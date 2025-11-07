import { memo } from 'react';
import { formatDate, formatNumber, formatCurrency } from '../lib/utils';
import { Trash2 } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Movement = Database['public']['Tables']['mouvements']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

interface MovementWithProduct extends Movement {
  products: Pick<Product, 'id' | 'code' | 'nom'>;
}

interface MovementRowProps {
  movement: MovementWithProduct;
  onDelete: (id: string) => void;
}

export const MovementRow = memo(({ movement, onDelete }: MovementRowProps) => {
  const getMovementTypeColor = (type: Movement['type_mouvement']) => {
    switch (type) {
      case 'ENTREE':
        return 'text-green-600';
      case 'SORTIE':
        return 'text-red-600';
      case 'AJUSTEMENT':
        return 'text-orange-600';
      case 'OUVERTURE':
        return 'text-blue-600';
      case 'MISE_AU_REBUT':
        return 'text-purple-600';
      default:
        return 'text-slate-600';
    }
  };

  const getMovementTypeLabel = (type: Movement['type_mouvement']) => {
    switch (type) {
      case 'ENTREE':
        return 'Entrée';
      case 'SORTIE':
        return 'Sortie';
      case 'AJUSTEMENT':
        return 'Ajustement';
      case 'OUVERTURE':
        return 'Stock initial';
      case 'MISE_AU_REBUT':
        return 'Mise au rebut';
      default:
        return type;
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border-b border-slate-200 hover:bg-slate-50">
      <div className="flex-1">
        <div className="flex items-start">
          <div className="flex-1">
            <h3 className="font-medium">{movement.products.nom}</h3>
            <p className="text-sm text-slate-500">Code: {movement.products.code}</p>
            <p className="text-sm text-slate-500">
              {formatDate(movement.date_mouvement)} - {movement.note}
            </p>
          </div>
          <div className="text-right">
            <p className={`font-medium ${getMovementTypeColor(movement.type_mouvement)}`}>
              {getMovementTypeLabel(movement.type_mouvement)}
            </p>
            <p className="text-sm text-slate-500">
              {formatNumber(movement.quantite)} unités
            </p>
            <p className="text-sm text-slate-500">
              {formatCurrency(movement.valeur_totale || 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        <button
          onClick={() => onDelete(movement.id)}
          className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

MovementRow.displayName = 'MovementRow';