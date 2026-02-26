import { Routes, Route, Link, useLocation } from "react-router-dom";
import { SessionsPage } from "./routes/index";
import { SessionDetailPage } from "./routes/sessions.$id";
import { StatsPage } from "./routes/stats";
import { cn } from "@/lib/utils";

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive =
    to === "/"
      ? location.pathname === "/"
      : location.pathname === to || location.pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      className={cn(
        "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

export function App() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link to="/" className="text-lg font-semibold text-foreground">
                Claude Deck
              </Link>
              <nav className="flex items-center gap-1">
                <NavLink to="/">Dashboard</NavLink>
                <NavLink to="/sessions">Sessions</NavLink>
              </nav>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Routes>
          <Route path="/" element={<StatsPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/sessions/:id" element={<SessionDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}
