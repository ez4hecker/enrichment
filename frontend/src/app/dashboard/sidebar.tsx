"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { History, KeyRound, LogOut, Upload } from "lucide-react";
import Icon from "../step11/svgs/svg-icon";
import ThemeToggle from "./theme-toggle";

const NAV_ITEMS = [
  { href: "/dashboard/new-job", label: "Upload CSV", icon: Upload },
  { href: "/dashboard", label: "History", icon: History },
  { href: "/dashboard/research-keys", label: "Research Keys", icon: KeyRound },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/");
    }
  };

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-background px-3 py-4">
      <Link href="/dashboard" className="flex items-center gap-2 px-2 mb-6 h-8">
        <Icon />
      </Link>
      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(({ href, label, icon: NavIcon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                active ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <NavIcon className="w-4.5 h-4.5 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <ThemeToggle />
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
      >
        <LogOut className="w-4.5 h-4.5 shrink-0" />
        <span>{loggingOut ? "Logging out..." : "Log out"}</span>
      </button>
    </aside>
  );
}
