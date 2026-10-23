interface Job { start: () => void; cancel: () => void }
export class IoQueue {
  private running = 0; private pending: Job[] = []; private stopped = false;
  private cancellations = new Set<() => void>();
  constructor(private limit = 4, private timeout = 5000) {}
  run<T>(task: () => Promise<T>): Promise<T> {
    if (this.stopped) return Promise.reject(new Error("Workspace closed."));
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown, value?: T) => {
        if (settled) return; settled = true; clearTimeout(timer); this.cancellations.delete(cancel);
        if (error) reject(error); else resolve(value as T);
      };
      const cancel = () => finish(new Error("Workspace closed."));
      const job: Job = { cancel, start: () => {
        if (settled) return;
        this.running++;
        void task().then(value => finish(undefined, value), error => finish(error)).finally(() => {
          this.running--; this.pump();
        });
      }};
      const timer = setTimeout(() => {
        this.pending = this.pending.filter(item => item !== job);
        finish(new Error("Location did not respond within five seconds. Retry when it is available."));
      }, this.timeout);
      this.cancellations.add(cancel); this.pending.push(job); this.pump();
    });
  }
  private pump(): void { while (!this.stopped && this.running < this.limit && this.pending.length) this.pending.shift()!.start(); }
  dispose(): void { this.stopped = true; for (const cancel of this.cancellations) cancel(); this.pending = []; }
}
