// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Quality } from '../../../out/smoke/vscode/application';
import { context } from './application';
import { pyBootstrapActivatedStatusBarTooltip, pyBootstrapTooltip } from './constants';

type Selector = 'PyBootstrapStatusBar' | 'ColumnLineNumbnerStatusBar' |
    'ExplorerActivityBar' | 'DebugSideBar' | 'PythonExtensionStatusBar' |
    'PyBootstrapActivatedStatusBar' | 'MaximizePanel' | 'MinimizePanel' |
    'IndividualLinesInOutputPanel' |
    'Notification' | 'NthNotification' | 'CloseButtonInNthNotification' | 'ButtonInNthNotification' |
    'ProblemsBadge' |
    'FileNameInProblemsPanel' | 'ProblemMessageInProblemsPanel';

const selectors: { [key in Selector]: { [keyP in Quality]?: string } } = {
    PythonExtensionStatusBar: {
        [Quality.Stable]: '.statusbar-item.statusbar-entry[id=\'ms-python.python\']'
    },
    // Selector for the Bootstrap extensions statubar item.
    PyBootstrapStatusBar: {
        [Quality.Stable]: `.part.statusbar *[title='${pyBootstrapTooltip}'] a`,
        [Quality.Insiders]: `.part.statusbar *[title='${pyBootstrapTooltip}'] a`
    },
    // Selector for the statusbar created by Bootstrap extensions when Python Extension gets activated.
    PyBootstrapActivatedStatusBar: {
        [Quality.Stable]: `.part.statusbar *[title='${pyBootstrapActivatedStatusBarTooltip}'] a`,
        [Quality.Insiders]: `.part.statusbar *[title='${pyBootstrapActivatedStatusBarTooltip}'] a`
    },
    // Selector for the VSC statubar item displaying the line & column.
    // This is the item on the bottom right e.g. `Ln 12, Col 56`.
    ColumnLineNumbnerStatusBar: {
        [Quality.Stable]: 'div.statusbar-item[title="Go to Line"] a',
        [Quality.Insiders]: 'div.statusbar-item[title="Go to Line"] a'
    },
    // Selector for Explorer Activity Bar
    ExplorerActivityBar: {
        [Quality.Stable]: '.composite.viewlet.explorer-viewlet'
    },
    // Selector for Debug Side Bar
    DebugSideBar: {
        [Quality.Stable]: '.composite.viewlet.debug-viewlet'
    },
    MaximizePanel: {
        [Quality.Stable]: '.part.panel.bottom a.icon.maximize-panel-action'
    },
    MinimizePanel: {
        [Quality.Stable]: '.part.panel.bottom a.icon.minimize-panel-action'
    },
    // Selector for individual lines in the visible output panel.
    IndividualLinesInOutputPanel: {
        [Quality.Stable]: '.part.panel.bottom .view-lines .view-line span span'
    },
    // Individual notification.
    Notification: {
        [Quality.Stable]: '.notifications-toasts.visible .notification-toast-container .notification-list-item.expanded'
    },
    // nth Individual notification.
    NthNotification: {
        [Quality.Stable]: '.notifications-toasts.visible .notification-toast-container:nth-child({0}) .notification-list-item.expanded'
    },
    // The (x) for the nth Individual notification.
    CloseButtonInNthNotification: {
        [Quality.Stable]: '.notifications-toasts.visible .notification-toast-container:nth-child({0}) .notification-list-item.expanded .action-label.icon.clear-notification-action'
    },
    // The (x) for the nth Individual notification.
    ButtonInNthNotification: {
        [Quality.Stable]: '.notifications-toasts.visible .notification-toast-container:nth-child({0}) .notification-list-item.expanded .monaco-button.monaco-text-button[title=\'{1}\']'
    },
    // The number of problems (this is a number next to `Problems` text in the panel)
    ProblemsBadge: {
        [Quality.Stable]: '.part.panel.bottom .action-item.checked .badge-content'
    },
    // Selector for the file name in a problem in the problems panel.
    FileNameInProblemsPanel: {
        [Quality.Stable]: '.part.panel.bottom .content .tree-container .monaco-tl-row .file-icon .label-name span span'
    },
    // Selector for the problem message in a problem in the problems panel.
    ProblemMessageInProblemsPanel: {
        [Quality.Stable]: '.part.panel.bottom .content .tree-container .monaco-tl-row .marker-message-details'
    }
};

export function getSelector(selector: Selector): string {
    const channelSelector = selectors[selector];
    return channelSelector[context.options.quality] || selectors[selector][Quality.Stable]!;
}
