// Settings synchronization via BroadcastChannel
// Admin can notify all users about settings update without forcing reload

const CHANNEL_NAME = 'settings_update';
const CACHE_KEY = 'settings_cache';

export class SettingsSync {
  private channel: BroadcastChannel | null = null;
  private onUpdateCallback: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        if (event.data.type === 'settings_updated') {
          this.handleSettingsUpdate();
        }
      };
    }
  }

  private handleSettingsUpdate() {
    // Clear cache
    localStorage.removeItem(CACHE_KEY);

    // Notify UI to show toast
    if (this.onUpdateCallback) {
      this.onUpdateCallback();
    }
  }

  public onUpdate(callback: () => void) {
    this.onUpdateCallback = callback;
  }

  public notifyAllUsers() {
    if (this.channel) {
      this.channel.postMessage({ type: 'settings_updated' });
    }
  }

  public destroy() {
    if (this.channel) {
      this.channel.close();
    }
  }
}

export const settingsSync = new SettingsSync();