import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function PaginationControls({
  currentPage,
  totalPages,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const pageSizeOptions = [10, 25, 50, 100];
  const start = currentPage * pageSize + 1;
  const end = Math.min((currentPage + 1) * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 px-4 py-3 bg-white border-t border-slate-200">
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <span>Lignes par page:</span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(0); // Reset to first page
          }}
          className="border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-700">
          {total === 0 ? 'Aucun résultat' : `${start}-${end} sur ${total}`}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0}
            className="p-2 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
            aria-label="Page précédente"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <span className="px-3 text-sm text-slate-700">
            Page {currentPage + 1} / {totalPages || 1}
          </span>
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages - 1 || totalPages === 0}
            className="p-2 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
            aria-label="Page suivante"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
