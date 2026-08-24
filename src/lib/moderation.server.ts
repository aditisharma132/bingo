/**
 * Lightweight pre-send content moderation for direct messages — the highest-risk
 * interpersonal-harm surface in the app. Fails open: if the AI call itself errors
 * (outage, rate limit), the message goes through rather than blocking real chat on
 * a moderation-service failure. Only flags genuine harassment/threats/hate speech/
 * sexual content, never ordinary blunt negotiation or criticism.
 */
export async function moderateText(text: string): Promise<{ flagged: boolean; reason: string }> {
  try {
    const { generateJson } = await import("@/lib/ai.server");
    const { data } = await generateJson<{ flagged: boolean; reason: string }>({
      system: [
        "You moderate messages for a professional creator-brand marketplace chat.",
        "Flag ONLY genuine harassment, threats, hate speech, or sexual content/solicitation.",
        "Never flag ordinary business negotiation, blunt feedback, criticism, or slang — those are normal here.",
        "When in doubt, do not flag.",
      ].join(" "),
      prompt: `Message:\n${text}`,
      schemaName: "message_moderation",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["flagged", "reason"],
        properties: {
          flagged: { type: "boolean" },
          reason: {
            type: "string",
            description: "One short sentence if flagged, empty string otherwise.",
          },
        },
      },
    });
    return data;
  } catch {
    return { flagged: false, reason: "" };
  }
}
