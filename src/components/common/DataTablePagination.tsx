import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight 
} from 'lucide-react';

export interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
}

export const DataTablePagination: React.FC<DataTablePaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100, -1],
  itemLabel = 'entries',
  className = ''
}) => {
  const [jumpPageInput, setJumpPageInput] = useState<string>('');

  if (totalItems === 0) {
    return (
      <div className={`flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6 text-xs text-gray-500 ${className}`}>
        <span>No {itemLabel} found</span>
      </div>
    );
  }

  // Generate page numbers with smart ellipsis
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpPageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpPageInput('');
    }
  };

  const displayStart = totalItems === 0 ? 0 : startIndex + 1;
  const displayEnd = endIndex;

  return (
    <div className={`bg-white px-4 py-3 border-t border-gray-200 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 select-none ${className}`}>
      {/* Left side: Information count & Page size selector */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-700">
        <div>
          Showing <span className="font-semibold text-gray-900">{displayStart}</span> to{' '}
          <span className="font-semibold text-gray-900">{displayEnd}</span> of{' '}
          <span className="font-semibold text-gray-900">{totalItems}</span> {itemLabel}
        </div>

        <div className="flex items-center gap-1.5 pl-2 border-l border-gray-300">
          <label htmlFor="pageSizeSelect" className="text-gray-500 whitespace-nowrap">
            Rows per page:
          </label>
          <select
            id="pageSizeSelect"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-gray-50 border border-gray-300 text-gray-800 text-xs rounded-md px-2 py-1 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer outline-none"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === -1 ? 'All' : opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right side: Navigation buttons & Quick jump */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Fast jump form when there are multiple pages */}
        {totalPages > 5 && (
          <form onSubmit={handleJumpSubmit} className="flex items-center gap-1 mr-2 text-xs">
            <span className="text-gray-500">Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              placeholder="#"
              className="w-12 px-1.5 py-1 text-center bg-gray-50 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </form>
        )}

        <div className="inline-flex items-center -space-x-px rounded-md shadow-sm">
          {/* First Page */}
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            title="First Page"
            className="relative inline-flex items-center px-2 py-1.5 rounded-l-md border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span className="sr-only">First</span>
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>

          {/* Previous Page */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            title="Previous Page"
            className="relative inline-flex items-center px-2 py-1.5 border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span className="sr-only">Previous</span>
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          {/* Page Number Pills */}
          <div className="hidden sm:inline-flex -space-x-px">
            {getPageNumbers().map((pageNum, idx) => {
              if (pageNum === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="relative inline-flex items-center px-3 py-1.5 border border-gray-300 bg-gray-50 text-xs font-medium text-gray-400 select-none"
                  >
                    ...
                  </span>
                );
              }

              const isCurrent = pageNum === currentPage;
              return (
                <button
                  key={`page-${pageNum}`}
                  onClick={() => onPageChange(pageNum as number)}
                  className={`relative inline-flex items-center px-3 py-1.5 border text-xs font-medium transition-colors ${
                    isCurrent
                      ? 'z-10 bg-indigo-600 border-indigo-600 text-white font-bold'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Mobile Current Indicator */}
          <span className="sm:hidden relative inline-flex items-center px-3 py-1.5 border border-gray-300 bg-white text-xs font-medium text-gray-700">
            {currentPage} / {totalPages}
          </span>

          {/* Next Page */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="Next Page"
            className="relative inline-flex items-center px-2 py-1.5 border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span className="sr-only">Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          {/* Last Page */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            title="Last Page"
            className="relative inline-flex items-center px-2 py-1.5 rounded-r-md border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span className="sr-only">Last</span>
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataTablePagination;
