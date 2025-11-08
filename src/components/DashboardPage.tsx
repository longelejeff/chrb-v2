import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, TrendingUp, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';
import { formatNumber, formatCurrency, formatCurrencyCompact } from '../lib/utils';

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalStockValue: number;
  entriesValueMonth: number;
  exitsValueMonth: number;
  entriesQtyMonth: number;
  exitsQtyMonth: number;
  expiringSoon: number;
  expired: number;
  lowStockProducts: number;
}

interface TopProduct {
  id: string;
  code: string;
  nom: string;
  valeur_stock: number;
  stock_actuel: number;
}

interface LowStockProduct {
  id: string;
  code: string;
  nom: string;
  seuil_alerte: number;
  stock_actuel: number;
}

export function DashboardPage({ selectedMonth }: { selectedMonth: string }) {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    activeProducts: 0,
    totalStockValue: 0,
    entriesValueMonth: 0,
    exitsValueMonth: 0,
    entriesQtyMonth: 0,
    exitsQtyMonth: 0,
    expiringSoon: 0,
    expired: 0,
    lowStockProducts: 0,
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [selectedMonth]);

  async function loadDashboardData() {
    try {
      setLoading(true);

      const [
        productsResponse,
        movementsResponse,
        expiriesResponse,
      ] = await Promise.all([
        supabase.from('products').select('id, code, nom, actif, seuil_alerte, stock_actuel, valeur_stock').order('valeur_stock', { ascending: false }),
        supabase.from('mouvements').select('type_mouvement, quantite, valeur_totale').eq('mois', selectedMonth),
        supabase.from('peremptions').select('date_peremption'),
      ]);

      if (productsResponse.error) throw productsResponse.error;
      if (movementsResponse.error) throw movementsResponse.error;
      if (expiriesResponse.error) throw expiriesResponse.error;

      const products = productsResponse.data || [];
      const movements = movementsResponse.data || [];
      const expiries = expiriesResponse.data || [];

      const activeProducts = products.filter(p => p.actif);

      const totalStockValue = activeProducts.reduce((sum, p) => sum + (p.valeur_stock || 0), 0);

      const entries = movements.filter(m => m.type_mouvement === 'ENTREE' || m.type_mouvement === 'OUVERTURE');
      const exits = movements.filter(m => m.type_mouvement === 'SORTIE' || m.type_mouvement === 'MISE_AU_REBUT');

      const entriesValueMonth = entries.reduce((sum, m) => sum + (m.valeur_totale || 0), 0);
      const exitsValueMonth = exits.reduce((sum, m) => sum + (m.valeur_totale || 0), 0);
      const entriesQtyMonth = entries.reduce((sum, m) => sum + m.quantite, 0);
      const exitsQtyMonth = exits.reduce((sum, m) => sum + m.quantite, 0);

      let expiringSoon = 0;
      let expired = 0;
      const now = new Date().getTime();

      expiries.forEach(e => {
        const expiryDate = new Date(e.date_peremption).getTime();
        const days = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
        if (days < 0) expired++;
        else if (days <= 30) expiringSoon++;
      });

      const lowStock: LowStockProduct[] = [];
      const topProds: TopProduct[] = [];

      for (const product of activeProducts) {
        if ((product.stock_actuel || 0) < (product.seuil_alerte || 0) && (product.seuil_alerte || 0) > 0) {
          lowStock.push({
            id: product.id,
            code: product.code,
            nom: product.nom,
            seuil_alerte: product.seuil_alerte || 0,
            stock_actuel: product.stock_actuel || 0,
          });
        }

        if ((product.valeur_stock || 0) > 0) {
          topProds.push({
            id: product.id,
            code: product.code,
            nom: product.nom,
            valeur_stock: product.valeur_stock || 0,
            stock_actuel: product.stock_actuel || 0,
          });
        }
      }

      setStats({
        totalProducts: products.length,
        activeProducts: activeProducts.length,
        totalStockValue,
        entriesValueMonth,
        exitsValueMonth,
        entriesQtyMonth,
        exitsQtyMonth,
        expiringSoon,
        expired,
        lowStockProducts: lowStock.length,
      });

      setTopProducts(topProds.slice(0, 5));
      setLowStockProducts(lowStock);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Tableau de Bord</h2>
        <p className="text-sm text-slate-600 mt-1">Vue d'ensemble de la gestion de stock</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-7 h-7 opacity-80" />
            <Package className="w-5 h-5 opacity-60" />
          </div>
          <p className="text-xs opacity-90">Valeur totale du stock</p>
          <p className="text-2xl font-bold mt-1">{formatCurrencyCompact(stats.totalStockValue)}</p>
          <p className="text-xs opacity-80 mt-1">{stats.activeProducts} produits actifs</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600">Entrées du mois</p>
              <p className="text-xl font-bold text-green-600 mt-1">{formatCurrencyCompact(stats.entriesValueMonth)}</p>
              <p className="text-xs text-slate-500 mt-0.5">{formatNumber(stats.entriesQtyMonth)} unités</p>
            </div>
            <div className="bg-green-100 p-2.5 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600">Sorties du mois</p>
              <p className="text-xl font-bold text-red-600 mt-1">{formatCurrencyCompact(stats.exitsValueMonth)}</p>
              <p className="text-xs text-slate-500 mt-0.5">{formatNumber(stats.exitsQtyMonth)} unités</p>
            </div>
            <div className="bg-red-100 p-2.5 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600">Flux net</p>
              <p className={`text-xl font-bold mt-1 ${stats.entriesValueMonth - stats.exitsValueMonth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.entriesValueMonth - stats.exitsValueMonth >= 0 ? '+' : ''}
                {formatCurrencyCompact(stats.entriesValueMonth - stats.exitsValueMonth)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {stats.entriesQtyMonth - stats.exitsQtyMonth >= 0 ? '+' : ''}
                {formatNumber(stats.entriesQtyMonth - stats.exitsQtyMonth)} unités
              </p>
            </div>
            <div className={`p-2.5 rounded-lg ${stats.entriesValueMonth - stats.exitsValueMonth >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <DollarSign className={`w-5 h-5 ${stats.entriesValueMonth - stats.exitsValueMonth >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-blue-100 p-1.5 rounded-lg">
              <Package className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">Top 5 Produits</h3>
          </div>

          {topProducts.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm">
              Aucun produit avec valeur de stock
            </div>
          ) : (
            <div className="space-y-2">
              {topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="bg-blue-100 text-blue-700 font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 text-sm truncate">{product.nom}</p>
                      <p className="text-xs text-slate-600 truncate">{product.code}</p>
                    </div>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <p className="font-bold text-slate-800 text-sm">{formatCurrency(product.valeur_stock)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-orange-100 p-1.5 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">Alertes</h3>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
              <div>
                <p className="text-sm font-medium text-red-800">Produits expirés</p>
                <p className="text-xs text-red-600 mt-0.5">Action immédiate</p>
              </div>
              <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div>
                <p className="text-sm font-medium text-orange-800">Expirent sous 30j</p>
                <p className="text-xs text-orange-600 mt-0.5">Surveillance</p>
              </div>
              <p className="text-2xl font-bold text-orange-600">{stats.expiringSoon}</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div>
                <p className="text-sm font-medium text-amber-800">Stocks faibles</p>
                <p className="text-xs text-amber-600 mt-0.5">Sous le seuil</p>
              </div>
              <p className="text-2xl font-bold text-amber-600">{stats.lowStockProducts}</p>
            </div>
          </div>
        </div>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-red-100 p-1.5 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">Alerte Stock</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {lowStockProducts.slice(0, 6).map((product) => (
              <div key={product.id} className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">{product.nom}</p>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">{product.code}</p>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <p className="text-base font-bold text-red-600">{formatNumber(product.stock_actuel)}</p>
                    <p className="text-xs text-slate-600">/ {formatNumber(product.seuil_alerte)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {lowStockProducts.length > 6 && (
            <p className="text-xs text-slate-600 mt-2 text-center">
              +{lowStockProducts.length - 6} autre(s) produit(s)
            </p>
          )}
        </div>
      )}

      <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg border border-slate-200 p-4">
        <h3 className="text-base font-semibold text-slate-800 mb-3">Résumé du mois</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-xs text-slate-600 mb-0.5">Valeur stock</p>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(stats.totalStockValue)}</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-xs text-slate-600 mb-0.5">Entrées</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(stats.entriesValueMonth)}</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-xs text-slate-600 mb-0.5">Sorties</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(stats.exitsValueMonth)}</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-xs text-slate-600 mb-0.5">Alertes</p>
            <p className="text-lg font-bold text-orange-600">{stats.expired + stats.expiringSoon + stats.lowStockProducts}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
