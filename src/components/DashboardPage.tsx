import { useMemo } from 'react';
import { Package, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Clock } from 'lucide-react';
import { formatNumber, formatCurrencyCompact, formatDate } from '../lib/utils';
import { useDashboard } from '../lib/hooks';

// Types used in computed stats and display
interface ProductRow {
  id: string;
  code: string;
  nom: string;
  actif: boolean | null;
  seuil_alerte: number | null;
  stock_actuel: number | null;
  valeur_stock: number | null;
}

interface MovementRow {
  type_mouvement: string;
  quantite: number;
  valeur_totale: number | null;
}

interface LotMovementRow {
  product_id: string;
  type_mouvement: string;
  quantite: number;
  lot_numero: string | null;
  date_peremption: string | null;
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

    const { products: rawProducts, movements: rawMovements, allMovementsWithLots: rawLotMovements } = data;
    const products = rawProducts as unknown as ProductRow[];
    const movements = rawMovements as unknown as MovementRow[];
    const allMovementsWithLots = rawLotMovements as unknown as LotMovementRow[];

    const activeProducts = products.filter(p => p.actif);
    const totalStockValue = activeProducts.reduce((sum, p) => sum + (p.valeur_stock || 0), 0);

    const entries = movements.filter(m => m.type_mouvement === 'ENTREE');
    const exits = movements.filter(m => m.type_mouvement === 'SORTIE');

    const entriesValueMonth = entries.reduce((sum, m) => sum + (m.valeur_totale || 0), 0);
    const exitsValueMonth = exits.reduce((sum, m) => sum + (m.valeur_totale || 0), 0);
    const entriesQtyMonth = entries.reduce((sum, m) => sum + m.quantite, 0);
    const exitsQtyMonth = exits.reduce((sum, m) => sum + m.quantite, 0);

    // Calculate lot stocks from movements (FEFO logic)
    const lotStocks = new Map<string, { stock: number; date_peremption: string | null; product_id: string }>();
    
    allMovementsWithLots.forEach(movement => {
      const key = `${movement.product_id}_${movement.lot_numero}`;
      
      if (!lotStocks.has(key)) {
        lotStocks.set(key, {
          // @ts-ignore - Supabase type inference
          stock: 0,
          // @ts-ignore - Supabase type inference
          date_peremption: movement.date_peremption || null,
          // @ts-ignore - Supabase type inference
          product_id: movement.product_id,
        });
      }
      
      const lot = lotStocks.get(key)!;
      if (movement.type_mouvement === 'ENTREE') {
        lot.stock += movement.quantite;
        if (movement.date_peremption) {
          lot.date_peremption = movement.date_peremption;
        }
      } else {
        lot.stock -= movement.quantite;
      }
    });

    // Calculate expiration alerts from lots with stock > 0
    let expiringSoon = 0;
    let expiringSoon7Days = 0;
    let expired = 0;
    const now = new Date().getTime();

    lotStocks.forEach(lot => {
      // Only count lots with stock > 0
      if (lot.stock > 0 && lot.date_peremption) {
        const expiryDate = new Date(lot.date_peremption).getTime();
        const days = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
        
        if (days < 0) {
          expired++;
        } else if (days <= 7) {
          expiringSoon7Days++;
        } else if (days > 7 && days <= 30) {
          expiringSoon++;
        }
      }
    });

    // Calculate stock alerts
    let lowStock = 0;
    let outOfStock = 0;

    for (const product of activeProducts) {
      const stockActuel = product.stock_actuel || 0;
      
      if (stockActuel === 0) {
        outOfStock++;
      } else if (stockActuel > 0 && stockActuel <= (product.seuil_alerte || 0)) {
        lowStock++;
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
      lowStockProducts: lowStock,
      outOfStockProducts: outOfStock,
    };
  }, [data]);

  const recentMovements = useMemo(() => {
    if (!data) return [];
    // Limit to 3 most recent movements
    return data.recentMovements.slice(0, 3);
  }, [data]);

  // Calculate products for each alert type
  const alertProducts = useMemo(() => {
    if (!data) return {
      expired: [],
      expiring7Days: [],
      expiring30Days: [],
      lowStock: [],
      outOfStock: [],
    };

    const now = new Date().getTime();
    const expired: any[] = [];
    const expiring7Days: any[] = [];
    const expiring30Days: any[] = [];
    const lowStock: any[] = [];
    const outOfStock: any[] = [];

    // Calculate lot stocks from movements
    const lotStocks = new Map<string, { stock: number; date_peremption: string | null; product_id: string }>();
    
    const rawLotMovements = data.allMovementsWithLots as unknown as LotMovementRow[];
    rawLotMovements?.forEach(movement => {
      const key = `${movement.product_id}_${movement.lot_numero}`;
      
      if (!lotStocks.has(key)) {
        lotStocks.set(key, {
          stock: 0,
          date_peremption: movement.date_peremption || null,
          product_id: movement.product_id,
        });
      }
      
      const lot = lotStocks.get(key)!;
      if (movement.type_mouvement === 'ENTREE') {
        lot.stock += movement.quantite;
        if (movement.date_peremption) {
          lot.date_peremption = movement.date_peremption;
        }
      } else {
        lot.stock -= movement.quantite;
      }
    });

    // Group lots by product and check expiry
    const productExpiryMap = new Map<string, { product: any; earliestExpiry: number; category: string }>();

    lotStocks.forEach(lot => {
      if (lot.stock > 0 && lot.date_peremption) {
        const expiryDate = new Date(lot.date_peremption).getTime();
        const days = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
        
        let category = '';
        if (days < 0) category = 'expired';
        else if (days <= 7) category = 'expiring7Days';
        else if (days > 7 && days <= 30) category = 'expiring30Days';

        if (category) {
          const existing = productExpiryMap.get(lot.product_id);
          if (!existing || expiryDate < existing.earliestExpiry) {
            const allProducts = data.products as unknown as ProductRow[];
            const product = allProducts.find(p => p.id === lot.product_id);
            if (product) {
              productExpiryMap.set(lot.product_id, {
                product,
                earliestExpiry: expiryDate,
                category,
              });
            }
          }
        }
      }
    });

    // Distribute products to alert categories
    productExpiryMap.forEach(({ product, category }) => {
      if (category === 'expired') expired.push(product);
      else if (category === 'expiring7Days') expiring7Days.push(product);
      else if (category === 'expiring30Days') expiring30Days.push(product);
    });

    // Stock alerts
    const activeProds = (data.products as unknown as ProductRow[]).filter(p => p.actif);
    activeProds.forEach(product => {
      const stockActuel = product.stock_actuel || 0;
      if (stockActuel === 0) {
        outOfStock.push(product);
      } else if (stockActuel > 0 && stockActuel <= (product.seuil_alerte || 0)) {
        lowStock.push(product);
      }
    });

    return {
      expired,
      expiring7Days,
      expiring30Days,
      lowStock,
      outOfStock,
    };
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

      {/* Activité & Alertes - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Activité du Mois & Récente - Merged Card */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
          {/* Bloc A: Activité du Mois */}
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

          {/* Separator */}
          <div className="border-t border-slate-200 my-4"></div>

          {/* Bloc B: Activité Récente (3 derniers mouvements) */}
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-purple-100 p-2 rounded-lg flex-shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
            </div>
            <h4 className="text-sm sm:text-base font-semibold text-slate-800">Activité Récente</h4>
          </div>

          {recentMovements.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm">
              Aucune activité récente
            </div>
          ) : (
            <div className="space-y-2">
              {recentMovements.map((movement: any) => (
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
                        {movement.product?.nom || 'Produit inconnu'}
                      </p>
                      <p className="text-xs text-slate-600 truncate">
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

        {/* Alertes - Right Side */}
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
                {alertProducts.expired.length > 0 && (
                  <p className="text-xs text-red-700 mt-1.5 line-clamp-2">
                    {alertProducts.expired.slice(0, 3).map((p: any) => p.nom).join(', ')}
                    {alertProducts.expired.length > 3 && '...'}
                  </p>
                )}
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-red-600 ml-2 flex-shrink-0">{stats.expired}</p>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-orange-800 truncate">Expirent dans 7 jours</p>
                <p className="text-xs text-orange-600 mt-1">Urgent</p>
                {alertProducts.expiring7Days.length > 0 && (
                  <p className="text-xs text-orange-700 mt-1.5 line-clamp-2">
                    {alertProducts.expiring7Days.slice(0, 3).map((p: any) => p.nom).join(', ')}
                    {alertProducts.expiring7Days.length > 3 && '...'}
                  </p>
                )}
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-orange-600 ml-2 flex-shrink-0">{stats.expiringSoon7Days}</p>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-yellow-800 truncate">Expirent dans 30 jours</p>
                <p className="text-xs text-yellow-600 mt-1">Surveillance</p>
                {alertProducts.expiring30Days.length > 0 && (
                  <p className="text-xs text-yellow-700 mt-1.5 line-clamp-2">
                    {alertProducts.expiring30Days.slice(0, 3).map((p: any) => p.nom).join(', ')}
                    {alertProducts.expiring30Days.length > 3 && '...'}
                  </p>
                )}
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-yellow-600 ml-2 flex-shrink-0">{stats.expiringSoon}</p>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-amber-800 truncate">Stocks faibles</p>
                <p className="text-xs text-amber-600 mt-1">Sous seuil</p>
                {alertProducts.lowStock.length > 0 && (
                  <p className="text-xs text-amber-700 mt-1.5 line-clamp-2">
                    {alertProducts.lowStock.slice(0, 3).map((p: any) => p.nom).join(', ')}
                    {alertProducts.lowStock.length > 3 && '...'}
                  </p>
                )}
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-amber-600 ml-2 flex-shrink-0">{stats.lowStockProducts}</p>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-slate-800 truncate">Ruptures de stock</p>
                <p className="text-xs text-slate-600 mt-1">Stock à zéro</p>
                {alertProducts.outOfStock.length > 0 && (
                  <p className="text-xs text-slate-700 mt-1.5 line-clamp-2">
                    {alertProducts.outOfStock.slice(0, 3).map((p: any) => p.nom).join(', ')}
                    {alertProducts.outOfStock.length > 3 && '...'}
                  </p>
                )}
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-600 ml-2 flex-shrink-0">{stats.outOfStockProducts}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
