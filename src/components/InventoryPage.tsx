import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Save, Lock, Search, Upload } from 'lucide-react';
import { formatNumber, exportToCSV, formatDate } from '../lib/utils';
import { PaginationControls } from './PaginationControls';
import { useInventoryLines } from '../lib/hooks';
import ConfirmModal from './ConfirmModal';
import type { Database } from '../lib/database.types';

type Inventory = Database['public']['Tables']['inventaires']['Row'];
type InventoryLine = Database['public']['Tables']['lignes_inventaire']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

interface InventoryLineWithProduct extends InventoryLine {
  product?: Product;
}

export function InventoryPage({ selectedMonth }: { selectedMonth: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('inventory_pageSize');
    return saved ? parseInt(saved) : 25;
  });

  // Use React Query hook for inventory lines
  const { data: linesData, isLoading: linesLoading, refetch } = useInventoryLines({
    page,
    pageSize,
    searchTerm,
    inventoryId: inventory?.id,
  });

  const lines = linesData?.data || [];
  const totalLines = linesData?.total || 0;
  const totalPages = linesData?.pageCount || 1;

  useEffect(() => {
    loadInventory();
  }, [selectedMonth]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  async function loadInventory() {
    try {
      setLoading(true);

      let { data: inv, error: invError } = await supabase
        .from('inventaires')
        .select('*')
        .eq('mois', selectedMonth)
        .maybeSingle();

      if (invError) throw invError;

      if (!inv) {
        const { data: newInv, error: createError } = await supabase
          .from('inventaires')
          .insert([{ mois: selectedMonth, statut: 'BROUILLON' }])
          .select()
          .single();

        if (createError) throw createError;
        inv = newInv;

        await initializeInventoryLines(newInv.id);
      }

      setInventory(inv);

      // Refetch lines after inventory is loaded
      refetch();
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  }

  async function initializeInventoryLines(inventoryId: string) {
    try {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('actif', true);

      if (productsError) throw productsError;

      const linesToInsert = await Promise.all(
        products.map(async (product) => {
          const stock = await calculateTheoreticalStock(product.id, selectedMonth);
          return {
            inventaire_id: inventoryId,
            product_id: product.id,
            stock_theorique: stock,
            stock_physique: 0,
            ecart: 0,
          };
        })
      );

      const { error: insertError } = await supabase
        .from('lignes_inventaire')
        .insert(linesToInsert);

      if (insertError) throw insertError;
    } catch (error) {
      console.error('Error initializing inventory lines:', error);
    }
  }

  async function calculateTheoreticalStock(productId: string, month: string): Promise<number> {
    try {
      // Filter by date_mouvement up to the end of the specified month
      const endDate = `${month}-31`;

      const { data, error } = await supabase
        .from('mouvements')
        .select('type_mouvement, quantite')
        .eq('product_id', productId)
        .lte('date_mouvement', endDate);

      if (error) throw error;

      let stock = 0;
      for (const movement of data || []) {
        if (movement.type_mouvement === 'ENTREE' || movement.type_mouvement === 'OUVERTURE' || movement.type_mouvement === 'AJUSTEMENT') {
          stock += movement.quantite;
        } else if (movement.type_mouvement === 'SORTIE' || movement.type_mouvement === 'MISE_AU_REBUT') {
          stock -= movement.quantite;
        }
      }

      return stock;
    } catch (error) {
      console.error('Error calculating stock:', error);
      return 0;
    }
  }

  async function updateLine(lineId: string, stockPhysique: number) {
    const line = lines.find(l => l.id === lineId);
    if (!line) return;

    const ecart = stockPhysique - (line.stock_theorique || 0);

    try {
      const { error } = await supabase
        .from('lignes_inventaire')
        .update({
          stock_physique: stockPhysique,
          ecart: ecart,
        })
        .eq('id', lineId);

      if (error) throw error;

      refetch();
    } catch (error: any) {
      showToast('error', `Erreur: ${error.message}`);
    }
  }

  async function validateInventory() {
    if (!inventory || !user) return;

    const allFilled = lines.every(l => l.stock_physique !== null && l.stock_physique !== undefined);
    if (!allFilled) {
      showToast('warning', 'Veuillez remplir tous les stocks physiques avant de valider.');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('inventaires')
        .update({
          statut: 'VALIDE',
          validated_by: user.id,
          validated_at: new Date().toISOString(),
        })
        .eq('id', inventory.id);

      if (error) throw error;
      loadInventory();
      showToast('success', 'Inventaire validé avec succès !');
    } catch (error: any) {
      showToast('error', `Erreur: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const exportData = lines.map((l: any) => ({
      produit: l.product?.nom || '',
      code: l.product?.code || '',
      stock_theorique: l.stock_theorique || 0,
      stock_physique: l.stock_physique || 0,
      ecart: l.ecart || 0,
    }));
    exportToCSV(exportData, `inventaire_${selectedMonth}`);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  function handlePageSizeChange(newSize: number) {
    setPageSize(newSize);
    setPage(1);
    localStorage.setItem('inventory_pageSize', newSize.toString());
  }

  const isValidated = inventory?.statut === 'VALIDE';

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Inventaire Mensuel</h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Statut: {isValidated ? (
                <span className="text-green-600 font-medium">Validé</span>
              ) : (
                <span className="text-orange-600 font-medium">Brouillon</span>
              )}
              {inventory?.validated_at && (
                <span className="text-slate-500 hidden sm:inline"> - Validé le {formatDate(inventory.validated_at)}</span>
              )}
            </p>
          </div>
          {!isValidated && (
            <button
              onClick={() => setShowValidateModal(true)}
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium text-sm flex-shrink-0"
            >
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Valider l'inventaire</span>
              <span className="sm:hidden">Valider</span>
            </button>
          )}
        </div>
        <button
          onClick={handleExport}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-xs sm:text-sm font-medium sm:self-start"
        >
          <Upload className="w-4 h-4 flex-shrink-0" />
          Exporter
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-0 px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Produit</th>
                  <th className="text-right py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Théorique</th>
                  <th className="text-right py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Physique</th>
                  <th className="text-right py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Écart</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line: any) => (
                  <tr key={line.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-3 sm:px-4 text-xs sm:text-sm text-slate-700 font-medium">{line.product?.nom}</td>
                    <td className="py-3 px-3 sm:px-4 text-xs sm:text-sm text-slate-700 text-right">{formatNumber(line.stock_theorique)}</td>
                    <td className="py-3 px-3 sm:px-4 text-right">
                      {isValidated ? (
                        <span className="text-xs sm:text-sm text-slate-700">{formatNumber(line.stock_physique)}</span>
                      ) : (
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={line.stock_physique || 0}
                          onChange={(e) => updateLine(line.id, parseInt(e.target.value) || 0)}
                          className="w-16 sm:w-24 px-2 py-1 text-xs sm:text-sm text-right border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      )}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs sm:text-sm font-medium ${
                          (line.ecart || 0) === 0
                            ? 'bg-slate-100 text-slate-700'
                            : (line.ecart || 0) > 0
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {(line.ecart || 0) > 0 ? '+' : ''}{formatNumber(line.ecart)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lines.length === 0 && (
            <div className="text-center py-8 text-slate-500">Aucun produit trouvé</div>
          )}
        </div>

        <PaginationControls
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalLines}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      {!isValidated && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Remplissez les stocks physiques pour chaque produit, puis validez l'inventaire.
            Une fois validé, l'inventaire ne pourra plus être modifié.
          </p>
        </div>
      )}

      <ConfirmModal
        isOpen={showValidateModal}
        onClose={() => setShowValidateModal(false)}
        onConfirm={validateInventory}
        title="Valider l'inventaire"
        message="Voulez-vous vraiment valider cet inventaire ? Cette action est irréversible."
        confirmText="Valider"
        cancelText="Annuler"
        type="warning"
      />
    </div>
  );
}
