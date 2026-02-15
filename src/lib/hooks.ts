import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { getLastDayOfMonth } from './utils';

export interface PaginationParams {
  page: number;
  pageSize: number;
  searchTerm?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  pageCount: number;
}

// Products hook
export function useProducts({ page, pageSize, searchTerm = '' }: PaginationParams) {
  return useQuery({
    queryKey: ['products', page, pageSize, searchTerm],
    queryFn: async (): Promise<PaginatedResponse<any>> => {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .order('nom');

      if (searchTerm) {
        const searchPattern = `%${searchTerm}%`;
        query = query.or(
          'nom.ilike.' + searchPattern + ',' +
          'code.ilike.' + searchPattern + ',' +
          'classe_therapeutique.ilike.' + searchPattern
        );
      }

      const { data, error, count } = await query.range(start, end);

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        pageCount: Math.ceil((count || 0) / pageSize),
      };
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

// Movements hook
export function useMovements({ page, pageSize, searchTerm = '', month, typeFilter, productFilter }: PaginationParams & { month: string; typeFilter?: string; productFilter?: string }) {
  return useQuery({
    queryKey: ['movements', page, pageSize, searchTerm, month, typeFilter, productFilter],
    queryFn: async (): Promise<PaginatedResponse<any>> => {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      // Calculate month range for filtering by date_mouvement
      const startDate = `${month}-01`;
      const endDate = getLastDayOfMonth(month);

      let query = supabase
        .from('mouvements')
        .select('*, product:products(*)', { count: 'exact' })
        .not('date_mouvement', 'is', null)
        .gte('date_mouvement', startDate)
        .lte('date_mouvement', endDate)
        .order('date_mouvement', { ascending: false })
        .order('created_at', { ascending: false });

      if (searchTerm) {
        // Search in product name or code
        query = query.or(
          `product.nom.ilike.%${searchTerm}%,product.code.ilike.%${searchTerm}%`
        );
      }

      if (typeFilter && typeFilter !== 'ALL') {
        query = query.eq('type_mouvement', typeFilter);
      }

      if (productFilter) {
        query = query.eq('product_id', productFilter);
      }

      const { data, error, count } = await query.range(start, end);

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        pageCount: Math.ceil((count || 0) / pageSize),
      };
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

// All Movements hook (for printing)
export function useAllMovements({ searchTerm = '', month, typeFilter, productFilter, enabled }: { searchTerm?: string; month: string; typeFilter?: string; productFilter?: string; enabled: boolean }) {
  return useQuery({
    queryKey: ['all-movements', searchTerm, month, typeFilter, productFilter],
    enabled,
    queryFn: async (): Promise<any[]> => {
      // Calculate month range for filtering by date_mouvement
      const startDate = `${month}-01`;
      const endDate = getLastDayOfMonth(month);

      let query = supabase
        .from('mouvements')
        .select('*, product:products(*)')
        .not('date_mouvement', 'is', null)
        .gte('date_mouvement', startDate)
        .lte('date_mouvement', endDate)
        .order('date_mouvement', { ascending: false })
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(
          `product.nom.ilike.%${searchTerm}%,product.code.ilike.%${searchTerm}%`
        );
      }

      if (typeFilter && typeFilter !== 'ALL') {
        query = query.eq('type_mouvement', typeFilter);
      }

      if (productFilter) {
        query = query.eq('product_id', productFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    },
  });
}

// Expiries hook (peremptions table)
export function useExpiries({ page, pageSize, searchTerm = '', filterType = 'all' }: PaginationParams & { filterType?: string }) {
  return useQuery({
    queryKey: ['expiries', page, pageSize, searchTerm, filterType],
    queryFn: async (): Promise<PaginatedResponse<any>> => {
      // Fetch all peremptions with stock > 0 (need client-side search/filter like inventory)
      let query = supabase
        .from('peremptions')
        .select('*, product:products(*)')
        .gt('quantite', 0)
        .order('date_peremption', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      let filtered = (data || []).filter((e: any) => e.product);

      // Client-side search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter((e: any) => {
          const nom = (e.product?.nom || '').toLowerCase();
          const code = (e.product?.code || '').toLowerCase();
          return nom.includes(term) || code.includes(term);
        });
      }

      // Client-side filter by expiry status
      if (filterType === 'expired') {
        filtered = filtered.filter((e: any) => {
          const days = Math.ceil((new Date(e.date_peremption).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return days < 0;
        });
      } else if (filterType === 'soon') {
        filtered = filtered.filter((e: any) => {
          const days = Math.ceil((new Date(e.date_peremption).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return days >= 0 && days <= 30;
        });
      }

      // Client-side pagination
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const paginated = filtered.slice(start, start + pageSize);

      return {
        data: paginated,
        total,
        pageCount: Math.ceil(total / pageSize),
      };
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

// All expiries hook (for counts, no pagination)
export function useAllExpiries() {
  return useQuery({
    queryKey: ['all-expiries'],
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await supabase
        .from('peremptions')
        .select('*, product:products(*)')
        .gt('quantite', 0)
        .order('date_peremption', { ascending: true });

      if (error) throw error;
      return (data || []).filter((e: any) => e.product);
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

// Inventory hook
export function useInventory({ page, pageSize, searchTerm = '', month }: PaginationParams & { month: string }) {
  return useQuery({
    queryKey: ['inventory', page, pageSize, searchTerm, month],
    queryFn: async (): Promise<PaginatedResponse<any>> => {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      // Calculate month range for filtering by date_mouvement
      const startDate = `${month}-01`;
      const endDate = getLastDayOfMonth(month);

      let query = supabase
        .from('mouvements')
        .select('*, product:products(*)', { count: 'exact' })
        .not('date_mouvement', 'is', null)
        .gte('date_mouvement', startDate)
        .lte('date_mouvement', endDate)
        .order('date_mouvement', { ascending: false });

      if (searchTerm) {
        query = query.or(
          `product.nom.ilike.%${searchTerm}%,product.code.ilike.%${searchTerm}%`
        );
      }

      const { data, error, count } = await query.range(start, end);

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        pageCount: Math.ceil((count || 0) / pageSize),
      };
    },
  });
}

// Inventory Lines hook (for the Inventory page with lignes_inventaire)
export function useInventoryLines({ page, pageSize, searchTerm = '', inventoryId }: PaginationParams & { inventoryId?: string }) {
  return useQuery({
    queryKey: ['inventory-lines', page, pageSize, searchTerm, inventoryId],
    enabled: !!inventoryId,
    queryFn: async (): Promise<PaginatedResponse<any>> => {
      // Fetch ALL lines for this inventory (no server-side pagination)
      // because we need to search/sort on product name client-side
      let query = supabase
        .from('lignes_inventaire')
        .select('*, product:products(*)')
        .eq('inventaire_id', inventoryId!);

      const { data, error } = await query;

      if (error) throw error;

      // Filter out lines where product join failed (shouldn't happen but safety)
      let filtered = (data || []).filter((line: any) => line.product);

      // Client-side search on product name/code
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter((line: any) => {
          const nom = (line.product?.nom || '').toLowerCase();
          const code = (line.product?.code || '').toLowerCase();
          return nom.includes(term) || code.includes(term);
        });
      }

      // Sort by product name alphabetically
      filtered.sort((a: any, b: any) => {
        const nameA = (a.product?.nom || '').toLowerCase();
        const nameB = (b.product?.nom || '').toLowerCase();
        return nameA.localeCompare(nameB, 'fr');
      });

      // Client-side pagination
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const paginated = filtered.slice(start, start + pageSize);

      return {
        data: paginated,
        total,
        pageCount: Math.ceil(total / pageSize),
      };
    },
  });
}

// Users hook
export function useUsers({ page, pageSize, searchTerm = '' }: PaginationParams) {
  return useQuery({
    queryKey: ['users', page, pageSize, searchTerm],
    queryFn: async (): Promise<PaginatedResponse<any>> => {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('nom');

      if (searchTerm) {
        const searchPattern = `%${searchTerm}%`;
        query = query.or(
          'nom.ilike.' + searchPattern + ',' +
          'role.ilike.' + searchPattern
        );
      }

      const { data, error, count } = await query.range(start, end);

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        pageCount: Math.ceil((count || 0) / pageSize),
      };
    },
  });
}

// Dashboard hook
export function useDashboard(selectedMonth: string) {
  return useQuery({
    queryKey: ['dashboard', selectedMonth],
    queryFn: async () => {
      // Calculate month range for filtering by date_mouvement
      const startDate = `${selectedMonth}-01`;
      const endDate = getLastDayOfMonth(selectedMonth);

      const [
        productsResponse,
        movementsResponse,
        recentMovementsResponse,
        allMovementsWithLotsResponse,
        latestPricesResponse,
      ] = await Promise.all([
        supabase.from('products').select('id, code, nom, actif, seuil_alerte, stock_actuel, prix_unitaire, valeur_stock').order('nom'),
        supabase.from('mouvements')
          .select('type_mouvement, quantite, valeur_totale')
          .not('date_mouvement', 'is', null)
          .gte('date_mouvement', startDate)
          .lte('date_mouvement', endDate),
        supabase.from('mouvements')
          .select('id, type_mouvement, quantite, date_mouvement, lot_numero, product:products(nom, code)')
          .order('created_at', { ascending: false })
          .limit(7),
        // Get movements with lot info to calculate current lot stocks
        // Bound: only lots with peremption date within 1 year old (not expired > 1 year ago)
        (() => {
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          const cutoffDate = oneYearAgo.toISOString().split('T')[0];
          return supabase.from('mouvements')
            .select('product_id, type_mouvement, quantite, lot_numero, date_peremption')
            .not('lot_numero', 'is', null)
            .not('date_peremption', 'is', null)
            .gte('date_peremption', cutoffDate)
            .order('created_at', { ascending: true });
        })(),
        // Latest prix_unitaire per product from ENTREE movements
        supabase.from('mouvements')
          .select('product_id, prix_unitaire')
          .eq('type_mouvement', 'ENTREE')
          .gt('prix_unitaire', 0)
          .order('created_at', { ascending: false }),
      ]);

      if (productsResponse.error) throw productsResponse.error;
      if (movementsResponse.error) throw movementsResponse.error;
      if (recentMovementsResponse.error) throw recentMovementsResponse.error;
      if (allMovementsWithLotsResponse.error) throw allMovementsWithLotsResponse.error;
      // latestPricesResponse is non-critical — don't throw on error

      // Build a map of product_id -> latest prix_unitaire from ENTREE movements
      const latestPriceMap: Record<string, number> = {};
      if (!latestPricesResponse.error && latestPricesResponse.data) {
        for (const row of latestPricesResponse.data) {
          // First occurrence per product_id is the most recent (ordered desc)
          if (row.product_id && !(row.product_id in latestPriceMap)) {
            latestPriceMap[row.product_id] = row.prix_unitaire;
          }
        }
      }

      return {
        products: productsResponse.data || [],
        movements: movementsResponse.data || [],
        recentMovements: recentMovementsResponse.data || [],
        allMovementsWithLots: allMovementsWithLotsResponse.data || [],
        latestPriceMap,
      };
    },
    staleTime: 0, // Always refetch when cache is invalidated
    refetchOnMount: true,
  });
}

// Sidebar alerts hook — lightweight counts for badge display
export function useSidebarAlerts() {
  return useQuery({
    queryKey: ['sidebar-alerts'],
    queryFn: async () => {
      const [expiryRes, productsRes] = await Promise.all([
        // Count expiries with stock > 0 and date_peremption within 30 days or past
        supabase.from('peremptions')
          .select('date_peremption, quantite')
          .gt('quantite', 0),
        // Products with low stock or out of stock
        supabase.from('products')
          .select('stock_actuel, seuil_alerte')
          .eq('actif', true),
      ]);

      let expiryAlerts = 0;
      if (!expiryRes.error && expiryRes.data) {
        const now = Date.now();
        expiryAlerts = expiryRes.data.filter(e => {
          const days = Math.ceil((new Date(e.date_peremption).getTime() - now) / (1000 * 60 * 60 * 24));
          return days <= 30;
        }).length;
      }

      let stockAlerts = 0;
      if (!productsRes.error && productsRes.data) {
        stockAlerts = productsRes.data.filter(p => {
          const stock = p.stock_actuel || 0;
          return stock === 0 || (stock > 0 && stock <= (p.seuil_alerte || 0));
        }).length;
      }

      return { expiryAlerts, stockAlerts };
    },
    staleTime: 60_000, // Refresh every minute
    refetchInterval: 60_000,
  });
}
