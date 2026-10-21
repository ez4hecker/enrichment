"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Checked once per page load, not on every navigation inside the dashboard.
let sessionCheck: Promise<boolean> | undefined;

function checkSession(): Promise<boolean> {
  sessionCheck ??= fetch("/api/auth/session")
    .then(res => res.ok)
    .catch(() => false)
    .then(ok => {
      if (!ok) sessionCheck = undefined;
      return ok;
    });
  return sessionCheck;
}

// The middleware only lets a request through when a session cookie exists, and every data
// request is checked by the backend, so the page renders at once while the session is
// confirmed in the background. An expired or reset session is sent back to sign in.
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    checkSession().then(ok => {
      if (!ok && !cancelled) router.replace(`/?next=${encodeURIComponent(pathname)}`);
    });
    return () => { cancelled = true; };
  }, [pathname, router]);

  return <>{children}</>;
}
