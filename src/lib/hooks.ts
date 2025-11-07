import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Database } from './database.types';

interface PaginationParams {
  page: number;
  pageSize: number;
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  pageCount: number;
}

export const useProducts = ({ page, pageSize, searchTerm, sortBy = 'nom', sortOrder = 'asc' }: PaginationParams) => {
  return useQuery({
    queryKey: ['products', { page, pageSize, searchTerm, sortBy, sortOrder }],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*', { count: 'exact' });

      if (searchTerm) {
        query = query.or('nom.ilike.%' + searchTerm + '%,code.ilike.%' + searchTerm + '%');
      }

      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const from = page * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        pageCount: count ? Math.ceil(count / pageSize) : 0,
      } as PaginatedResponse<Database['public']['Tables']['products']['Row']>;
    },
  });
};

export const useMovements = ({ page, pageSize, searchTerm, sortBy = 'date_mouvement', sortOrder = 'desc' }: PaginationParams) => {
  return useQuery({
    queryKey: ['movements', { page, pageSize, searchTerm, sortBy, sortOrder }],
    queryFn: async () => {
      let query = supabase
        .from('mouvements')
        .select('*, products(id, code, nom)', { count: 'exact' });

      if (searchTerm) {
        query = query.or('products.nom.ilike.%' + searchTerm + '%,products.code.ilike.%' + searchTerm + '%');
      }

      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const from = page * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        pageCount: count ? Math.ceil(count / pageSize) : 0,
      } as PaginatedResponse<Database['public']['Tables']['mouvements']['Row']>;
    },
  });
};

export const useExpiries = ({ page, pageSize, searchTerm, sortBy = 'date_peremption', sortOrder = 'asc' }: PaginationParams) => {
  return useQuery({
    queryKey: ['expiries', { page, pageSize, searchTerm, sortBy, sortOrder }],
    queryFn: async () => {
      let query = supabase
        .from('peremptions')
        .select('*, products(id, code, nom)', { count: 'exact' });

      if (searchTerm) {
        query = query.or('products.nom.ilike.%' + searchTerm + '%,products.code.ilike.%' + searchTerm + '%');
      }

      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const from = page * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        pageCount: count ? Math.ceil(count / pageSize) : 0,
      } as PaginatedResponse<Database['public']['Tables']['peremptions']['Row']>;
    },
  });
};