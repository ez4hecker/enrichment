"use client";
import { useEffect, useState } from "react";
import { ListSkeleton } from "../../components/skeleton";

export default function CustomOperationsPage() {
  const [operations, setOperations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOps = async () => {
      try {
        const res = await fetch("/api/custom-operations");
        if (res.ok) {
          const data = await res.json();
          setOperations(data.operations || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadOps();
  }, []);

  return (
    <div className="flex flex-col flex-1 bg-surface-2 p-8 h-full w-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-foreground">Custom Operations</h2>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm hover:bg-primary/90">
          Create Operation
        </button>
      </div>

      <div className="bg-background border border-border rounded-lg overflow-hidden flex-1 shadow-sm">
        {loading ? (
          <div className="p-4"><ListSkeleton rows={4} /></div>
        ) : operations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">⚙️</span>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No Custom Operations</h3>
            <p className="text-muted-foreground max-w-md">
              Create AI-powered operations to extract specific data from URLs or text during your enrichment jobs.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted text-muted-foreground text-xs uppercase font-medium">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Prompt</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {operations.map((op) => (
                <tr key={op.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 font-medium">{op.name}</td>
                  <td className="px-6 py-4 truncate max-w-xs">{op.prompt}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-primary hover:underline font-medium">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
