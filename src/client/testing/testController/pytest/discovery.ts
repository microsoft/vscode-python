// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { flatten } from 'lodash';
import * as path from 'path';
import { TestItem, Uri } from 'vscode';
import { runAdapter } from '../../../common/process/internal/scripts/testing_tools';
import { TestDiscoveryOptions } from '../../common/types';
import { ITestDiscoveryHelper } from '../common/discoveryHelper';
import { updateTestRoot } from '../common/testItemUtilities';
import { ITestDiscovery, PythonTestData } from '../common/types';
import { WorkspaceTestRoot } from '../common/workspaceTestRoot';
import { getTestFolders, prepareArgumentsForDiscovery } from './arguments';

export class PytestDiscoveryService implements ITestDiscovery {
    constructor(private readonly discoveryHelper: ITestDiscoveryHelper) {}

    public async discoverWorkspaceTests(options: TestDiscoveryOptions): Promise<TestItem<PythonTestData> | undefined> {
        // Get individual test directories selected by the user.
        const testDirectories = getTestFolders(options.args);

        // Set arguments to use with pytest discovery script.
        const args = runAdapter(['discover', 'pytest', '--', ...prepareArgumentsForDiscovery(options)]);

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
        const testRoot = WorkspaceTestRoot.create({
            id: 'pytest',
            uri: options.workspaceFolder,
            label: 'Pytest Tests',
        });

        if (rawTestData.length === 1) {
            if (rawTestData[0].tests.length > 0) {
                updateTestRoot(testRoot, rawTestData[0]);
            }
        } else if (rawTestData.length > 1) {
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
        }
        return testRoot.children.size > 0 ? testRoot : undefined;
    }
}
