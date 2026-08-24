import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Chip, PageHeader, Panel } from "@/components/bingo-ui";
import { ProfileMediaEditor } from "@/components/profile-media";
import { PublicProfilePreview } from "@/components/public-profile-preview";
import { TagEditor } from "@/components/tag-editor";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import {
  generateBrandDNA,
  generateCreatorDNA,
  saveBrandOnboarding,
  saveCreatorOnboarding,
  setAiCategory,
} from "@/lib/onboarding.functions";
import type { BrandDNA, CreatorDNA } from "@/lib/taxonomy";
import { CATEGORIES, CREATOR_TYPES, INDUSTRIES, LANGUAGES } from "@/lib/taxonomy";

type ProfileTab = "edit" | "media" | "tags" | "preview" | "settings";
const PROFILE_TABS: ProfileTab[] = ["edit", "media", "tags", "preview", "settings"];

export const Route = createFileRoute("/_authenticated/profile")({
  validateSearch: (search: Record<string, unknown>): { tab?: ProfileTab } => {
    const raw = String(search["tab"] ?? "");
    return PROFILE_TABS.includes(raw as ProfileTab) ? { tab: raw as ProfileTab } : {};
  },
  head: () => ({
    meta: [
      { title: "Your profile | Bingo" },
      {
        name: "description",
        content: "Edit your Bingo profile, categories, rates and AI-generated DNA.",
      },
      { property: "og:title", content: "Your profile | Bingo" },
      {
        property: "og:description",
        content: "Edit your Bingo profile, categories, rates and AI-generated DNA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function DnaPanel({
  title,
  entries,
  summary,
  onRegenerate,
  busy,
}: {
  title: string;
  summary: string | null;
  entries: { label: string; values: string[] }[];
  onRegenerate: () => void;
  busy: boolean;
}) {
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button variant="outline" size="sm" onClick={onRegenerate} disabled={busy}>
          {busy ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1 size-4" />
          )}
          Regenerate
        </Button>
      </div>
      {summary ? (
        <p className="mt-3 text-sm text-muted-foreground">{summary}</p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No DNA yet — regenerate to build your match profile.
        </p>
      )}
      <div className="mt-5 space-y-4">
        {entries
          .filter((e) => e.values.length > 0)
          .map((e) => (
            <div key={e.label}>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{e.label}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {e.values.map((v) => (
                  <Chip key={v} label={v} />
                ))}
              </div>
            </div>
          ))}
      </div>
    </Panel>
  );
}

function ProfilePage() {
  const { loading, role, needsOnboarding, refresh, creator, brand } = useAuth();
  const navigate = useNavigate();
  const { tab = "edit" } = Route.useSearch();
  const setTab = (next: ProfileTab) =>
    navigate({ to: "/profile", search: { tab: next }, replace: true });

  useEffect(() => {
    if (!loading && needsOnboarding) navigate({ to: "/onboarding", replace: true });
  }, [loading, needsOnboarding, navigate]);

  if (loading || needsOnboarding) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const isBrand = role === "brand";
  const entityId = isBrand ? brand?.id : creator?.id;
  const name = isBrand ? (brand?.brand_name ?? "") : (creator?.display_name ?? "");
  const avatar = ((isBrand ? (brand as any)?.logo_url : (creator as any)?.avatar_url) ?? null) as
    string | null;
  const cover = ((isBrand ? (brand as any)?.cover_url : (creator as any)?.cover_url) ?? null) as
    string | null;

  const tabs = [
    { id: "edit" as const, label: "Edit profile" },
    { id: "media" as const, label: "Media & cover" },
    { id: "tags" as const, label: "Tags" },
    { id: "preview" as const, label: "Public preview" },
    { id: "settings" as const, label: "Settings" },
  ];

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-8 inline-flex flex-wrap gap-1 rounded-full border border-border p-1 text-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-full px-4 py-1.5",
                tab === t.id
                  ? "bg-gradient-brand text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "edit" ? (
          isBrand ? (
            <BrandProfile onSaved={refresh} />
          ) : (
            <CreatorProfile onSaved={refresh} />
          )
        ) : null}

        {tab === "media" ? (
          <div className="space-y-4">
            <h1 className="font-display text-2xl font-bold">Media & cover</h1>
            <p className="text-sm text-muted-foreground">
              Upload a cover image and display picture — these show on your public page and
              everywhere you appear.
            </p>
            <ProfileMediaEditor name={name} avatar={avatar} cover={cover} editable />
          </div>
        ) : null}

        {tab === "tags" ? (
          <div className="space-y-4">
            <h1 className="font-display text-2xl font-bold">Tags</h1>
            <p className="text-sm text-muted-foreground">
              Custom tags feed matchmaking alongside your standard categories. Create your own —
              Bingo maps them to related concepts.
            </p>
            {entityId ? (
              <Panel>
                <TagEditor
                  entityType={isBrand ? "brand" : "creator"}
                  entityId={entityId}
                  editable
                />
              </Panel>
            ) : (
              <p className="text-sm text-muted-foreground">Finish onboarding to add tags.</p>
            )}
          </div>
        ) : null}

        {tab === "preview" && entityId ? (
          <PublicProfilePreview role={isBrand ? "brand" : "creator"} id={entityId} />
        ) : null}

        {tab === "settings" ? <SettingsTab /> : null}
      </main>
    </div>
  );
}

function CreatorProfile({ onSaved }: { onSaved: () => Promise<void> }) {
  const save = useServerFn(saveCreatorOnboarding);
  const regen = useServerFn(generateCreatorDNA);
  const chooseAiCategoryFn = useServerFn(setAiCategory);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiCatBusy, setAiCatBusy] = useState(false);
  const [dna, setDna] = useState<CreatorDNA | null>(null);
  const [aiCategory, setAiCategoryValue] = useState<string | null>(null);
  const [aiCategoryLocked, setAiCategoryLocked] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    headline: "",
    bio: "",
    location: "",
    instagram: "",
    starting_price_inr: "",
    open_to_paid: true,
    open_to_barter: false,
    languages: [] as string[],
    creator_types: [] as string[],
    categories: [] as string[],
    portfolio_links: "",
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;
      const { data: profile } = await supabase
        .from("creator_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      const { data: social } = await supabase
        .from("social_accounts")
        .select("handle")
        .eq("user_id", userId)
        .eq("platform", "instagram")
        .maybeSingle();
      if (!active || !profile) return;
      const ownCategories = ((profile.categories ?? []) as string[])
        .filter((c) => c !== (profile as any).ai_category)
        .slice(0, 2);
      setForm({
        display_name: profile.display_name ?? "",
        headline: profile.headline ?? "",
        bio: profile.bio ?? "",
        location: profile.location ?? "",
        instagram: social?.handle ?? "",
        starting_price_inr: profile.starting_price_inr ? String(profile.starting_price_inr) : "",
        open_to_paid: profile.open_to_paid ?? true,
        open_to_barter: profile.open_to_barter ?? false,
        languages: profile.languages ?? [],
        creator_types: profile.creator_types ?? [],
        categories: ownCategories,
        portfolio_links: ((profile.portfolio_links ?? []) as string[]).join("\n"),
      });
      setAiCategoryValue((profile as any).ai_category ?? null);
      setAiCategoryLocked((profile as any).ai_category_locked ?? false);
      const { data: dnaRow } = await supabase
        .from("creator_dna")
        .select("data")
        .eq("creator_id", profile.id)
        .maybeSingle();
      if (dnaRow?.data) setDna(dnaRow.data as unknown as CreatorDNA);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const onSubmit = async () => {
    if (!form.display_name.trim()) {
      toast.error("Add a display name.");
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          display_name: form.display_name.trim(),
          headline: form.headline,
          bio: form.bio,
          location: form.location,
          languages: form.languages,
          creator_types: form.creator_types,
          categories: form.categories,
          instagram: form.instagram,
          starting_price_inr: form.starting_price_inr ? Number(form.starting_price_inr) : null,
          open_to_paid: form.open_to_paid,
          open_to_barter: form.open_to_barter,
          preferred_categories: form.categories,
          portfolio_links: form.portfolio_links
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
        },
      });
      await onSaved();
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const onRegenerate = async () => {
    setBusy(true);
    try {
      const next = await regen({ data: undefined });
      setDna(next as CreatorDNA);
      // A fresh regenerate may have updated the AI-assigned category unless it's locked.
      if (!aiCategoryLocked) {
        const best = (next as CreatorDNA).best_fit_categories?.find(
          (c) => c && !form.categories.includes(c),
        );
        setAiCategoryValue(best ?? null);
      }
      toast.success("Creator DNA refreshed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not regenerate DNA");
    } finally {
      setBusy(false);
    }
  };

  const chooseAiCategory = async (category: string | null) => {
    setAiCatBusy(true);
    try {
      await chooseAiCategoryFn({ data: { category } });
      setAiCategoryValue(category);
      setAiCategoryLocked(category !== null);
      toast.success(
        category
          ? `Locked "${category}" as your third category`
          : "Cleared — the next DNA regenerate will pick again",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally {
      setAiCatBusy(false);
    }
  };

  if (!ready) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Creator profile"
        title={form.display_name || "Your profile"}
        subtitle="Everything here feeds your match score. Keep it sharp and specific."
        action={
          <Button
            onClick={onSubmit}
            disabled={saving}
            className="bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90"
          >
            {saving ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Save className="mr-1 size-4" />
            )}
            Save changes
          </Button>
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel>
            <h2 className="text-lg font-semibold">Basics</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="display_name">Display name</Label>
                <Input
                  id="display_name"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="headline">Headline</Label>
                <Input
                  id="headline"
                  value={form.headline}
                  onChange={(e) => setForm({ ...form, headline: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="bio">About your content</Label>
                <Textarea
                  id="bio"
                  rows={4}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="instagram">Instagram handle</Label>
                <Input
                  id="instagram"
                  value={form.instagram}
                  onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="price">Starting price (INR)</Label>
                <Input
                  id="price"
                  inputMode="numeric"
                  value={form.starting_price_inr}
                  onChange={(e) =>
                    setForm({ ...form, starting_price_inr: e.target.value.replace(/\D/g, "") })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="portfolio">Portfolio links (one per line)</Label>
                <Textarea
                  id="portfolio"
                  rows={3}
                  value={form.portfolio_links}
                  onChange={(e) => setForm({ ...form, portfolio_links: e.target.value })}
                />
              </div>
            </div>
          </Panel>

          <Panel>
            <h2 className="text-lg font-semibold">Craft & categories</h2>
            <p className="mt-1 text-sm text-muted-foreground">What you make and where you play.</p>
            <p className="mt-5 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Creator types
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CREATOR_TYPES.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  selected={form.creator_types.includes(t)}
                  onClick={() => setForm({ ...form, creator_types: toggle(form.creator_types, t) })}
                />
              ))}
            </div>
            <p className="mt-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Categories (pick up to 2)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  selected={form.categories.includes(c)}
                  onClick={() =>
                    setForm({
                      ...form,
                      categories: form.categories.includes(c)
                        ? form.categories.filter((x) => x !== c)
                        : form.categories.length < 2
                          ? [...form.categories, c]
                          : form.categories,
                    })
                  }
                />
              ))}
            </div>

            <p className="mt-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Third category (AI-assigned)
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Bingo adds a third category from your DNA. Lock in your own choice, or clear it to let
              AI pick again.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {aiCategory ? (
                <Chip
                  label={`${aiCategory}${aiCategoryLocked ? " · locked" : ""}`}
                  selected
                  onClick={aiCatBusy ? undefined : () => chooseAiCategory(null)}
                />
              ) : (
                <span className="text-sm text-muted-foreground">
                  Not set yet — regenerate DNA, or pick one below.
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.filter((c) => !form.categories.includes(c) && c !== aiCategory).map(
                (c) => (
                  <Chip
                    key={c}
                    label={c}
                    onClick={aiCatBusy ? undefined : () => chooseAiCategory(c)}
                  />
                ),
              )}
            </div>

            <p className="mt-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Languages
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {LANGUAGES.map((l) => (
                <Chip
                  key={l}
                  label={l}
                  selected={form.languages.includes(l)}
                  onClick={() => setForm({ ...form, languages: toggle(form.languages, l) })}
                />
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-lg font-semibold">Deal preferences</h2>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="paid">Open to paid campaigns</Label>
                <Switch
                  id="paid"
                  checked={form.open_to_paid}
                  onCheckedChange={(v) => setForm({ ...form, open_to_paid: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="barter">Open to barter / gifting</Label>
                <Switch
                  id="barter"
                  checked={form.open_to_barter}
                  onCheckedChange={(v) => setForm({ ...form, open_to_barter: v })}
                />
              </div>
            </div>
          </Panel>
        </div>

        <DnaPanel
          title="Creator DNA"
          summary={dna?.summary ?? null}
          busy={busy}
          onRegenerate={onRegenerate}
          entries={[
            { label: "Content style", values: dna?.content_style ?? [] },
            { label: "Audience signals", values: dna?.audience_signals ?? [] },
            { label: "Best-fit categories", values: dna?.best_fit_categories ?? [] },
            { label: "Strengths", values: dna?.strengths ?? [] },
            { label: "Gaps", values: dna?.gaps ?? [] },
          ]}
        />
      </div>
    </>
  );
}

function BrandProfile({ onSaved }: { onSaved: () => Promise<void> }) {
  const save = useServerFn(saveBrandOnboarding);
  const regen = useServerFn(generateBrandDNA);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dna, setDna] = useState<BrandDNA | null>(null);
  const [form, setForm] = useState({
    brand_name: "",
    website: "",
    instagram: "",
    industry: "",
    about: "",
    contact_person: "",
    contact_email: "",
    contact_phone: "",
    campaign_categories: [] as string[],
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;
      const { data: profile } = await supabase
        .from("brand_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (!active || !profile) return;
      const { data: contacts } = await supabase
        .from("brand_contacts")
        .select("contact_person, contact_email, contact_phone")
        .eq("brand_id", profile.id)
        .maybeSingle();
      setForm({
        brand_name: profile.brand_name ?? "",
        website: profile.website ?? "",
        instagram: profile.instagram ?? "",
        industry: profile.industry ?? "",
        about: profile.about ?? "",
        contact_person: contacts?.contact_person ?? "",
        contact_email: contacts?.contact_email ?? "",
        contact_phone: contacts?.contact_phone ?? "",
        campaign_categories: profile.campaign_categories ?? [],
      });
      const { data: dnaRow } = await supabase
        .from("brand_dna")
        .select("data")
        .eq("brand_id", profile.id)
        .maybeSingle();
      if (dnaRow?.data) setDna(dnaRow.data as unknown as BrandDNA);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const onSubmit = async () => {
    if (!form.brand_name.trim()) {
      toast.error("Add a brand name.");
      return;
    }
    setSaving(true);
    try {
      await save({ data: { ...form, brand_name: form.brand_name.trim() } });
      await onSaved();
      toast.success("Brand profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const onRegenerate = async () => {
    setBusy(true);
    try {
      const next = await regen({ data: undefined });
      setDna(next as BrandDNA);
      toast.success("Brand DNA refreshed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not regenerate DNA");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Brand profile"
        title={form.brand_name || "Your brand"}
        subtitle="Your Brand DNA drives which creators get shortlisted for every campaign."
        action={
          <Button
            onClick={onSubmit}
            disabled={saving}
            className="bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90"
          >
            {saving ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Save className="mr-1 size-4" />
            )}
            Save changes
          </Button>
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel>
            <h2 className="text-lg font-semibold">Brand basics</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="brand_name">Brand name</Label>
                <Input
                  id="brand_name"
                  value={form.brand_name}
                  onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="brand_ig">Instagram</Label>
                <Input
                  id="brand_ig"
                  value={form.instagram}
                  onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  list="industries"
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                />
                <datalist id="industries">
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i} />
                  ))}
                </datalist>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="about">About the brand</Label>
                <Textarea
                  id="about"
                  rows={4}
                  value={form.about}
                  onChange={(e) => setForm({ ...form, about: e.target.value })}
                />
              </div>
            </div>
          </Panel>

          <Panel>
            <h2 className="text-lg font-semibold">Campaign categories</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  selected={form.campaign_categories.includes(c)}
                  onClick={() =>
                    setForm({ ...form, campaign_categories: toggle(form.campaign_categories, c) })
                  }
                />
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-lg font-semibold">Point of contact</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="contact_person">Name</Label>
                <Input
                  id="contact_person"
                  value={form.contact_person}
                  onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="contact_email">Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="contact_phone">Phone</Label>
                <Input
                  id="contact_phone"
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                />
              </div>
            </div>
          </Panel>
        </div>

        <DnaPanel
          title="Brand DNA"
          summary={dna?.summary ?? null}
          busy={busy}
          onRegenerate={onRegenerate}
          entries={[
            { label: "Tone of voice", values: dna?.tone_of_voice ?? [] },
            { label: "Target audience", values: dna?.target_audience ?? [] },
            { label: "Ideal creator profile", values: dna?.ideal_creator_profile ?? [] },
            { label: "Content themes", values: dna?.content_themes ?? [] },
            { label: "Gaps", values: dna?.gaps ?? [] },
          ]}
        />
      </div>
    </>
  );
}

function SettingsTab() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sending, setSending] = useState(false);

  async function sendReset() {
    if (!user?.email) return;
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent to your email.");
  }

  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="text-lg font-semibold">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">Signed in as {user?.email ?? "—"}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" disabled={sending} onClick={sendReset}>
            {sending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Send password reset email
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Panel>

      <Panel>
        <h2 className="text-lg font-semibold">Appearance</h2>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Currently using {theme === "dark" ? "dark" : "light"} mode.
          </p>
          <Button variant="outline" onClick={toggleTheme}>
            Switch to {theme === "dark" ? "light" : "dark"} mode
          </Button>
        </div>
      </Panel>

      <Panel>
        <h2 className="text-lg font-semibold">More settings</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Link
            to="/connections"
            className="rounded-xl border border-border p-3 text-sm hover:border-primary"
          >
            Social connections
          </Link>
          <Link
            to="/notification-preferences"
            className="rounded-xl border border-border p-3 text-sm hover:border-primary"
          >
            Notification preferences
          </Link>
          <Link
            to="/support"
            className="rounded-xl border border-border p-3 text-sm hover:border-primary"
          >
            Support
          </Link>
        </div>
      </Panel>
    </div>
  );
}
