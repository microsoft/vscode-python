// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, TestController, Uri, MarkdownString } from 'vscode';
import * as util from 'util';
import { DiscoveredTestPayload } from './types';
import { TestProvider } from '../../types';
import { traceError, traceWarn } from '../../../logging';
import { Testing } from '../../../common/utils/localize';
import { createErrorTestItem } from './testItemUtilities';
import { buildErrorNodeOptions, populateTestTree } from './utils';
import { TestItemIndex } from './testItemIndex';
import { PROJECT_ID_SEPARATOR } from './projectUtils';

/**
 * Stateless handler for processing discovery payloads and building/updating the TestItem tree.
 * This handler is shared across all workspaces and contains no instance state.
 */
export class TestDiscoveryHandler {
    /**
     * Process discovery payload and update test tree
     * Pure function - no instance state used
     */
    public processDiscovery(
        payload: DiscoveredTestPayload,
        testController: TestController,
        testItemIndex: TestItemIndex,
        workspaceUri: Uri,
        testProvider: TestProvider,
        token?: CancellationToken,
        projectId?: string,
        projectName?: string,
    ): void {
        if (!payload) {
            // No test data is available
            return;
        }

        const workspacePath = workspaceUri.fsPath;
        const rawTestData = payload as DiscoveredTestPayload;

        // Check if there were any errors in the discovery process.
        if (rawTestData.status === 'error') {
            this.createErrorNode(testController, workspaceUri, rawTestData.error, testProvider, projectId, projectName);
        } else {
            // remove error node only if no errors exist.
            const errorNodeId = projectId
                ? `${projectId}${PROJECT_ID_SEPARATOR}DiscoveryError:${workspacePath}`
                : `DiscoveryError:${workspacePath}`;
            testController.items.delete(errorNodeId);
        }

        if (rawTestData.tests || rawTestData.tests === null) {
            // if any tests exist, they should be populated in the test tree, regardless of whether there were errors or not.
            // parse and insert test data.

            // Clear existing mappings before rebuilding test tree
            testItemIndex.clear();

            // If the test root for this folder exists: Workspace refresh, update its children.
            // Otherwise, it is a freshly discovered workspace, and we need to create a new test root and populate the test tree.
            // Note: populateTestTree will call testItemIndex.registerTestItem() for each discovered test
            populateTestTree(
                testController,
                rawTestData.tests,
                undefined,
                {
                    runIdToTestItem: testItemIndex.runIdToTestItemMap,
                    runIdToVSid: testItemIndex.runIdToVSidMap,
                    vsIdToRunId: testItemIndex.vsIdToRunIdMap,
                },
                token,
                projectId,
                projectName,
            );
        }
    }

    /**
     * Create an error node for discovery failures
     */
    public createErrorNode(
        testController: TestController,
        workspaceUri: Uri,
        error: string[] | undefined,
        testProvider: TestProvider,
        projectId?: string,
        projectName?: string,
    ): void {
        const workspacePath = workspaceUri.fsPath;
        const testingErrorConst =
            testProvider === 'pytest' ? Testing.errorPytestDiscovery : Testing.errorUnittestDiscovery;

        traceError(testingErrorConst, 'for workspace: ', workspacePath, '\r\n', error?.join('\r\n\r\n') ?? '');

        // For unittest in project-based mode, check if the error might be caused by nested project imports
        // This helps users understand that import errors from nested projects can be safely ignored
        // if those tests are covered by a different project with the correct environment.
        if (testProvider === 'unittest' && projectId) {
            const errorText = error?.join(' ') ?? '';
            const isImportError =
                errorText.includes('ModuleNotFoundError') ||
                errorText.includes('ImportError') ||
                errorText.includes('No module named');

            if (isImportError) {
                const warningMessage =
                    '--- ' +
                    `[test-by-project] Import error during unittest discovery for project at ${workspacePath}. ` +
                    'This may be caused by test files in nested project directories that require different dependencies. ' +
                    'If these tests are discovered successfully by their own project (with the correct Python environment), ' +
                    'this error can be safely ignored. To avoid this, consider excluding nested project paths from parent project discovery. ' +
                    '---';
                traceWarn(warningMessage);
            }
        }

        const errorNodeId = projectId
            ? `${projectId}${PROJECT_ID_SEPARATOR}DiscoveryError:${workspacePath}`
            : `DiscoveryError:${workspacePath}`;
        let errorNode = testController.items.get(errorNodeId);
        const message = util.format(
            `${testingErrorConst} ${Testing.seePythonOutput}\r\n`,
            error?.join('\r\n\r\n') ?? '',
        );

        if (errorNode === undefined) {
            const options = buildErrorNodeOptions(workspaceUri, message, testProvider, projectName);
            // Update the error node ID to include project scope if applicable
            options.id = errorNodeId;
            errorNode = createErrorTestItem(testController, options);
            testController.items.add(errorNode);
        }

        const errorNodeLabel: MarkdownString = new MarkdownString(
            `[Show output](command:python.viewOutput) to view error logs`,
        );
        errorNodeLabel.isTrusted = true;
        errorNode.error = errorNodeLabel;
    }
}
