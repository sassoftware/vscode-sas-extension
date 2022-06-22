import { Event, EventEmitter } from "vscode";
import { sleep } from "../../sleep";

export interface ActiveValueTracker<T> {
  readonly activeChanged: Event<T>;
  setActive(switchedTo: T): void;
  activeAsync(): Promise<T>;
  active(): T | null;
}

export function create<T>(
  getActiveValue: () => Promise<T>,
  pollIntervalMS: number
): ActiveValueTracker<T> {
  return new ActiveValueTrackerImpl<T>(getActiveValue, pollIntervalMS);
}

class ActiveValueTrackerImpl<T> implements ActiveValueTracker<T> {
  private activeValue: T | null = null;
  private readonly activeChangedEmitter: EventEmitter<T> =
    new EventEmitter<T>();

  constructor(
    private readonly getActiveValue: () => Promise<T>,
    private readonly pollIntervalMS: number
  ) {
    this.pollActive();
  }

  public get activeChanged(): Event<T> {
    return this.activeChangedEmitter.event;
  }

  public setActive(switchedTo: T): void {
    if (switchedTo !== this.activeValue) {
      this.activeValue = switchedTo;
      this.activeChangedEmitter.fire(this.activeValue);
    }
  }

  public async activeAsync(): Promise<T> {
    const value = await this.getActiveValue();
    this.setActive(value);
    return value;
  }

  public active(): T | null {
    return this.activeValue;
  }

  private async pollActive(): Promise<never> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const activeProfile = await this.getActiveValue();
      this.setActive(activeProfile);
      await sleep(this.pollIntervalMS);
    }
  }
}
