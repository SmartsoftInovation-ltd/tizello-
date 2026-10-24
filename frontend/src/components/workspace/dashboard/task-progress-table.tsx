import { ChevronDownIcon } from "@/components/ui/icons";
import type { WorkspaceOverviewRow } from "@/lib/workspace-overview";

const n = (value: number) => value.toLocaleString("en-US");

/*
 * The table twin of `TaskProgressChart` — every number the bars and their
 * tooltips show, readable without hovering, plus the two the bars do not
 * (overdue, open points). Collapsed by default: the chart is the summary, the
 * table is for whoever wants the exact figures. A native `<details>`, so it
 * opens from the keyboard and needs no JavaScript.
 */
export function TaskProgressTable({ rows }: { rows: WorkspaceOverviewRow[] }) {
  return (
    <details className="group border-t border-border">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-5 py-2.5 text-xs font-medium text-text-muted transition-colors duration-150 ease-standard hover:text-text [&::-webkit-details-marker]:hidden">
        <ChevronDownIcon className="size-3.5 -rotate-90 transition-transform duration-150 group-open:rotate-0" />
        Show as table
      </summary>

      <div className="overflow-x-auto px-5 pb-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-text-subtle">
              <th scope="col" className="py-2 pr-3 font-medium">Workspace</th>
              {["To do", "In progress", "Done", "Overdue", "Open points"].map((label) => (
                <th key={label} scope="col" className="py-2 pl-3 text-right font-medium whitespace-nowrap">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row" className="py-2 pr-3 text-left font-medium text-text">{row.name}</th>
                {[row.tasks.TODO, row.tasks.IN_PROGRESS, row.tasks.COMPLETE, row.overdue, row.openPoints].map(
                  (value, index) => (
                    <td key={index} className="py-2 pl-3 text-right text-text-muted tabular-nums">{n(value)}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
