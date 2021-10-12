// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// IMPORTANT: Do not import any node fs related modules here, as they do not work in browser.
import * as vscode from 'vscode';

export function createStatusItem(): vscode.Disposable {
    // TODO: Note strings are not localized here yet. Localizing strings here
    // require us to use browser based fs APIs provided by VSCode:
    // https://github.com/microsoft/vscode-python/issues/17712
    if ('createLanguageStatusItem' in vscode.languages) {
        const statusItem = vscode.languages.createLanguageStatusItem('python.projectStatus', {
            language: 'python',
        });
        statusItem.name = 'Python IntelliSense Status';
        statusItem.severity = vscode.LanguageStatusSeverity.Warning;
        statusItem.text = 'Partial Mode';
        statusItem.detail = 'Limited IntelliSense provided by Pylance';
        statusItem.command = {
            title: 'Learn More',
            command: 'vscode.open',
            arguments: [vscode.Uri.parse('https://aka.ms/AAdzyh4')],
        };
        return statusItem;
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return { dispose: () => {} };
}
