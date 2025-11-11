import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Save, Lock, Search, Upload, Printer } from 'lucide-react';
import { formatNumber, exportToCSV, formatDate, getMonthDate } from '../lib/utils';
import { PaginationControls } from './PaginationControls';
import { useInventoryLines } from '../lib/hooks';
import ConfirmModal from './ConfirmModal';
import type { Database } from '../lib/database.types';

type Inventory = Database['public']['Tables']['inventaires']['Row'];
type InventoryLine = Database['public']['Tables']['lignes_inventaire']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

interface InventoryLineWithProduct extends InventoryLine {
  product?: Product;
}

export function InventoryPage({ selectedMonth }: { selectedMonth: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('inventory_pageSize');
    return saved ? parseInt(saved) : 25;
  });

  // Use React Query hook for inventory lines
  const { data: linesData, isLoading: linesLoading, refetch } = useInventoryLines({
    page,
    pageSize,
    searchTerm,
    inventoryId: inventory?.id,
  });

  const lines = linesData?.data || [];
  const totalLines = linesData?.total || 0;
  const totalPages = linesData?.pageCount || 1;

  useEffect(() => {
    loadInventory();
  }, [selectedMonth]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  async function loadInventory() {
    try {
      setLoading(true);

      let { data: inv, error: invError } = await supabase
        .from('inventaires')
        .select('*')
        .eq('mois', selectedMonth)
        .maybeSingle();

      if (invError) throw invError;

      if (!inv) {
        const { data: newInv, error: createError } = await supabase
          .from('inventaires')
          .insert([{ mois: selectedMonth, statut: 'BROUILLON' }])
          .select()
          .single();

        if (createError) throw createError;
        inv = newInv;

        await initializeInventoryLines(newInv.id);
      }

      setInventory(inv);

      // Refetch lines after inventory is loaded
      refetch();
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  }

  async function initializeInventoryLines(inventoryId: string) {
    try {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, stock_actuel')
        .eq('actif', true);

      if (productsError) throw productsError;

      const linesToInsert = products.map((product) => ({
        inventaire_id: inventoryId,
        product_id: product.id,
        stock_theorique: product.stock_actuel || 0,
        stock_physique: 0,
        ecart: -product.stock_actuel || 0,
      }));

      const { error: insertError } = await supabase
        .from('lignes_inventaire')
        .insert(linesToInsert);

      if (insertError) throw insertError;
    } catch (error) {
      console.error('Error initializing inventory lines:', error);
    }
  }

  async function updateLine(lineId: string, stockPhysique: number) {
    const line = lines.find(l => l.id === lineId);
    if (!line) return;

    const stockTheorique = line.product?.stock_actuel || 0;
    const ecart = stockPhysique - stockTheorique;

    try {
      // @ts-ignore - Supabase type inference issue
      const { error } = await supabase
        .from('lignes_inventaire')
        // @ts-ignore
        .update({
          stock_physique: stockPhysique,
          stock_theorique: stockTheorique,
          ecart: ecart,
        })
        .eq('id', lineId);

      if (error) throw error;

      refetch();
    } catch (error: any) {
      showToast('error', `Erreur: ${error.message}`);
    }
  }

  async function saveInventory() {
    if (!inventory) return;

    try {
      setSaving(true);
      showToast('success', 'Inventaire sauvegardé !');
    } catch (error: any) {
      showToast('error', `Erreur: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function validateInventory() {
    if (!inventory || !user) return;

    const allFilled = lines.every(l => l.stock_physique !== null && l.stock_physique !== undefined);
    if (!allFilled) {
      showToast('warning', 'Veuillez remplir tous les stocks physiques avant de valider.');
      return;
    }

    try {
      setSaving(true);
      // @ts-ignore - Supabase type inference issue
      const { error } = await supabase
        .from('inventaires')
        // @ts-ignore
        .update({
          statut: 'VALIDE',
          validated_by: user.id,
          validated_at: new Date().toISOString(),
        })
        .eq('id', inventory.id);

      if (error) throw error;
      loadInventory();
      showToast('success', 'Inventaire validé avec succès !');
    } catch (error: any) {
      showToast('error', `Erreur: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const exportData = lines.map((l: any) => ({
      produit: l.product?.nom || '',
      code: l.product?.code || '',
      stock_theorique: l.stock_theorique || 0,
      stock_physique: l.stock_physique || 0,
      ecart: l.ecart || 0,
    }));
    exportToCSV(exportData, `inventaire_${selectedMonth}`);
  }

  async function handlePrint() {
    try {
      if (!inventory?.id) {
        showToast('error', 'Aucun inventaire trouvé');
        return;
      }

      // Récupérer tous les produits (sans pagination)
      const { data: allLines, error } = await supabase
        .from('lignes_inventaire')
        .select('*, product:products!inner(*)')
        .eq('inventaire_id', inventory.id)
        .order('product(nom)', { ascending: true });

      if (error) {
        console.error('Erreur Supabase:', error);
        throw error;
      }

      if (!allLines || allLines.length === 0) {
        showToast('warning', 'Aucun produit dans l\'inventaire');
        return;
      }

      console.log('Lignes récupérées:', allLines.length);

      // Créer le contenu HTML pour l'impression
      const printContent = generatePrintHTML(allLines);
      
      // Ouvrir une nouvelle fenêtre et imprimer
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Attendre que le contenu soit rendu puis imprimer
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
      } else {
        showToast('error', 'Impossible d\'ouvrir la fenêtre d\'impression. Vérifiez les popups bloqués.');
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'impression:', error);
      showToast('error', `Erreur lors de la génération du PDF: ${error.message}`);
    }
  }

  function generatePrintHTML(allLines: any[]): string {
    // Créer une date UTC pour éviter les problèmes de timezone
    const date = getMonthDate(selectedMonth);
    const monthYear = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const printDate = new Date().toLocaleDateString('fr-FR');
    
    // Fonction pour échapper le HTML
    const escapeHtml = (text: string) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };
    
    // Diviser les produits en 2 colonnes
    const halfLength = Math.ceil(allLines.length / 2);
    const leftColumn = allLines.slice(0, halfLength);
    const rightColumn = allLines.slice(halfLength);

    const generateRows = (items: any[]) => items.map((line: any) => {
      const stockTheorique = line.product?.stock_actuel || 0;
      const productName = escapeHtml(line.product?.nom || '');
      return `
        <tr>
          <td>${productName}</td>
          <td style="text-align: center;">${formatNumber(stockTheorique)}</td>
          <td style="text-align: center;"></td>
          <td style="text-align: center;"></td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Inventaire Mensuel - ${monthYear}</title>
        <style>
          @media print {
            @page {
              size: A4;
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #1e293b;
          }
          
          .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 3px solid #3b82f6;
          }
          
          .header h1 {
            font-size: 20pt;
            color: #1e40af;
            margin-bottom: 5px;
            font-weight: 700;
          }
          
          .header h2 {
            font-size: 14pt;
            color: #475569;
            margin-bottom: 8px;
            font-weight: 600;
          }
          
          .header-info {
            font-size: 10pt;
            color: #64748b;
          }
          
          .columns-container {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
          }
          
          .column {
            flex: 1;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            background: white;
          }
          
          th {
            background: #3b82f6;
            color: white;
            font-weight: 600;
            padding: 6px 8px;
            text-align: left;
            font-size: 9pt;
            border: 1px solid #2563eb;
          }
          
          td {
            border: 1px solid #cbd5e1;
            padding: 4px 8px;
            font-size: 9pt;
          }
          
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          
          .text-center {
            text-align: center;
          }
          
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #cbd5e1;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
          }
          
          .signature-box {
            flex: 1;
            margin: 0 10px;
          }
          
          .signature-box label {
            display: block;
            font-weight: 600;
            margin-bottom: 30px;
            color: #475569;
            font-size: 10pt;
          }
          
          .signature-line {
            border-top: 1px solid #334155;
            padding-top: 5px;
            text-align: center;
            color: #64748b;
            font-size: 9pt;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>CHRB Gestion de Stock</h1>
          <h2>Inventaire Mensuel</h2>
          <div class="header-info">
            <strong>Période:</strong> ${monthYear} | 
            <strong>Date d'impression:</strong> ${printDate}
          </div>
        </div>
        
        <div class="columns-container">
          <div class="column">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th class="text-center">Théorique</th>
                  <th class="text-center">Physique</th>
                  <th class="text-center">Écart</th>
                </tr>
              </thead>
              <tbody>
                ${generateRows(leftColumn)}
              </tbody>
            </table>
          </div>
          
          <div class="column">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th class="text-center">Théorique</th>
                  <th class="text-center">Physique</th>
                  <th class="text-center">Écart</th>
                </tr>
              </thead>
              <tbody>
                ${generateRows(rightColumn)}
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="footer">
          <div class="signature-box">
            <label>Signature:</label>
            <div class="signature-line">Signature du contrôleur</div>
          </div>
          
          <div class="signature-box">
            <label>Validé par:</label>
            <div class="signature-line">Nom et signature</div>
          </div>
          
          <div class="signature-box">
            <label>Date:</label>
            <div class="signature-line">JJ/MM/AAAA</div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  function handlePageSizeChange(newSize: number) {
    setPageSize(newSize);
    setPage(1);
    localStorage.setItem('inventory_pageSize', newSize.toString());
  }

  const isValidated = inventory?.statut === 'VALIDE';

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-2 sm:space-y-6 px-2 sm:px-0 pb-20 sm:pb-0">
      <div className="flex flex-col gap-2 sm:gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
          <div className="min-w-0 flex-1 w-full">
            <h2 className="text-lg sm:text-2xl font-bold text-slate-800">Inventaire Mensuel</h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Statut: {isValidated ? (
                <span className="text-green-600 font-medium">Validé</span>
              ) : (
                <span className="text-orange-600 font-medium">Brouillon</span>
              )}
              {inventory?.validated_at && (
                <span className="text-slate-500 hidden sm:inline"> - Validé le {formatDate(inventory.validated_at)}</span>
              )}
            </p>
          </div>
          {/* Desktop: Primary action button (Valider) */}
          {!isValidated && (
            <button
              onClick={() => setShowValidateModal(true)}
              disabled={saving}
              className="hidden sm:flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium text-sm flex-shrink-0"
              aria-label="Valider l'inventaire mensuel"
            >
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span>Valider l'inventaire</span>
            </button>
          )}
        </div>

        {/* Desktop: Secondary actions in row */}
        <div className="hidden sm:flex gap-3">
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
            aria-label="Exporter l'inventaire"
          >
            <Upload className="w-4 h-4 flex-shrink-0" />
            Exporter
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
            aria-label="Imprimer l'inventaire en PDF"
          >
            <Printer className="w-4 h-4 flex-shrink-0" />
            Imprimer (PDF)
          </button>
          {!isValidated && (
            <button
              onClick={saveInventory}
              disabled={saving}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
              aria-label="Sauvegarder l'inventaire"
            >
              <Save className="w-4 h-4 flex-shrink-0" />
              Sauvegarder
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-0 px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Desktop Table - Hidden on mobile */}
        <div className="hidden sm:block overflow-x-auto -mx-2 sm:mx-0">
          <div className="inline-block min-w-full align-middle px-2 sm:px-0">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">Produit</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">Théorique</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">Physique</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">Écart</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line: any) => {
                  const stockTheorique = line.product?.stock_actuel || 0;
                  const stockPhysique = line.stock_physique || 0;
                  const ecart = stockPhysique - stockTheorique;
                  
                  return (
                    <tr key={line.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-xs text-slate-700 font-medium">{line.product?.nom}</td>
                      <td className="py-3 px-4 text-xs text-slate-700 text-right whitespace-nowrap">{formatNumber(stockTheorique)}</td>
                      <td className="py-3 px-4 text-right">
                        {isValidated ? (
                          <span className="text-xs text-slate-700">{formatNumber(stockPhysique)}</span>
                        ) : (
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={stockPhysique}
                            onChange={(e) => updateLine(line.id, parseInt(e.target.value) || 0)}
                            className="w-20 px-2 py-1 text-xs text-right border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                            ecart === 0
                              ? 'bg-slate-100 text-slate-700'
                              : ecart > 0
                              ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                        >
                          {ecart > 0 ? '+' : ''}{formatNumber(ecart)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card Layout - Compact et moderne */}
        <div className="sm:hidden space-y-2">
          {lines.map((line: any) => {
            const stockTheorique = line.product?.stock_actuel || 0;
            const stockPhysique = line.stock_physique || 0;
            const ecart = stockPhysique - stockTheorique;
            
            return (
              <div key={line.id} className="bg-white rounded-xl shadow-sm border-0 p-3 transition-all duration-200">
                <div className="font-semibold text-sm text-slate-800 mb-2 truncate">{line.product?.nom}</div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Théorique</div>
                    <div className="text-sm font-semibold text-slate-700 bg-slate-50 rounded-lg px-2 py-1.5 text-center">
                      {formatNumber(stockTheorique)}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Physique</div>
                    {isValidated ? (
                      <div className="text-sm font-semibold text-slate-700 bg-slate-50 rounded-lg px-2 py-1.5 text-center">
                        {formatNumber(stockPhysique)}
                      </div>
                    ) : (
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={stockPhysique}
                        onChange={(e) => updateLine(line.id, parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 text-sm text-center font-medium bg-slate-50 border-0 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200"
                      />
                    )}
                  </div>
                  
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Écart</div>
                    <div
                      className={`text-sm font-bold rounded-lg px-2 py-1.5 text-center transition-all duration-200 ${
                        ecart === 0
                          ? 'bg-slate-100 text-slate-700'
                          : ecart > 0
                          ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {ecart > 0 ? '+' : ''}{formatNumber(ecart)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {lines.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">Aucun produit trouvé</div>
        )}
      </div>

      <PaginationControls
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={totalLines}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {!isValidated && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Remplissez les stocks physiques pour chaque produit, puis validez l'inventaire.
            Une fois validé, l'inventaire ne pourra plus être modifié.
          </p>
        </div>
      )}

      <ConfirmModal
        isOpen={showValidateModal}
        onClose={() => setShowValidateModal(false)}
        onConfirm={validateInventory}
        title="Valider l'inventaire"
        message="Voulez-vous vraiment valider cet inventaire ? Cette action est irréversible."
        confirmText="Valider"
        cancelText="Annuler"
        type="warning"
      />

      {/* Mobile: Sticky bottom bar for primary action */}
      {!isValidated && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-lg z-40">
          <button
            onClick={() => setShowValidateModal(true)}
            disabled={saving}
            className="w-full h-11 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 font-medium text-sm shadow-sm"
            aria-label="Valider l'inventaire mensuel"
          >
            <Lock className="w-4 h-4 flex-shrink-0" />
            Valider
          </button>
        </div>
      )}

      {/* Mobile: Bouton Sauvegarder sticky */}
      {!isValidated && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 p-3 shadow-lg z-40">
          <button
            onClick={saveInventory}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 hover:shadow-lg transition-all duration-200 disabled:opacity-50 text-sm font-semibold"
            aria-label="Sauvegarder l'inventaire"
          >
            <Save className="w-5 h-5 flex-shrink-0" />
            <span>Sauvegarder l'inventaire</span>
          </button>
        </div>
      )}
    </div>
  );
}
