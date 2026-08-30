/**
 * Webhook & Notification Dispatcher for Thesis Review Events.
 *
 * Dispatches real-time webhooks (Slack, Microsoft Teams, Discord, or generic JSON endpoints)
 * when reviews are generated, confirmed, or flagged for recalibration.
 */

export type ReviewEventType =
  | "REVIEW_GENERATED"
  | "GRADE_CONFIRMED"
  | "RECALIBRATION_WARNING"
  | "FLAGGED_PLAGIARISM"

export interface ReviewWebhookPayload {
  event: ReviewEventType
  workspaceId: string
  reviewId: string
  studentName: string
  thesisTitle: string
  reviewerName?: string
  reviewerRole: string
  grade?: string
  recommendation?: string
  timestamp: string
  details?: Record<string, any>
}

/**
 * Dispatches a formatted notification to a configured webhook endpoint.
 */
export async function dispatchReviewWebhook(
  endpointUrl: string,
  payload: ReviewWebhookPayload,
  signal?: AbortSignal
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const isSlack = endpointUrl.includes("hooks.slack.com")
    const isTeams = endpointUrl.includes("webhook.office.com") || endpointUrl.includes("webhook.office365.com")

    let body: any = payload

    if (isSlack) {
      body = {
        text: `*[PosterApp Posudok]* ${payload.event}: *${payload.studentName}* — _${payload.thesisTitle}_\nZnámka: \`${payload.grade || "N/A"}\` | Rola: ${payload.reviewerRole}`,
      }
    } else if (isTeams) {
      body = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        themeColor: "8B2635",
        summary: `PosterApp: ${payload.event}`,
        sections: [
          {
            activityTitle: `PosterApp — ${payload.event}`,
            activitySubtitle: `${payload.studentName} • ${payload.thesisTitle}`,
            facts: [
              { name: "Známka", value: payload.grade || "N/A" },
              { name: "Posudzovateľ", value: payload.reviewerName || "Neuvedené" },
              { name: "Rola", value: payload.reviewerRole },
              { name: "Odporúčanie", value: payload.recommendation || "N/A" },
            ],
            markdown: true,
          },
        ],
      }
    }

    const res = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: signal || AbortSignal.timeout(6000),
    })

    return { ok: res.ok, status: res.status }
  } catch (err: any) {
    return { ok: false, error: err.message || "Webhook delivery failed" }
  }
}
