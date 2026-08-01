import type { Clock } from '../Clock';

export class FakeClock implements Clock {
  #currentTime: number;

  public constructor(currentTime: number) {
    this.#currentTime = currentTime;
  }

  public now(): number {
    return this.#currentTime;
  }

  public set(currentTime: number): void {
    this.#currentTime = currentTime;
  }
}
