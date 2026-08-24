import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  Eye,
  LifeBuoy,
  Link2,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Settings,
  SlidersHorizontal,
  Sun,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { listConversations } from "@/lib/messaging.functions";
import { listNotifications } from "@/lib/social.functions";

const publicLinks = [
  { to: "/for-creators", label: "For Creators" },
  { to: "/for-brands", label: "For Brands" },
] as const;

const creatorLinks = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/matches", label: "Matches" },
  { to: "/feed", label: "Feed" },
  { to: "/deals", label: "Collaborations" },
] as const;

const adminLinks = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/admin", label: "Admin" },
  { to: "/deals", label: "Collaborations" },
  { to: "/discover", label: "Discover" },
] as const;

const brandLinks = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/discover", label: "Discover" },
  { to: "/campaigns", label: "Campaigns" },
  { to: "/deals", label: "Collaborations" },
] as const;

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-gradient-brand px-1 text-[10px] font-bold text-primary-foreground">
      {count > 9 ? "9+" : count}
    </span>
  );
}

function NotificationBell() {
  const fetchNotifications = useServerFn(listNotifications);
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications({ data: undefined }),
    refetchInterval: 60_000,
  });
  const unread = (data ?? []).filter((n: { read_at: string | null }) => !n.read_at).length;

  return (
    <Link
      to="/notifications"
      aria-label="Notifications"
      className="relative inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
    >
      <Bell className="size-4" />
      <Badge count={unread} />
    </Link>
  );
}

function MessagesIcon() {
  const fetchConversations = useServerFn(listConversations);
  const { data } = useQuery({
    queryKey: ["conversations", "nav"],
    queryFn: () => fetchConversations({ data: undefined }),
    refetchInterval: 60_000,
  });
  const unread = (data ?? []).reduce((sum: number, c: { unread: number }) => sum + (c.unread ?? 0), 0);

  return (
    <Link
      to="/messages"
      search={{ c: undefined }}
      aria-label="Messages"
      className="relative inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
    >
      <MessageSquare className="size-4" />
      <Badge count={unread} />
    </Link>
  );
}

function AccountMenu() {
  const { displayName, role, creator, brand, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const initials = (displayName || "You").slice(0, 1).toUpperCase();
  const publicHref =
    role === "brand" && brand ? `/brands/${brand.id}` : creator ? `/creators/${creator.id}` : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 text-sm hover:border-primary"
        >
          <span className="grid size-7 place-items-center rounded-full bg-gradient-brand text-xs font-bold text-primary-foreground">
            {initials}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">{displayName || "Account"}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate">{displayName || "Account"}</span>
          <span className="text-xs font-normal capitalize text-muted-foreground">{role ?? "member"}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: "/profile", search: { tab: "edit" as const } })}>
          <UserRound className="mr-2 size-4" /> Edit profile
        </DropdownMenuItem>
        {publicHref ? (
          <DropdownMenuItem onSelect={() => navigate({ to: publicHref })}>
            <Eye className="mr-2 size-4" /> View public profile
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => navigate({ to: "/profile", search: { tab: "settings" as const } })}>
          <Settings className="mr-2 size-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: "/notification-preferences" })}>
          <SlidersHorizontal className="mr-2 size-4" /> Notification preferences
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: "/connections" })}>
          <Link2 className="mr-2 size-4" /> Connections
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: "/support" })}>
          <LifeBuoy className="mr-2 size-4" /> Support
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleTheme(); }}>
          {theme === "dark" ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            navigate({ to: "/", replace: true });
          }}
        >
          <LogOut className="mr-2 size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const links = user ? (role === "admin" ? adminLinks : role === "brand" ? brandLinks : creatorLinks) : publicLinks;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-brand font-display text-sm font-bold text-primary-foreground">
            B
          </span>
          <span className="font-display text-lg font-bold tracking-tight">Bingo</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeOptions={{ exact: false }}
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground [&.active]:bg-muted [&.active]:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <MessagesIcon />
              <NotificationBell />
              <AccountMenu />
              <button
                type="button"
                aria-label="Sign out"
                title="Sign out"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/", replace: true });
                }}
                className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
              >
                <LogOut className="size-4" />
              </button>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild size="sm" className="bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90">
                <Link to="/signup">Join Bingo</Link>
              </Button>
            </>
          )}
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-full border border-border md:hidden"
          >
            <Menu className="size-4" />
          </button>
        </div>
      </div>

      {open ? (
        <nav className="flex flex-col border-t border-border px-4 py-2 md:hidden">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
