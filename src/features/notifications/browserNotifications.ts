const STORAGE_KEY = 'kopla_browser_notifications_enabled';

export type BrowserNotificationState = 'unsupported' | 'default' | 'granted' | 'denied';

const supported = () => typeof window !== 'undefined' && 'Notification' in window;

export const browserNotifications = {
  state(): BrowserNotificationState {
    return supported() ? Notification.permission : 'unsupported';
  },

  enabled(): boolean {
    return supported() && Notification.permission === 'granted' && window.localStorage.getItem(STORAGE_KEY) === 'true';
  },

  async enable(): Promise<BrowserNotificationState> {
    if (!supported()) return 'unsupported';
    const permission = await Notification.requestPermission();
    if (permission === 'granted') window.localStorage.setItem(STORAGE_KEY, 'true');
    return permission;
  },

  disable(): void {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, 'false');
  },

  async show({ title, body, url }: { title: string; body: string; url: string }): Promise<void> {
    if (!this.enabled() || document.visibilityState === 'visible') return;
    const options: NotificationOptions = { body, icon: '/icons/Captura%20de%20tela%20de%202026-08-28%2013-59-03.svg', badge: '/icons/Captura%20de%20tela%20de%202026-08-28%2013-59-03.svg', tag: `conversation:${url}`, renotify: true, data: { url } };
    const registration = await navigator.serviceWorker?.ready;
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
    new Notification(title, options);
  },
};
