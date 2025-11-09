import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Search, Plus, Upload, Edit2, X, Save, Power, PowerOff, FileText, AlertCircle } from 'lucide-react';
import { exportToCSV, formatCurrency } from '../lib/utils';
import { generateProductCode, normalizeProductCode, generateUniqueCode } from '../lib/codeGenerator';
import { PaginationControls } from './PaginationControls';
import { useProducts } from '../lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import type { Database } from '../lib/database.types';

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

export function ProductsPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showQuickImport, setShowQuickImport] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [generatedCode, setGeneratedCode] = useState('');
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('products_pageSize');
    return saved ? parseInt(saved) : 25;
  });

  // Use React Query hook for products
  const { data: productsData, isLoading, refetch } = useProducts({
    page,
    pageSize,
    searchTerm,
  });

  const products = productsData?.data || [];
  const totalProducts = productsData?.total || 0;
  const totalPages = productsData?.pageCount || 1;

  const [duplicateConfirm, setDuplicateConfirm] = useState<DuplicateConfirmation>({
    show: false,
    code: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  const [quickImportText, setQuickImportText] = useState('');
  const [quickImportPreviews, setQuickImportPreviews] = useState<QuickImportPreview[]>([]);

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
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (!editingProduct) {
      const code = generateProductCode(formData.nom);
      setGeneratedCode(code);
    }
  }, [formData.nom, editingProduct]);

  useEffect(() => {
    const lines = quickImportText.trim().split('\n').filter(line => line.trim());
    const previews = lines.map(line => ({
      name: line.trim(),
      code: generateProductCode(line.trim()),
      selected: true,
    }));
    setQuickImportPreviews(previews);
  }, [quickImportText]);

  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!formData.nom.trim()) {
      errors.nom = 'Le nom est requis';
    }

    if (editingProduct && !formData.code.trim()) {
      errors.code = 'Le code est requis';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function openModal(product?: Product) {
    if (product) {
      setEditingProduct(product);
      setFormData({
        code: product.code,
        nom: product.nom,
        forme: product.forme || '',
        dosage: product.dosage || '',
        unite: product.unite || '',
        seuil_alerte: product.seuil_alerte || 0,
        classe_therapeutique: product.classe_therapeutique || '',
        actif: product.actif ?? true,
        stock_actuel: product.stock_actuel || 0,
        prix_unitaire: product.prix_unitaire || 0,
      });
      setGeneratedCode(product.code);
    } else {
      setEditingProduct(null);
      setFormData({
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
      });
      setGeneratedCode('');
    }
    setFieldErrors({});
    setShowModal(true);
  }

  async function checkDuplicateCode(code: string, excludeId?: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('code', code);

    if (error) throw error;

    if (excludeId) {
      return data.some(p => p.id !== excludeId);
    }

    return data.length > 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      showToast('error', 'Impossible de sauvegarder. Veuillez vérifier les champs requis et réessayer.');
      return;
    }

    const codeToUse = editingProduct ? normalizeProductCode(formData.code) : generatedCode;
    const finalFormData = { ...formData, code: codeToUse };

    try {
      const isDuplicate = await checkDuplicateCode(codeToUse, editingProduct?.id);

      if (isDuplicate && !editingProduct) {
        showToast('warning', `Doublon détecté pour le code "${codeToUse}".`);
        setDuplicateConfirm({
          show: true,
          code: codeToUse,
          onConfirm: async () => {
            const existingCodes = products.map(p => p.code);
            const uniqueCode = generateUniqueCode(codeToUse, existingCodes);
            await saveProduct({ ...finalFormData, code: uniqueCode }, true);
            setDuplicateConfirm({ show: false, code: '', onConfirm: () => {}, onCancel: () => {} });
          },
          onCancel: () => {
            setDuplicateConfirm({ show: false, code: '', onConfirm: () => {}, onCancel: () => {} });
          },
        });
        return;
      }

      await saveProduct(finalFormData, false);
    } catch (error: any) {
      showToast('error', 'Impossible de sauvegarder. Veuillez vérifier les champs requis et réessayer.');
    }
  }

  async function saveProduct(data: typeof formData, withSuffix: boolean) {
    try {
      const valeur_stock = (data.stock_actuel || 0) * (data.prix_unitaire || 0);
      const productData = { ...data, valeur_stock };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        showToast('success', `Produit "${data.nom}" modifié avec succès.`);
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;
        showToast('success', `Produit "${data.nom}" créé avec succès.`);
        if (data.code !== generatedCode) {
          showToast('info', `Code produit auto-généré : ${data.code}.`);
        }
      }

      // Invalidate dashboard cache since product changes affect stock value
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      
      setShowModal(false);
      refetch();
    } catch (error: any) {
      throw error;
    }
  }

  async function toggleActive(product: Product) {
    try {
      const { error } = await supabase
        .from('products')
        .update({ actif: !product.actif })
        .eq('id', product.id);

      if (error) throw error;
      
      // Invalidate dashboard cache
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      
      refetch();
      showToast('success', `Produit "${product.nom}" ${!product.actif ? 'activé' : 'désactivé'}.`);
    } catch (error: any) {
      showToast('error', 'Erreur lors de la modification du statut.');
    }
  }

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));

        const headers = rows[0].map(h => h.toLowerCase());
        const productsToImport: any[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length < 2 || !row[0]) continue;

          const name = row[headers.indexOf('nom') >= 0 ? headers.indexOf('nom') : headers.indexOf('name')] || '';
          const code = generateProductCode(name);

          const product: any = {
            code,
            nom: name,
            forme: row[headers.indexOf('forme') >= 0 ? headers.indexOf('forme') : headers.indexOf('form')] || '',
            dosage: row[headers.indexOf('dosage')] || '',
            unite: row[headers.indexOf('unite') >= 0 ? headers.indexOf('unite') : headers.indexOf('unit')] || '',
            seuil_alerte: parseFloat(row[headers.indexOf('seuil_alerte') >= 0 ? headers.indexOf('seuil_alerte') : headers.indexOf('alert_threshold')] || '0') || 0,
            classe_therapeutique: row[headers.indexOf('classe_therapeutique') >= 0 ? headers.indexOf('classe_therapeutique') : headers.indexOf('therapeutic_class')] || '',
            actif: true,
          };

          if (product.code && product.nom) {
            productsToImport.push(product);
          }
        }

        if (productsToImport.length === 0) {
          showToast('warning', 'Aucun produit valide trouvé dans le fichier.');
          return;
        }

        const { error } = await supabase
          .from('products')
          .upsert(productsToImport, { onConflict: 'code', ignoreDuplicates: false });

        if (error) throw error;

        showToast('success', `${productsToImport.length} produit(s) importé(s) avec succès.`);
        refetch();
      } catch (error: any) {
        showToast('error', `Erreur lors de l'importation : ${error.message}`);
      }
    };

    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleQuickImport() {
    const selected = quickImportPreviews.filter(p => p.selected);
    if (selected.length === 0) {
      showToast('warning', 'Aucun produit sélectionné pour l\'importation.');
      return;
    }

    let imported = 0;
    let skipped = 0;
    let withSuffix = 0;

    const existingCodes = products.map(p => p.code);

    for (const preview of selected) {
      try {
        const isDuplicate = await checkDuplicateCode(preview.code);

        if (isDuplicate) {
          skipped++;
        } else {
          const finalCode = generateUniqueCode(preview.code, existingCodes);
          if (finalCode !== preview.code) {
            withSuffix++;
          }

          const { error } = await supabase
            .from('products')
            .insert([{
              code: finalCode,
              nom: preview.name,
              forme: '',
              dosage: '',
              unite: '',
              seuil_alerte: 0,
              classe_therapeutique: '',
              actif: true,
            }]);

          if (error) throw error;

          existingCodes.push(finalCode);
          imported++;
        }
      } catch (error) {
        console.error('Error importing:', error);
        skipped++;
      }
    }

    let message = `Importés : ${imported}`;
    if (skipped > 0) message += ` • Ignorés (doublons) : ${skipped}`;
    if (withSuffix > 0) message += ` • Créés avec suffixe : ${withSuffix}`;

    showToast('success', message);
    setShowQuickImport(false);
    setQuickImportText('');
    setQuickImportPreviews([]);
    refetch();
  }

  function handleExport() {
    const exportData = products.map((p: Product) => ({
      code: p.code,
      nom: p.nom,
      forme: p.forme || '',
      dosage: p.dosage || '',
      unite: p.unite || '',
      seuil_alerte: p.seuil_alerte || 0,
      classe_therapeutique: p.classe_therapeutique || '',
      actif: p.actif ? 'Oui' : 'Non',
    }));
    exportToCSV(exportData, 'produits');
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  function handlePageSizeChange(newSize: number) {
    setPageSize(newSize);
    setPage(1);
    localStorage.setItem('products_pageSize', newSize.toString());
  }

  if (isLoading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Produits</h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">Gestion du catalogue</p>
          </div>
          <button
            onClick={() => openModal()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nouveau Produit</span>
            <span className="sm:hidden">Ajouter</span>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={() => setShowQuickImport(true)}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-xs sm:text-sm font-medium"
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Import Rapide</span>
          </button>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleImportCSV}
              className="hidden"
            />
            <div className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm font-medium">
              <Upload className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Importer CSV</span>
            </div>
          </label>
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-xs sm:text-sm font-medium"
          >
            <Upload className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Exporter</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Nom</th>
                  <th className="text-right py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Stock</th>
                  <th className="hidden sm:table-cell text-right py-3 px-4 text-sm font-semibold text-slate-700">Prix Unit.</th>
                  <th className="text-right py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Valeur</th>
                  <th className="hidden md:table-cell text-left py-3 px-4 text-sm font-semibold text-slate-700">Statut</th>
                  <th className="text-right py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-3 sm:px-4">
                      <div className="text-sm text-slate-700 font-medium">{product.nom}</div>
                      <div className="md:hidden text-xs text-slate-500 mt-0.5">
                        {product.actif ? (
                          <span className="text-green-600">● Actif</span>
                        ) : (
                          <span className="text-slate-400">● Inactif</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-xs sm:text-sm text-slate-700 text-right font-medium">{product.stock_actuel || 0}</td>
                    <td className="hidden sm:table-cell py-3 px-4 text-sm text-slate-700 text-right">{formatCurrency(product.prix_unitaire)}</td>
                    <td className="py-3 px-3 sm:px-4 text-xs sm:text-sm text-slate-700 text-right font-medium">{formatCurrency(product.valeur_stock)}</td>
                    <td className="hidden md:table-cell py-3 px-4">
                      {product.actif ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                          <Power className="w-3 h-3" /> Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                          <PowerOff className="w-3 h-3" /> Inactif
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right">
                      <div className="flex justify-end gap-1 sm:gap-2">
                        <button
                          onClick={() => toggleActive(product)}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                          title={product.actif ? 'Désactiver' : 'Activer'}
                        >
                          {product.actif ? <PowerOff className="w-4 h-4 text-slate-600" /> : <Power className="w-4 h-4 text-slate-600" />}
                        </button>
                        <button
                          onClick={() => openModal(product)}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4 text-blue-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {products.length === 0 && (
            <div className="text-center py-8 text-slate-500">Aucun produit trouvé</div>
          )}
        </div>

        <PaginationControls
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalProducts}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">
                {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className={`w-full px-3 sm:px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base ${
                      fieldErrors.nom ? 'border-red-500' : 'border-slate-300'
                    }`}
                  />
                  {fieldErrors.nom && (
                    <p className="text-red-600 text-sm mt-1">{fieldErrors.nom}</p>
                  )}
                </div>


                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Forme</label>
                  <input
                    type="text"
                    value={formData.forme}
                    onChange={(e) => setFormData({ ...formData, forme: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dosage</label>
                  <input
                    type="text"
                    value={formData.dosage}
                    onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unité</label>
                  <input
                    type="text"
                    value={formData.unite}
                    onChange={(e) => setFormData({ ...formData, unite: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Seuil d'alerte</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.seuil_alerte}
                    onChange={(e) => setFormData({ ...formData, seuil_alerte: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock actuel</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.stock_actuel}
                    onChange={(e) => setFormData({ ...formData, stock_actuel: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prix unitaire (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.prix_unitaire}
                    onChange={(e) => setFormData({ ...formData, prix_unitaire: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Classe thérapeutique</label>
                  <input
                    type="text"
                    value={formData.classe_therapeutique}
                    onChange={(e) => setFormData({ ...formData, classe_therapeutique: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium">Valeur du stock:</span> {formatCurrency((formData.stock_actuel || 0) * (formData.prix_unitaire || 0))}
                    </p>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.actif}
                      onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Produit actif</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full sm:w-auto px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm sm:text-base"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base"
                >
                  <Save className="w-4 h-4" />
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {duplicateConfirm.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="bg-amber-100 p-3 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Produit en double détecté</h3>
                  <p className="text-sm text-slate-600">
                    Un produit avec le code <span className="font-mono font-bold">"{duplicateConfirm.code}"</span> existe déjà.
                    Voulez-vous quand même créer ce nouveau produit ?
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 bg-slate-50 border-t border-slate-200">
              <button
                onClick={duplicateConfirm.onCancel}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                onClick={duplicateConfirm.onConfirm}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Créer quand même
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuickImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">Import Rapide</h3>
              <button onClick={() => setShowQuickImport(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Collez les noms de produits (un par ligne)
                </label>
                <textarea
                  value={quickImportText}
                  onChange={(e) => setQuickImportText(e.target.value)}
                  placeholder="Paracétamol&#10;Ibuprofène&#10;Amoxicilline"
                  rows={8}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
              </div>

              {quickImportPreviews.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Aperçu ({quickImportPreviews.length} produits)</h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={quickImportPreviews.every(p => p.selected)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setQuickImportPreviews(prev => prev.map(p => ({ ...p, selected: checked })));
                              }}
                              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                            />
                          </th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700">Nom</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700">Code généré</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quickImportPreviews.map((preview, index) => (
                          <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-2 px-3">
                              <input
                                type="checkbox"
                                checked={preview.selected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setQuickImportPreviews(prev =>
                                    prev.map((p, i) => i === index ? { ...p, selected: checked } : p)
                                  );
                                }}
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-sm text-slate-700">{preview.name}</td>
                            <td className="py-2 px-3 text-sm font-mono text-blue-600">{preview.code}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleQuickImport}
                  disabled={quickImportPreviews.filter(p => p.selected).length === 0}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Importer {quickImportPreviews.filter(p => p.selected).length > 0 && `(${quickImportPreviews.filter(p => p.selected).length})`}
                </button>
                <button
                  onClick={() => setShowQuickImport(false)}
                  className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
