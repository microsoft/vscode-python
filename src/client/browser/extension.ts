// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { LanguageClientOptions, State } from 'vscode-languageclient';
import { LanguageClient } from 'vscode-languageclient/browser';
import { LanguageClientMiddlewareBase } from '../activation/languageClientMiddlewareBase';
import { LanguageServerType } from '../activation/types';
import { AppinsightsKey, PVSC_EXTENSION_ID, PYLANCE_EXTENSION_ID } from '../common/constants';
import { loadLocalizedStringsForBrowser } from '../common/utils/localizeHelpers';
import { EventName } from '../telemetry/constants';
import { createStatusItem } from './intellisenseStatus';

interface BrowserConfig {
    distUrl: string; // URL to Pylance's dist folder.
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Run in a promise and return early so that VS Code can go activate Pylance.
    await loadLocalizedStringsForBrowser();
    const pylanceExtension = vscode.extensions.getExtension(PYLANCE_EXTENSION_ID);
    if (pylanceExtension) {
        runPylance(context, pylanceExtension);
        return;
    }

    const changeDisposable = vscode.extensions.onDidChange(() => {
        const newPylanceExtension = vscode.extensions.getExtension(PYLANCE_EXTENSION_ID);
        if (newPylanceExtension) {
            changeDisposable.dispose();
            runPylance(context, newPylanceExtension);
        }
    });
}

async function runPylance(
    context: vscode.ExtensionContext,
    pylanceExtension: vscode.Extension<unknown>,
): Promise<void> {
    const { extensionPath, packageJSON } = pylanceExtension;
    const distUrl = `${extensionPath}/dist`;

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

        const middleware = new LanguageClientMiddlewareBase(
            undefined,
            LanguageServerType.Node,
            sendTelemetryEventBrowser,
            packageJSON.version,
        );
        middleware.connect();

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
            middleware,
        };

        const languageClient = new LanguageClient('python', 'Python Language Server', clientOptions, worker);

        languageClient.onDidChangeState((e): void => {
            // The client's on* methods must be called after the client has started, but if called too
            // late the server may have already sent a message (which leads to failures). Register
            // these on the state change to running to ensure they are ready soon enough.
            if (e.newState !== State.Running) {
                return;
            }

            context.subscriptions.push(
                vscode.commands.registerCommand('python.viewLanguageServerOutput', () =>
                    languageClient.outputChannel.show(),
                ),
            );

            languageClient.onTelemetry(
                (telemetryEvent: {
                    EventName: EventName;
                    Properties: { method: string };
                    Measurements: number | Record<string, number> | undefined;
                    Exception: Error | undefined;
                }) => {
                    const eventName = telemetryEvent.EventName || EventName.LANGUAGE_SERVER_TELEMETRY;
                    const formattedProperties = {
                        ...telemetryEvent.Properties,
                        // Replace all slashes in the method name so it doesn't get scrubbed by vscode-extension-telemetry.
                        method: telemetryEvent.Properties.method?.replace(/\//g, '.'),
                    };
                    sendTelemetryEventBrowser(
                        eventName,
                        telemetryEvent.Measurements,
                        formattedProperties,
                        telemetryEvent.Exception,
                    );
                },
            );
        });

        const disposable = languageClient.start();

        context.subscriptions.push(disposable);
        context.subscriptions.push(createStatusItem());
    } catch (e) {
        console.log(e);
    }
}

// Duplicate code from telemetry/index.ts to avoid pulling in winston,
// which doesn't support the browser.

let telemetryReporter: TelemetryReporter | undefined;
function getTelemetryReporter() {
    if (telemetryReporter) {
        return telemetryReporter;
    }
    const extensionId = PVSC_EXTENSION_ID;

    // eslint-disable-next-line global-require
    const { extensions } = require('vscode') as typeof import('vscode');
    const extension = extensions.getExtension(extensionId)!;
    const extensionVersion = extension.packageJSON.version;

    // eslint-disable-next-line global-require
    const Reporter = require('vscode-extension-telemetry').default as typeof TelemetryReporter;
    telemetryReporter = new Reporter(extensionId, extensionVersion, AppinsightsKey, true);

    return telemetryReporter;
}

function sendTelemetryEventBrowser(
    eventName: EventName,
    measuresOrDurationMs?: Record<string, number> | number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties?: any,
    ex?: Error,
): void {
    const reporter = getTelemetryReporter();
    const measures =
        typeof measuresOrDurationMs === 'number'
            ? { duration: measuresOrDurationMs }
            : measuresOrDurationMs || undefined;
    const customProperties: Record<string, string> = {};
    const eventNameSent = eventName as string;

    if (properties) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = properties as any;
        Object.getOwnPropertyNames(data).forEach((prop) => {
            if (data[prop] === undefined || data[prop] === null) {
                return;
            }
            try {
                // If there are any errors in serializing one property, ignore that and move on.
                // Else nothing will be sent.
                switch (typeof data[prop]) {
                    case 'string':
                        customProperties[prop] = data[prop];
                        break;
                    case 'object':
                        customProperties[prop] = 'object';
                        break;
                    default:
                        customProperties[prop] = data[prop].toString();
                        break;
                }
            } catch (exception) {
                console.error(`Failed to serialize ${prop} for ${eventName}`, exception);
            }
        });
    }

    // Add shared properties to telemetry props (we may overwrite existing ones).
    // Removed in the browser; there's no setSharedProperty.
    // Object.assign(customProperties, sharedProperties);

    if (ex) {
        const errorProps = {
            errorName: ex.name,
            errorMessage: ex.message,
            errorStack: ex.stack ?? '',
        };
        Object.assign(customProperties, errorProps);

        // To avoid hardcoding the names and forgetting to update later.
        const errorPropNames = Object.getOwnPropertyNames(errorProps);
        reporter.sendTelemetryErrorEvent(eventNameSent, customProperties, measures, errorPropNames);
    } else {
        reporter.sendTelemetryEvent(eventNameSent, customProperties, measures);
    }

    if (process.env && process.env.VSC_PYTHON_LOG_TELEMETRY) {
        console.error(
            `Telemetry Event : ${eventNameSent} Measures: ${JSON.stringify(measures)} Props: ${JSON.stringify(
                customProperties,
            )} `,
        );
    }
}
