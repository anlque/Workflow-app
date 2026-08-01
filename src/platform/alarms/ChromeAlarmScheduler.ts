import { browser, type Browser } from 'wxt/browser';

import type { AlarmScheduler } from './AlarmScheduler';

export class ChromeAlarmScheduler implements AlarmScheduler {
  public async schedule(name: string, when: number): Promise<void> {
    await browser.alarms.create(name, { when });
  }

  public async clear(name: string): Promise<void> {
    await browser.alarms.clear(name);
  }

  public onFired(listener: (name: string) => Promise<void>): () => void {
    const chromeListener = (alarm: Browser.alarms.Alarm): void => {
      void listener(alarm.name);
    };
    browser.alarms.onAlarm.addListener(chromeListener);
    return () => {
      browser.alarms.onAlarm.removeListener(chromeListener);
    };
  }
}
