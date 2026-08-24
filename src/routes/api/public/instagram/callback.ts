import { createFileRoute } from "@tanstack/react-router";

/**
 * Instagram Business Login callback. The signed `state` carries the app user id,
 * so this public endpoint can attribute the connection without a session cookie.
 */
export const Route = createFileRoute("/api/public/instagram/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const ig = await import("@/lib/instagram.server");

        const back = (origin: string, params: Record<string, string>, path = "/connections") =>
          new Response(null, {
            status: 302,
            headers: { Location: `${origin}${path}?${new URLSearchParams(params).toString()}` },
          });

        const stateRaw = url.searchParams.get("state") ?? "";
        let state: { uid: string; redirect: string; exp: number } | null = null;
        try {
          state = ig.verifyState(stateRaw);
        } catch (error) {
          return new Response(`Instagram connection failed: ${(error as Error).message}`, { status: 400 });
        }

        const origin = state.redirect.replace(/\/$/, "");
        const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
        if (error) return back(origin, { instagram: "error", message: error.slice(0, 200) });

        const code = url.searchParams.get("code");
        if (!code) return back(origin, { instagram: "error", message: "No authorization code returned." });

        try {
          const short = await ig.exchangeCode(code, ig.redirectUriFor(origin));
          const long = await ig.exchangeLongLived(short.accessToken);
          const snapshot = await ig.fetchSnapshot(long.accessToken);
          const { saveInstagramConnection } = await import("@/lib/instagram-store.server");
          await saveInstagramConnection(state.uid, long.accessToken, long.expiresIn, snapshot);
          // Land the user back inside Bingo on their analytics screen, not on instagram.com.
          return back(
            origin,
            { tab: "analytics", instagram: "connected", handle: snapshot.profile.username ?? "" },
            "/dashboard",
          );
        } catch (err) {
          console.error("instagram callback failed", err);
          return back(origin, { instagram: "error", message: (err as Error).message.slice(0, 200) });
        }
      },
    },
  },
});
