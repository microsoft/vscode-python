// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import type { LanguageClientOptions } from 'vscode-languageclient';
import { LanguageClient } from 'vscode-languageclient/browser';
import { PYLANCE_EXTENSION_ID } from './common/constants';

declare const Worker: {
    new(stringUrl: string): any;
};

const pylancePath = 'dist/browser.server.js'

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const pylanceExtension = vscode.extensions.getExtension(PYLANCE_EXTENSION_ID);
    if (!pylanceExtension) {
        throw new Error('Could not find Pylance extension');
    }

    await pylanceExtension.activate();

    const serverMain = vscode.Uri.joinPath(pylanceExtension.extensionUri, pylancePath);
    try {
        const worker = new Worker(serverMain.toString());

        const clientOptions: LanguageClientOptions = {
            // Register the server for python source files.
            documentSelector: [
                {
                    scheme: 'file',
                    language: 'python',
                },
            ],
            synchronize: {
                // Synchronize the setting section to the server.
                configurationSection: ['python', 'pyright'],
            },
            // TODO: replace cancellation strategy with SharedArrayBuffer (shared worker memory)
            // connectionOptions: { cancellationStrategy: cancellationStrategy },
        };

        const languageClient = new LanguageClient('python', 'Pylance', clientOptions, worker);
        const disposable = languageClient.start();

        context.subscriptions.push(disposable);

        languageClient.onTelemetry((eventInfo) => {
            console.log(`onTelemetry EventName: ${eventInfo.EventName}`);

            for (const [prop, value] of Object.entries(eventInfo.Properties)) {
                console.log(`               Property: ${prop} : ${value}`);
            }

            for (const [measure, value] of Object.entries(eventInfo.Measurements)) {
                console.log(`               Measurement: ${measure} : ${value}`);
            }
        });
    } catch (e) {
        console.log(e);
    }
}
