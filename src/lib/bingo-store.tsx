import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  demoBrands,
  demoCreators,
  type BrandProfile,
  type CampaignBrief,
  type CollabState,
  type CreatorProfile,
  type Role,
} from "@/lib/bingo-data";

export type Session = { role: Role; id: string; name: string };

export type Collab = {
  id: string;
  campaignId: string;
  creatorId: string;
  brandId: string;
  state: CollabState;
  shortlisted: boolean;
  submissions: { id: string; title: string; note: string; at: string; verdict?: "approved" | "changes" ; feedback?: string }[];
  messages: { id: string; from: "creator" | "brand"; text: string; at: string }[];
  rating?: { stars: number; note: string };
  brandFeedback?: { decision: "accepted" | "rejected"; reasons: string[]; note: string };
};

type OnboardingState = {
  creatorDone: boolean;
  brandDone: boolean;
};

type StoreShape = {
  session: Session | null;
  creators: CreatorProfile[];
  brands: BrandProfile[];
  campaigns: CampaignBrief[];
  collabs: Collab[];
  onboarding: OnboardingState;
};

const KEY = "bingo-store-v1";

const seedCampaigns: CampaignBrief[] = [
  {
    id: "cmp-nexus-1",
    brandId: "b-nexus",
    title: "Nexus Halo X launch — honest latency test",
    rawPrompt:
      "We want technical creators to stress-test our new Halo X mouse and talk about latency honestly, no hype, ahead of the Q4 launch.",
    objective: "Drive considered purchase intent for Nexus Gear among 18–34 competitive gamers.",
    deliverables: [
      "1× long-form integration (60–90s dedicated segment)",
      "2× short-form cutdowns (TikTok / Reels)",
      "1× usage licence for paid amplification (90 days)",
    ],
    timeline: [
      { label: "Kickoff call", date: "Week 1" },
      { label: "Concept + script approval", date: "Week 2" },
      { label: "First cut delivered", date: "Week 4" },
      { label: "Publish window", date: "Week 5–6" },
    ],
    compensation: "$4,500 · 50% on signature, 50% on approval",
    requirements: [
      "Tone must stay technical, confident, no hype language",
      "Disclose the partnership in caption and on-screen",
      "No competitor integrations 30 days either side",
      "Raw files shared for brand archive",
    ],
    audience: "18–34 competitive gamers · Hardware researchers · US/DE/BR",
    status: "open",
  },
  {
    id: "cmp-lumina-1",
    brandId: "b-lumina",
    title: "Barrier Repair Serum — myth-busting series",
    rawPrompt: "Looking for science-led beauty creators to debunk skincare myths using our barrier serum.",
    objective: "Build trust for Lumina Skincare among 22–38 skincare researchers.",
    deliverables: ["1× explainer video", "2× carousel posts", "Story link set"],
    timeline: [
      { label: "Brief accepted", date: "Week 1" },
      { label: "Script approval", date: "Week 2" },
      { label: "Delivery", date: "Week 3" },
    ],
    compensation: "$2,400 · paid on approval",
    requirements: ["Cite sources on screen", "No fear-based claims", "Disclose partnership"],
    audience: "22–38 skincare researchers · UK/US/AU",
    status: "open",
  },
];

const seedCollabs: Collab[] = [
  {
    id: "col-1",
    campaignId: "cmp-nexus-1",
    creatorId: "c-nova",
    brandId: "b-nexus",
    state: "in_review",
    shortlisted: true,
    submissions: [
      { id: "s1", title: "v2_cut_final.mp4", note: "Full integration with latency bench overlay.", at: "Yesterday" },
    ],
    messages: [
      { id: "m1", from: "brand", text: "Loved your teardown format — brief is attached above.", at: "Mon 09:12" },
      { id: "m2", from: "creator", text: "Bench data looks solid. Sending the first cut Thursday.", at: "Mon 10:04" },
    ],
  },
  {
    id: "col-2",
    campaignId: "cmp-lumina-1",
    creatorId: "c-mira",
    brandId: "b-lumina",
    state: "invited",
    shortlisted: true,
    submissions: [],
    messages: [{ id: "m3", from: "brand", text: "We think your myth-busting duets fit this perfectly.", at: "Tue 14:20" }],
  },
  {
    id: "col-3",
    campaignId: "cmp-nexus-1",
    creatorId: "c-jax",
    brandId: "b-nexus",
    state: "completed",
    shortlisted: true,
    submissions: [{ id: "s2", title: "halo_x_review.mp4", note: "Published 12 Oct.", at: "Oct 12", verdict: "approved" }],
    messages: [],
    rating: { stars: 5, note: "Clear brief, fast approvals, paid on time." },
    brandFeedback: {
      decision: "accepted",
      reasons: ["Audience fit", "Tone match"],
      note: "Numbers-first delivery matched our anti-hype positioning.",
    },
  },
];

const initialState: StoreShape = {
  session: null,
  creators: demoCreators,
  brands: demoBrands,
  campaigns: seedCampaigns,
  collabs: seedCollabs,
  onboarding: { creatorDone: false, brandDone: false },
};

type StoreApi = StoreShape & {
  ready: boolean;
  currentCreator: CreatorProfile | null;
  currentBrand: BrandProfile | null;
  randomLogin: (role: Role) => Session;
  logout: () => void;
  updateCreator: (id: string, patch: Partial<CreatorProfile>) => void;
  updateBrand: (id: string, patch: Partial<BrandProfile>) => void;
  completeOnboarding: (role: Role) => void;
  addCampaign: (campaign: CampaignBrief) => void;
  upsertCollab: (collab: Collab) => void;
  patchCollab: (id: string, patch: Partial<Collab>) => void;
  inviteCreator: (campaignId: string, creatorId: string, brandId: string) => void;
  sendMessage: (collabId: string, from: "creator" | "brand", text: string) => void;
};

const StoreContext = createContext<StoreApi | null>(null);

export function BingoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreShape>(initialState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...initialState, ...(JSON.parse(raw) as StoreShape) });
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, ready]);

  const randomLogin = useCallback((role: Role) => {
    const pool = role === "creator" ? demoCreators : demoBrands;
    const pick = pool[Math.floor(Math.random() * pool.length)]!;
    const session: Session = { role, id: pick.id, name: pick.name };
    setState((s) => ({ ...s, session }));
    return session;
  }, []);

  const api = useMemo<StoreApi>(() => {
    const currentCreator =
      state.session?.role === "creator" ? state.creators.find((c) => c.id === state.session!.id) ?? null : null;
    const currentBrand =
      state.session?.role === "brand" ? state.brands.find((b) => b.id === state.session!.id) ?? null : null;

    return {
      ...state,
      ready,
      currentCreator,
      currentBrand,
      randomLogin,
      logout: () => setState((s) => ({ ...s, session: null })),
      updateCreator: (id, patch) =>
        setState((s) => ({ ...s, creators: s.creators.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      updateBrand: (id, patch) =>
        setState((s) => ({ ...s, brands: s.brands.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      completeOnboarding: (role) =>
        setState((s) => ({
          ...s,
          onboarding: { ...s.onboarding, [role === "creator" ? "creatorDone" : "brandDone"]: true },
        })),
      addCampaign: (campaign) => setState((s) => ({ ...s, campaigns: [campaign, ...s.campaigns] })),
      upsertCollab: (collab) =>
        setState((s) => ({
          ...s,
          collabs: s.collabs.some((c) => c.id === collab.id)
            ? s.collabs.map((c) => (c.id === collab.id ? collab : c))
            : [collab, ...s.collabs],
        })),
      patchCollab: (id, patch) =>
        setState((s) => ({ ...s, collabs: s.collabs.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      inviteCreator: (campaignId, creatorId, brandId) =>
        setState((s) => {
          if (s.collabs.some((c) => c.campaignId === campaignId && c.creatorId === creatorId)) return s;
          const collab: Collab = {
            id: `col-${Date.now()}-${creatorId}`,
            campaignId,
            creatorId,
            brandId,
            state: "invited",
            shortlisted: true,
            submissions: [],
            messages: [{ id: `m-${Date.now()}`, from: "brand", text: "You've been privately invited to this campaign.", at: "Just now" }],
          };
          return { ...s, collabs: [collab, ...s.collabs] };
        }),
      sendMessage: (collabId, from, text) =>
        setState((s) => ({
          ...s,
          collabs: s.collabs.map((c) =>
            c.id === collabId
              ? { ...c, messages: [...c.messages, { id: `m-${Date.now()}`, from, text, at: "Just now" }] }
              : c,
          ),
        })),
    };
  }, [state, ready, randomLogin]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useBingo() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useBingo must be used inside BingoProvider");
  return ctx;
}
