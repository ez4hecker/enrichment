"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TableSkeleton } from "../components/skeleton";

export default function JobHistoryPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadJobs = async () => {
    try {
      const res = await fetch("/api/enrichment-jobs");
      if (!res.ok) throw new Error("Failed to load jobs");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    const interval = setInterval(() => {
      loadJobs();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col flex-1 bg-surface-2 w-full">
      {/* Welcome Banner Gradient */}
      <div
        data-dashboard-banner
        className="block shrink-0 h-[16.75rem] w-full"
        style={{
          backgroundColor: "#064e3b",
          backgroundImage: "radial-gradient(91.5% 105.84% at 51.49% 89.74%, rgba(59,205,158,0.4) 0%, rgba(16,185,129,0.3) 44.25%, rgba(4,120,87,0.2) 58.99%, rgba(6,78,59,0.6) 100%)"
        }}
      >
        <div className="flex pt-14 pb-8 px-12 flex-col shrink-0 gap-6 w-full">
          <h1 className="block text-[#fff] text-[1.75rem] font-bold">
            Welcome back, Arjun
          </h1>
        </div>
      </div>

      <div className="flex-1 w-full max-w-6xl px-10 py-10 mx-auto">
        <header className="flex pb-8 justify-between items-center gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-gray-900">History</h1>
            <p className="text-sm text-gray-500">Your enrichment jobs. Completed results can be downloaded.</p>
          </div>
          <Link href="/dashboard/new-job" className="h-10 inline-flex items-center justify-center px-5 rounded-lg text-sm text-white font-semibold bg-black hover:bg-gray-800 transition-colors">
            Upload CSV
          </Link>
        </header>

        {error && <div className="text-red-500 mb-4">{error}</div>}

        {/* Content */}
        {loading ? (
          <TableSkeleton rows={5} />
        ) : jobs.length === 0 ? (
          <div className="block pb-6 mt-16">
            <div className="flex flex-col justify-center items-center gap-1 text-center">
              <img className="h-44.5 block max-w-full overflow-clip align-middle w-96 max-md:h-30.5 max-md:w-[16.4375rem]" alt="Empty" src="/assets/cloned/images/098b8938faaf.png" />
              <h3 className="block mb-2 text-xl font-semibold leading-7">
                No jobs yet
              </h3>
              <p className="w-full block mb-6 text-gray-500 max-w-lg text-sm">
                Upload a CSV to start your first enrichment job. It will show up here once created.
              </p>
              <Link href="/dashboard/new-job" className="h-10 inline-flex items-center justify-center px-5 rounded-lg text-sm text-white font-semibold bg-black hover:bg-gray-800 transition-colors">
                Upload CSV
              </Link>
            </div>
          </div>
        ) : (
          <div className="border border-border bg-background rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-muted text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-6 py-4 border-b border-border">File</th>
                  <th className="px-6 py-4 border-b border-border">Type</th>
                  <th className="px-6 py-4 border-b border-border">Status</th>
                  <th className="px-6 py-4 border-b border-border">Progress</th>
                  <th className="px-6 py-4 text-right border-b border-border">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground max-w-md truncate" title={`${job.fileName} (${job.id})`}>{job.fileName || job.id}</td>
                    <td className="px-6 py-4 text-gray-500">{job.kind === "Preview" ? "Saved answers" : "Full job"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        job.status === "Completed" ? "bg-green-100 text-green-800" :
                        job.status === "Queued" ? "bg-gray-100 text-gray-800" :
                        job.status === "Failed" ? "bg-red-100 text-red-800" :
                        "bg-blue-100 text-blue-800"
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {job.progress ? `${job.progress.completed} / ${job.progress.total}` : "N/A"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {job.status === "Completed" && (
                        <div className="inline-flex items-center gap-4">
                          <Link href={`/dashboard/jobs/${encodeURIComponent(job.id)}`} className="text-primary hover:underline font-medium">
                            View
                          </Link>
                          <a href={`/api/enrichment-jobs/${encodeURIComponent(job.id)}/enriched-list`} className="text-primary hover:underline font-medium" download>
                            Download
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
