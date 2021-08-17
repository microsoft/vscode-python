// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { LanguageClientOptions, State } from 'vscode-languageclient';
import { LanguageClient } from 'vscode-languageclient/browser';
import { LanguageClientMiddlewareBase } from '../activation/languageClientMiddlewareBase';
import { ILSExtensionApi } from '../activation/node/languageServerFolderService';
import { LanguageServerType } from '../activation/types';
import { PYLANCE_EXTENSION_ID } from '../common/constants';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';

interface BrowserConfig {
    distUrl: string; // URL to Pylance's dist folder.
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Run in a promise and return early so that VS Code can go activate Pylance.
    runPylance(context);
}

async function runPylance(context: vscode.ExtensionContext): Promise<void> {
    const pylanceExtension = vscode.extensions.getExtension<ILSExtensionApi>(PYLANCE_EXTENSION_ID);
    const pylanceApi = await pylanceExtension?.activate();
    if (!pylanceApi?.languageServerFolder) {
        throw new Error('Could not find Pylance extension');
    }

    const { path: distUrl, version } = await pylanceApi.languageServerFolder();

    try {
        const worker = new Worker(`${distUrl}/browser.server.bundle.js`);

        // Pass the configuration as the first message to the worker so it can
        // have info like the URL of the dist folder early enough.
        //
        // This is the same method used by the TS worker:
        // https://github.com/microsoft/vscode/blob/90aa979bb75a795fd8c33d38aee263ea655270d0/extensions/typescript-language-features/src/tsServer/serverProcess.browser.ts#L55
        const config: BrowserConfig = {
            distUrl,
        };
        worker.postMessage(config);

        const clientOptions: LanguageClientOptions = {
            // Register the server for python source files.
            documentSelector: [
                {
                    language: 'python',
                },
            ],
            synchronize: {
                // Synchronize the setting section to the server.
                configurationSection: ['python'],
            },
            middleware: new LanguageClientMiddlewareBase(undefined, LanguageServerType.Node, version),
        };

        const languageClient = new LanguageClient('python', 'Python Language Server', clientOptions, worker);

        languageClient.onDidChangeState((e) => {
            // The client's on* methods must be called after the client has started, but if called too
            // late the server may have already sent a message (which leads to failures). Register
            // these on the state change to running to ensure they are ready soon enough.
            if (e.newState !== State.Running) {
                return;
            }

            languageClient.onTelemetry((telemetryEvent) => {
                const eventName = telemetryEvent.EventName || EventName.LANGUAGE_SERVER_TELEMETRY;
                const formattedProperties = {
                    ...telemetryEvent.Properties,
                    // Replace all slashes in the method name so it doesn't get scrubbed by vscode-extension-telemetry.
                    method: telemetryEvent.Properties.method?.replace(/\//g, '.'),
                };
                sendTelemetryEvent(
                    eventName,
                    telemetryEvent.Measurements,
                    formattedProperties,
                    telemetryEvent.Exception,
                );
            });
        });

        const disposable = languageClient.start();

        context.subscriptions.push(disposable);
    } catch (e) {
        console.log(e);
    }
}
