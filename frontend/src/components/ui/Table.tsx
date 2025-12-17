'use client';

import { cn } from '@/lib/utils';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

const Table = ({ children, className }: TableProps) => {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="min-w-full divide-y divide-gray-200">{children}</table>
    </div>
  );
};

const TableHeader = ({ children, className }: TableProps) => {
  return <thead className={cn('bg-gray-50', className)}>{children}</thead>;
};

const TableBody = ({ children, className }: TableProps) => {
  return <tbody className={cn('bg-white divide-y divide-gray-200', className)}>{children}</tbody>;
};

const TableRow = ({ children, className, onClick }: TableProps & { onClick?: () => void }) => {
  return (
    <tr
      className={cn(onClick && 'cursor-pointer hover:bg-gray-50', className)}
      onClick={onClick}
    >
      {children}
    </tr>
  );
};

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  header?: boolean;
}

const TableCell = ({ children, className, header = false }: TableCellProps) => {
  if (header) {
    return (
      <th
        className={cn(
          'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
          className
        )}
      >
        {children}
      </th>
    );
  }

  return (
    <td className={cn('px-6 py-4 whitespace-nowrap text-sm text-gray-900', className)}>
      {children}
    </td>
  );
};

export { Table, TableHeader, TableBody, TableRow, TableCell };
