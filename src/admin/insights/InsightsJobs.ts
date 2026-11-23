import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { generateUUID } from 'src/utils';
import { run, select } from '../sql';
import { addDays, watDay } from '../time';
import { LabelService } from './LabelService';

const TICK_MS = 60_000;
const HOLDER = generateUUID();

/** WAT hour now (0–23). */
const watHour = () => (new Date().getUTCHours() + 1) % 24;

/**
 * Takes a named lock for `ttlMs` (so a second server doesn't run the same job), runs `fn`, and
 * records when it last ran. Returns false when another server holds it.
 */
export async function withJobLock(
  name: string,
  ttlMs: number,
  fn: () => Promise<void>,
) {
  const now = new Date();
  const until = new Date(now.getTime() + ttlMs);
  await run(
    `INSERT INTO insights_job (name, holder, locked_until) VALUES (:name, :holder, :until) AS fresh
     ON DUPLICATE KEY UPDATE
       holder = IF(insights_job.locked_until IS NULL OR insights_job.locked_until < :now, fresh.holder, insights_job.holder),
       locked_until = IF(insights_job.locked_until IS NULL OR insights_job.locked_until < :now, fresh.locked_until, insights_job.locked_until)`,
    { name, holder: HOLDER, until, now },
  );
  const [row] = await select<{ holder: string }>(
    `SELECT holder FROM insights_job WHERE name = :name`,
    { name },
  );
  if (row?.holder !== HOLDER) return false;
  try {
    await fn();
    await run(`UPDATE insights_job SET last_run_on = :now WHERE name = :name`, {
      name,
      now: new Date(),
    });
  } finally {
    await run(
      `UPDATE insights_job SET locked_until = NULL WHERE name = :name AND holder = :holder`,
      {
        name,
        holder: HOLDER,
      },
    );
  }
  return true;
}

/** The WAT day a job last ran, or null. */
async function lastRunDay(name: string) {
  const [row] = await select<{ last_run_on: Date | null }>(
    `SELECT last_run_on FROM insights_job WHERE name = :name`,
    { name },
  );
  return row?.last_run_on ? watDay(new Date(row.last_run_on)) : null;
}

export interface ScheduledTask {
  name: string;
  /** Runs once a day, at or after this WAT hour. */
  hour: number;
  /** Mondays only. */
  mondays?: boolean;
  run: () => Promise<void>;
}

/**
 * The feedback loop's background work, checked every minute:
 * - always: collect finished Claude batches (free, and needed for anything submitted by hand);
 * - with INSIGHTS_JOBS_ENABLED=true: label new items nightly (02:00), draft follow-ups (05:00),
 *   and write last week's themes (Monday 07:00). Off by default, so a laptop running the backend
 *   doesn't spend money on its own.
 */
@Injectable()
export class InsightsJobs implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private tasks: ScheduledTask[] = [];

  constructor(@Inject(LabelService) private labels: LabelService) {}

  get scheduleEnabled() {
    return process.env.INSIGHTS_JOBS_ENABLED === 'true';
  }

  /** Other services add their daily work here. */
  schedule(task: ScheduledTask) {
    this.tasks.push(task);
  }

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    // Nightly labelling of the last few days.
    this.schedule({
      name: 'label_recent',
      hour: 2,
      run: async () => {
        await this.labels.staleTests();
        await this.labels.submit({
          kinds: ['chat', 'test', 'document'],
          from: addDays(watDay(), -3),
          to: watDay(),
          requestedBy: 'nightly',
        });
      },
    });
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref?.();
    setTimeout(() => void this.tick(), 20_000).unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.labels.poll();
      if (this.scheduleEnabled) {
        const today = watDay();
        const monday =
          new Date().getUTCDay() === 1 ||
          (new Date().getUTCDay() === 0 && watHour() === 0);
        for (const task of this.tasks) {
          if (watHour() < task.hour) continue;
          if (task.mondays && !monday) continue;
          if ((await lastRunDay(task.name)) === today) continue;
          await withJobLock(task.name, 30 * 60_000, task.run).catch((e) =>
            console.error(`insights: ${task.name} failed`, e?.message),
          );
        }
      }
    } catch (error) {
      console.error('insights: tick failed', error?.message);
    } finally {
      this.running = false;
    }
  }
}
