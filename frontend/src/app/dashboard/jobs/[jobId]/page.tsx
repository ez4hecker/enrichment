"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { Skeleton, TableSkeleton } from "../../../components/skeleton";
import { parseCsvText } from "../../../../lib/csv";

const ROWS_PER_PAGE = 100;
// The backend's column of Processing Errors; shown under a friendlier name.
const ERRORS_COLUMN = "processing_errors";

type Job = { id: string; fileName: string; status: string; kind: string };

// Shows a finished job's Enriched List in the browser, for checking results without downloading.
export default function JobResultsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);

  const downloadUrl = `/api/enrichment-jobs/${encodeURIComponent(jobId)}/enriched-list`;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/enrichment-jobs").then(res => res.ok ? res.json() : { jobs: [] }),
      fetch(downloadUrl).then(async res => {
        if (!res.ok) throw new Error(res.status === 404 ? "These results are not available. The job may still be running, or its results have expired." : "The results could not be loaded.");
        return res.text();
      }),
    ])
      .then(([history, csv]) => {
        if (cancelled) return;
        setJob(history.jobs?.find((entry: Job) => entry.id === jobId) ?? null);
        const [csvHeaders = [], ...csvRows] = parseCsvText(csv);
        setHeaders(csvHeaders);
        setRows(csvRows.filter(row => row.some(value => value !== "")));
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jobId, downloadUrl]);

  const filterText = filter.trim().toLowerCase();
  const shownRows = useMemo(
    () => rows.map((row, index) => ({ row, index })).filter(({ row }) => !filterText || row.some(value => value.toLowerCase().includes(filterText))),
    [rows, filterText],
  );
  const pageCount = Math.max(1, Math.ceil(shownRows.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = shownRows.slice(currentPage * ROWS_PER_PAGE, (currentPage + 1) * ROWS_PER_PAGE);
  const notFoundCount = rows.reduce((total, row) => total + row.filter(value => value === "[Not Found]").length, 0);

  return (
    <div className="flex flex-col flex-1 w-full max-w-[96rem] px-8 py-8 mx-auto gap-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <Link href="/dashboard" className="text-gray-500 hover:text-black text-sm flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to history
          </Link>
          {loading ? (
            <>
              <Skeleton className="h-7 w-80" />
              <Skeleton className="h-4 w-56 mt-1" />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 truncate" title={job?.fileName}>{job?.fileName || "Results"}</h1>
              {!error && (
                <p className="text-sm text-gray-500">
                  {rows.length.toLocaleString()} row{rows.length === 1 ? "" : "s"} · {headers.filter(h => h !== ERRORS_COLUMN).length} columns
                  {notFoundCount > 0 && <> · {notFoundCount.toLocaleString()} values not found</>}
                </p>
              )}
            </>
          )}
        </div>
        {!error && (
          <div className="flex items-center gap-2">
            <input
              value={filter}
              onChange={event => { setFilter(event.target.value); setPage(0); }}
              placeholder="Search results..."
              disabled={loading}
              className="w-56 bg-white border border-gray-200 rounded-lg py-2 px-3 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black disabled:opacity-50"
            />
            <a
              href={downloadUrl}
              download
              className={`h-10 inline-flex items-center gap-2 px-4 rounded-lg text-sm text-white font-semibold bg-black hover:bg-gray-800 transition-colors ${loading ? "pointer-events-none opacity-50" : ""}`}
            >
              <Download className="w-4 h-4" /> Download CSV
            </a>
          </div>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : error ? (
        <div className="text-red-600 bg-red-50 border border-red-100 rounded-xl p-4 text-sm">{error}</div>
      ) : (
        <div className="border border-gray-200 bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col">
          <div className="overflow-auto max-h-[calc(100vh-14rem)]">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-white border-b border-gray-200 text-gray-600 font-medium sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-3 w-12 text-center text-gray-400">#</th>
                  {headers.map((header, column) => (
                    <th key={column} className={`p-3 font-semibold ${header === ERRORS_COLUMN ? "text-amber-800 bg-amber-50" : "text-gray-700"}`}>
                      {header === ERRORS_COLUMN ? "Notes" : header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageRows.map(({ row, index }) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-3 text-center text-gray-400 text-xs">{index + 1}</td>
                    {headers.map((header, column) => {
                      const value = row[column] ?? "";
                      return (
                        <td
                          key={column}
                          title={value}
                          className={`p-3 truncate max-w-[260px] ${
                            header === ERRORS_COLUMN ? "text-amber-800 bg-amber-50/40 text-xs"
                              : value === "[Not Found]" || value === "[Uncertain]" ? "text-gray-400"
                              : "text-gray-900"
                          }`}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr><td colSpan={headers.length + 1} className="p-8 text-center text-gray-400">{filterText ? `No rows match "${filter}".` : "This list has no rows."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div className="px-5 py-3 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
              <span>{shownRows.length.toLocaleString()} rows</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="px-2 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
                <span>Page {currentPage + 1} of {pageCount}</span>
                <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)} className="px-2 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
