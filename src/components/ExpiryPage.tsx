import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Plus, Search, Trash2, AlertTriangle, X, Save } from 'lucide-react';
import { formatDate, getDaysUntilExpiry, exportToCSV } from '../lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import ConfirmModal from './ConfirmModal';
import type { Database } from '../lib/database.types';

type Expiry = Database['public']['Tables']['peremptions']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

interface ExpiryWithProduct extends Expiry {
  product?: Product;
}

export function ExpiryPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [expiries, setExpiries] = useState<ExpiryWithProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'expired' | 'soon'>('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; id: string }>({ show: false, id: '' });
  const [formData, setFormData] = useState({
    product_id: '',
    date_peremption: '',
    quantite: 0,
    emplacement: '',
  });

  useEffect(() => {
    loadProducts();
    loadExpiries();
  }, []);

  async function loadProducts() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('actif', true)
        .order('nom');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }

  async function loadExpiries() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('peremptions')
        .select('*, product:products(*)')
        .gt('quantite', 0) // Only show lots with stock > 0
        .order('date_peremption', { ascending: true });

      if (error) throw error;
      setExpiries(data as any || []);
    } catch (error) {
      console.error('Error loading expiries:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('peremptions')
        .insert([formData]);

      if (error) throw error;

      setFormData({
        product_id: '',
        date_peremption: '',
        quantite: 0,
        emplacement: '',
      });
      setShowModal(false);
      loadExpiries();
      
      // Invalidate dashboard cache to refresh expiry alerts
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      
      showToast('success', 'Péremption ajoutée avec succès.');
    } catch (error: any) {
      showToast('error', `Erreur: ${error.message}`);
    }
  }

  async function handleDelete() {
    try {
      const { error } = await supabase
        .from('peremptions')
        .delete()
        .eq('id', confirmDelete.id);

      if (error) throw error;
      loadExpiries();
      
      // Invalidate dashboard cache
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      
      showToast('success', 'Péremption supprimée avec succès.');
    } catch (error: any) {
      showToast('error', `Erreur: ${error.message}`);
    }
  }

  function handleExport() {
    const exportData = filteredExpiries.map(e => ({
      produit: e.product?.nom || '',
      code: e.product?.code || '',
      date_peremption: formatDate(e.date_peremption),
      quantite: e.quantite,
      emplacement: e.emplacement || '',
      jours_restants: getDaysUntilExpiry(e.date_peremption),
    }));
    exportToCSV(exportData, 'peremptions');
  }

  const filteredExpiries = expiries.filter(e => {
    // Only show expiries with stock > 0
    if (e.quantite <= 0) return false;
    
    const matchesSearch = e.product?.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         e.product?.code.toLowerCase().includes(searchTerm.toLowerCase());

    const days = getDaysUntilExpiry(e.date_peremption);
    let matchesFilter = true;

    if (filterType === 'expired') {
      matchesFilter = days < 0;
    } else if (filterType === 'soon') {
      matchesFilter = days >= 0 && days <= 30;
    }

    return matchesSearch && matchesFilter;
  });

  // Only count expiries with stock > 0
  const expiredCount = expiries.filter(e => e.quantite > 0 && getDaysUntilExpiry(e.date_peremption) < 0).length;
  const soonCount = expiries.filter(e => {
    if (e.quantite <= 0) return false;
    const days = getDaysUntilExpiry(e.date_peremption);
    return days >= 0 && days <= 30;
  }).length;

  function getExpiryStatus(expiryDate: string) {
    const days = getDaysUntilExpiry(expiryDate);

    if (days < 0) {
      return { label: 'Expiré', color: 'bg-red-100 text-red-700', days: Math.abs(days) };
    } else if (days <= 30) {
      return { label: 'Bientôt expiré', color: 'bg-orange-100 text-orange-700', days };
    } else {
      return { label: 'Valide', color: 'bg-green-100 text-green-700', days };
    }
  }

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Gestion des Péremptions</h2>
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex-shrink-0"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Ajouter</span>
            <span className="sm:hidden">Nouveau</span>
          </button>
        </div>
        <button
          onClick={handleExport}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-xs sm:text-sm font-medium sm:self-start"
        >
          Exporter
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-slate-600">Total</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">{expiries.length}</p>
            </div>
            <div className="bg-blue-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-slate-600">Bientôt expirés</p>
              <p className="text-2xl sm:text-3xl font-bold text-orange-600 mt-1">{soonCount}</p>
            </div>
            <div className="bg-orange-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-slate-600">Expirés</p>
              <p className="text-2xl sm:text-3xl font-bold text-red-600 mt-1">{expiredCount}</p>
            </div>
            <div className="bg-red-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-3 sm:mb-4">
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-0 px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="w-full sm:w-auto px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm flex-shrink-0"
          >
            <option value="all">Tous</option>
            <option value="soon">Bientôt expirés (≤30j)</option>
            <option value="expired">Expirés</option>
          </select>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Produit</th>
                  <th className="text-left py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Date</th>
                  <th className="text-right py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Qté</th>
                  <th className="hidden md:table-cell text-left py-3 px-4 text-sm font-semibold text-slate-700">Emplacement</th>
                  <th className="text-left py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Statut</th>
                  <th className="text-right py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpiries.map((expiry) => {
                  const status = getExpiryStatus(expiry.date_peremption);
                  return (
                    <tr key={expiry.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-3 sm:px-4">
                        <div className="text-xs sm:text-sm text-slate-700 font-medium">{expiry.product?.nom}</div>
                        {expiry.emplacement && (
                          <div className="md:hidden text-xs text-slate-500 mt-0.5">{expiry.emplacement}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-xs sm:text-sm text-slate-700 whitespace-nowrap">{formatDate(expiry.date_peremption)}</td>
                      <td className="py-3 px-3 sm:px-4 text-xs sm:text-sm text-slate-700 text-right">{expiry.quantite}</td>
                      <td className="hidden md:table-cell py-3 px-4 text-sm text-slate-600">{expiry.emplacement || '-'}</td>
                      <td className="py-3 px-3 sm:px-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                          <span className="hidden sm:inline">{status.label} </span>({status.days}j)
                        </span>
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-right">
                        <button
                          onClick={() => setConfirmDelete({ show: true, id: expiry.id })}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredExpiries.length === 0 && (
            <div className="text-center py-8 text-slate-500">Aucune péremption trouvée</div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-xl w-full max-w-md my-8">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">Ajouter une péremption</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Produit <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                >
                  <option value="">Sélectionner un produit</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date de péremption <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.date_peremption}
                  onChange={(e) => setFormData({ ...formData, date_peremption: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantité <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  step="1"
                  min="1"
                  value={formData.quantite}
                  onChange={(e) => setFormData({ ...formData, quantite: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Emplacement</label>
                <input
                  type="text"
                  value={formData.emplacement}
                  onChange={(e) => setFormData({ ...formData, emplacement: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  placeholder="Emplacement de stockage..."
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full sm:w-auto px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm sm:text-base"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base"
                >
                  <Save className="w-4 h-4" />
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDelete.show}
        onClose={() => setConfirmDelete({ show: false, id: '' })}
        onConfirm={handleDelete}
        title="Supprimer cette péremption"
        message="Voulez-vous vraiment supprimer cet enregistrement ? Cette action est irréversible."
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
      />
    </div>
  );
}
