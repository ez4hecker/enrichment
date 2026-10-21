import Sidebar from "./sidebar";
import AuthGuard from "./auth-guard";
import "./dashboard-theme.css";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-dashboard scopes dark mode (dashboard-theme.css) to the dashboard only.
    <div data-dashboard className="h-screen w-full flex bg-background text-foreground">
      <Sidebar />
      <main id="dashboard-scroll" className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
        <div className="flex flex-col min-h-full w-full">
          <AuthGuard>{children}</AuthGuard>
        </div>
      </main>
    </div>
  );
}
