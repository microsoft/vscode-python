// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { pyBootstrapActivatedStatusBarTooltip, pyBootstrapTooltip } from './constants';
import { Channel } from './types';

export enum Selector {
    /**
     * Selector for the Bootstrap extensions statubar item.
     */
    'PyBootstrapStatusBar',
    /**
     * Selector for Python extension statusbar item .
     */
    'PythonExtensionStatusBar',

    /**
     * Selector for the VSC statubar item displaying the line & column.
     * This is the item on the bottom right e.g. `Ln 12, Col 56`.
     */
    'ColumnLineNumbnerStatusBar',
    /**
     * Selector for the statusbar created by Bootstrap extensions when Python Extension gets activated.
     * (basically if this status bar item exists, then Python Extension has activated).
     */
    'PyBootstrapActivatedStatusBar',
    /**
     * Selector for Explorer Activity Bar
     */
    'ExplorerActivityBar',
    /**
     * Selector for Debug Activity Bar
     */
    'DebugActivityBar',
    'MaximizePanel',
    'MinimizePanel',
    /**
     * Selector for individual lines in the visible output panel.
     */
    'IndividualLinesInOutputPanel',
    /**
     * Individual notification.
     */
    'Notification',
    'IndividualNotification',
    /**
     * Message displayed in the nth Individual notification.
     */
    'NthNotificationMessage',
    /**
     * The (x) for the nth Individual notification.
     */
    'CloseButtonInNthNotification',
    /**
     * The selector for a button in the nth Individual notification.
     */
    'ButtonInNthNotification',
    /**
     * The number of problems (this is a number next to `Problems` text in the panel).
     */
    'ProblemsBadge',
    /**
     * Selector for the file name in a problem in the problems panel.
     */
    'FileNameInProblemsPanel',
    /**
     * Selector for the problem message in a problem in the problems panel.
     */
    'ProblemMessageInProblemsPanel',
    /**
     * Quick input container
     */
    'QuickInput',
    /**
     * Input box in the Quick Input
     */
    'QuickInputInput',
    /**
     * Input box in the quick open dropdown
     */
    'QuickOpenInput',
    /**
     * Selector for when quick open has been hidden.
     */
    'QuickOpenHidden',
    /**
     * Selector for individual items displayed in the quick open dropdown
     */
    'QuickOpenEntryLabel',
    /**
     * Selector for individual items that are focused and displayed in the quick open dropdown
     */
    'QuickOpenEntryLabelFocused',
    'QuickOpenEntryLabelFocused2',
    /**
     * Selector for the test activitybar/test explorer.
     */
    'TestActivityBar'
}

// Selector for container of notifications.
const messageBoxContainer = 'div.notifications-toasts.visible div.notification-toast-container';
// Selector for individual notification message.
const messageBoxSelector = `${messageBoxContainer} div.notification-list-item-message span`;
const quickOpen = 'div.monaco-quick-open-widget';
// Selector
// tslint:disable: no-unnecessary-class
export class QuickOpen {
    public static QUICK_OPEN = 'div.monaco-quick-open-widget';
    public static QUICK_OPEN_HIDDEN = 'div.monaco-quick-open-widget[aria-hidden="true"]';
    public static QUICK_OPEN_INPUT = `${QuickOpen.QUICK_OPEN} .quick-open-input input`;
    public static QUICK_OPEN_FOCUSED_ELEMENT = `${QuickOpen.QUICK_OPEN} .quick-open-tree .monaco-tree-row.focused .monaco-highlighted-label`;
    public static QUICK_OPEN_ENTRY_SELECTOR = 'div[aria-label="Quick Picker"] .monaco-tree-rows.show-twisties .monaco-tree-row .quick-open-entry';
    public static QUICK_OPEN_ENTRY_LABEL_SELECTOR = 'div[aria-label="Quick Picker"] .monaco-tree-rows.show-twisties .monaco-tree-row .quick-open-entry .label-name';
}

class QuickInput {
    public static QUICK_INPUT = '.quick-input-widget';
    public static QUICK_INPUT_INPUT = `${QuickInput.QUICK_INPUT} .quick-input-box input`;
    public static QUICK_INPUT_FOCUSED_ELEMENT = `${QuickInput.QUICK_INPUT} .quick-open-tree .monaco-tree-row.focused .monaco-highlighted-label`;
}

const selectors: Record<Selector, { stable: string } & { insider?: string }> = {
    [Selector.PythonExtensionStatusBar]: {
        stable: '.statusbar-item.statusbar-entry[id=\'ms-python.python\']'
    },
    [Selector.PyBootstrapStatusBar]: {
        stable: `.part.statusbar *[title='${pyBootstrapTooltip}'] a`,
        insider: `.part.statusbar *[title='${pyBootstrapTooltip}'] a`
    },
    [Selector.PyBootstrapActivatedStatusBar]: {
        stable: `.part.statusbar *[title='${pyBootstrapActivatedStatusBarTooltip}'] a`,
        insider: `.part.statusbar *[title='${pyBootstrapActivatedStatusBarTooltip}'] a`
    },
    [Selector.ColumnLineNumbnerStatusBar]: {
        stable: 'div.statusbar-item[title="Go to Line"] a',
        insider: 'div.statusbar-item[title="Go to Line"] a'
    },
    [Selector.ExplorerActivityBar]: {
        stable: '.composite.viewlet.explorer-viewlet'
    },
    [Selector.DebugActivityBar]: {
        stable: '.composite.viewlet.debug-viewlet'
    },
    [Selector.MaximizePanel]: {
        stable: '.part.panel.bottom a.icon.maximize-panel-action'
    },
    [Selector.MinimizePanel]: {
        stable: '.part.panel.bottom a.icon.minimize-panel-action'
    },
    [Selector.IndividualLinesInOutputPanel]: {
        stable: '.part.panel.bottom .view-lines .view-line span span'
    },
    [Selector.Notification]: {
        stable: '.notifications-toasts.visible .notification-toast-container .notification-list-item.expanded'
    },
    [Selector.NthNotificationMessage]: {
        stable: '.notifications-toasts.visible .notification-toast-container:nth-child({0}) .notification-list-item.expanded div.notification-list-item-message span'
    },
    [Selector.IndividualNotification]: {
        stable: messageBoxSelector
    },
    [Selector.CloseButtonInNthNotification]: {
        stable: '.notifications-toasts.visible .notification-toast-container:nth-child({0}) .notification-list-item.expanded .action-label.icon.clear-notification-action'
    },
    [Selector.ButtonInNthNotification]: {
        stable: '.notifications-toasts.visible .notification-toast-container:nth-child({0}) .notification-list-item.expanded .monaco-button.monaco-text-button[title=\'{1}\']'
    },
    [Selector.ProblemsBadge]: {
        stable: '.part.panel.bottom .action-item.checked .badge-content'
    },
    [Selector.FileNameInProblemsPanel]: {
        stable: '.part.panel.bottom .content .tree-container .monaco-tl-row .file-icon .label-name span span'
    },
    [Selector.ProblemMessageInProblemsPanel]: {
        stable: '.part.panel.bottom .content .tree-container .monaco-tl-row .marker-message-details'
    },
    [Selector.QuickOpenInput]: {
        stable: `${quickOpen} .quick-open-input input`
    },
    [Selector.QuickOpenEntryLabel]: {
        stable: 'div[aria-label="Quick Picker"] .monaco-tree-rows.show-twisties .monaco-tree-row .quick-open-entry .label-name'
    },
    [Selector.QuickOpenEntryLabelFocused]: {
        stable: 'div[aria-label="Quick Picker"] .monaco-tree-rows.show-twisties .monaco-tree-row.focused .quick-open-entry .label-name .monaco-highlighted-label .highlight'
    },
    [Selector.QuickOpenEntryLabelFocused2]: {
        // stable: '.monaco-tree-row.focused .monaco-icon-label-description-container .monaco-highlighted-label span'
        stable: '.monaco-tree-row.focused .monaco-icon-label-description-container .monaco-highlighted-label'
    },
    [Selector.QuickInputInput]: {
        stable: QuickInput.QUICK_INPUT_INPUT
    },
    [Selector.QuickInput]: {
        stable: QuickInput.QUICK_INPUT
    },
    [Selector.TestActivityBar]: {
        stable: '.composite.viewlet[id="workbench.view.extension.test"]'
    },
    [Selector.QuickOpenHidden]: {
        stable: QuickOpen.QUICK_OPEN_HIDDEN
    }
};

export function getSelector(selector: Selector, channel: Channel): string {
    const channelSelector = selectors[selector];
    return channelSelector[channel] || selectors[selector].stable;
}
