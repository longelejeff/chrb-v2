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

// Expiries hook
export function useExpiries({ page, pageSize, searchTerm = '' }: PaginationParams) {
  return useQuery({
    queryKey: ['expiries', page, pageSize, searchTerm],
    queryFn: async (): Promise<PaginatedResponse<any>> => {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      let query = supabase
        .from('mouvements')
        .select('*, product:products(*)', { count: 'exact' })
        .not('date_peremption', 'is', null)
        .order('date_peremption', { ascending: true });

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
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      let query = supabase
        .from('lignes_inventaire')
        .select('*, product:products(*)', { count: 'exact' })
        .eq('inventaire_id', inventoryId!)
        .order('product(nom)');

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
      ] = await Promise.all([
        supabase.from('products').select('id, code, nom, actif, seuil_alerte, stock_actuel, valeur_stock').order('valeur_stock', { ascending: false }),
        supabase.from('mouvements')
          .select('type_mouvement, quantite, valeur_totale')
          .not('date_mouvement', 'is', null)
          .gte('date_mouvement', startDate)
          .lte('date_mouvement', endDate),
        supabase.from('mouvements')
          .select('id, type_mouvement, quantite, date_mouvement, lot_numero, product:products(nom, code)')
          .order('created_at', { ascending: false })
          .limit(7),
        // Get all movements with lot info to calculate current lot stocks
        supabase.from('mouvements')
          .select('product_id, type_mouvement, quantite, lot_numero, date_peremption')
          .not('lot_numero', 'is', null)
          .not('date_peremption', 'is', null)
          .order('created_at', { ascending: true }),
      ]);

      if (productsResponse.error) throw productsResponse.error;
      if (movementsResponse.error) throw movementsResponse.error;
      if (recentMovementsResponse.error) throw recentMovementsResponse.error;
      if (allMovementsWithLotsResponse.error) throw allMovementsWithLotsResponse.error;

      return {
        products: productsResponse.data || [],
        movements: movementsResponse.data || [],
        recentMovements: recentMovementsResponse.data || [],
        allMovementsWithLots: allMovementsWithLotsResponse.data || [],
      };
    },
    staleTime: 0, // Always refetch when cache is invalidated
    refetchOnMount: true,
  });
}
