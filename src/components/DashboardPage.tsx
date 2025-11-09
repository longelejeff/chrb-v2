import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Package, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Clock } from 'lucide-react';
import { formatNumber, formatCurrencyCompact, formatDate } from '../lib/utils';
import { useDashboard } from '../lib/hooks';

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalStockValue: number;
  entriesValueMonth: number;
  exitsValueMonth: number;
  entriesQtyMonth: number;
  exitsQtyMonth: number;
  expiringSoon: number;
  expiringSoon7Days: number;
  expired: number;
  lowStockProducts: number;
  outOfStockProducts: number;
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

interface RecentMovement {
  id: string;
  type_mouvement: string;
  quantite: number;
  date_mouvement: string;
  lot_numero: string | null;
  product: {
    nom: string;
    code: string;
  };
}

export function DashboardPage({ selectedMonth }: { selectedMonth: string }) {
  const { data, isLoading, error } = useDashboard(selectedMonth);

  const stats = useMemo(() => {
    if (!data) {
      return {
        totalProducts: 0,
        activeProducts: 0,
        totalStockValue: 0,
        entriesValueMonth: 0,
        exitsValueMonth: 0,
        entriesQtyMonth: 0,
        exitsQtyMonth: 0,
        expiringSoon: 0,
        expiringSoon7Days: 0,
        expired: 0,
        lowStockProducts: 0,
        outOfStockProducts: 0,
      };
    }

    const { products, movements } = data;

    // @ts-ignore - Supabase type inference
    const activeProducts = products.filter(p => p.actif);

    // @ts-ignore - Supabase type inference
    const totalStockValue = activeProducts.reduce((sum, p) => sum + (p.valeur_stock || 0), 0);

    // @ts-ignore - Supabase type inference
    const entries = movements.filter(m => m.type_mouvement === 'ENTREE');
    // @ts-ignore - Supabase type inference
    const exits = movements.filter(m => m.type_mouvement === 'SORTIE');

    // @ts-ignore - Supabase type inference
    const entriesValueMonth = entries.reduce((sum, m) => sum + (m.valeur_totale || 0), 0);
    // @ts-ignore - Supabase type inference
    const exitsValueMonth = exits.reduce((sum, m) => sum + (m.valeur_totale || 0), 0);
    // @ts-ignore - Supabase type inference
    const entriesQtyMonth = entries.reduce((sum, m) => sum + m.quantite, 0);
    // @ts-ignore - Supabase type inference
    const exitsQtyMonth = exits.reduce((sum, m) => sum + m.quantite, 0);

    let expiringSoon = 0;
    let expiringSoon7Days = 0;
    let expired = 0;
    const now = new Date().getTime();

    // @ts-ignore - Supabase type inference
    movements.forEach(m => {
      // @ts-ignore - Supabase type inference
      if (m.date_peremption) {
        // @ts-ignore - Supabase type inference
        const expiryDate = new Date(m.date_peremption).getTime();
        const days = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
        if (days < 0) expired++;
        else if (days <= 7) expiringSoon7Days++;
        else if (days <= 30) expiringSoon++;
      }
    });

    let outOfStock = 0;

    // @ts-ignore - Supabase type inference
    for (const product of activeProducts) {
      // @ts-ignore - Supabase type inference
      if ((product.stock_actuel || 0) === 0) {
        outOfStock++;
      }
    }

    return {
      totalProducts: products.length,
      activeProducts: activeProducts.length,
      totalStockValue,
      entriesValueMonth,
      exitsValueMonth,
      entriesQtyMonth,
      exitsQtyMonth,
      expiringSoon,
      expiringSoon7Days,
      expired,
      lowStockProducts: 0, // Will calculate below
      outOfStockProducts: outOfStock,
    };
  }, [data]);

  const topProducts = useMemo(() => {
    if (!data) return [];
    
    // @ts-ignore - Supabase type inference
    const activeProducts = data.products.filter(p => p.actif);
    return activeProducts.slice(0, 5);
  }, [data]);

  const lowStockProducts = useMemo(() => {
    if (!data) return [];
    
    // @ts-ignore - Supabase type inference
    const activeProducts = data.products.filter(p => p.actif);
    const lowStock: LowStockProduct[] = [];

    // @ts-ignore - Supabase type inference
    for (const product of activeProducts) {
      // @ts-ignore - Supabase type inference
      if ((product.stock_actuel || 0) > 0 && (product.stock_actuel || 0) <= product.seuil_alerte) {
        lowStock.push(product);
      }
    }

    return lowStock.slice(0, 5);
  }, [data]);

  const recentMovements = useMemo(() => {
    if (!data) return [];
    return data.recentMovements;
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Erreur de chargement des données</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Tableau de Bord</h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">Vue d'ensemble de la gestion de stock</p>
      </div>

      {/* Vue 360° - Indicateurs principaux */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Valeur totale du stock */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
            <Package className="w-5 h-5 sm:w-6 sm:h-6 opacity-60" />
          </div>
          <p className="text-xs sm:text-sm opacity-90">Valeur totale du stock</p>
          <p className="text-2xl sm:text-3xl font-bold mt-1 break-words">{formatCurrencyCompact(stats.totalStockValue)}</p>
          <p className="text-xs opacity-80 mt-1">{stats.activeProducts} produits actifs</p>
        </div>

        {/* Approvisionnements (Entrées) */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-slate-600 font-medium truncate">Approvisionnements</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1 break-words">{formatCurrencyCompact(stats.entriesValueMonth)}</p>
              <p className="text-xs text-slate-500 mt-1">
                <span className="font-semibold">{formatNumber(stats.entriesQtyMonth)}</span> unités
              </p>
            </div>
            <div className="bg-green-100 p-2 sm:p-3 rounded-lg flex-shrink-0 ml-2">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Sorties (Ventes/Consommations) - Indicateur positif d'activité */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-slate-600 font-medium truncate">Ventes & Conso.</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1 break-words">{formatCurrencyCompact(stats.exitsValueMonth)}</p>
              <p className="text-xs text-slate-500 mt-1">
                <span className="font-semibold">{formatNumber(stats.exitsQtyMonth)}</span> unités
              </p>
            </div>
            <div className="bg-blue-100 p-2 sm:p-3 rounded-lg flex-shrink-0 ml-2">
              <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Flux net (Balance) */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-slate-600 font-medium truncate">Flux net du mois</p>
              <p className={`text-xl sm:text-2xl font-bold mt-1 break-words ${stats.entriesValueMonth - stats.exitsValueMonth >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                {stats.entriesValueMonth - stats.exitsValueMonth >= 0 ? '+' : ''}
                {formatCurrencyCompact(stats.entriesValueMonth - stats.exitsValueMonth)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {stats.entriesQtyMonth - stats.exitsQtyMonth >= 0 ? '+' : ''}
                {formatNumber(stats.entriesQtyMonth - stats.exitsQtyMonth)} unités
              </p>
            </div>
            <div className={`p-2 sm:p-3 rounded-lg flex-shrink-0 ml-2 ${stats.entriesValueMonth - stats.exitsValueMonth >= 0 ? 'bg-green-100' : 'bg-orange-100'}`}>
              <DollarSign className={`w-5 h-5 sm:w-6 sm:h-6 ${stats.entriesValueMonth - stats.exitsValueMonth >= 0 ? 'text-green-600' : 'text-orange-600'}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Graphique d'activité du mois */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-4">
            <div className="bg-indigo-100 p-2 rounded-lg flex-shrink-0">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-800">Activité du Mois</h3>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {/* Barre d'approvisionnement */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm font-medium text-slate-700 truncate">Approvisionnements</span>
                <span className="text-xs sm:text-sm font-bold text-green-600 ml-2 flex-shrink-0">{formatCurrencyCompact(stats.entriesValueMonth)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 sm:h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-green-500 to-green-600 h-2 sm:h-3 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, stats.totalStockValue > 0 ? (stats.entriesValueMonth / stats.totalStockValue) * 100 : 0)}%` 
                  }}
                ></div>
              </div>
              <p className="text-xs text-slate-500 mt-1">{formatNumber(stats.entriesQtyMonth)} unités reçues</p>
            </div>

            {/* Barre de ventes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm font-medium text-slate-700 truncate">Ventes & Consommations</span>
                <span className="text-xs sm:text-sm font-bold text-blue-600 ml-2 flex-shrink-0">{formatCurrencyCompact(stats.exitsValueMonth)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 sm:h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 sm:h-3 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, stats.totalStockValue > 0 ? (stats.exitsValueMonth / stats.totalStockValue) * 100 : 0)}%` 
                  }}
                ></div>
              </div>
              <p className="text-xs text-slate-500 mt-1">{formatNumber(stats.exitsQtyMonth)} unités distribuées</p>
            </div>

            {/* Comparaison */}
            <div className="pt-3 sm:pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs sm:text-sm font-medium text-slate-700">Taux d'activité</span>
                <span className="text-xs sm:text-sm font-bold text-indigo-600">
                  {stats.totalStockValue > 0 
                    ? ((stats.exitsValueMonth / stats.totalStockValue) * 100).toFixed(1)
                    : 0}% du stock
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Rotation: {stats.entriesValueMonth > 0 
                  ? ((stats.exitsValueMonth / stats.entriesValueMonth) * 100).toFixed(0)
                  : 0}% des entrées
              </p>
            </div>
          </div>
        </div>

        {/* Top 5 Produits par Valeur */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-4">
            <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-800">Top 5 Produits</h3>
          </div>

          {topProducts.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              Aucun produit avec valeur de stock
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center justify-between p-2 sm:p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="bg-blue-100 text-blue-700 font-bold text-xs sm:text-sm w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 text-xs sm:text-sm truncate">{product.nom}</p>
                      <p className="text-xs text-slate-600 truncate">{product.code} • {formatNumber(product.stock_actuel)}</p>
                    </div>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <p className="font-bold text-slate-800 text-xs sm:text-sm">{formatCurrencyCompact(product.valeur_stock)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-4">
            <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-800">Alertes</h3>
          </div>

          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between p-3 sm:p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-red-800 truncate">Produits expirés</p>
                <p className="text-xs text-red-600 mt-1">Action immédiate</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-red-600 ml-2 flex-shrink-0">{stats.expired}</p>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-orange-800 truncate">Expirent dans 7 jours</p>
                <p className="text-xs text-orange-600 mt-1">Urgent</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-orange-600 ml-2 flex-shrink-0">{stats.expiringSoon7Days}</p>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-yellow-800 truncate">Expirent dans 30 jours</p>
                <p className="text-xs text-yellow-600 mt-1">Surveillance</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-yellow-600 ml-2 flex-shrink-0">{stats.expiringSoon}</p>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-amber-800 truncate">Stocks faibles</p>
                <p className="text-xs text-amber-600 mt-1">Sous seuil</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-amber-600 ml-2 flex-shrink-0">{stats.lowStockProducts}</p>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-slate-800 truncate">Ruptures de stock</p>
                <p className="text-xs text-slate-600 mt-1">Stock à zéro</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-600 ml-2 flex-shrink-0">{stats.outOfStockProducts}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-4">
          <div className="bg-purple-100 p-2 rounded-lg flex-shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-slate-800">Activité Récente</h3>
        </div>

        {recentMovements.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            Aucune activité récente
          </div>
        ) : (
          <div className="space-y-2">
            {recentMovements.map((movement) => (
              <div key={movement.id} className="flex items-center justify-between p-2 sm:p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${movement.type_mouvement === 'ENTREE' ? 'bg-green-100' : 'bg-blue-100'}`}>
                    {movement.type_mouvement === 'ENTREE' ? (
                      <TrendingUp className={`w-3 h-3 sm:w-4 sm:h-4 text-green-600`} />
                    ) : (
                      <TrendingDown className={`w-3 h-3 sm:w-4 sm:h-4 text-blue-600`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-xs sm:text-sm truncate">
                      {/* @ts-ignore - Joined table type */}
                      {movement.product?.nom || 'Produit inconnu'}
                    </p>
                    <p className="text-xs text-slate-600 truncate">
                      {/* @ts-ignore - Joined table type */}
                      {movement.product?.code || ''} 
                      {movement.lot_numero && ` • Lot: ${movement.lot_numero}`}
                    </p>
                  </div>
                </div>
                <div className="text-right ml-2 flex-shrink-0">
                  <p className={`font-bold text-xs sm:text-sm ${movement.type_mouvement === 'ENTREE' ? 'text-green-600' : 'text-blue-600'}`}>
                    {movement.type_mouvement === 'ENTREE' ? '+' : '-'}{formatNumber(movement.quantite)}
                  </p>
                  <p className="text-xs text-slate-500 hidden sm:block">{formatDate(movement.date_mouvement)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {lowStockProducts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-4">
            <div className="bg-red-100 p-2 rounded-lg flex-shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-800">Produits en Alerte</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {lowStockProducts.slice(0, 6).map((product) => (
              <div key={product.id} className="p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-xs sm:text-sm truncate">{product.nom}</p>
                    <p className="text-xs text-slate-600 mt-1 truncate">{product.code}</p>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <p className="text-base sm:text-lg font-bold text-red-600">{formatNumber(product.stock_actuel)}</p>
                    <p className="text-xs text-slate-600">/ {formatNumber(product.seuil_alerte)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {lowStockProducts.length > 6 && (
            <p className="text-xs sm:text-sm text-slate-600 mt-3 text-center">
              +{lowStockProducts.length - 6} autre(s) produit(s) en alerte
            </p>
          )}
        </div>
      )}

      <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg border border-slate-200 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
          <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-slate-800 truncate">
            Vue d'ensemble - {new Date(selectedMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
          <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border-l-4 border-blue-500">
            <p className="text-xs text-slate-600 mb-1 uppercase font-semibold truncate">Stock Actuel</p>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 break-words">{formatCurrencyCompact(stats.totalStockValue)}</p>
            <p className="text-xs text-slate-500 mt-1">{stats.activeProducts} produits</p>
          </div>
          <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border-l-4 border-green-500">
            <p className="text-xs text-slate-600 mb-1 uppercase font-semibold truncate">Approvision.</p>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600 break-words">{formatCurrencyCompact(stats.entriesValueMonth)}</p>
            <p className="text-xs text-slate-500 mt-1 truncate">{formatNumber(stats.entriesQtyMonth)} u.</p>
          </div>
          <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border-l-4 border-blue-600">
            <p className="text-xs text-slate-600 mb-1 uppercase font-semibold truncate">Ventes</p>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 break-words">{formatCurrencyCompact(stats.exitsValueMonth)}</p>
            <p className="text-xs text-slate-500 mt-1 truncate">{formatNumber(stats.exitsQtyMonth)} u.</p>
          </div>
          <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border-l-4 border-indigo-500">
            <p className="text-xs text-slate-600 mb-1 uppercase font-semibold truncate">Balance</p>
            <p className={`text-lg sm:text-xl lg:text-2xl font-bold break-words ${stats.entriesValueMonth - stats.exitsValueMonth >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
              {stats.entriesValueMonth - stats.exitsValueMonth >= 0 ? '+' : ''}
              {formatCurrencyCompact(stats.entriesValueMonth - stats.exitsValueMonth)}
            </p>
            <p className="text-xs text-slate-500 mt-1 truncate">
              {stats.entriesQtyMonth - stats.exitsQtyMonth >= 0 ? '+' : ''}
              {formatNumber(stats.entriesQtyMonth - stats.exitsQtyMonth)} u.
            </p>
          </div>
          <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border-l-4 border-orange-500">
            <p className="text-xs text-slate-600 mb-1 uppercase font-semibold truncate">Alertes</p>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600">{stats.expired + stats.expiringSoon7Days + stats.expiringSoon + stats.lowStockProducts + stats.outOfStockProducts}</p>
            <p className="text-xs text-slate-500 mt-1">À surveiller</p>
          </div>
        </div>
      </div>
    </div>
  );
}
