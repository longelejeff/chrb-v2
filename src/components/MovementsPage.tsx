import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Plus, Upload, Trash2, Printer, Download, Edit2 } from 'lucide-react';
import { formatDate, formatNumber, exportToCSV, formatCurrency, formatMonth, getMonthFromDate, getMonthDate } from '../lib/utils';
import ConfirmModal from './ConfirmModal';
import { PaginationControls } from './PaginationControls';
import { useMovements, useAllMovements } from '../lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import type { Database } from '../lib/database.types';
import { openPrintWindow, escapeHtml } from '../lib/printUtils';
import { EmptyState } from './ui/EmptyState';
import { FAB } from './ui/FAB';
import { SearchBar } from './ui/SearchBar';

type Product = Database['public']['Tables']['products']['Row'];

export function MovementsPage({ selectedMonth }: { selectedMonth: string }) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const isReadOnly = profile?.role === 'LECTEUR';
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [productFilter, setProductFilter] = useState<string>(''); // New: filter by specific product
  const [showForm, setShowForm] = useState(false);
  const [editingMovement, setEditingMovement] = useState<any>(null);
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
    productFilter: productFilter || undefined, // New: pass product filter
  });

  // Fetch all movements when printing all
  const { data: allMovementsData } = useAllMovements({
    searchTerm,
    month: selectedMonth,
    typeFilter: typeFilter === 'ALL' ? undefined : typeFilter,
    productFilter: productFilter || undefined, // New: pass product filter
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
  const [, setSelectedLot] = useState<string>('');
  const [lotDetails, setLotDetails] = useState<any>(null);
  const [quantityError, setQuantityError] = useState<string>('');
  const [isLoadingLots, setIsLoadingLots] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, typeFilter, productFilter, selectedMonth]);

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
      
      // Extract date part only (YYYY-MM-DD) to avoid timezone issues
      const expiryDateOnly = lot.date_peremption ? lot.date_peremption.split('T')[0] : '';
      
      setFormData(prev => ({
        ...prev,
        lot_numero: lot.lot_numero,
        prix_unitaire: lot.prix_unitaire || 0,
        date_peremption: expiryDateOnly,
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

  function handleEdit(movement: any) {
    const expiryDate = movement.date_peremption ? movement.date_peremption.split('T')[0] : '';
    setFormData({
      product_id: movement.product_id,
      type_mouvement: movement.type_mouvement,
      quantite: movement.quantite,
      date_mouvement: movement.date_mouvement?.split('T')[0] || new Date().toISOString().split('T')[0],
      note: movement.note || '',
      prix_unitaire: movement.prix_unitaire || 0,
      lot_numero: movement.lot_numero || '',
      date_peremption: expiryDate,
      fournisseur: movement.fournisseur || '',
      date_reception: movement.date_reception?.split('T')[0] || new Date().toISOString().split('T')[0],
    });
    setEditingMovement(movement);
    setShowForm(true);

    // Load lots if SORTIE
    if (movement.type_mouvement === 'SORTIE' && movement.product_id) {
      loadAvailableLots(movement.product_id).then(() => {
        if (movement.lot_numero) {
          setSelectedLot(movement.lot_numero);
        }
      });
    }
  }

  function resetForm() {
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
    setEditingMovement(null);
    setSelectedLot('');
    setLotDetails(null);
    setQuantityError('');
    setAvailableLots([]);
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    try {
      const product = products.find(p => p.id === formData.product_id);
      if (!product) throw new Error('Produit introuvable');

      const valeur_totale = formData.quantite * (formData.prix_unitaire || 0);

      if (editingMovement) {
        // EDIT MODE: update the row in place, then recalculate stock from all movements
        const movementUpdate = {
          product_id: formData.product_id,
          type_mouvement: formData.type_mouvement,
          quantite: formData.quantite,
          date_mouvement: formData.date_mouvement,
          note: formData.note,
          prix_unitaire: formData.prix_unitaire,
          lot_numero: formData.lot_numero || null,
          date_peremption: formData.date_peremption || null,
          mois: getMonthFromDate(formData.date_mouvement),
          valeur_totale,
        };

        const { data: updatedRows, error: updateError } = await (supabase
          .from('mouvements') as any)
          .update(movementUpdate)
          .eq('id', editingMovement.id)
          .select();

        if (updateError) throw updateError;
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error('Impossible de modifier ce mouvement. Vérifiez les politiques RLS dans Supabase (UPDATE sur mouvements).');
        }

        // If product changed, recalculate old product's stock too
        const oldProductId = editingMovement.product_id;
        if (oldProductId && oldProductId !== formData.product_id) {
          const { data: oldMoves } = await supabase
            .from('mouvements')
            .select('type_mouvement, quantite')
            .eq('product_id', oldProductId);
          const oldStock = (oldMoves || []).reduce((s: number, m: any) =>
            m.type_mouvement === 'ENTREE' ? s + m.quantite : s - m.quantite, 0);
          await (supabase.from('products') as any)
            .update({ stock_actuel: oldStock })
            .eq('id', oldProductId);
        }

        // Recalculate stock from ALL movements for this product
        const { data: allMoves } = await supabase
          .from('mouvements')
          .select('type_mouvement, quantite')
          .eq('product_id', formData.product_id);

        const recalcStock = (allMoves || []).reduce((sum: number, m: any) => {
          return m.type_mouvement === 'ENTREE' ? sum + m.quantite : sum - m.quantite;
        }, 0);

        // Update product stock and the movement's solde_apres
        await (supabase.from('products') as any)
          .update({ stock_actuel: recalcStock })
          .eq('id', formData.product_id);

        await (supabase.from('mouvements') as any)
          .update({ solde_apres: recalcStock })
          .eq('id', editingMovement.id);

        showToast('success', `Mouvement modifié avec succès — stock: ${recalcStock} unités.`);
      } else {
        // CREATE MODE
        const currentStock = product.stock_actuel || 0;
        const newStock = formData.type_mouvement === 'ENTREE'
          ? currentStock + formData.quantite
          : currentStock - formData.quantite;

        const movementData = {
          product_id: formData.product_id,
          type_mouvement: formData.type_mouvement,
          quantite: formData.quantite,
          date_mouvement: formData.date_mouvement,
          note: formData.note,
          prix_unitaire: formData.prix_unitaire,
          lot_numero: formData.lot_numero || null,
          date_peremption: formData.date_peremption || null,
          mois: getMonthFromDate(formData.date_mouvement),
          created_by: user.id,
          valeur_totale,
          solde_apres: newStock,
        };

        const { error: movementError } = await supabase
          .from('mouvements')
          .insert([movementData] as any);

        if (movementError) throw movementError;

        showToast('success', `Mouvement enregistré avec succès — stock restant: ${newStock} unités.`);
      }

      // Sync products.prix_unitaire on ENTREE so stock value stays accurate
      if (formData.type_mouvement === 'ENTREE' && formData.prix_unitaire > 0) {
        await (supabase.from('products') as any)
          .update({ prix_unitaire: formData.prix_unitaire })
          .eq('id', formData.product_id);
      }

      // Invalidate all related caches to trigger automatic refresh
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['movements'] });

      resetForm();
      refetch();
      loadProducts();
    } catch (error: any) {
      showToast('error', `Erreur: ${error.message}`);
    }
  }

  async function handleDelete() {
    if (!confirmDelete.id) return;

    try {
      // First get the movement so we know the product_id for stock recalc
      const { data: movToDelete } = await supabase
        .from('mouvements')
        .select('product_id')
        .eq('id', confirmDelete.id)
        .single();

      const productIdToRecalc = movToDelete?.product_id;

      const { data: deletedRows, error: deleteError } = await (supabase
        .from('mouvements') as any)
        .delete()
        .eq('id', confirmDelete.id)
        .select();

      if (deleteError) throw deleteError;
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error('Impossible de supprimer ce mouvement. Vérifiez les politiques RLS dans Supabase (DELETE sur mouvements).');
      }

      // Recalculate stock from remaining movements for this product
      if (productIdToRecalc) {
        const { data: remainingMoves } = await supabase
          .from('mouvements')
          .select('type_mouvement, quantite')
          .eq('product_id', productIdToRecalc);

        const recalcStock = (remainingMoves || []).reduce((sum: number, m: any) => {
          return m.type_mouvement === 'ENTREE' ? sum + m.quantite : sum - m.quantite;
        }, 0);

        await (supabase.from('products') as any)
          .update({ stock_actuel: recalcStock })
          .eq('id', productIdToRecalc);
      }

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

  async function handlePrintPDF() {
    try {
      // Récupérer TOUS les mouvements du mois (sans pagination)
      const { data: allMovements, error } = await supabase
        .from('mouvements')
        .select('*, product:products!inner(*)')
        .gte('date_mouvement', `${selectedMonth}-01`)
        .lte('date_mouvement', `${selectedMonth}-31`)
        .order('date_mouvement', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur Supabase:', error);
        throw error;
      }

      if (!allMovements || allMovements.length === 0) {
        showToast('warning', 'Aucun mouvement pour ce mois');
        return;
      }

      // Créer le contenu HTML pour l'impression
      const printContent = generateMovementsPrintHTML(allMovements);
      
      // Ouvrir une nouvelle fenêtre et imprimer
      openPrintWindow(printContent, () => {
        showToast('error', 'Impossible d\'ouvrir la fenêtre d\'impression. Vérifiez les popups bloqués.');
      });
    } catch (error: any) {
      console.error('Erreur lors de l\'impression:', error);
      showToast('error', `Erreur lors de la génération du PDF: ${error.message}`);
    }
  }

  function generateMovementsPrintHTML(allMovements: any[]): string {
    // Créer une date UTC pour éviter les problèmes de timezone
    const date = getMonthDate(selectedMonth);
    const monthYear = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const printDate = new Date().toLocaleDateString('fr-FR');
    
    const generateRows = () => allMovements.map((movement: any) => {
      const productName = escapeHtml(movement.product?.nom || 'Produit inconnu');
      const lotNumero = movement.lot_numero ? escapeHtml(movement.lot_numero) : '-';
      const note = movement.note ? escapeHtml(movement.note) : '-';
      const typeColor = movement.type_mouvement === 'ENTREE' ? '#22c55e' : '#3b82f6';
      
      return `
        <tr>
          <td style="font-size: 9px;">${formatDate(movement.date_mouvement)}</td>
          <td style="font-size: 9px; color: ${typeColor}; font-weight: 600;">${movement.type_mouvement}</td>
          <td style="font-size: 9px;">${productName}</td>
          <td style="font-size: 9px; text-align: center;">${lotNumero}</td>
          <td style="font-size: 9px; text-align: right;">${movement.type_mouvement === 'SORTIE' ? '-' : ''}${formatNumber(movement.quantite)}</td>
          <td style="font-size: 9px; text-align: right;">${formatCurrency(movement.prix_unitaire)}</td>
          <td style="font-size: 9px; text-align: right;">${formatCurrency(movement.valeur_totale)}</td>
          <td style="font-size: 9px; text-align: right; font-weight: 600;">${formatNumber(movement.solde_apres)}</td>
          <td style="font-size: 9px;">${note}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Mouvements du Mois - ${monthYear}</title>
        <style>
          @media print {
            @page {
              size: A4 landscape;
              margin: 1cm;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px;
            background: white;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #1e293b;
            padding-bottom: 15px;
          }
          .header h1 {
            font-size: 20px;
            color: #1e293b;
            margin-bottom: 5px;
          }
          .header h2 {
            font-size: 16px;
            color: #475569;
            margin-bottom: 10px;
          }
          .header .meta {
            font-size: 10px;
            color: #64748b;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th {
            background-color: #f1f5f9;
            color: #1e293b;
            font-size: 9px;
            font-weight: 700;
            padding: 8px 6px;
            text-align: left;
            border: 1px solid #cbd5e1;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td {
            padding: 6px 6px;
            border: 1px solid #e2e8f0;
            vertical-align: top;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 9px;
            color: #64748b;
            border-top: 1px solid #cbd5e1;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>CHRB – Gestion de Stock</h1>
          <h2>Mouvements du Mois</h2>
          <div class="meta">
            Période: ${monthYear} | Imprimé le: ${printDate} | Total: ${allMovements.length} mouvements
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 8%;">Date</th>
              <th style="width: 7%;">Type</th>
              <th style="width: 22%;">Produit</th>
              <th style="width: 10%;">Lot</th>
              <th style="width: 7%; text-align: right;">Qté</th>
              <th style="width: 9%; text-align: right;">Prix Unit.</th>
              <th style="width: 10%; text-align: right;">Valeur</th>
              <th style="width: 7%; text-align: right;">Solde</th>
              <th style="width: 20%;">Note</th>
            </tr>
          </thead>
          <tbody>
            ${generateRows()}
          </tbody>
        </table>
        
        <div class="footer">
          Document généré automatiquement le ${printDate}
        </div>
      </body>
      </html>
    `;
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
    <div className="space-y-2 sm:space-y-6 px-2 sm:px-0 pb-24 sm:pb-0">
      <div className="flex flex-col gap-2 sm:gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
          <h2 className="text-lg sm:text-2xl font-bold text-slate-800 print:hidden">Mouvements de Stock</h2>
          {/* Desktop: Primary action button */}
          {!isReadOnly && (
            <button
              onClick={() => { resetForm(); setShowForm(!showForm); }}
              className="hidden sm:flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm print:hidden"
              aria-label="Créer un nouveau mouvement de stock"
            >
            <Plus className="w-4 h-4 flex-shrink-0" />
            Nouveau Mouvement
          </button>
          )}
        </div>

        {/* Desktop: Secondary actions in row */}
        <div className="hidden sm:flex gap-3 print:hidden">
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
            aria-label="Exporter en CSV"
          >
            <Upload className="w-4 h-4 flex-shrink-0" />
            Exporter CSV
          </button>
          <button
            onClick={() => handlePrint('current')}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            aria-label="Imprimer la page courante"
          >
            <Printer className="w-4 h-4 flex-shrink-0" />
            Imprimer Page
          </button>
          <button
            onClick={() => handlePrint('all')}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors text-sm font-medium"
            aria-label="Imprimer tous les mouvements"
          >
            <Printer className="w-4 h-4 flex-shrink-0" />
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

      {showForm && !isReadOnly && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
            {editingMovement ? 'Modifier le Mouvement' : 'Nouveau Mouvement'}
          </h3>
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
                  className="w-full px-3 sm:px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
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
                  className="w-full px-3 sm:px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
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
                  inputMode="numeric"
                  placeholder="Ex: 100"
                  value={formData.quantite || ''}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 0)}
                  className="w-full px-3 sm:px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
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
                  inputMode="decimal"
                  placeholder="Ex: 25.00"
                  value={formData.prix_unitaire || ''}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setFormData({ ...formData, prix_unitaire: parseFloat(e.target.value) || 0 })}
                  readOnly={formData.type_mouvement === 'SORTIE'}
                  className={`w-full px-3 sm:px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base ${
                    formData.type_mouvement === 'SORTIE' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                  }`}
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
                  className="w-full px-3 sm:px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
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
                      className="w-full px-3 sm:px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
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

              {/* Date de péremption (read-only for SORTIE) */}
              {formData.type_mouvement === 'SORTIE' && formData.lot_numero && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date de péremption <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date_peremption}
                    readOnly
                    className="w-full px-3 sm:px-4 py-2.5 border border-slate-300 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed text-sm sm:text-base"
                    title="Date de péremption du lot sélectionné (lecture seule)"
                  />
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
                      className="w-full px-3 sm:px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
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
                      className="w-full px-3 sm:px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
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
                      className="w-full px-3 sm:px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
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
                      className="w-full px-3 sm:px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
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
                  className="w-full px-3 sm:px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  placeholder="Note optionnelle..."
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="w-full sm:w-auto px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm sm:text-base"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={formData.type_mouvement === 'SORTIE' && formData.product_id !== '' && !isLoadingLots && availableLots.length === 0}
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
              >
                {editingMovement ? 'Modifier' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border-0 p-2 sm:p-4 transition-all duration-200">
        {/* Mobile: Bouton PDF - Au-dessus de la recherche */}
        <div className="sm:hidden mb-3">
          <button
            onClick={handlePrintPDF}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full shadow-sm hover:bg-blue-700 hover:shadow-md transition-all duration-200 text-sm font-medium"
            aria-label="Télécharger PDF de tous les mouvements"
          >
            <Download className="w-4 h-4 flex-shrink-0" />
            <span>Tout (PDF)</span>
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-3 sm:mb-4">
          {/* Champ de recherche - Style uniforme */}
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Rechercher un produit..."
          />
          
          {/* Filtres - Style moderne */}
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="flex-1 sm:flex-initial px-4 py-2 sm:py-2.5 bg-slate-50 border-0 rounded-full focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all duration-200 appearance-none bg-no-repeat bg-right pr-10"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}
            >
              <option value="">Tous les produits</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.code} - {product.nom}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="flex-1 sm:flex-initial px-4 py-2 sm:py-2.5 bg-slate-50 border-0 rounded-full focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all duration-200 appearance-none bg-no-repeat bg-right pr-10"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}
            >
              <option value="ALL">Tous les types</option>
              <option value="ENTREE">Entrées</option>
              <option value="SORTIE">Sorties</option>
            </select>
          </div>
        </div>

        {/* Desktop Table - Hidden on mobile */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700">Produit</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">Qté</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">Prix Unit.</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">Solde</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayMovements.map((movement: any) => {
                  return (
                    <tr key={movement.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">{formatDate(movement.date_mouvement)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                            movement.type_mouvement === 'ENTREE' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {movement.type_mouvement === 'ENTREE' ? 'E' : 'S'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-slate-700 font-medium truncate">{movement.product?.nom}</div>
                            {movement.lot_numero && (
                              <div className="text-xs text-slate-500 truncate">
                                Lot: {movement.lot_numero}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 text-right font-medium whitespace-nowrap">
                        {movement.type_mouvement === 'SORTIE' ? '-' : '+'}
                        {formatNumber(movement.quantite)}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 text-right whitespace-nowrap">{formatCurrency(movement.prix_unitaire)}</td>
                      <td className="py-3 px-4 text-xs text-slate-700 text-right font-medium whitespace-nowrap">{formatNumber(movement.solde_apres)}</td>
                      <td className="py-3 px-4 text-right">
                        {!isReadOnly && (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(movement)}
                            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                            title="Modifier"
                          >
                            <Edit2 className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ show: true, id: movement.id })}
                            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        {/* Mobile Card Layout - Compact et moderne */}
        <div className="sm:hidden space-y-2">
          {displayMovements.map((movement: any) => (
            <div key={movement.id} className="bg-white rounded-xl shadow-sm border-0 p-3 transition-all duration-200 hover:shadow-md">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold flex-shrink-0 transition-all duration-200 ${
                    movement.type_mouvement === 'ENTREE' 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {movement.type_mouvement === 'ENTREE' ? '↑ ENTRÉE' : '↓ SORTIE'}
                  </span>
                </div>
                {!isReadOnly && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(movement)}
                    className="p-1.5 hover:bg-blue-50 rounded-lg transition-all duration-200 flex-shrink-0"
                    title="Modifier"
                  >
                    <Edit2 className="w-4 h-4 text-blue-600" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete({ show: true, id: movement.id })}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-all duration-200 flex-shrink-0"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
                )}
              </div>
              
              <div className="mb-2">
                <div className="text-sm font-semibold text-slate-800 truncate">{movement.product?.nom}</div>
                {movement.lot_numero && (
                  <div className="text-xs text-slate-500 mt-0.5">Lot: {movement.lot_numero}</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Date:</span>
                  <span className="text-xs font-medium text-slate-700">{formatDate(movement.date_mouvement)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Qté:</span>
                  <span className={`text-xs font-semibold ${movement.type_mouvement === 'SORTIE' ? 'text-red-600' : 'text-green-600'}`}>
                    {movement.type_mouvement === 'SORTIE' ? '-' : '+'}
                    {formatNumber(movement.quantite)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Prix:</span>
                  <span className="text-xs font-medium text-slate-700">{formatCurrency(movement.prix_unitaire)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Solde:</span>
                  <span className="text-xs font-bold text-slate-800">{formatNumber(movement.solde_apres)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {movements.length === 0 && (
          <EmptyState message="Aucun mouvement trouvé" />
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

      {/* Mobile: FAB - Bouton flottant rond */}
      {!isReadOnly && <FAB onClick={() => { resetForm(); setShowForm(true); }} label="Créer un nouveau mouvement de stock" />}
    </div>
  );
}
