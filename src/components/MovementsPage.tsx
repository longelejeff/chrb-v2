import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Plus, Search } from 'lucide-react';
import { formatDate, formatNumber, exportToCSV } from '../lib/utils';
import ConfirmModal from './ConfirmModal';
import { useMovements } from '../lib/hooks';
import { PaginationControls } from './PaginationControls';
import { VirtualizedList } from './VirtualizedList';
import { MovementRow } from './MovementRow';
import type { Database } from '../lib/database.types';

type Movement = Database['public']['Tables']['mouvements']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

interface MovementWithProduct extends Movement {
  products: Pick<Product, 'id' | 'code' | 'nom'>;
}

export function MovementsPage({ selectedMonth }: { selectedMonth: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; id: string }>({ show: false, id: '' });

  const [formData, setFormData] = useState({
    product_id: '',
    type_mouvement: 'ENTREE' as Movement['type_mouvement'],
    quantite: 0,
    date_mouvement: new Date().toISOString().split('T')[0],
    note: '',
    prix_unitaire: 0,
  });

  // Use React Query for data fetching
  const { data: movementData, isLoading } = useMovements({
    page,
    pageSize,
    searchTerm,
    sortBy: 'date_mouvement',
    sortOrder: 'desc',
  });

  const movements = movementData?.data || [];
  const total = movementData?.total || 0;
  const pageCount = movementData?.pageCount || 0;

  const handleDelete = useCallback((id: string) => {
    setConfirmDelete({ show: true, id });
  }, []);

  const handleConfirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('mouvements')
        .delete()
        .eq('id', confirmDelete.id);

      if (error) throw error;

      showToast('success', 'Mouvement supprimé avec succès.');
      setConfirmDelete({ show: false, id: '' });
    } catch (error) {
      console.error('Error deleting movement:', error);
      showToast('error', 'Erreur lors de la suppression du mouvement.');
    }
  };

  const handleExport = () => {
    const exportData = movements.map(m => ({
      'Date': formatDate(m.date_mouvement),
      'Type': m.type_mouvement,
      'Produit': m.products.nom,
      'Code': m.products.code,
      'Quantité': m.quantite,
      'Prix unitaire': m.prix_unitaire || 0,
      'Valeur totale': m.valeur_totale || 0,
      'Note': m.note || '',
    }));

    exportToCSV(exportData, `mouvements_${selectedMonth}.csv`);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-2 top-2.5" />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border rounded-lg px-4 py-2"
          >
            <option value="ALL">Tous les types</option>
            <option value="ENTREE">Entrées</option>
            <option value="SORTIE">Sorties</option>
            <option value="AJUSTEMENT">Ajustements</option>
            <option value="OUVERTURE">Stock initial</option>
            <option value="MISE_AU_REBUT">Mise au rebut</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Exporter
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nouveau mouvement
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Chargement...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0">
            <VirtualizedList
              items={movements}
              height={600}
              itemSize={100}
              renderItem={(movement) => (
                <MovementRow
                  movement={movement}
                  onDelete={handleDelete}
                />
              )}
              className="border rounded-lg overflow-auto bg-white"
            />
          </div>

          <PaginationControls
            currentPage={page}
            pageCount={pageCount}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      {confirmDelete.show && (
        <ConfirmModal
          isOpen={confirmDelete.show}
          onClose={() => setConfirmDelete({ show: false, id: '' })}
          onConfirm={handleConfirmDelete}
          title="Supprimer le mouvement"
          message="Êtes-vous sûr de vouloir supprimer ce mouvement ? Cette action est irréversible."
          type="danger"
        />
      )}

      {/* Keep your existing form modal */}
    </div>
  );
}