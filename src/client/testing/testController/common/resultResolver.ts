// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, TestController, Uri } from 'vscode';
import * as util from 'util';
import * as path from 'path';
import { DiscoveredTestPayload, DiscoveredTestType } from './types';
import { TestProvider } from '../../types';
import { traceError } from '../../../logging';
import { Testing } from '../../../common/utils/localize';
import { ErrorTestItemOptions, createErrorTestItem } from './testItemUtilities';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';

export class ITestResultResolver {
    testController: TestController;

    testProvider: TestProvider;

    constructor(testController: TestController, testProvider: TestProvider, private workspaceUri: Uri) {
        this.testController = testController;
        this.testProvider = testProvider;
    }

    public resolveDiscovery(payload: DiscoveredTestPayload, token?: CancellationToken): Promise<void> {
        const workspacePath = this.workspaceUri.fsPath;
        const workspaceFilePath = ''; // FIX THIS
        const isMultiroot = false; // FIX THIS

        const rawTestData = payload;
        if (!rawTestData) {
            // No test data is available
            return Promise.resolve();
        }

        // Check if there were any errors in the discovery process.
        if (rawTestData.status === 'error') {
            const testingErrorConst =
                this.testProvider === 'pytest' ? Testing.errorPytestDiscovery : Testing.errorUnittestDiscovery;
            const { errors } = rawTestData;
            traceError(testingErrorConst, '\r\n', errors!.join('\r\n\r\n'));

            let errorNode = this.testController.items.get(`DiscoveryError:${workspacePath}`);
            const message = util.format(
                `${testingErrorConst} ${Testing.seePythonOutput}\r\n`,
                errors!.join('\r\n\r\n'),
            );

            if (errorNode === undefined) {
                const options = buildErrorNodeOptions(this.workspaceUri, message, this.testProvider);
                errorNode = createErrorTestItem(this.testController, options);
                this.testController.items.add(errorNode);
            }
            errorNode.error = message;
        } else {
            // Remove the error node if necessary,
            // then parse and insert test data.
            this.testController.items.delete(`DiscoveryError:${workspacePath}`);

            // Wrap the data under a root node named after the test provider.
            const wrappedTests = rawTestData.tests;

            // If we are in a multiroot workspace scenario, wrap the current folder's test result in a tree under the overall root + the current folder name.
            let rootPath = workspacePath;
            let childrenRootPath = rootPath;
            let childrenRootName = path.basename(rootPath);

            if (isMultiroot) {
                rootPath = workspaceFilePath!;
                childrenRootPath = workspacePath;
                childrenRootName = path.basename(workspacePath);
            }

            const children = [
                {
                    path: childrenRootPath,
                    name: childrenRootName,
                    type_: 'folder' as DiscoveredTestType,
                    id_: childrenRootPath,
                    children: wrappedTests ? [wrappedTests] : [],
                },
            ];

            // Update the raw test data with the wrapped data.
            rawTestData.tests = {
                path: rootPath,
                name: this.testProvider,
                type_: 'folder',
                id_: rootPath,
                children,
            };

            if (rawTestData.tests) {
                // If the test root for this folder exists: Workspace refresh, update its children.
                // Otherwise, it is a freshly discovered workspace, and we need to create a new test root and populate the test tree.
                populateTestTree(this.testController, rawTestData.tests, undefined, this, token);
            } else {
                // Delete everything from the test controller.
                this.testController.items.replace([]);
            }
        }

        sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_DONE, undefined, { tool: this.testProvider, failed: false });
        return Promise.resolve();
    }
}
export function buildErrorNodeOptions(uri: Uri, message: string, testType: string): ErrorTestItemOptions {
    const labelText = testType === 'pytest' ? 'Pytest Discovery Error' : 'Unittest Discovery Error';
    return {
        id: `DiscoveryError:${uri.fsPath}`,
        label: `${labelText} [${path.basename(uri.fsPath)}]`,
        error: message,
    };
}
