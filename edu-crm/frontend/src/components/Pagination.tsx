interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, total, limit, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        Previous
      </button>
      {pages.map((pageNumber) => (
        <button
          key={pageNumber}
          className={pageNumber === page ? 'active' : ''}
          onClick={() => onPageChange(pageNumber)}
        >
          {pageNumber}
        </button>
      ))}
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
        Next
      </button>
    </div>
  );
}
