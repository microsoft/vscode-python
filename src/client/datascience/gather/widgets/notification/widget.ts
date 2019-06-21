import { Widget } from '@phosphor/widgets';

/**
 * The name of the class for toolbar notifications.
 */
const TOOLBAR_NOTIFACTION_CLASS = 'jp-Toolbar-notification';

/**
 * Number of milliseconds to show a notification.
 */
const NOTIFICATION_MS = 5000;

/**
 * Widget for showing notification text.
 */
export class NotificationWidget extends Widget {
  constructor(tag?: string) {
    super({ node: document.createElement(tag || 'span') });
    this.addClass(TOOLBAR_NOTIFACTION_CLASS);
  }

  showMessage(message: string, ms?: number) {
    let notificationMs = ms || NOTIFICATION_MS;
    this.node.textContent = message;
    setTimeout(() => {
      this.node.textContent = '';
    }, notificationMs);
  }
}
