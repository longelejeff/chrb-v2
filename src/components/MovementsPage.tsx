import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Plus, Search, Upload, Trash2 } from 'lucide-react';
import { formatDate, formatNumber, exportToCSV, formatCurrency } from '../lib/utils';
import ConfirmModal from './ConfirmModal';
import type { Database } from '../lib/database.types';

type Movement = Database['public']['Tables']['mouvements']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

interface MovementWithProduct extends Movement {
  product?: Product;
}

export function MovementsPage({ selectedMonth }: { selectedMonth: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [movements, setMovements] = useState<MovementWithProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    loadMovements();
  }, [selectedMonth]);

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

  async function loadMovements() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('mouvements')
        .select('*, product:products(*)')
        .eq('mois', selectedMonth)
        .order('date_mouvement', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMovements(data as any || []);
    } catch (error) {
      console.error('Error loading movements:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleProductChange(productId: string) {
    setFormData({ ...formData, product_id: productId });

    const product = products.find(p => p.id === productId);
    if (product && product.prix_unitaire) {
      setFormData(prev => ({ ...prev, product_id: productId, prix_unitaire: product.prix_unitaire || 0 }));
    } else {
      setFormData(prev => ({ ...prev, product_id: productId }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    try {
      const product = products.find(p => p.id === formData.product_id);
      if (!product) throw new Error('Produit introuvable');

      const currentStock = product.stock_actuel || 0;
      let newStock = currentStock;

      if (formData.type_mouvement === 'ENTREE' || formData.type_mouvement === 'OUVERTURE') {
        newStock = currentStock + formData.quantite;
      } else if (formData.type_mouvement === 'SORTIE' || formData.type_mouvement === 'MISE_AU_REBUT') {
        newStock = currentStock - formData.quantite;
      } else if (formData.type_mouvement === 'AJUSTEMENT') {
        newStock = currentStock + formData.quantite;
      }

      const valeur_totale = formData.quantite * (formData.prix_unitaire || 0);
      const valeur_stock = newStock * (product.prix_unitaire || 0);

      const { error: movementError } = await supabase
        .from('mouvements')
        .insert([{
          ...formData,
          mois: selectedMonth,
          created_by: user.id,
          valeur_totale,
          solde_apres: newStock,
        }]);

      if (movementError) throw movementError;

      const { error: productError } = await supabase
        .from('products')
        .update({
          stock_actuel: newStock,
          valeur_stock,
        })
        .eq('id', formData.product_id);

      if (productError) throw productError;

      showToast('success', `Mouvement enregistré avec succès — stock restant: ${newStock} unités.`);

      setFormData({
        product_id: '',
        type_mouvement: 'ENTREE',
        quantite: 0,
        date_mouvement: new Date().toISOString().split('T')[0],
        note: '',
        prix_unitaire: 0,
      });
      setShowForm(false);
      loadMovements();
      loadProducts();
    } catch (error: any) {
      showToast('error', `Erreur: ${error.message}`);
    }
  }

  async function handleDelete() {
    try {
      const { error } = await supabase
        .from('mouvements')
        .delete()
        .eq('id', confirmDelete.id);

      if (error) throw error;
      showToast('success', 'Mouvement supprimé avec succès.');
      loadMovements();
    } catch (error: any) {
      showToast('error', `Erreur: ${error.message}`);
    }
  }

  function handleExport() {
    const exportData = filteredMovements.map(m => ({
      date: formatDate(m.date_mouvement),
      type: m.type_mouvement,
      produit: m.product?.nom || '',
      code: m.product?.code || '',
      quantite: m.quantite,
      prix_unitaire: formatCurrency(m.prix_unitaire),
      valeur_totale: formatCurrency(m.valeur_totale),
      solde_apres: m.solde_apres,
      note: m.note || '',
    }));
    exportToCSV(exportData, `mouvements_${selectedMonth}`);
  }

  const filteredMovements = movements.filter(m => {
    const matchesSearch = m.product?.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         m.product?.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'ALL' || m.type_mouvement === typeFilter;
    return matchesSearch && matchesType;
  });

  const typeColors: Record<Movement['type_mouvement'], string> = {
    ENTREE: 'bg-green-100 text-green-700',
    SORTIE: 'bg-red-100 text-red-700',
    AJUSTEMENT: 'bg-blue-100 text-blue-700',
    OUVERTURE: 'bg-slate-100 text-slate-700',
    MISE_AU_REBUT: 'bg-orange-100 text-orange-700',
  };

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-xl font-bold text-slate-800">Mouvements de Stock</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            Nouveau
          </button>
        </div>
        <button
          onClick={handleExport}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-xs sm:text-sm font-medium sm:self-start"
        >
          <Upload className="w-3.5 h-3.5" />
          Exporter
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
          <h3 className="text-base font-semibold text-slate-800 mb-3">Nouveau Mouvement</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Produit <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.product_id}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Sélectionner un produit</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom} (Stock: {p.stock_actuel || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.type_mouvement}
                  onChange={(e) => setFormData({ ...formData, type_mouvement: e.target.value as Movement['type_mouvement'] })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ENTREE">Entrée</option>
                  <option value="SORTIE">Sortie</option>
                  <option value="AJUSTEMENT">Ajustement</option>
                  <option value="MISE_AU_REBUT">Mise au rebut</option>
                </select>
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
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Prix unitaire (USD) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={formData.prix_unitaire}
                  onChange={(e) => setFormData({ ...formData, prix_unitaire: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.date_mouvement}
                  onChange={(e) => setFormData({ ...formData, date_mouvement: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Valeur totale</label>
                <div className="px-3 sm:px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg">
                  <p className="text-sm font-semibold text-slate-800">
                    {formatCurrency(formData.quantite * formData.prix_unitaire)}
                  </p>
                </div>
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
                <input
                  type="text"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Note optionnelle..."
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-full sm:w-auto px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="flex-1 flex items-center gap-2">
            <Search className="w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">Tous les types</option>
            <option value="ENTREE">Entrées</option>
            <option value="SORTIE">Sorties</option>
            <option value="AJUSTEMENT">Ajustements</option>
            <option value="OUVERTURE">Ouvertures</option>
            <option value="MISE_AU_REBUT">Mises au rebut</option>
          </select>
        </div>

        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 sm:px-3 text-xs font-semibold text-slate-700">Date</th>
                  <th className="text-left py-2 px-2 sm:px-3 text-xs font-semibold text-slate-700">Type</th>
                  <th className="text-left py-2 px-2 sm:px-3 text-xs font-semibold text-slate-700">Produit</th>
                  <th className="text-right py-2 px-2 sm:px-3 text-xs font-semibold text-slate-700">Qté</th>
                  <th className="hidden md:table-cell text-right py-2 px-3 text-xs font-semibold text-slate-700">Prix U.</th>
                  <th className="hidden lg:table-cell text-right py-2 px-3 text-xs font-semibold text-slate-700">Valeur</th>
                  <th className="text-right py-2 px-2 sm:px-3 text-xs font-semibold text-slate-700">Solde</th>
                  <th className="hidden xl:table-cell text-left py-2 px-3 text-xs font-semibold text-slate-700">Note</th>
                  <th className="text-right py-2 px-2 sm:px-3 text-xs font-semibold text-slate-700">Act.</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((movement) => (
                  <tr key={movement.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-2 sm:px-3 text-xs text-slate-700 whitespace-nowrap">{formatDate(movement.date_mouvement)}</td>
                    <td className="py-2 px-2 sm:px-3">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${typeColors[movement.type_mouvement]}`}>
                        {movement.type_mouvement === 'ENTREE' ? 'ENT' : movement.type_mouvement === 'SORTIE' ? 'SOR' : movement.type_mouvement === 'AJUSTEMENT' ? 'AJU' : movement.type_mouvement === 'OUVERTURE' ? 'OUV' : 'REB'}
                      </span>
                    </td>
                    <td className="py-2 px-2 sm:px-3">
                      <div className="text-xs text-slate-700 font-medium truncate max-w-[100px] sm:max-w-none">{movement.product?.nom}</div>
                      {movement.note && (
                        <div className="xl:hidden text-xs text-slate-500 mt-0.5 truncate max-w-[100px]">{movement.note}</div>
                      )}
                    </td>
                    <td className="py-2 px-2 sm:px-3 text-xs text-slate-700 text-right font-medium whitespace-nowrap">
                      {movement.type_mouvement === 'SORTIE' || movement.type_mouvement === 'MISE_AU_REBUT' ? '-' : ''}
                      {formatNumber(movement.quantite)}
                    </td>
                    <td className="hidden md:table-cell py-2 px-3 text-xs text-slate-600 text-right">{formatCurrency(movement.prix_unitaire)}</td>
                    <td className="hidden lg:table-cell py-2 px-3 text-xs text-slate-700 text-right font-medium">{formatCurrency(movement.valeur_totale)}</td>
                    <td className="py-2 px-2 sm:px-3 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                        (movement.solde_apres || 0) >= 0 ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {formatNumber(movement.solde_apres)}
                      </span>
                    </td>
                    <td className="hidden xl:table-cell py-2 px-3 text-xs text-slate-600 truncate max-w-xs">{movement.note}</td>
                    <td className="py-2 px-2 sm:px-3 text-right">
                      <button
                        onClick={() => setConfirmDelete({ show: true, id: movement.id })}
                        className="p-1 hover:bg-slate-100 rounded transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredMovements.length === 0 && (
            <div className="text-center py-8 text-slate-500">Aucun mouvement trouvé</div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmDelete.show}
        onClose={() => setConfirmDelete({ show: false, id: '' })}
        onConfirm={handleDelete}
        title="Supprimer ce mouvement"
        message="Voulez-vous vraiment supprimer ce mouvement ? Cette action est irréversible."
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
      />
    </div>
  );
}
