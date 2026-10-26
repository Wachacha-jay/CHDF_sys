import { useState, useMemo, useEffect } from 'react';

export interface UsePaginationOptions<T> {
  data: T[];
  initialPageSize?: number;
  initialPage?: number;
  resetDependencies?: any[];
}

export interface UsePaginationResult<T> {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  paginatedData: T[];
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  setPageSize: (size: number) => void;
  canNextPage: boolean;
  canPrevPage: boolean;
  isAll: boolean;
}

export function usePagination<T>({
  data,
  initialPageSize = 25,
  initialPage = 1,
  resetDependencies = []
}: UsePaginationOptions<T>): UsePaginationResult<T> {
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [pageSize, setPageSizeState] = useState<number>(initialPageSize);

  // Auto-reset to page 1 whenever search/filter dependencies change
  useEffect(() => {
    setCurrentPage(1);
  }, resetDependencies);

  const totalItems = data.length;
  const isAll = pageSize === -1 || (pageSize >= totalItems && totalItems > 0);

  const totalPages = useMemo(() => {
    if (totalItems === 0) return 1;
    if (pageSize === -1) return 1;
    return Math.ceil(totalItems / pageSize);
  }, [totalItems, pageSize]);

  // Ensure currentPage stays within valid bounds if total items decreases
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = useMemo(() => {
    if (totalItems === 0 || isAll) return 0;
    return (currentPage - 1) * pageSize;
  }, [currentPage, pageSize, totalItems, isAll]);

  const endIndex = useMemo(() => {
    if (totalItems === 0) return 0;
    if (isAll) return totalItems;
    return Math.min(startIndex + pageSize, totalItems);
  }, [startIndex, pageSize, totalItems, isAll]);

  const paginatedData = useMemo(() => {
    if (totalItems === 0) return [];
    if (isAll) return data;
    return data.slice(startIndex, endIndex);
  }, [data, startIndex, endIndex, isAll, totalItems]);

  const goToPage = (page: number) => {
    const target = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(target);
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const firstPage = () => setCurrentPage(1);
  const lastPage = () => setCurrentPage(totalPages);

  const setPageSize = (newSize: number) => {
    setPageSizeState(newSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    paginatedData,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    setPageSize,
    canNextPage: currentPage < totalPages,
    canPrevPage: currentPage > 1,
    isAll
  };
}
