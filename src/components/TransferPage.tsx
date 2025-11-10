import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import { formatMonth, getPreviousMonth, formatDate, getMonthFromDate } from '../lib/utils';
import ConfirmModal from './ConfirmModal';

interface Transfer {
  id: string;
  mois_source: string;
  mois_destination: string;
  nb_produits: number;
  created_at: string;
}

export function TransferPage({ selectedMonth }: { selectedMonth: string }) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    loadTransfers();
  }, [selectedMonth]);

  async function loadTransfers() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transferts_stock')
        .select('*')
        .or(`mois_source.eq.${selectedMonth},mois_destination.eq.${selectedMonth}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransfers(data || []);
    } catch (error) {
      console.error('Error loading transfers:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleTransfer() {
    if (!user) return;

    const previousMonth = getPreviousMonth(selectedMonth);

    try {
      setTransferring(true);

      const existingTransfer = transfers.find(
        t => t.mois_source === previousMonth && t.mois_destination === selectedMonth
      );

      if (existingTransfer) {
        showToast('warning', 'Un transfert a déjà été effectué pour cette période.');
        return;
      }

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('actif', true);

      if (productsError) throw productsError;

      let transferredCount = 0;
      const movementsToInsert = [];

      for (const product of products) {
        const stock = await calculateStock(product.id, previousMonth);
        if (stock > 0) {
          const dateMouvement = `${selectedMonth}-01`;
          movementsToInsert.push({
            product_id: product.id,
            type_mouvement: 'OUVERTURE',
            quantite: stock,
            date_mouvement: dateMouvement,
            mois: getMonthFromDate(dateMouvement), // Calculate from date_mouvement
            note: `Transfert automatique depuis ${formatMonth(previousMonth)}`,
            created_by: user.id,
          });
          transferredCount++;
        }
      }

      if (movementsToInsert.length > 0) {
        const { error: movementsError } = await supabase
          .from('mouvements')
          .insert(movementsToInsert);

        if (movementsError) throw movementsError;
      }

      const { error: transferError } = await supabase
        .from('transferts_stock')
        .insert([{
          mois_source: previousMonth,
          mois_destination: selectedMonth,
          nb_produits: transferredCount,
          created_by: user.id,
        }]);

      if (transferError) throw transferError;

      showToast('success', `Transfert effectué avec succès ! ${transferredCount} produit(s) transféré(s).`);
      loadTransfers();
    } catch (error: any) {
      showToast('error', `Erreur lors du transfert: ${error.message}`);
    } finally {
      setTransferring(false);
    }
  }

  async function calculateStock(productId: string, month: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('mouvements')
        .select('type_mouvement, quantite')
        .eq('product_id', productId)
        .lte('mois', month);

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

  const previousMonth = getPreviousMonth(selectedMonth);
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

            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={transferring || !isAdmin}
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
