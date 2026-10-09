const cron = require('node-cron');
const db = require('./db');
const { fetchSubscription } = require('./fetcher');

class Scheduler {
  constructor() {
    this.cronTask = null;
  }

  init() {
    this.restart();
  }

  restart() {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }

    const settings = db.getSettings();
    if (!settings.autoRefreshEnabled) {
      console.log('[Scheduler] Auto-refresh is disabled in settings.');
      return;
    }

    const cronExpr = settings.autoRefreshInterval || '0 */6 * * *';
    console.log(`[Scheduler] Starting cron job with schedule: ${cronExpr}`);

    try {
      this.cronTask = cron.schedule(cronExpr, async () => {
        console.log('[Scheduler] Triggering scheduled subscription update...');
        const subs = db.getSubscriptions().filter(s => s.enabled && s.autoRefresh);
        for (const sub of subs) {
          try {
            console.log(`[Scheduler] Auto-refreshing subscription: ${sub.name}`);
            await fetchSubscription(sub.id);
          } catch (e) {
            console.error(`[Scheduler] Failed to auto-refresh ${sub.name}:`, e.message);
          }
        }
      });
    } catch (e) {
      console.error('[Scheduler] Invalid cron expression:', cronExpr, e.message);
    }
  }
}

module.exports = new Scheduler();
