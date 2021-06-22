// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { flatten } from 'lodash';
import * as path from 'path';
import { TestItem, Uri } from 'vscode';
import { runAdapter } from '../../../common/process/internal/scripts/testing_tools';
import { TestDiscoveryOptions } from '../../common/types';
import { updateTestRoot } from '../common/testItemUtilities';
import { ITestDiscovery, ITestDiscoveryHelper, PythonTestData } from '../common/types';
import { WorkspaceTestRoot } from '../common/workspaceTestRoot';
import { pytestGetTestFolders, preparePytestArgumentsForDiscovery } from './arguments';

@injectable()
export class PytestDiscoveryService implements ITestDiscovery {
    constructor(@inject(ITestDiscoveryHelper) private readonly discoveryHelper: ITestDiscoveryHelper) {}

    public async discoverWorkspaceTests(options: TestDiscoveryOptions): Promise<TestItem<PythonTestData> | undefined> {
        // Get individual test directories selected by the user.
        const testDirectories = pytestGetTestFolders(options.args);

        // Set arguments to use with pytest discovery script.
        const args = runAdapter(['discover', 'pytest', '--', ...preparePytestArgumentsForDiscovery(options)]);

        // Build options for each directory selected by the user.
        let discoveryRunOptions: TestDiscoveryOptions[];
        if (testDirectories.length === 0) {
            // User did not provide any directory. So we don't need to tweak arguments.
            discoveryRunOptions = [
                {
                    ...options,
                    args,
                },
            ];
        } else {
            discoveryRunOptions = testDirectories.map((testDir) => {
                // Add test directory as a positional argument.
                return {
                    ...options,
                    args: [...args, testDir],
                };
            });
        }

        // This is where we execute pytest discovery via a common helper.
        const rawTestData = flatten(
            await Promise.all(
                discoveryRunOptions.map((o) => {
                    return this.discoveryHelper.runTestDiscovery(o);
                }),
            ),
        );

        // If nothing was found, return empty.
        if (rawTestData.length === 0) {
            return undefined;
        }

        // This is the root object for all `pytest`
        let testRoot: TestItem<WorkspaceTestRoot>;

        if (rawTestData.length === 1) {
            testRoot = WorkspaceTestRoot.create({
                id: rawTestData[0].root,
                uri: options.workspaceFolder,
                label: path.basename(rawTestData[0].root),
            });
            if (rawTestData[0].tests.length > 0) {
                updateTestRoot(testRoot, rawTestData[0]);
                return testRoot;
            }
        } else if (rawTestData.length > 1) {
            testRoot = WorkspaceTestRoot.create({
                id: options.workspaceFolder.fsPath,
                uri: options.workspaceFolder,
                label: path.basename(options.workspaceFolder.fsPath),
            });
            testRoot.description =
                'This node is the root for all tests discovered with pytest, and may contain tests from multiple roots.';

            rawTestData.forEach((data) => {
                if (data.tests.length > 0) {
                    const subRootItem = WorkspaceTestRoot.create({
                        id: data.root,
                        uri: Uri.file(data.root),
                        label: path.basename(data.root),
                    });
                    testRoot.addChild(subRootItem);
                    updateTestRoot(subRootItem, data);
                }
            });
            return testRoot;
        }

        return undefined;
    }
}
