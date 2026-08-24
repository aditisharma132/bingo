import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/bingo-ui";
import { Button } from "@/components/ui/button";
import { confirmMockPayment, getPayment } from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/checkout/$paymentId")({
  head: () => ({
    meta: [
      { title: "Secure this collaboration | Bingo" },
      { name: "description", content: "Hold the agreed amount in escrow so the creator can start with confidence." },
      { property: "og:title", content: "Secure this collaboration | Bingo" },
      { property: "og:description", content: "Hold the agreed amount in escrow so the creator can start with confidence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { paymentId } = useParams({ from: "/_authenticated/checkout/$paymentId" });
  const navigate = useNavigate();
  const fetchPayment = useServerFn(getPayment);
  const confirmFn = useServerFn(confirmMockPayment);

  const { data, isLoading } = useQuery({
    queryKey: ["payment", paymentId],
    queryFn: () => fetchPayment({ data: { paymentId } }),
  });

  const pay = useMutation({
    mutationFn: () => confirmFn({ data: { paymentId } }),
    onSuccess: (res: any) => {
      toast.success("Payment secured in escrow");
      navigate({ to: "/deals/$dealId", params: { dealId: res.dealId } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not complete payment"),
  });

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-xl px-4 py-14 sm:px-6">
        <Panel>
          {isLoading || !data ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading payment…
            </div>
          ) : (
            <>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Escrow checkout</p>
              <h1 className="mt-2 text-2xl font-bold">{data.campaignTitle}</h1>
              <p className="mt-1 text-muted-foreground">Collaboration with {data.creatorName}</p>

              <div className="mt-6 rounded-2xl border p-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground">Amount held in escrow</span>
                  <span className="text-2xl font-bold">
                    ₹{Number(data.amount_inr).toLocaleString("en-IN")}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Funds stay secured until you approve the delivered content. If the collaboration is cancelled before
                  delivery, the amount is returned.
                </p>
              </div>

              {data.status === "secured" || data.status === "released" ? (
                <p className="mt-6 flex items-center gap-2 text-sm font-medium text-primary">
                  <ShieldCheck className="size-4" /> This collaboration is already funded.
                </p>
              ) : (
                <>
                  <div className="mt-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Test mode — no live payment provider is connected yet, so confirming here simulates a successful
                    payment. Connecting real keys later switches this screen to the provider's hosted checkout with no
                    other changes.
                  </div>
                  <Button
                    className="mt-6 w-full bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90"
                    disabled={pay.isPending}
                    onClick={() => pay.mutate()}
                  >
                    {pay.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                    Pay ₹{Number(data.amount_inr).toLocaleString("en-IN")} (test)
                  </Button>
                </>
              )}

              <Button asChild variant="ghost" className="mt-3 w-full">
                <Link to="/deals/$dealId" params={{ dealId: data.deal_id }}>
                  Back to collaboration
                </Link>
              </Button>
            </>
          )}
        </Panel>
      </main>
    </div>
  );
}
