"use client";
import { useEffect, useState } from "react";
import { ListSkeleton } from "../../components/skeleton";
import { KeyRound, Trash2 } from "lucide-react";

type ContributedKey = {
  id: string;
  label: string;
  lastFour: string;
  status: "Active" | "Disabled";
  disabledReason?: string;
  addedAt: string;
  searchesToday: number;
  dailySearchLimit: number;
};

type PoolStatus = { activeKeys: number; searchesLeftToday: number };

async function errorMessage(res: Response) {
  try {
    const data = await res.json();
    if (data.code === "RESEARCH_KEYS_UNAVAILABLE") return "The server has no RESEARCH_KEY_ENCRYPTION_SECRET configured, so keys can't be stored yet.";
    return data.message || data.code || res.statusText;
  } catch {
    return res.statusText;
  }
}

export default function ResearchKeysPage() {
  const [keys, setKeys] = useState<ContributedKey[]>([]);
  const [pool, setPool] = useState<PoolStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    try {
      const res = await fetch("/api/research-keys");
      if (!res.ok) throw new Error(await errorMessage(res));
      const data = await res.json();
      setKeys(data.keys ?? []);
      setPool(data.pool ?? null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setAdding(true);
    try {
      const res = await fetch("/api/research-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), label: label.trim() || undefined, acknowledgedRisk: acknowledged }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      setApiKey("");
      setLabel("");
      setAcknowledged(false);
      setNotice("Key checked and added to the pool.");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (key: ContributedKey) => {
    if (!window.confirm(`Remove "${key.label}" from the research pool?`)) return;
    setError("");
    setNotice("");
    const res = await fetch(`/api/research-keys/${encodeURIComponent(key.id)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      setError(await errorMessage(res));
      return;
    }
    setNotice("Key removed. It will not be used again.");
    await load();
  };

  return (
    <div className="flex flex-col flex-1 bg-white p-8 w-full">
      <div className="max-w-3xl w-full mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Research Keys</h1>
        <p className="text-gray-500 text-sm mb-6">
          AI Research uses free Google searches from Gemini API keys in this pool first. Paid search (Serper) only runs when the pool is out of free searches.
        </p>

        {pool && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase">Keys in the pool</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{pool.activeKeys}</div>
            </div>
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase">Free searches left today</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{pool.searchesLeftToday.toLocaleString()}</div>
              <div className="text-xs text-gray-400 mt-0.5">Resets at midnight Pacific time</div>
            </div>
          </div>
        )}

        {error && <div className="text-red-600 bg-red-50 p-3 rounded-lg text-sm mb-4 border border-red-100">{error}</div>}
        {notice && <div className="text-emerald-700 bg-emerald-50 p-3 rounded-lg text-sm mb-4 border border-emerald-100">{notice}</div>}

        <form onSubmit={handleAdd} className="border border-gray-200 rounded-2xl p-6 mb-8 flex flex-col gap-4 shadow-sm">
          <h2 className="font-bold text-gray-900 flex items-center gap-2"><KeyRound className="w-5 h-5 text-gray-400" /> Add a key</h2>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-700" htmlFor="api-key">Gemini API key</label>
            <input
              id="api-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="AIza..."
              className="w-full bg-white border border-gray-200 rounded-xl py-2.5 px-4 outline-none focus:border-black focus:ring-1 focus:ring-black font-mono text-sm text-gray-900"
            />
            <p className="text-xs text-gray-500">
              Create one at aistudio.google.com → Get API key, in a project <span className="font-semibold">without billing</span>. Keys from billed projects are refused.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-700" htmlFor="key-label">Label (optional)</label>
            <input
              id="key-label"
              value={label}
              onChange={e => setLabel(e.target.value)}
              maxLength={60}
              placeholder="e.g. Ada's key"
              className="w-full bg-white border border-gray-200 rounded-xl py-2.5 px-4 outline-none focus:border-black focus:ring-1 focus:ring-black text-sm text-gray-900"
            />
          </div>
          <label className="flex gap-3 items-start text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} className="mt-1" />
            <span>
              I'm adding this key from my own Google account voluntarily. I understand that pooling keys for one company's workload may go against Google's terms, that any enforcement would fall on my account, and that Google may use free-tier requests to improve its products.
            </span>
          </label>
          <button
            type="submit"
            disabled={adding || !apiKey.trim() || !acknowledged}
            className="self-start bg-black hover:bg-gray-900 text-white rounded-xl py-2.5 px-6 font-semibold transition-colors disabled:opacity-50"
          >
            {adding ? "Checking key with Google..." : "Check and add key"}
          </button>
        </form>

        <h2 className="font-bold text-gray-900 mb-3">Your keys</h2>
        {loading ? (
          <ListSkeleton rows={2} />
        ) : keys.length === 0 ? (
          <div className="text-sm text-gray-500 italic p-6 bg-gray-50 rounded-xl text-center border border-dashed border-gray-200">You haven't added any keys.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {keys.map(key => (
              <div key={key.id} className="border border-gray-200 rounded-xl p-4 flex justify-between items-center">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-gray-900">{key.label}</span>
                  <span className="text-xs text-gray-500 font-mono">AIza••••{key.lastFour}</span>
                  <span className="text-xs text-gray-500">
                    {key.status === "Active"
                      ? `${key.searchesToday} of ${key.dailySearchLimit} free searches used today`
                      : <span className="text-red-600">Disabled: {key.disabledReason ?? "rejected by Google"}</span>}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(key)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
