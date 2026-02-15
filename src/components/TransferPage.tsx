import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ArrowRight, AlertCircle, CheckCircle, Eye, Package } from 'lucide-react';
import { formatMonth, getPreviousMonth, formatDate, getMonthFromDate, getLastDayOfMonth, formatNumber } from '../lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ConfirmModal from './ConfirmModal';

interface Transfer {
  id: string;
  mois_source: string;
  mois_destination: string;
  nb_produits: number;
  created_at: string;
}

interface PreviewItem {
  product_id: string;
  product_name: string;
  product_code: string;
  stock: number;
}

export function TransferPage({ selectedMonth }: { selectedMonth: string }) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [transferring, setTransferring] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const previousMonth = getPreviousMonth(selectedMonth);

  // React Query for transfers list
  const { data: transfers = [], isLoading: loading } = useQuery({
    queryKey: ['transfers', selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transferts_stock')
        .select('*')
        .or(`mois_source.eq.${selectedMonth},mois_destination.eq.${selectedMonth}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Transfer[];
    },
  });

  /** Compute stock per product up to the end of previousMonth */
  async function computeStockPreview(): Promise<PreviewItem[]> {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, nom, code')
      .eq('actif', true) as { data: { id: string; nom: string; code: string }[] | null; error: any };

    if (productsError) throw productsError;

    const endDate = getLastDayOfMonth(previousMonth);
    const { data: allMovements, error: movError } = await supabase
      .from('mouvements')
      .select('product_id, type_mouvement, quantite')
      .lte('date_mouvement', endDate) as { data: { product_id: string; type_mouvement: string; quantite: number }[] | null; error: any };

    if (movError) throw movError;

    const stockByProduct = new Map<string, number>();
    for (const m of allMovements || []) {
      const prev = stockByProduct.get(m.product_id) || 0;
      if (['ENTREE', 'OUVERTURE', 'AJUSTEMENT'].includes(m.type_mouvement)) {
        stockByProduct.set(m.product_id, prev + m.quantite);
      } else if (['SORTIE', 'MISE_AU_REBUT'].includes(m.type_mouvement)) {
        stockByProduct.set(m.product_id, prev - m.quantite);
      }
    }

    const productMap = new Map((products || []).map(p => [p.id, p]));
    const items: PreviewItem[] = [];

    for (const [productId, stock] of stockByProduct.entries()) {
      if (stock > 0 && productMap.has(productId)) {
        const p = productMap.get(productId)!;
        items.push({ product_id: productId, product_name: p.nom, product_code: p.code, stock });
      }
    }

    items.sort((a, b) => a.product_name.localeCompare(b.product_name, 'fr'));
    return items;
  }

  async function handlePreview() {
    try {
      setLoadingPreview(true);
      const items = await computeStockPreview();
      setPreview(items);
    } catch (error: any) {
      showToast('error', `Erreur: ${error.message}`);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleTransfer() {
    if (!user) return;

    try {
      setTransferring(true);

      const existingTransfer = transfers.find(
        t => t.mois_source === previousMonth && t.mois_destination === selectedMonth
      );

      if (existingTransfer) {
        showToast('warning', 'Un transfert a déjà été effectué pour cette période.');
        return;
      }

      // Use preview data if already loaded, otherwise compute fresh
      const items = preview || await computeStockPreview();

      const movementsToInsert = items.map(item => ({
        product_id: item.product_id,
        type_mouvement: 'OUVERTURE',
        quantite: item.stock,
        date_mouvement: `${selectedMonth}-01`,
        mois: getMonthFromDate(`${selectedMonth}-01`),
        note: `Transfert automatique depuis ${formatMonth(previousMonth)}`,
        created_by: user.id,
      }));

      if (movementsToInsert.length > 0) {
        const { error: movementsError } = await supabase
          .from('mouvements')
          .insert(movementsToInsert as any);

        if (movementsError) throw movementsError;
      }

      const { error: transferError } = await supabase
        .from('transferts_stock')
        .insert([{
          mois_source: previousMonth,
          mois_destination: selectedMonth,
          nb_produits: items.length,
          created_by: user.id,
        }] as any);

      if (transferError) throw transferError;

      showToast('success', `Transfert effectué avec succès ! ${items.length} produit(s) transféré(s).`);
      
      // Invalidate caches
      await queryClient.invalidateQueries({ queryKey: ['transfers'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['movements'] });
      await queryClient.invalidateQueries({ queryKey: ['sidebar-alerts'] });
      
      setPreview(null);
    } catch (error: any) {
      showToast('error', `Erreur lors du transfert: ${error.message}`);
    } finally {
      setTransferring(false);
    }
  }

  const hasTransferForCurrentMonth = transfers.some(
    t => t.mois_source === previousMonth && t.mois_destination === selectedMonth
  );

  const isAdmin = profile?.role === 'ADMIN';

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Transfert de Stock</h2>
      </div>

      {!isAdmin && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-orange-600 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-medium text-orange-800">Accès réservé aux administrateurs</p>
            <p className="text-xs sm:text-sm text-orange-700 mt-1">
              Seuls les utilisateurs avec le rôle ADMIN peuvent effectuer des transferts de stock.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex-1 w-full bg-blue-50 rounded-lg p-3 sm:p-4 text-center">
            <p className="text-xs text-slate-600 mb-1">Mois source</p>
            <p className="text-sm sm:text-base md:text-lg font-bold text-slate-800">{formatMonth(previousMonth)}</p>
          </div>
          <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 rotate-90 sm:rotate-0 flex-shrink-0" />
          <div className="flex-1 w-full bg-green-50 rounded-lg p-3 sm:p-4 text-center">
            <p className="text-xs text-slate-600 mb-1">Mois destination</p>
            <p className="text-sm sm:text-base md:text-lg font-bold text-slate-800">{formatMonth(selectedMonth)}</p>
          </div>
        </div>

        {hasTransferForCurrentMonth ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 flex-shrink-0 text-green-600 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-green-800">Transfert déjà effectué</p>
              <p className="text-xs sm:text-sm text-green-700 mt-1">
                Les stocks non écoulés ont déjà été transférés pour cette période.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
              <p className="text-xs sm:text-sm text-blue-800">
                <strong>Fonctionnement:</strong> Cette opération va créer des mouvements d'ouverture pour {formatMonth(selectedMonth)}
                basés sur les stocks restants de {formatMonth(previousMonth)}. Seuls les produits avec un stock positif seront transférés.
              </p>
            </div>

            {/* Preview section */}
            {preview === null ? (
              <button
                onClick={handlePreview}
                disabled={loadingPreview || !isAdmin}
                className="w-full flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm mb-3"
              >
                <Eye className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="truncate">{loadingPreview ? 'Calcul en cours...' : 'Aperçu du transfert'}</span>
              </button>
            ) : (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Aperçu: {preview.length} produit(s) à transférer
                  </h4>
                  <span className="text-xs text-slate-500">
                    Total: {formatNumber(preview.reduce((s, i) => s + i.stock, 0))} unités
                  </span>
                </div>
                {preview.length === 0 ? (
                  <div className="text-center py-4 text-slate-500 text-sm bg-slate-50 rounded-lg">
                    Aucun produit avec du stock positif à transférer.
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700">Produit</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-slate-700">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map(item => (
                          <tr key={item.product_id} className="border-t border-slate-100">
                            <td className="py-1.5 px-3">
                              <span className="font-medium text-slate-800">{item.product_name}</span>
                              <span className="text-xs text-slate-500 ml-2">{item.product_code}</span>
                            </td>
                            <td className="py-1.5 px-3 text-right font-medium text-slate-700">{formatNumber(item.stock)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={transferring || !isAdmin || (preview !== null && preview.length === 0)}
              className="w-full flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">{transferring ? 'Transfert en cours...' : 'Transférer les stocks non écoulés'}</span>
            </button>
          </>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 md:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-slate-800 mb-3 sm:mb-4">Historique des transferts</h3>

        <div className="space-y-2 sm:space-y-3">
          {transfers.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">Aucun transfert enregistré</div>
          ) : (
            transfers.map((transfer) => (
              <div key={transfer.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="bg-white p-2 rounded flex-shrink-0">
                    <ArrowRight className="w-4 sm:w-5 h-4 sm:h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm md:text-base font-medium text-slate-800 truncate">
                      {formatMonth(transfer.mois_source)} → {formatMonth(transfer.mois_destination)}
                    </p>
                    <p className="text-xs text-slate-600">
                      {transfer.nb_produits} produit(s) transféré(s)
                    </p>
                  </div>
                </div>
                <div className="text-xs text-slate-600 pl-11 sm:pl-0 flex-shrink-0">
                  {formatDate(transfer.created_at)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleTransfer}
        title="Transférer les stocks"
        message={`Voulez-vous transférer les stocks non écoulés de ${formatMonth(previousMonth)} vers ${formatMonth(selectedMonth)} ?`}
        confirmText="Transférer"
        cancelText="Annuler"
        type="info"
      />
    </div>
  );
}
