// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { inject, injectable } from 'inversify';
import { CancellationToken, TestItem } from 'vscode';
import { execCode } from '../../../common/process/internal/python';
import { UNITTEST_PROVIDER } from '../../common/constants';
import { ITestRunner, Options, TestDiscoveryOptions } from '../../common/types';
import { ITestDiscovery, PythonTestData } from '../common/types';
import { unittestGetTestFolders, unittestGetTestPattern } from './arguments';
import { RawDiscoveredTests, RawTest, RawTestParent } from '../../common/services/types';
import { WorkspaceTestRoot } from '../common/workspaceTestRoot';
import { updateTestRoot } from '../common/testItemUtilities';

function getTestIds(content: string): string[] {
    let startedCollecting = false;
    return content
        .split(/\r?\n/g)
        .map((line) => {
            if (!startedCollecting) {
                if (line === 'start') {
                    startedCollecting = true;
                }
                return '';
            }
            return line.trim();
        })
        .filter((line) => line.length > 0);
}

function testDiscoveryParser(
    cwd: string,
    testDir: string,
    testIds: string[],
    token: CancellationToken | undefined,
): Promise<RawDiscoveredTests> {
    const parents: RawTestParent[] = [];
    const tests: RawTest[] = [];

    for (const testId of testIds) {
        if (token?.isCancellationRequested) {
            break;
        }

        const parts = testId.split(':');

        // At minimum a `unittest` test will have a file, class, function, and line number
        // E.g:
        // test_math.TestMathMethods.test_numbers:5
        // test_math.TestMathMethods.test_numbers2:9
        if (parts.length > 3) {
            const lineNo = parts.pop();
            const functionName = parts.pop();
            const className = parts.pop();
            const fileName = parts.pop();
            const folders = parts;
            const pyFileName = `${fileName}.py`;
            const relPath = `./${[...folders, pyFileName].join('/')}`;

            if (functionName && className && fileName && lineNo) {
                const collectionId = `${relPath}::${className}`;
                const fileId = relPath;
                tests.push({
                    id: `${relPath}::${className}::${functionName}`,
                    name: functionName,
                    parentid: collectionId,
                    source: `${relPath}:${lineNo}`,
                });

                const rawCollection = parents.find((c) => c.id === collectionId);
                if (!rawCollection) {
                    parents.push({
                        id: collectionId,
                        name: className,
                        parentid: fileId,
                        kind: 'suite',
                    });
                }

                const rawFile = parents.find((f) => f.id === fileId);
                if (!rawFile) {
                    parents.push({
                        id: fileId,
                        name: pyFileName,
                        parentid: folders.length === 0 ? testDir : `./${folders.join('/')}`,
                        kind: 'file',
                        relpath: relPath,
                    } as RawTestParent);
                }

                const folderParts = [];
                for (const folder of folders) {
                    const parentId = folderParts.length === 0 ? testDir : `${folderParts.join('/')}`;
                    folderParts.push(folder);
                    const pathId = `${folderParts.join('/')}`;
                    const rawFolder = parents.find((f) => f.id === pathId);
                    if (!rawFolder) {
                        parents.push({
                            id: pathId,
                            name: folder,
                            parentid: parentId,
                            kind: 'folder',
                            relpath: pathId,
                        } as RawTestParent);
                    }
                }
            }
        }
    }

    return Promise.resolve({
        rootid: testDir,
        root: path.isAbsolute(testDir) ? testDir : path.resolve(cwd, testDir),
        parents,
        tests,
    });
}

@injectable()
export class UnittestDiscoveryService implements ITestDiscovery {
    constructor(@inject(ITestRunner) private readonly runner: ITestRunner) {}

    public async discoverWorkspaceTests(options: TestDiscoveryOptions): Promise<TestItem<PythonTestData> | undefined> {
        const startDir = unittestGetTestFolders(options.args)[0];
        const pattern = unittestGetTestPattern(options.args);
        const discoveryScript = `
import unittest
import inspect
loader = unittest.TestLoader()
suites = loader.discover("${startDir}", pattern="${pattern}")
def get_sourceline(obj):
    s, n = inspect.getsourcelines(obj)
    for i, v in enumerate(s):
        if v.strip().startswith('def'):
            return str(n+i)
    return '*'
print("start") #Don't remove this line
for suite in suites._tests:
    for cls in suite._tests:
        try:
            for m in cls._tests:
                tm = getattr(m, m._testMethodName)
                print(m.id().replace('.',':') + ":" + get_sourceline(tm))
        except:
            pass
`;

        const runOptions: Options = {
            // unittest needs to load modules in the workspace
            // isolating it breaks unittest discovery
            args: execCode(discoveryScript, false),
            cwd: options.cwd,
            workspaceFolder: options.workspaceFolder,
            token: options.token,
            outChannel: options.outChannel,
        };

        const content = await this.runner.run(UNITTEST_PROVIDER, runOptions);
        const rawTestData = await testDiscoveryParser(
            options.cwd,
            path.isAbsolute(startDir) ? path.relative(options.cwd, startDir) : startDir,
            getTestIds(content),
            options.token,
        );

        const testRoot = WorkspaceTestRoot.create({
            id: rawTestData.root,
            uri: options.workspaceFolder,
            label: path.basename(rawTestData.root),
        });
        if (rawTestData.tests.length > 0) {
            updateTestRoot(testRoot, rawTestData);
            return testRoot;
        }
        return undefined;
    }
}
