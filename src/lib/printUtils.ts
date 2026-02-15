/**
 * Opens a new browser window with HTML content and triggers print.
 * Used by MovementsPage and InventoryPage for PDF generation.
 */
export function openPrintWindow(htmlContent: string, onError?: () => void): void {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  } else {
    onError?.();
  }
}

/**
 * Escapes HTML special characters to prevent XSS in print output.
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
