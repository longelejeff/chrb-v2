import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Plus, Search, Upload, Trash2, Printer } from 'lucide-react';
import { formatDate, formatNumber, exportToCSV, formatCurrency, formatMonth } from '../lib/utils';
import ConfirmModal from './ConfirmModal';
import { PaginationControls } from './PaginationControls';
import { useMovements, useAllMovements } from '../lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import type { Database } from '../lib/database.types';

type Movement = Database['public']['Tables']['mouvements']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

export function MovementsPage({ selectedMonth }: { selectedMonth: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; id: string }>({ show: false, id: '' });
  const [printMode, setPrintMode] = useState<'current' | 'all' | null>(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('movements_pageSize');
    return saved ? parseInt(saved) : 25;
  });

  // Use React Query hook for movements
  const { data: movementsData, isLoading, refetch } = useMovements({
    page,
    pageSize,
    searchTerm,
    month: selectedMonth,
    typeFilter: typeFilter === 'ALL' ? undefined : typeFilter,
  });

  // Fetch all movements when printing all
  const { data: allMovementsData } = useAllMovements({
    searchTerm,
    month: selectedMonth,
    typeFilter: typeFilter === 'ALL' ? undefined : typeFilter,
    enabled: printMode === 'all',
  });

  const movements = movementsData?.data || [];
  const allMovements = allMovementsData || [];
  const displayMovements = printMode === 'all' ? allMovements : movements;
  const totalMovements = movementsData?.total || 0;
  const totalPages = movementsData?.pageCount || 1;

  // Enhanced form state
  const [formData, setFormData] = useState({
    product_id: '',
    type_mouvement: 'ENTREE' as 'ENTREE' | 'SORTIE',
    quantite: 0,
    date_mouvement: new Date().toISOString().split('T')[0],
    note: '',
    prix_unitaire: 0,
    lot_numero: '',
    date_peremption: '',
    fournisseur: '',
    date_reception: new Date().toISOString().split('T')[0],
  });

  // Lot management for SORTIE
  const [availableLots, setAvailableLots] = useState<any[]>([]);
  const [selectedLot, setSelectedLot] = useState<string>('');
  const [lotDetails, setLotDetails] = useState<any>(null);
  const [quantityError, setQuantityError] = useState<string>('');
  const [isLoadingLots, setIsLoadingLots] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, typeFilter, selectedMonth]);

  async function loadProducts() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('actif', true)
        .order('nom');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }

  async function handleProductChange(productId: string) {
    setFormData(prev => ({ ...prev, product_id: productId }));
    setSelectedLot('');
    setLotDetails(null);
    setQuantityError('');

    const product = products.find(p => p.id === productId);
    
    // For ENTREE, auto-fill prix_unitaire from product
    if (formData.type_mouvement === 'ENTREE' && product && product.prix_unitaire) {
      setFormData(prev => ({ ...prev, product_id: productId, prix_unitaire: product.prix_unitaire || 0 }));
    } else {
      setFormData(prev => ({ ...prev, product_id: productId }));
    }

    // For SORTIE, load available lots
    if (formData.type_mouvement === 'SORTIE' && productId) {
      await loadAvailableLots(productId);
    }
  }

  async function loadAvailableLots(productId: string) {
    setIsLoadingLots(true);
    try {
      // Get all movements for this product with lot information
      const { data: lotMovements, error } = await supabase
        .from('mouvements')
        .select('*')
        .eq('product_id', productId)
        .not('lot_numero', 'is', null)
        .order('date_peremption', { ascending: true, nullsFirst: false });

      if (error) throw error;

      // Calculate stock per lot (FEFO - First Expiry First Out)
      const lotMap = new Map<string, any>();
      
      lotMovements?.forEach((movement: any) => {
        const lotKey = movement.lot_numero;
        if (!lotMap.has(lotKey)) {
          lotMap.set(lotKey, {
            lot_numero: movement.lot_numero,
            date_peremption: null,
            prix_unitaire: movement.prix_unitaire,
            stock: 0,
          });
        }
        
        const lot = lotMap.get(lotKey);
        if (movement.type_mouvement === 'ENTREE') {
          lot.stock += movement.quantite;
          // Update expiry date from ENTREE movements (they have the date)
          if (movement.date_peremption) {
            lot.date_peremption = movement.date_peremption;
          }
          // Update price from ENTREE movements
          if (movement.prix_unitaire) {
            lot.prix_unitaire = movement.prix_unitaire;
          }
        } else if (movement.type_mouvement === 'SORTIE') {
          lot.stock -= movement.quantite;
        }
      });

      // Filter lots with stock > 0 and sort by expiry date (FEFO)
      const activeLots = Array.from(lotMap.values())
        .filter(lot => lot.stock > 0)
        .sort((a, b) => {
          if (!a.date_peremption) return 1;
          if (!b.date_peremption) return -1;
          return new Date(a.date_peremption).getTime() - new Date(b.date_peremption).getTime();
        });

      setAvailableLots(activeLots);
    } catch (error) {
      console.error('Error loading lots:', error);
      showToast('error', 'Erreur lors du chargement des lots');
    } finally {
      setIsLoadingLots(false);
    }
  }

  function handleLotChange(lotNumero: string) {
    setSelectedLot(lotNumero);
    const lot = availableLots.find(l => l.lot_numero === lotNumero);
    
    if (lot) {
      setLotDetails(lot);
      setFormData(prev => ({
        ...prev,
        lot_numero: lot.lot_numero,
        prix_unitaire: lot.prix_unitaire || 0,
        date_peremption: lot.date_peremption || '',
      }));
      
      // Validate quantity
      if (formData.quantite > lot.stock) {
        setQuantityError(`Quantité disponible: ${lot.stock} unités`);
      } else {
        setQuantityError('');
      }
    }
  }

  function handleQuantityChange(qty: number) {
    setFormData(prev => ({ ...prev, quantite: qty }));
    
    // Validate for SORTIE
    if (formData.type_mouvement === 'SORTIE' && lotDetails) {
      if (qty > lotDetails.stock) {
        setQuantityError(`Quantité disponible: ${lotDetails.stock} unités`);
      } else {
        setQuantityError('');
      }
    }
  }

  function handleTypeChange(type: 'ENTREE' | 'SORTIE') {
    setFormData(prev => ({
      ...prev,
      type_mouvement: type,
      quantite: 0,
      lot_numero: '',
      date_peremption: '',
      prix_unitaire: 0,
      fournisseur: '',
    }));
    setSelectedLot('');
    setLotDetails(null);
    setQuantityError('');
    setAvailableLots([]);

    // If product selected and switching to SORTIE, load lots
    if (type === 'SORTIE' && formData.product_id) {
      loadAvailableLots(formData.product_id);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    try {
      const product = products.find(p => p.id === formData.product_id);
      if (!product) throw new Error('Produit introuvable');

      const currentStock = product.stock_actuel || 0;
      let newStock = currentStock;

      // Simple calculation: ENTREE adds, SORTIE subtracts
      if (formData.type_mouvement === 'ENTREE') {
        newStock = currentStock + formData.quantite;
      } else if (formData.type_mouvement === 'SORTIE') {
        newStock = currentStock - formData.quantite;
      }

      const valeur_totale = formData.quantite * (formData.prix_unitaire || 0);
      const valeur_stock = newStock * (product.prix_unitaire || 0);

      // Prepare movement data - force date_peremption to null for SORTIE
      const movementData = {
        product_id: formData.product_id,
        type_mouvement: formData.type_mouvement,
        quantite: formData.quantite,
        date_mouvement: formData.date_mouvement,
        note: formData.note,
        prix_unitaire: formData.prix_unitaire,
        lot_numero: formData.lot_numero || null,
        date_peremption: formData.type_mouvement === 'SORTIE' ? null : (formData.date_peremption || null),
        mois: selectedMonth,
        created_by: user.id,
        valeur_totale,
        solde_apres: newStock,
      };

      // @ts-ignore - New fields added to database
      const { error: movementError } = await supabase
        .from('mouvements')
        .insert([movementData]);

      if (movementError) throw movementError;

      // @ts-ignore - Supabase type inference issue
      const { error: productError } = await supabase
        .from('products')
        .update({
          stock_actuel: newStock,
          valeur_stock,
        })
        .eq('id', formData.product_id);

      if (productError) throw productError;

      showToast('success', `Mouvement enregistré avec succès — stock restant: ${newStock} unités.`);

      // Invalidate all related caches to trigger automatic refresh
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['movements'] });

      setFormData({
        product_id: '',
        type_mouvement: 'ENTREE',
        quantite: 0,
        date_mouvement: new Date().toISOString().split('T')[0],
        note: '',
        prix_unitaire: 0,
        lot_numero: '',
        date_peremption: '',
        fournisseur: '',
        date_reception: new Date().toISOString().split('T')[0],
      });
      setSelectedLot('');
      setLotDetails(null);
      setQuantityError('');
      setAvailableLots([]);
      setShowForm(false);
      refetch();
      loadProducts();
    } catch (error: any) {
      showToast('error', `Erreur: ${error.message}`);
    }
  }

  async function handleDelete() {
    if (!confirmDelete.id) return;

    try {
      // First, get the movement details to update the product stock
      // @ts-ignore - Supabase type inference issue with joined tables
      const { data: movement, error: fetchError } = await supabase
        .from('mouvements')
        .select('*, product:products(*)')
        .eq('id', confirmDelete.id)
        .single();

      if (fetchError) throw fetchError;
      if (!movement) throw new Error('Mouvement introuvable');

      // Calculate the new stock after removing this movement
      // @ts-ignore - Product type from join
      const product = movement.product as any;
      if (!product) throw new Error('Produit introuvable');

      const currentStock = product.stock_actuel || 0;
      let newStock = currentStock;

      // Reverse the movement operation: ENTREE adds (so subtract), SORTIE subtracts (so add back)
      // @ts-ignore - Movement type
      if (movement.type_mouvement === 'ENTREE') {
        // @ts-ignore - Movement type
        newStock = currentStock - movement.quantite;
      // @ts-ignore - Movement type
      } else if (movement.type_mouvement === 'SORTIE') {
        // @ts-ignore - Movement type
        newStock = currentStock + movement.quantite;
      }

      // Prevent negative stock
      if (newStock < 0) {
        throw new Error('La suppression de ce mouvement entraînerait un stock négatif. Impossible de supprimer.');
      }

      const valeur_stock = newStock * (product.prix_unitaire || 0);

      // Delete the movement
      const { error: deleteError } = await supabase
        .from('mouvements')
        .delete()
        .eq('id', confirmDelete.id);

      if (deleteError) throw deleteError;

      // Update product stock
      // @ts-ignore - Supabase type inference issue
      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock_actuel: newStock,
          valeur_stock,
        })
        // @ts-ignore - Movement type
        .eq('id', movement.product_id);

      if (updateError) throw updateError;

      showToast('success', 'Mouvement supprimé avec succès.');
      
      // Invalidate all related caches and force refetch
      await queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'active' });
      await queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'active' });
      await queryClient.invalidateQueries({ queryKey: ['movements'], refetchType: 'active' });
      await queryClient.refetchQueries({ queryKey: ['movements'] });
      
      setConfirmDelete({ show: false, id: '' });
      loadProducts();
    } catch (error: any) {
      showToast('error', `Erreur lors de la suppression: ${error.message}`);
      setConfirmDelete({ show: false, id: '' });
    }
  }

  function handleExport() {
    const exportData = movements.map(m => ({
      date: formatDate(m.date_mouvement),
      type: m.type_mouvement,
      produit: m.product?.nom || '',
      code: m.product?.code || '',
      quantite: m.quantite,
      // @ts-ignore
      lot_numero: m.lot_numero || '',
      // @ts-ignore
      date_peremption: m.date_peremption ? formatDate(m.date_peremption) : '',
      prix_unitaire: formatCurrency(m.prix_unitaire),
      valeur_totale: formatCurrency(m.valeur_totale),
      solde_apres: m.solde_apres,
      note: m.note || '',
    }));
    exportToCSV(exportData, `mouvements_${selectedMonth}`);
  }

  function handlePrint(mode: 'current' | 'all') {
    setPrintMode(mode);
    // Small delay to allow state update before printing
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 100);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  function handlePageSizeChange(newSize: number) {
    setPageSize(newSize);
    setPage(1);
    localStorage.setItem('movements_pageSize', newSize.toString());
  }

  if (isLoading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-800 print:hidden">Mouvements de Stock</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium print:hidden"
          >
            <Plus className="w-4 h-4" />
            Nouveau Mouvement
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 print:hidden">
          <button
            onClick={handleExport}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            Exporter CSV
          </button>
          <button
            onClick={() => handlePrint('current')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <Printer className="w-4 h-4" />
            Imprimer Page Actuelle
          </button>
          <button
            onClick={() => handlePrint('all')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors text-sm font-medium"
          >
            <Printer className="w-4 h-4" />
            Imprimer Tout
          </button>
        </div>
      </div>

      {/* Print Header - Only visible when printing */}
      <div className="hidden print:block mb-6">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-slate-800">CHRB – Gestion de Stock</h1>
          <h2 className="text-xl font-semibold text-slate-700 mt-2">Mouvements de Stock</h2>
          <p className="text-sm text-slate-600 mt-2">
            Période: {formatMonth(selectedMonth)}
          </p>
          {searchTerm && <p className="text-sm text-slate-600">Recherche: {searchTerm}</p>}
          {typeFilter !== 'ALL' && <p className="text-sm text-slate-600">Filtre: {typeFilter}</p>}
          <p className="text-sm text-slate-500 mt-1">
            Imprimé le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Nouveau Mouvement</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Produit <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.product_id}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                >
                  <option value="">Sélectionner un produit</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom} (Stock: {p.stock_actuel || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.type_mouvement}
                  onChange={(e) => handleTypeChange(e.target.value as 'ENTREE' | 'SORTIE')}
                  className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                >
                  <option value="ENTREE">Entrée (Stock In)</option>
                  <option value="SORTIE">Sortie (Stock Out)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantité <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  step="1"
                  min="1"
                  value={formData.quantite}
                  onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 0)}
                  className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Prix unitaire (USD) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={formData.prix_unitaire}
                  onChange={(e) => setFormData({ ...formData, prix_unitaire: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.date_mouvement}
                  onChange={(e) => setFormData({ ...formData, date_mouvement: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                />
              </div>

              {/* LOT MANAGEMENT FOR SORTIE - Select from available lots */}
              {formData.type_mouvement === 'SORTIE' && formData.product_id && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Sélectionner un lot <span className="text-red-500">*</span>
                  </label>
                  {isLoadingLots ? (
                    <div className="px-3 sm:px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-500">
                      Chargement des lots...
                    </div>
                  ) : availableLots.length > 0 ? (
                    <select
                      required
                      value={formData.lot_numero}
                      onChange={(e) => handleLotChange(e.target.value)}
                      className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                    >
                      <option value="">Choisir un lot (FEFO)</option>
                      {availableLots.map((lot) => (
                        <option key={lot.lot_numero} value={lot.lot_numero}>
                          {lot.lot_numero} - Stock: {lot.stock} - Expiration: {lot.date_peremption ? new Date(lot.date_peremption).toLocaleDateString('fr-FR') : 'N/A'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-3 sm:px-4 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-700">
                      Aucun lot disponible pour ce produit
                    </div>
                  )}
                  {quantityError && (
                    <p className="mt-1 text-sm text-red-600">{quantityError}</p>
                  )}
                  {lotDetails && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Stock disponible:</strong> {lotDetails.stock} unités
                      </p>
                      <p className="text-sm text-blue-800">
                        <strong>Prix unitaire:</strong> {formatCurrency(lotDetails.prix_unitaire)}
                      </p>
                      {lotDetails.date_peremption && (
                        <p className="text-sm text-blue-800">
                          <strong>Date de péremption:</strong> {new Date(lotDetails.date_peremption).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* LOT MANAGEMENT FOR ENTREE - Create new lot */}
              {formData.type_mouvement === 'ENTREE' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Numéro de lot <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lot_numero}
                      onChange={(e) => setFormData({ ...formData, lot_numero: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                      placeholder="Ex: LOT-2025-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Date de péremption <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.date_peremption}
                      onChange={(e) => setFormData({ ...formData, date_peremption: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Fournisseur
                    </label>
                    <input
                      type="text"
                      value={formData.fournisseur}
                      onChange={(e) => setFormData({ ...formData, fournisseur: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                      placeholder="Nom du fournisseur"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Date de réception
                    </label>
                    <input
                      type="date"
                      value={formData.date_reception}
                      onChange={(e) => setFormData({ ...formData, date_reception: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                    />
                  </div>
                </>
              )}

              <div className="md:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Valeur totale</label>
                <div className="px-3 sm:px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg">
                  <p className="text-sm font-semibold text-slate-800">
                    {formatCurrency(formData.quantite * formData.prix_unitaire)}
                  </p>
                </div>
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
                <input
                  type="text"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  placeholder="Note optionnelle..."
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-full sm:w-auto px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm sm:text-base"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1 flex items-center gap-2">
            <Search className="w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full sm:w-auto px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
          >
            <option value="ALL">Tous les types</option>
            <option value="ENTREE">Entrées</option>
            <option value="SORTIE">Sorties</option>
          </select>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Date</th>
                  <th className="text-left py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Type</th>
                  <th className="text-left py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Produit</th>
                  <th className="text-right py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Qté</th>
                  <th className="hidden md:table-cell text-left py-3 px-4 text-sm font-semibold text-slate-700">Numéro de lot</th>
                  <th className="hidden lg:table-cell text-left py-3 px-4 text-sm font-semibold text-slate-700">Date de péremption</th>
                  <th className="hidden md:table-cell text-right py-3 px-4 text-sm font-semibold text-slate-700">Prix Unit.</th>
                  <th className="hidden lg:table-cell text-right py-3 px-4 text-sm font-semibold text-slate-700">Valeur</th>
                  <th className="text-right py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Solde</th>
                  <th className="hidden xl:table-cell text-left py-3 px-4 text-sm font-semibold text-slate-700">Note</th>
                  <th className="text-right py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayMovements.map((movement: any) => {
                  // Calculate expiry status
                  let expiryClass = '';
                  let expiryText = '';
                  // @ts-ignore - New fields added to database
                  if (movement.date_peremption) {
                    const today = new Date();
                    // @ts-ignore
                    const expiryDate = new Date(movement.date_peremption);
                    const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (daysUntilExpiry < 0) {
                      expiryClass = 'text-red-700 font-semibold';
                      // @ts-ignore
                      expiryText = formatDate(movement.date_peremption);
                    } else if (daysUntilExpiry <= 30) {
                      expiryClass = 'text-orange-600 font-semibold';
                      // @ts-ignore
                      expiryText = formatDate(movement.date_peremption);
                    } else {
                      expiryClass = 'text-slate-700';
                      // @ts-ignore
                      expiryText = formatDate(movement.date_peremption);
                    }
                  }

                  return (
                    <tr key={movement.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-3 sm:px-4 text-xs sm:text-sm text-slate-700 whitespace-nowrap">{formatDate(movement.date_mouvement)}</td>
                      <td className="py-3 px-3 sm:px-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          movement.type_mouvement === 'ENTREE' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {movement.type_mouvement === 'ENTREE' ? 'ENT' : 'SOR'}
                        </span>
                      </td>
                      <td className="py-3 px-3 sm:px-4">
                        <div className="text-xs sm:text-sm text-slate-700 font-medium">{movement.product?.nom}</div>
                        {movement.note && (
                          <div className="xl:hidden text-xs text-slate-500 mt-0.5 truncate max-w-[120px]">{movement.note}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-xs sm:text-sm text-slate-700 text-right font-medium whitespace-nowrap">
                        {movement.type_mouvement === 'SORTIE' ? '-' : ''}
                        {formatNumber(movement.quantite)}
                      </td>
                      <td className="hidden md:table-cell py-3 px-4 text-sm text-slate-700">
                        {/* @ts-ignore */}
                        {movement.lot_numero || '-'}
                      </td>
                      <td className={`hidden lg:table-cell py-3 px-4 text-sm ${expiryClass}`}>
                        {expiryText || '-'}
                      </td>
                      <td className="hidden md:table-cell py-3 px-4 text-sm text-slate-600 text-right">{formatCurrency(movement.prix_unitaire)}</td>
                      <td className="hidden lg:table-cell py-3 px-4 text-sm text-slate-700 text-right font-medium">{formatCurrency(movement.valeur_totale)}</td>
                      <td className="py-3 px-3 sm:px-4 text-right">
                        <span className={`inline-block px-2 py-1 rounded text-xs sm:text-sm font-semibold ${
                          (movement.solde_apres || 0) >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {formatNumber(movement.solde_apres)}
                        </span>
                      </td>
                      <td className="hidden xl:table-cell py-3 px-4 text-sm text-slate-600 truncate max-w-xs">{movement.note}</td>
                      <td className="py-3 px-3 sm:px-4 text-right">
                        <button
                          onClick={() => setConfirmDelete({ show: true, id: movement.id })}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {movements.length === 0 && (
            <div className="text-center py-8 text-slate-500">Aucun mouvement trouvé</div>
          )}
          
          <div className="print:hidden">
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalMovements}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmDelete.show}
        onClose={() => setConfirmDelete({ show: false, id: '' })}
        onConfirm={handleDelete}
        title="Supprimer ce mouvement"
        message="Voulez-vous vraiment supprimer ce mouvement ? Cette action est irréversible."
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
      />
    </div>
  );
}
