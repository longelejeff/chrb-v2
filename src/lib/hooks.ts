import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

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
  });
}

// Movements hook
export function useMovements({ page, pageSize, searchTerm = '', month, typeFilter }: PaginationParams & { month: string; typeFilter?: string }) {
  return useQuery({
    queryKey: ['movements', page, pageSize, searchTerm, month, typeFilter],
    queryFn: async (): Promise<PaginatedResponse<any>> => {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      let query = supabase
        .from('mouvements')
        .select('*, product:products(*)', { count: 'exact' })
        .eq('mois', month)
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

// All Movements hook (for printing)
export function useAllMovements({ searchTerm = '', month, typeFilter, enabled }: { searchTerm?: string; month: string; typeFilter?: string; enabled: boolean }) {
  return useQuery({
    queryKey: ['all-movements', searchTerm, month, typeFilter],
    enabled,
    queryFn: async (): Promise<any[]> => {
      let query = supabase
        .from('mouvements')
        .select('*, product:products(*)')
        .eq('mois', month)
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

      let query = supabase
        .from('mouvements')
        .select('*, product:products(*)', { count: 'exact' })
        .eq('mois', month)
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
