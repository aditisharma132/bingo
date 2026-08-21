import { createFileRoute } from "@tanstack/react-router";
import { FileText, Send, Smile, Plus } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages | Bingo" },
      { name: "description", content: "Chat with brands, share assets and keep partnership context in one thread." },
      { property: "og:title", content: "Messages | Bingo" },
      { property: "og:description", content: "Chat with brands, share assets and keep partnership context in one thread." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Messages,
});

const threads = [
  { name: "Nexus Gear", preview: "Ready for the kickoff call?", active: true },
  { name: "Volt Energy", preview: "Sending the rate card tonight.", active: false },
  { name: "Lumina Skincare", preview: "Draft 2 approved 🎉", active: false },
];

const messages = [
  {
    from: "them" as const,
    text: "Hey! Just reviewed the final draft of the contract. Looks solid. Ready to get started on the first mood board.",
    time: "10:42 AM",
  },
  {
    from: "me" as const,
    text: "Amazing. We're stoked to have you on board. I've just updated the status to 'Signed'. Let's aim for a kickoff call this Thursday?",
    time: "10:45 AM",
  },
];

function Messages() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border border-border bg-card p-4">
          <h1 className="font-display text-lg font-bold">Messages</h1>
          <ul className="mt-4 space-y-1">
            {threads.map((thread) => (
              <li key={thread.name}>
                <button
                  type="button"
                  className={`w-full rounded-xl px-3 py-3 text-left transition-colors ${
                    thread.active ? "bg-muted" : "hover:bg-muted/60"
                  }`}
                >
                  <p className="text-sm font-medium">{thread.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{thread.preview}</p>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex flex-col rounded-2xl border border-border bg-card">
          <header className="flex flex-wrap items-center gap-3 border-b border-border p-5">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Current partnership</p>
              <h2 className="font-display text-lg font-bold">Summer Cyber Campaign</h2>
            </div>
            <Badge className="bg-gradient-brand text-primary-foreground">Contract Signed</Badge>
            <Button size="sm" variant="outline">
              View details
            </Button>
          </header>

          <div className="flex-1 space-y-4 p-5">
            <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">Today</p>
            {messages.map((message) => (
              <div
                key={message.time}
                className={`flex ${message.from === "me" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    message.from === "me"
                      ? "bg-gradient-brand text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p>{message.text}</p>
                  <p className="mt-1 text-[11px] opacity-70">{message.time}</p>
                </div>
              </div>
            ))}

            <div className="flex items-center gap-3 rounded-xl border border-border p-3">
              <FileText className="size-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">Moodboard_V1_Brief.pdf</p>
                <p className="text-xs text-muted-foreground">2.4 MB</p>
              </div>
              <Button size="sm" variant="ghost">
                Download
              </Button>
            </div>
          </div>

          <footer className="flex items-center gap-2 border-t border-border p-4">
            <Button size="icon" variant="ghost" aria-label="Attach">
              <Plus className="size-4" />
            </Button>
            <Input placeholder="Write a message..." className="flex-1" />
            <Button size="icon" variant="ghost" aria-label="Emoji">
              <Smile className="size-4" />
            </Button>
            <Button size="icon" className="bg-gradient-brand text-primary-foreground" aria-label="Send">
              <Send className="size-4" />
            </Button>
          </footer>
        </section>
      </main>
    </div>
  );
}
