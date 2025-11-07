import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Plus, Search } from 'lucide-react';
import { formatDate, exportToCSV } from '../lib/utils';
import ConfirmModal from './ConfirmModal';
import { useExpiries } from '../lib/hooks';
import { PaginationControls } from './PaginationControls';
import { VirtualizedList } from './VirtualizedList';
import { ExpiryRow } from './ExpiryRow';
import type { Database } from '../lib/database.types';

type Expiry = Database['public']['Tables']['peremptions']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

interface ExpiryWithProduct extends Expiry {
  products: Pick<Product, 'id' | 'code' | 'nom'>;
}

export function ExpiryPage() {
  const { showToast } = useToast();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'expired' | 'soon'>('all');
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; id: string }>({ show: false, id: '' });
  
  const [formData, setFormData] = useState({
    product_id: '',
    date_peremption: '',
    quantite: 0,
    emplacement: '',
  });

  // Use React Query for data fetching
  const { data: expiryData, isLoading } = useExpiries({
    page,
    pageSize,
    searchTerm,
    sortBy: 'date_peremption',
    sortOrder: 'asc',
  });

  const expiries = expiryData?.data || [];
  const total = expiryData?.total || 0;
  const pageCount = expiryData?.pageCount || 0;

  const handleDelete = useCallback((id: string) => {
    setConfirmDelete({ show: true, id });
  }, []);

  const handleConfirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('peremptions')
        .delete()
        .eq('id', confirmDelete.id);

      if (error) throw error;

      showToast('success', 'Péremption supprimée avec succès.');
      setConfirmDelete({ show: false, id: '' });
    } catch (error) {
      console.error('Error deleting expiry:', error);
      showToast('error', 'Erreur lors de la suppression de la péremption.');
    }
  };

  const handleExport = () => {
    const exportData = expiries.map(e => ({
      'Date péremption': formatDate(e.date_peremption),
      'Produit': e.products.nom,
      'Code': e.products.code,
      'Quantité': e.quantite,
      'Emplacement': e.emplacement || '',
    }));

    exportToCSV(exportData, 'peremptions.csv');
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
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'expired' | 'soon')}
            className="border rounded-lg px-4 py-2"
          >
            <option value="all">Tous</option>
            <option value="expired">Expirés</option>
            <option value="soon">Bientôt expirés</option>
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
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nouvelle péremption
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
              items={expiries}
              height={600}
              itemSize={100}
              renderItem={(expiry) => (
                <ExpiryRow
                  expiry={expiry}
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
          title="Supprimer la péremption"
          message="Êtes-vous sûr de vouloir supprimer cette péremption ? Cette action est irréversible."
          type="danger"
        />
      )}

      {/* Keep your existing form modal */}
    </div>
  );
}