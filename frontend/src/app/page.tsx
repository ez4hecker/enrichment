"use client";
import Illustration from "./svgs/svg-illustration";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "That email and password don't match.",
  EMAIL_ALREADY_REGISTERED: "An account with this email already exists.",
  WEAK_PASSWORD: "Use a valid email and a password of at least 12 characters.",
  INVALID_REQUEST: "Enter your email and password.",
};

// Only follow same-site paths so ?next= can't send users elsewhere.
function destination() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export default function Page() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  // Load the dashboard's code while the user types, so signing in navigates at once.
  useEffect(() => {
    router.prefetch(destination());
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    const url = isRegister ? "/api/auth/register" : "/api/auth/login";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        // The spinner stays until the dashboard replaces this page.
        router.push(destination());
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(ERROR_MESSAGES[data.code] ?? data.code ?? "Something went wrong. Please try again.");
    } catch (err) {
      setError("Failed to connect to the server.");
    }
    setSubmitting(false);
  };

  return (
    <main className="min-h-screen flex relative p-8 justify-center items-center max-md:p-6">
      <div className="block absolute inset-0 z-0 opacity-30 [background-size:10px_10px] pointer-events-none max-lg:hidden" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, var(--clr-0) 1px, var(--clr-1) 0px)" }} />
      <div className="flex relative z-10 flex-col w-full max-w-md">
        <a className="flex items-center gap-2 mb-10 mx-auto cursor-pointer" data-component="link" href="/">
          <Illustration />
          <span className="text-2xl font-bold tracking-tight text-color-001">GrowthInfi</span>
        </a>
        <section className="border border-solid border-border rounded-[24.8px] bg-clr-2 p-10 w-full max-md:p-6">
          <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
            <header className="flex flex-col gap-1 text-center">
              <h1 className="block text-color-001 text-2xl font-semibold leading-8" data-component="heading">
                {isRegister ? "Create an account" : "Sign in to continue"}
              </h1>
              <p className="block text-muted-foreground">
                {isRegister ? "Enter details to register" : "Enter your email and password"}
              </p>
            </header>
            {error && <div className="text-red-500 text-sm font-medium text-center">{error}</div>}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 w-full" role="group">
                <label className="flex items-center gap-2 text-sm font-medium leading-[1.1875rem] cursor-default" htmlFor="email">
                  Email
                </label>
                <input className="w-full border border-solid border-border block min-w-0 py-2 px-4 rounded-[10.8px] overflow-clip text-sm leading-5 bg-clr-5 cursor-text h-11 max-md:[font-size:inherit] max-md:leading-[inherit]" data-ditto-id="style-email" data-component="input" aria-invalid="false" id="email" name="email" placeholder="Enter your email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2 w-full" role="group">
                <label className="flex items-center gap-2 text-sm font-medium leading-[1.1875rem] cursor-default" htmlFor="password">
                  Password
                </label>
                <div className="h-11 min-h-11 border border-solid border-border flex relative min-w-0 rounded-[10.8px] items-center bg-clr-5 w-full" role="group">
                  <input className="w-full block min-w-0 py-2 pr-1.5 pl-4 flex-1 overflow-clip text-sm leading-5 cursor-text h-11 max-md:[font-size:inherit] max-md:leading-[inherit]" data-ditto-id="style-password" data-component="input" aria-invalid="false" id="password" name="password" placeholder="Enter your password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} minLength={12} required />
                  <div className="flex -mr-[0.3rem] py-2 pr-2 justify-center items-center order-[9999] gap-2 text-muted-foreground text-sm font-medium leading-5 cursor-text h-auto" role="group">
                    <button className="w-9 h-9 border border-solid border-clr-1 flex rounded-[10.8px] justify-center items-center shrink-0 cursor-pointer hover:bg-clr-4 hover:text-color-001" data-component="button" aria-label={showPassword ? "Hide password" : "Show password"} type="button" onClick={() => setShowPassword(s => !s)}>
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
              <button className="border border-solid border-clr-1 flex px-4 rounded-[10.8px] justify-center items-center shrink-0 gap-1.5 text-background text-sm font-medium leading-5 text-center whitespace-nowrap text-nowrap bg-color-001 cursor-pointer h-11 w-full hover:bg-clr-7 disabled:opacity-70 disabled:cursor-wait" data-component="button" type="submit" disabled={submitting} aria-busy={submitting}>
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                    {isRegister ? "Creating account..." : "Signing in..."}
                  </>
                ) : isRegister ? "Create Account" : "Log In"}
              </button>
            </div>
            <p className="flex justify-center items-center gap-1 text-muted-foreground text-sm leading-5">
              {isRegister ? "Already have an account?" : "Don't have an account?"}
              <a className="block text-color-001 font-semibold cursor-pointer hover:underline" onClick={() => setIsRegister(!isRegister)}>
                {isRegister ? "Log In" : "Sign up"}
              </a>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
