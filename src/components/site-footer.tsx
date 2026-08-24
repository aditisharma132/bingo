import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-display">Bingo — Engineered for Creators. Built for Brands.</p>
        <nav className="flex flex-wrap items-center gap-4">
          <Link to="/about" className="hover:text-foreground">
            About us
          </Link>
          <Link to="/faq" className="hover:text-foreground">
            FAQ
          </Link>
          <Link to="/help" className="hover:text-foreground">
            Support
          </Link>

        </nav>
      </div>
    </footer>
  );
}
