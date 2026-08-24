import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Chip, StepHeader } from "@/components/bingo-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import type { CreatorKind } from "@/lib/onboarding.functions";
import {
  generateBrandDNA,
  generateCreatorDNA,
  mapCustomCategories,
  saveBrandOnboarding,
  saveCreatorOnboarding,
} from "@/lib/onboarding.functions";
import type { BrandDNA, CreatorDNA } from "@/lib/taxonomy";
import { CATEGORIES, CREATOR_TYPES, INDUSTRIES, LANGUAGES, LOCATIONS } from "@/lib/taxonomy";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InstagramPanel } from "@/components/instagram-panel";

/* ---------- validation helpers ---------- */
const NAME_RE = /^[A-Za-z][A-Za-z .'-]*$/;
const PHONE_RE = /^\+\d{1,4}[\s-]?\d{10}$/;

function validateName(value: string) {
  if (!value.trim()) return "Contact person is required.";
  if (!NAME_RE.test(value.trim())) return "Use letters only — no numbers or symbols.";
  return null;
}

function validatePhone(value: string) {
  if (!value.trim()) return "Contact phone is required.";
  if (!PHONE_RE.test(value.trim().replace(/\s+/g, " ")))
    return "Use a country code + 10 digits, e.g. +91 9876543210.";
  return null;
}

function validateEmail(value: string) {
  if (!value.trim()) return "Contact email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())) return "Enter a valid email address.";
  return null;
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function validatePricePoint(value: string) {
  if (!value.trim()) return null;
  if (!/^[\d\s,.\-–]+$/.test(value.trim())) return "Price point takes numbers only, e.g. 499 - 1999.";
  if (!/\d/.test(value)) return "Enter at least one number.";
  return null;
}

function validateMarkets(value: string) {
  if (!value.trim()) return null;
  if (!/^[\p{L}][\p{L}\s,.'\-/&]*$/u.test(value.trim())) return "Use place names only — no numbers or symbols.";
  return null;
}

/* Free-text categories: AI maps them onto existing taxonomy or proposes a new one. */
function CustomCategories({
  selected,
  onAdd,
  important,
  notice,
}: {
  selected: string[];
  onAdd: (categories: string[]) => void;
  important?: boolean;
  notice?: string;
}) {
  const mapFn = useServerFn(mapCustomCategories);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Array<{ input: string; category: string; is_new: boolean; note: string }>>([]);

  async function run() {
    const phrases = raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (!phrases.length) return;
    setBusy(true);
    try {
      const result = await mapFn({ data: { raw: phrases, existing: selected } });
      setNotes(result.mappings);
      onAdd(result.mappings.map((m) => m.category).filter(Boolean));
      setRaw("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not map those categories.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={
        important
          ? "space-y-2 rounded-2xl border-2 border-primary/60 bg-primary/5 p-4"
          : "space-y-2 rounded-2xl border border-dashed border-border p-4"
      }
    >
      <Label htmlFor="other-cats">
        Other — describe it in your own words{important ? " *" : ""}
      </Label>
      <p className="text-xs text-muted-foreground">
        Bingo will map it to an existing category or create a new one that fits.
      </p>
      {notice ? <p className="text-xs font-medium text-primary">{notice}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="other-cats"
          placeholder="e.g. sustainable home decor, desi street food"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <Button type="button" variant="outline" onClick={run} disabled={busy || !raw.trim()}>
          {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Sparkles className="mr-1 size-4" />}
          Add with AI
        </Button>
      </div>
      {notes.length ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {notes.map((n) => (
            <li key={`${n.input}-${n.category}`}>
              “{n.input}” → <span className="text-foreground">{n.category}</span>
              {n.is_new ? " (new category)" : ""} — {n.note}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your Bingo profile" },
      {
        name: "description",
        content: "Tell Bingo about your content or your brand so matches are built on fit, not follower count.",
      },
      { property: "og:title", content: "Set up your Bingo profile" },
      {
        property: "og:description",
        content: "Tell Bingo about your content or your brand so matches are built on fit, not follower count.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingPage,
});

const CREATOR_KINDS: Array<{ value: CreatorKind; label: string; hint: string }> = [
  {
    value: "content_creator",
    label: "Content creator / Influencer",
    hint: "You publish on your own channels and brands pay for your audience and voice.",
  },
  {
    value: "ugc_creator",
    label: "UGC creator",
    hint: "You produce content brands run on their own channels — share your profile and portfolio links.",
  },
  {
    value: "other",
    label: "Other",
    hint: "Anything else — photographer, editor, agency, studio. Admin approval is required before brands see you.",
  },
];

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function intendedRole(): "creator" | "brand" | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem("bingo-intended-role");
    return stored === "brand" || stored === "creator" ? stored : null;
  } catch {
    return null;
  }
}

function OnboardingPage() {
  const { role, loading, user } = useAuth();
  const [picked, setPicked] = useState<"creator" | "brand" | null>(null);
  const signupRole = (user?.user_metadata?.["role"] as string | undefined) ?? undefined;
  const preselected =
    signupRole === "brand" || signupRole === "creator" ? (signupRole as "creator" | "brand") : intendedRole();
  const active = role === "brand" ? "brand" : role === "creator" ? "creator" : (picked ?? preselected);


  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {active === "creator" ? (
          <CreatorWizard />
        ) : active === "brand" ? (
          <BrandWizard />
        ) : (
          <div>
            <h1 className="font-display text-3xl font-bold">How will you use Bingo?</h1>
            <p className="mt-2 text-muted-foreground">Pick the side you're on. You can only choose once.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {(
                [
                  { key: "creator", title: "I'm a Creator", body: "Get matched to brands by your content and craft." },
                  { key: "brand", title: "I'm a Brand", body: "Describe a campaign and meet creators who actually fit." },
                ] as const
              ).map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setPicked(o.key)}
                  className="rounded-2xl border border-border bg-card p-6 text-left transition-colors hover:border-primary"
                >
                  <p className="font-display text-lg font-bold">{o.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{o.body}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function WizardShell({
  step,
  total,
  title,
  description,
  onBack,
  onNext,
  nextLabel,
  busy,
  disabled,
  children,
}: {
  step: number;
  total: number;
  title: string;
  description?: string;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <StepHeader step={step} total={total} title={title} description={description} />
      <div className="mt-8 space-y-5">{children}</div>
      <div className="mt-10 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} disabled={!onBack || busy}>
          <ArrowLeft className="mr-1 size-4" /> Back
        </Button>
        <Button
          onClick={onNext}
          disabled={busy || disabled}
          className="bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90"
        >
          {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
          {nextLabel ?? "Continue"}
          {!busy ? <ArrowRight className="ml-1 size-4" /> : null}
        </Button>
      </div>
    </div>
  );
}

function DnaReview({
  entries,
  busy,
  onRetry,
  onConfirm,
}: {
  entries: Array<{ label: string; value: string | string[]; why?: string }>;
  busy: boolean;
  onRetry: () => void;
  onConfirm: () => void;
}) {
  const empty = (why?: string) => `Not enough data yet — ${why ?? "add more detail above and regenerate."}`;
  return (
    <div className="space-y-5">
      {entries.map((entry) => (
        <div key={entry.label} className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{entry.label}</p>
          {Array.isArray(entry.value) ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.value.length ? (
                entry.value.map((v) => <Chip key={v} label={v} />)
              ) : (
                <span className="text-sm text-muted-foreground">{empty(entry.why)}</span>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm">{entry.value || <span className="text-muted-foreground">{empty(entry.why)}</span>}</p>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onRetry} disabled={busy}>
          Regenerate
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy}
          className="bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90"
        >
          Looks right — continue
        </Button>
      </div>
    </div>
  );
}

function AnalyzingState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
      <Sparkles className="mx-auto size-6 animate-pulse text-primary" />
      <p className="mt-4 font-display text-lg font-semibold">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">This usually takes a few seconds.</p>
    </div>
  );
}

function CreatorWizard() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const save = useServerFn(saveCreatorOnboarding);
  const generate = useServerFn(generateCreatorDNA);

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [dna, setDna] = useState<CreatorDNA | null>(null);

  const [creatorKind, setCreatorKind] = useState<CreatorKind | null>(null);
  const [form, setForm] = useState({
    display_name: "",
    headline: "",
    bio: "",
    location: "",
    instagram: "",
    starting_price: "",
    open_to_paid: true,
    open_to_barter: false,
    portfolio: "",
  });
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [creatorTypes, setCreatorTypes] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [preferred, setPreferred] = useState<string[]>([]);

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const portfolioLinks = form.portfolio
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  async function runDna() {
    setBusy(true);
    try {
      setDna(await generate({}));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build your Creator DNA.");
    } finally {
      setBusy(false);
    }
  }

  async function submitProfile() {
    setBusy(true);
    try {
      await save({
        data: {
          creator_kind: creatorKind ?? "content_creator",
          display_name: form.display_name.trim(),
          headline: form.headline.trim(),
          bio: form.bio.trim(),
          location: form.location.trim(),
          languages,
          creator_types: creatorTypes,
          categories,
          instagram: form.instagram.trim(),
          starting_price_inr: form.starting_price ? Number(form.starting_price) : null,
          open_to_paid: form.open_to_paid,
          open_to_barter: form.open_to_barter,
          preferred_categories: preferred,
          portfolio_links: form.portfolio
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });
      await refresh();
      if (creatorKind === "other") {
        toast.success("Profile submitted — an admin will review and approve it shortly.");
      }
      setStep(5);
      void runDna();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  if (step === 1) {
    return (
      <WizardShell
        step={1}
        total={5}
        title="Who are you as a creator?"
        description="This is what brands see first."
        onNext={() => setStep(2)}
        disabled={!form.display_name.trim() || !creatorKind}
      >
        <div className="space-y-2">
          <Label>What kind of creator are you?</Label>
          <div className="flex flex-wrap gap-2">
            {CREATOR_KINDS.map((k) => (
              <Chip
                key={k.value}
                label={k.label}
                selected={creatorKind === k.value}
                onClick={() => setCreatorKind(k.value)}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {creatorKind ? CREATOR_KINDS.find((k) => k.value === creatorKind)!.hint : "Pick the option that fits you best."}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Display name</Label>
          <Input id="name" value={form.display_name} onChange={(e) => set("display_name", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            placeholder="UGC creator for skincare and wellness brands"
            value={form.headline}
            onChange={(e) => set("headline", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">About your content</Label>
          <Textarea id="bio" rows={5} value={form.bio} onChange={(e) => set("bio", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Select value={form.location} onValueChange={(v) => set("location", v)}>
            <SelectTrigger id="location">
              <SelectValue placeholder="Select your city" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {LOCATIONS.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Languages you create in</Label>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <Chip
                key={l}
                label={l}
                selected={languages.includes(l)}
                onClick={() => setLanguages((v) => toggle(v, l))}
              />
            ))}
          </div>
        </div>
      </WizardShell>
    );
  }

  if (step === 2) {
    return (
      <WizardShell
        step={2}
        total={5}
        title="What kind of creator are you?"
        description="Pick everything that describes your work."
        onBack={() => setStep(1)}
        onNext={() => setStep(3)}
        disabled={creatorTypes.length === 0 || categories.length === 0}
      >
        <div className="space-y-2">
          <Label>Creator types</Label>
          <div className="flex flex-wrap gap-2">
            {CREATOR_TYPES.map((t) => (
              <Chip
                key={t}
                label={t}
                selected={creatorTypes.includes(t)}
                onClick={() => setCreatorTypes((v) => toggle(v, t))}
              />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Categories you create in * (pick up to 2)</Label>
          <p className="text-xs text-muted-foreground">
            Our AI adds one more category based on your Creator DNA, for a maximum of three.
          </p>
          <div className="flex flex-wrap gap-2">
            {[...CATEGORIES, ...categories.filter((c) => !CATEGORIES.includes(c as never))].map((c) => (
              <Chip
                key={c}
                label={c}
                selected={categories.includes(c)}
                onClick={() =>
                  setCategories((v) => {
                    if (v.includes(c)) return v.filter((x) => x !== c);
                    if (v.length >= 2) {
                      toast.error("Pick at most 2 categories — AI labels the third.");
                      return v;
                    }
                    return [...v, c];
                  })
                }
              />
            ))}
          </div>
        </div>
        <CustomCategories
          selected={categories}
          onAdd={(added) => setCategories((v) => Array.from(new Set([...v, ...added])).slice(0, 2))}
        />

      </WizardShell>
    );
  }

  if (step === 3) {
    return (
      <WizardShell
        step={3}
        total={5}
        title="Where can brands see your work?"
        description={
          creatorKind === "ugc_creator"
            ? "UGC creators must share a profile link and at least one portfolio link so brands can review real work."
            : "Connect Instagram so AI can read your real metrics, or add your handle and links manually."
        }
        onBack={() => setStep(2)}
        onNext={() => setStep(4)}
        disabled={creatorKind === "ugc_creator" && !(form.instagram.trim() && portfolioLinks.length > 0)}
      >
        {creatorKind === "other" ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Profiles outside our standard creator types are reviewed manually. You can finish onboarding now — an admin
            will approve your profile before it appears to brands.
          </div>
        ) : null}
        <InstagramPanel />
        <div className="space-y-2">
          <Label htmlFor="ig">
            Instagram handle or profile link{creatorKind === "ugc_creator" ? " *" : ""}
          </Label>
          <Input id="ig" placeholder="@yourhandle" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="portfolio">
            Portfolio links{creatorKind === "ugc_creator" ? " *" : " (optional)"}
          </Label>
          <Textarea
            id="portfolio"
            rows={4}
            placeholder="One link per line — Drive folder, reels, past work"
            value={form.portfolio}
            onChange={(e) => set("portfolio", e.target.value)}
          />
        </div>
      </WizardShell>
    );
  }

  if (step === 4) {
    return (
      <WizardShell
        step={4}
        total={5}
        title="How do you like to work?"
        description="Used to filter out deals that waste your time."
        onBack={() => setStep(3)}
        onNext={submitProfile}
        nextLabel="Build my Creator DNA"
        busy={busy}
      >
        <div className="space-y-2">
          <Label htmlFor="price">Starting price (₹)</Label>
          <Input
            id="price"
            type="number"
            min={0}
            value={form.starting_price}
            onChange={(e) => set("starting_price", e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip label="Open to paid deals" selected={form.open_to_paid} onClick={() => set("open_to_paid", !form.open_to_paid)} />
          <Chip label="Open to barter" selected={form.open_to_barter} onClick={() => set("open_to_barter", !form.open_to_barter)} />
        </div>
        <div className="space-y-2">
          <Label>Categories you'd love to work with</Label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={c}
                selected={preferred.includes(c)}
                onClick={() => setPreferred((v) => toggle(v, c))}
              />
            ))}
          </div>
        </div>
      </WizardShell>
    );
  }

  return (
    <div>
      <StepHeader step={5} total={5} title="Your Creator DNA" description="Review it — you can regenerate anytime." />
      <div className="mt-8">
        {busy || !dna ? (
          <AnalyzingState label="Analyzing your profile…" />
        ) : (
          <DnaReview
            busy={busy}
            onRetry={runDna}
            onConfirm={() => navigate({ to: "/dashboard" })}
            entries={[
              { label: "Summary", value: dna.summary, why: "your bio is too short for the AI to describe you." },
              { label: "Content style", value: dna.content_style, why: "add creator types and a richer bio." },
              { label: "Audience signals", value: dna.audience_signals, why: "connect Instagram so real metrics can be read." },
              { label: "Best fit categories", value: dna.best_fit_categories, why: "pick more categories you actually create in." },
              { label: "Strengths", value: dna.strengths, why: "add portfolio links showing your best work." },
              { label: "Brand fit notes", value: dna.brand_fit_notes, why: "add pricing and collaboration preferences." },
              { label: "Gaps", value: dna.gaps, why: "nothing stood out — that's a good sign." },
            ]}

          />
        )}
      </div>
    </div>
  );
}

function BrandWizard() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const save = useServerFn(saveBrandOnboarding);
  const generate = useServerFn(generateBrandDNA);

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [dna, setDna] = useState<BrandDNA | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const [form, setForm] = useState({
    brand_name: "",
    website: "",
    instagram: "",
    industry: "",
    about: "",
    mission: "",
    demographics: "",
    goals: "",
    markets: "",
    price_point: "",
    contact_person: "",
    contact_email: "",
    contact_phone: "",
  });
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const nameError = validateName(form.contact_person);
  const emailError = validateEmail(form.contact_email);
  const phoneError = validatePhone(form.contact_phone);
  const pricePointError = validatePricePoint(form.price_point);
  const marketsError = validateMarkets(form.markets);

  const contactValid = !nameError && !emailError && !phoneError;

  async function runDna() {
    setBusy(true);
    try {
      setDna(await generate({}));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build your Brand DNA.");
    } finally {
      setBusy(false);
    }
  }

  async function submitProfile() {
    setTouched(true);
    if (!contactValid) {
      toast.error("Fix the contact details before continuing.");
      return;
    }
    setBusy(true);
    try {
      await save({
        data: {
          brand_name: form.brand_name.trim(),
          website: form.website.trim(),
          instagram: form.instagram.trim(),
          industry: form.industry,
          about: form.about.trim(),
          mission: form.mission.trim(),
          demographics: form.demographics.trim(),
          goals: form.goals.trim(),
          markets: form.markets.trim(),
          price_point: form.price_point.trim(),
          contact_person: form.contact_person.trim(),
          contact_email: form.contact_email.trim(),
          contact_phone: form.contact_phone.trim(),
          campaign_categories: categories,
        },
      });
      await refresh();
      setStep(5);
      void runDna();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your brand.");
    } finally {
      setBusy(false);
    }
  }

  if (step === 1) {
    return (
      <WizardShell
        step={1}
        total={5}
        title="Tell us about your brand"
        onNext={() => setStep(2)}
        disabled={!form.brand_name.trim() || !form.about.trim()}
      >
        <div className="space-y-2">
          <Label htmlFor="brand">Brand name</Label>
          <Input id="brand" value={form.brand_name} onChange={(e) => set("brand_name", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="about">What do you sell, and to whom?</Label>
          <Textarea id="about" rows={5} value={form.about} onChange={(e) => set("about", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Industry</Label>
          <div className="flex flex-wrap gap-2">
            {INDUSTRIES.map((i) => (
              <Chip key={i} label={i} selected={form.industry === i} onClick={() => set("industry", i)} />
            ))}
          </div>
        </div>
      </WizardShell>
    );
  }

  if (step === 2) {
    return (
      <WizardShell
        step={2}
        total={5}
        title="Where can creators find you?"
        description="Instagram and at least one campaign category are required — they drive every match we make."
        onBack={() => setStep(1)}
        onNext={() => setStep(3)}
        disabled={!form.instagram.trim() || categories.length === 0}
      >
        <div className="space-y-2">
          <Label htmlFor="site">Website</Label>
          <Input id="site" placeholder="https://" value={form.website} onChange={(e) => set("website", e.target.value)} />
        </div>
        <InstagramPanel />
        <div className="space-y-2">
          <Label htmlFor="bi">Instagram handle *</Label>
          <Input id="bi" placeholder="@yourbrand" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} />
          {!form.instagram.trim() ? (
            <p className="text-xs text-destructive">Instagram is required for brands.</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label>Categories you run campaigns in *</Label>
          <div className="flex flex-wrap gap-2">
            {[...CATEGORIES, ...categories.filter((c) => !CATEGORIES.includes(c as never))].map((c) => (
              <Chip
                key={c}
                label={c}
                selected={categories.includes(c)}
                onClick={() => setCategories((v) => toggle(v, c))}
              />
            ))}
          </div>
          {categories.length === 0 ? (
            <p className="text-xs text-destructive">Pick at least one category.</p>
          ) : null}
        </div>
        <CustomCategories
          selected={categories}
          onAdd={(added) => setCategories((v) => Array.from(new Set([...v, ...added])))}
          important
          notice="Important — custom categories are reviewed by our team. You can verify your brand account once you finish onboarding; the request goes to Bingo admins."
        />
      </WizardShell>
    );
  }

  if (step === 3) {
    return (
      <WizardShell
        step={3}
        total={5}
        title="Who are you trying to reach?"
        description="The more context here, the sharper your matches and AI briefs."
        onBack={() => setStep(2)}
        onNext={() => setStep(4)}
        disabled={!form.demographics.trim() || !!pricePointError}
      >
        <div className="space-y-2">
          <Label htmlFor="mission">Brand mission</Label>
          <Textarea
            id="mission"
            rows={3}
            placeholder="Why the brand exists and what it stands for."
            value={form.mission}
            onChange={(e) => set("mission", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="demo">Target demographics *</Label>
          <Textarea
            id="demo"
            rows={3}
            placeholder="Age range, gender skew, income, lifestyle, buying triggers."
            value={form.demographics}
            onChange={(e) => set("demographics", e.target.value)}
          />
          {!form.demographics.trim() ? (
            <p className="text-xs text-destructive">Target demographics are required.</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="markets">Key markets / cities</Label>
          <Input
            id="markets"
            placeholder="Mumbai, Bengaluru, Tier-2 metros"
            value={form.markets}
            onChange={(e) => set("markets", e.target.value)}
          />
          <FieldError message={marketsError} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Typical price point (₹, numbers only)</Label>
          <Input
            id="price"
            inputMode="numeric"
            placeholder="499 - 1999"
            value={form.price_point}
            onChange={(e) => set("price_point", e.target.value.replace(/[^\d\s,.\-–]/g, ""))}
          />
          <FieldError message={pricePointError} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="goals">What do you want from creator collaborations?</Label>
          <Textarea
            id="goals"
            rows={3}
            placeholder="Awareness, UGC library, performance content, launches…"
            value={form.goals}
            onChange={(e) => set("goals", e.target.value)}
          />
        </div>
      </WizardShell>
    );
  }


  if (step === 4) {
    return (
      <WizardShell
        step={4}
        total={5}
        title="Who should creators talk to?"
        onBack={() => setStep(3)}
        onNext={submitProfile}
        nextLabel="Build my Brand DNA"
        busy={busy}
        disabled={!contactValid}
      >
        <div className="space-y-2">
          <Label htmlFor="cp">Contact person</Label>
          <Input
            id="cp"
            value={form.contact_person}
            onBlur={() => setTouched(true)}
            onChange={(e) => set("contact_person", e.target.value)}
          />
          <FieldError message={touched ? nameError : null} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ce">Contact email</Label>
          <Input
            id="ce"
            type="email"
            value={form.contact_email}
            onBlur={() => setTouched(true)}
            onChange={(e) => set("contact_email", e.target.value)}
          />
          <FieldError message={touched ? emailError : null} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cph">Contact phone</Label>
          <Input
            id="cph"
            inputMode="tel"
            placeholder="+91 9876543210"
            value={form.contact_phone}
            onBlur={() => setTouched(true)}
            onChange={(e) => set("contact_phone", e.target.value)}
          />
          <FieldError message={touched ? phoneError : null} />
        </div>
      </WizardShell>
    );
  }

  return (
    <div>
      <StepHeader step={5} total={5} title="Your Brand DNA" description="Review it — you can regenerate anytime." />
      <div className="mt-8">
        {busy || !dna ? (
          <AnalyzingState label="Analyzing your brand…" />
        ) : (
          <DnaReview
            busy={busy}
            onRetry={runDna}
            onConfirm={() => navigate({ to: "/dashboard" })}
            entries={[
              { label: "Summary", value: dna.summary, why: "your 'what do you sell' answer is too brief." },
              { label: "Positioning", value: dna.positioning, why: "add your brand mission and price point." },
              { label: "Tone of voice", value: dna.tone_of_voice, why: "connect Instagram or add more about your brand." },
              { label: "Target audience", value: dna.target_audience, why: "target demographics need more specifics (age, income, lifestyle)." },
              { label: "Ideal creator profile", value: dna.ideal_creator_profile, why: "add campaign categories and collaboration goals." },
              { label: "Content themes", value: dna.content_themes, why: "describe the content you want from creators." },
              { label: "Gaps", value: dna.gaps, why: "nothing stood out — that's a good sign." },
            ]}

          />
        )}
      </div>
    </div>
  );
}
