// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { Common, LanguageService } from '../common/utils/localize';
import { noop } from '../common/utils/misc';

export function createStatusItem(): vscode.Disposable {
    if ('createLanguageStatusItem' in vscode.languages) {
        const statusItem = vscode.languages.createLanguageStatusItem('python.projectStatus', {
            language: 'python',
        });
        statusItem.name = LanguageService.statusItem.name();
        statusItem.severity = vscode.LanguageStatusSeverity.Warning;
        statusItem.text = LanguageService.statusItem.text();
        statusItem.detail = LanguageService.statusItem.detail();
        statusItem.command = {
            title: Common.learnMore(),
            command: 'vscode.open',
            arguments: [vscode.Uri.parse('https://aka.ms/AAdzyh4')],
        };
        return statusItem;
    }
    return { dispose: noop };
}
