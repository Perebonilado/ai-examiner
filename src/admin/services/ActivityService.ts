import { Injectable } from '@nestjs/common';
import { generateUUID } from 'src/utils';
import {
  ActivityType,
  UserActivityModel,
  UserDailyActiveModel,
  UserPresenceModel,
} from '../models/ActivityModels';
import { describeDevice, watDay } from '../time';
import { CourseDocumentModel } from 'src/infra/db/models/CourseDocumentModel';

const SESSION_GAP_MS = 5 * 60 * 1000;
/** Easy Read opens of the same document within this window count once. */
const EASY_READ_DEDUPE_MS = 30 * 60 * 1000;

/**
 * Records what people do, for the admin dashboard. Every method is best effort: it never throws
 * and never slows the request that called it (callers don't await it).
 */
@Injectable()
export class ActivityService {
  /** "userId|day" pairs already written this process, so heartbeats don't hit the table every minute. */
  private activeDays = new Set<string>();
  private recentEasyRead = new Map<string, number>();

  record(
    userId: string | null | undefined,
    type: ActivityType,
    detail: string,
    meta?: Record<string, unknown>,
  ): void {
    if (!userId) return;
    void this.write(userId, type, detail, meta).catch((error) =>
      console.error('activity: could not record', type, error?.message),
    );
  }

  /** Record a sentence that names a document, looking its title up first (best effort). */
  recordForDocument(
    userId: string | null | undefined,
    type: ActivityType,
    documentId: string | null | undefined,
    sentence: (title: string) => string,
    meta?: Record<string, unknown>,
  ): void {
    if (!userId) return;
    void (async () => {
      let title = 'a document';
      if (documentId) {
        const doc = await CourseDocumentModel.findByPk(documentId, {
          attributes: ['title'],
        });
        if (doc?.title) title = doc.title;
      }
      await this.write(userId, type, sentence(title), {
        ...(meta || {}),
        documentId,
      });
    })().catch((error) =>
      console.error('activity: could not record', type, error?.message),
    );
  }

  /** Easy Read: record an open at most once per document per 30 minutes. */
  recordEasyRead(userId: string | null | undefined, documentId: string): void {
    if (!userId) return;
    const key = `${userId}|${documentId}`;
    const last = this.recentEasyRead.get(key) ?? 0;
    if (Date.now() - last < EASY_READ_DEDUPE_MS) return;
    this.recentEasyRead.set(key, Date.now());
    if (this.recentEasyRead.size > 5000) this.recentEasyRead.clear();
    this.recordForDocument(
      userId,
      'easy_read',
      documentId,
      (title) => `opened ${title} in Easy Read`,
    );
  }

  async heartbeat(
    userId: string,
    doing?: string | null,
    path?: string | null,
    userAgent?: string | null,
  ): Promise<void> {
    const now = new Date();
    const existing = await UserPresenceModel.findByPk(userId);
    const values = {
      lastSeenAt: now,
      doing: doing ? doing.slice(0, 160) : null,
      path: path ? path.slice(0, 200) : null,
      device: describeDevice(userAgent),
    };
    if (existing) {
      const newVisit =
        now.getTime() - new Date(existing.lastSeenAt).getTime() >
        SESSION_GAP_MS;
      await existing.update({
        ...values,
        ...(newVisit ? { sessionStartedAt: now } : {}),
      });
    } else {
      await UserPresenceModel.create({
        userId,
        sessionStartedAt: now,
        ...values,
      } as UserPresenceModel);
    }
    await this.markActive(userId, now);
  }

  private async write(
    userId: string,
    type: ActivityType,
    detail: string,
    meta?: Record<string, unknown>,
  ) {
    const now = new Date();
    await UserActivityModel.create({
      id: generateUUID(),
      userId,
      type,
      detail: detail.slice(0, 500),
      meta: meta ? JSON.stringify(meta).slice(0, 4000) : null,
      createdOn: now,
    } as UserActivityModel);
    await this.markActive(userId, now);
  }

  private async markActive(userId: string, at: Date) {
    const day = watDay(at);
    const key = `${userId}|${day}`;
    if (this.activeDays.has(key)) return;
    await UserDailyActiveModel.findOrCreate({
      where: { userId, day },
      defaults: { id: generateUUID(), userId, day } as UserDailyActiveModel,
    });
    this.activeDays.add(key);
    if (this.activeDays.size > 20000) this.activeDays.clear();
  }
}
