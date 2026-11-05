import type { ReactNode } from "react";

/** A scroll region that leaves table structure and styling to its caller. */
export function TableScroll({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className: string;
  label: string;
}) {
  return (
    <div className={className} tabIndex={0} aria-label={label}>
      {children}
    </div>
  );
}

/** Use for static column headings; interactive headings can be composed directly. */
export function TableHeader({ columns }: { columns: readonly string[] }) {
  return (
    <thead>
      <tr>
        {columns.map((column) => (
          <th key={column} scope="col">
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}
