import { GoogleAuth } from "google-auth-library";
/** FCM HTTP v1 transport; credentials stay on the server via ADC. */
export class FirebasePush {
  private auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });
  private projectId = "";
  async init() {
    this.projectId =
      process.env.GOOGLE_CLOUD_PROJECT || (await this.auth.getProjectId());
    await this.auth.getAccessToken();
  }
  async send(
    tokens: string[],
    payload: {
      title: string;
      body: string;
      entryId: string;
      communityId: string;
    },
  ) {
    const accessToken = await this.auth.getAccessToken();
    return Promise.all(
      tokens.map(async (token) => {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.projectId)}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title: payload.title, body: payload.body },
                data: {
                  visitor_entry_id: payload.entryId,
                  community_id: payload.communityId,
                },
                android: { priority: "HIGH" },
                apns: { payload: { aps: { sound: "default" } } },
              },
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (response.ok) return { token, error: null };
        const data = (await response.json()) as {
          error?: { details?: { errorCode?: string }[] };
        };
        const code = data.error?.details?.find((d) => d.errorCode)?.errorCode;
        return {
          token,
          error: code === "UNREGISTERED" ? "unregistered" : "retry",
        };
      }),
    );
  }
}
