import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Search, Plus, Upload, Edit2, X, Save, Power, PowerOff } from 'lucide-react';
import { exportToCSV, formatCurrency } from '../lib/utils';
import { generateProductCode, normalizeProductCode } from '../lib/codeGenerator';
import type { Database } from '../lib/database.types';
import { useProducts } from '../lib/hooks';
import { PaginationControls } from './PaginationControls';
import { VirtualizedList } from './VirtualizedList';

type Product = Database['public']['Tables']['products']['Row'];

interface DuplicateConfirmation {
  show: boolean;
  code: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface QuickImportPreview {
  name: string;
  code: string;
  selected: boolean;
}

const ProductRow = memo(({ product, onEdit, onToggleActive }: {
  product: Product;
  onEdit: (product: Product) => void;
  onToggleActive: (product: Product) => void;
}) => (
  <div className="flex items-center justify-between p-4 border-b border-slate-200 hover:bg-slate-50">
    <div className="flex-1">
      <div className="flex items-start">
        <div className="flex-1">
          <h3 className="font-medium">{product.nom}</h3>
          <p className="text-sm text-slate-500">Code: {product.code}</p>
        </div>
        <div className="text-right">
          <p className="font-medium">{formatCurrency(product.valeur_stock || 0)}</p>
          <p className="text-sm text-slate-500">
            Stock: {product.stock_actuel || 0} {product.unite}
          </p>
        </div>
      </div>
    </div>

    <div className="flex items-center gap-2 ml-4">
      <button
        onClick={() => onEdit(product)}
        className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
      >
        <Edit2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => onToggleActive(product)}
        className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
      >
        {product.actif ? (
          <Power className="w-4 h-4 text-green-600" />
        ) : (
          <PowerOff className="w-4 h-4 text-red-600" />
        )}
      </button>
    </div>
  </div>
));

ProductRow.displayName = 'ProductRow';

export function ProductsPage() {
  const { showToast } = useToast();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showQuickImport, setShowQuickImport] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [duplicateConfirm, setDuplicateConfirm] = useState<DuplicateConfirmation>({
    show: false,
    code: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  const [formData, setFormData] = useState({
    code: '',
    nom: '',
    forme: '',
    dosage: '',
    unite: '',
    seuil_alerte: 0,
    classe_therapeutique: '',
    actif: true,
    stock_actuel: 0,
    prix_unitaire: 0,
    valeur_stock: 0,
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Use React Query for data fetching
  const { data: productData, isLoading } = useProducts({
    page,
    pageSize,
    searchTerm,
    sortBy: 'nom',
    sortOrder: 'asc',
  });

  const products = productData?.data || [];
  const total = productData?.total || 0;
  const pageCount = productData?.pageCount || 0;

  const handleEdit = useCallback((product: Product) => {
    setEditingProduct(product);
    setFormData({
      code: product.code,
      nom: product.nom,
      forme: product.forme || '',
      dosage: product.dosage || '',
      unite: product.unite || '',
      seuil_alerte: product.seuil_alerte || 0,
      classe_therapeutique: product.classe_therapeutique || '',
      actif: product.actif || false,
      stock_actuel: product.stock_actuel || 0,
      prix_unitaire: product.prix_unitaire || 0,
      valeur_stock: product.valeur_stock || 0,
    });
    setShowModal(true);
  }, []);

  const handleToggleActive = useCallback(async (product: Product) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ actif: !product.actif })
        .eq('id', product.id);

      if (error) throw error;

      showToast(
        'success',
        `Le produit a été ${product.actif ? 'désactivé' : 'activé'} avec succès.`
      );
    } catch (error) {
      console.error('Error toggling product:', error);
      showToast('error', 'Erreur lors de la modification du produit.');
    }
  }, [showToast]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    setPage(0); // Reset to first page when searching
  }, []);

  const handleExport = useCallback(() => {
    const exportData = products.map(p => ({
      'Code': p.code,
      'Nom': p.nom,
      'Forme': p.forme || '',
      'Dosage': p.dosage || '',
      'Unité': p.unite || '',
      'Seuil alerte': p.seuil_alerte || 0,
      'Classe thérapeutique': p.classe_therapeutique || '',
      'Actif': p.actif ? 'Oui' : 'Non',
      'Stock actuel': p.stock_actuel || 0,
      'Prix unitaire': p.prix_unitaire || 0,
      'Valeur stock': p.valeur_stock || 0,
    }));

    exportToCSV(exportData, 'produits.csv');
  }, [products]);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-2 top-2.5" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Upload className="w-4 h-4" />
            Exporter
          </button>
          <button
            onClick={() => {
              setEditingProduct(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nouveau produit
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Chargement...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0">
            <VirtualizedList
              items={products}
              height={600}
              itemSize={80}
              renderItem={(product) => (
                <ProductRow
                  product={product}
                  onEdit={handleEdit}
                  onToggleActive={handleToggleActive}
                />
              )}
              className="border rounded-lg overflow-auto bg-white"
            />
          </div>

          <PaginationControls
            currentPage={page}
            pageCount={pageCount}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      {/* Keep your existing modals */}
    </div>
  );
}