import { Injectable, Inject, OnModuleDestroy } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { Subject, filter } from "rxjs";
import { FirebasePush } from "./firebase-push";
import { randomUUID } from "node:crypto";
import { Database } from "../database/database";
export type LiveEvent = {
  id: string;
  community_id: string;
  unit_id?: string;
  visitor_entry_id?: string;
  type: string;
  occurred_at: string;
};
@Injectable()
export class JobsService implements OnModuleDestroy {
  private queue?: Queue;
  private worker?: Worker;
  private redis?: IORedis;
  private subscriber?: IORedis;
  private timer?: NodeJS.Timeout;
  private draining = false;
  private events = new Subject<LiveEvent>();
  constructor(@Inject(Database) private db: Database) {}
  async init() {
    const url = process.env.REDIS_URL;
    if (!url) return;
    this.redis = new IORedis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    this.redis.on("error", () => undefined);
    await this.redis.connect();
    this.subscriber = this.redis.duplicate();
    await this.subscriber.subscribe("mycommunity:events");
    this.subscriber.on("message", (_channel, value) => {
      try {
        this.events.next(JSON.parse(value));
      } catch {
        /* Ignore malformed transport events. */
      }
    });
    this.queue = new Queue("visitor-notifications", {
      connection: this.redis as any,
    });
    if (process.env.FCM_ENABLED === "true") {
      const push = new FirebasePush();
      await push.init();
      this.worker = new Worker(
        "visitor-notifications",
        async (job) => {
          const payload = await this.db.scoped(
            "",
            null,
            async (sql) => {
              const item = (
                await sql.query(
                  "SELECT * FROM notification_outbox WHERE id=$1",
                  [job.data.id],
                )
              ).rows[0];
              if (!item || item.sent_at) return null;
              const tokens = (
                await sql.query("SELECT token FROM devices WHERE user_id=$1", [
                  item.user_id,
                ])
              ).rows.map((d) => d.token);
              return { item, tokens };
            },
            true,
          );
          if (!payload) return;
          if (!payload.tokens.length) {
            await this.db.scoped(
              "",
              null,
              async (sql) => {
                await sql.query(
                  "UPDATE notification_outbox SET status='no_devices' WHERE id=$1",
                  [payload.item.id],
                );
              },
              true,
            );
            return;
          }
          const results = await push.send(payload.tokens, {
            title: payload.item.title,
            body: payload.item.body,
            entryId: payload.item.entry_id,
            communityId: payload.item.community_id,
          });
          const transient: string[] = [];
          for (const result of results) {
            if (result.error === "unregistered") {
              await this.db.scoped(
                "",
                null,
                async (sql) => {
                  await sql.query("DELETE FROM devices WHERE token=$1", [
                    result.token,
                  ]);
                },
                true,
              );
            } else if (result.error) transient.push(result.error);
          }
          if (transient.length)
            throw new Error("Temporary push delivery failure");
          await this.db.scoped(
            "",
            null,
            async (sql) => {
              await sql.query(
                "UPDATE notification_outbox SET status='sent',sent_at=now() WHERE id=$1",
                [payload.item.id],
              );
            },
            true,
          );
        },
        { connection: this.redis as any, concurrency: 5 },
      );
      this.worker.on("error", (error) =>
        console.error("Notification worker:", error.message),
      );
      this.worker.on("failed", (job) => {
        if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
        void this.db
          .scoped(
            "",
            null,
            async (sql) => {
              await sql.query(
                "UPDATE notification_outbox SET status='failed' WHERE id=$1 AND sent_at IS NULL",
                [job.data.id],
              );
            },
            true,
          )
          .catch((error) =>
            console.error("Push failure status:", error.message),
          );
      });
    }
    this.timer = setInterval(
      () =>
        void this.drain().catch((error) =>
          console.error("Outbox dispatch:", error.message),
        ),
      3000,
    );
    this.timer.unref();
    await this.drain();
  }
  private async drain() {
    if (this.draining || !this.queue) return;
    this.draining = true;
    try {
      const pending = await this.db.scoped(
        "",
        null,
        async (sql) =>
          (
            await sql.query(
              "SELECT id FROM notification_outbox WHERE status='pending' ORDER BY created_at LIMIT 100",
            )
          ).rows,
        true,
      );
      for (const row of pending) {
        await this.queue.add(
          "send",
          { id: row.id },
          {
            jobId: row.id,
            attempts: 5,
            backoff: { type: "exponential", delay: 2000 },
            removeOnComplete: { age: 604800, count: 1000 },
            removeOnFail: false,
          },
        );
        await this.db.scoped(
          "",
          null,
          async (sql) => {
            await sql.query(
              "UPDATE notification_outbox SET status='queued',queued_at=now() WHERE id=$1 AND status='pending'",
              [row.id],
            );
          },
          true,
        );
      }
    } finally {
      this.draining = false;
    }
  }
  async publish(data: Omit<LiveEvent, "id" | "occurred_at">) {
    const event = {
      ...data,
      id: randomUUID(),
      occurred_at: new Date().toISOString(),
    };
    if (this.redis) {
      try {
        await this.redis.publish("mycommunity:events", JSON.stringify(event));
      } catch {
        this.events.next(event);
      }
    } else this.events.next(event);
  }
  stream(community: string, units: string[] | null) {
    return this.events.pipe(
      filter(
        (e) =>
          e.community_id === community &&
          (units === null || (!!e.unit_id && units.includes(e.unit_id))),
      ),
    );
  }
  status() {
    return {
      redis: this.redis?.status || "not-configured",
      push: this.worker ? "enabled" : "not-configured",
    };
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
    await this.subscriber?.quit();
    await this.redis?.quit();
  }
}
