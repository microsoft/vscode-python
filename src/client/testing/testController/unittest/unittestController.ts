// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as util from 'util';
import { inject, injectable, named } from 'inversify';
import { CancellationToken, TestController, TestItem, Uri, WorkspaceFolder } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { IConfigurationService } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { UNITTEST_PROVIDER } from '../../common/constants';
import { ITestRunner, Options, TestDiscoveryOptions } from '../../common/types';
import {
    ITestFrameworkController,
    ITestRun,
    ITestsRunner,
    RawDiscoveredTests,
    RawTest,
    RawTestParent,
    TestData,
} from '../common/types';
import { unittestGetTestFolders, unittestGetTestPattern } from './arguments';
import { execCode } from '../../../common/process/internal/python';
import {
    createErrorTestItem,
    createWorkspaceRootTestItem,
    getNodeByUri,
    getWorkspaceNode,
    updateTestItemFromRawData,
} from '../common/testItemUtilities';
import { traceError } from '../../../common/logger';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';

@injectable()
export class UnittestController implements ITestFrameworkController {
    private readonly testData: Map<string, RawDiscoveredTests> = new Map();

    private discovering: Map<string, Deferred<void>> = new Map();

    private idToRawData: Map<string, TestData> = new Map();

    constructor(
        @inject(ITestRunner) private readonly discoveryRunner: ITestRunner,
        @inject(ITestsRunner) @named(UNITTEST_PROVIDER) private readonly runner: ITestsRunner,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
    ) {}

    public async resolveChildren(testController: TestController, item: TestItem): Promise<void> {
        const workspace = this.workspaceService.getWorkspaceFolder(item.uri);
        if (workspace) {
            // if we are still discovering then wait
            const discovery = this.discovering.get(workspace.uri.fsPath);
            if (discovery) {
                await discovery.promise;
            }

            // see if we have raw test data
            const rawTestData = this.testData.get(workspace.uri.fsPath);
            if (rawTestData) {
                if (rawTestData.root === item.id) {
                    if (rawTestData.tests.length === 0) {
                        testController.items.delete(item.id);
                        return Promise.resolve();
                    }

                    if (rawTestData.tests.length > 0) {
                        updateTestItemFromRawData(item, testController, this.idToRawData, item.id, [rawTestData]);
                    } else {
                        this.idToRawData.delete(item.id);
                        testController.items.delete(item.id);
                    }
                } else {
                    const workspaceNode = getWorkspaceNode(item, this.idToRawData);
                    if (workspaceNode) {
                        updateTestItemFromRawData(item, testController, this.idToRawData, workspaceNode.id, [
                            rawTestData,
                        ]);
                    }
                }
            } else {
                const workspaceNode = getWorkspaceNode(item, this.idToRawData);
                if (workspaceNode) {
                    testController.items.delete(workspaceNode.id);
                }
            }
        }
        return Promise.resolve();
    }

    public async refreshTestData(testController: TestController, uri: Uri, token?: CancellationToken): Promise<void> {
        sendTelemetryEvent(EventName.UNITTEST_DISCOVERING, undefined, { tool: 'unittest' });
        const workspace = this.workspaceService.getWorkspaceFolder(uri);
        if (workspace) {
            // Discovery is expensive. So if it is already running then use the promise
            // from the last run
            const previous = this.discovering.get(workspace.uri.fsPath);
            if (previous) {
                return previous.promise;
            }

            const settings = this.configService.getSettings(workspace.uri);
            const options: TestDiscoveryOptions = {
                workspaceFolder: workspace.uri,
                cwd: settings.testing.cwd ?? workspace.uri.fsPath,
                args: settings.testing.unittestArgs,
                ignoreCache: true,
                token,
            };

            const startDir = unittestGetTestFolders(options.args)[0];
            const pattern = unittestGetTestPattern(options.args);
            const discoveryScript = `
import unittest
import inspect

def get_sourceline(obj):
    s, n = inspect.getsourcelines(obj)
    for i, v in enumerate(s):
        if v.strip().startswith('def'):
            return str(n+i)
    return '*'

def generate_test_cases(suite):
    for test in suite:
        if isinstance(test, unittest.TestCase):
            yield test
        else:
            yield from generate_test_cases(test)

loader = unittest.TestLoader()
suite = loader.discover("${startDir}", pattern="${pattern}")

print("start")  # Don't remove this line
loader_errors = []
for s in generate_test_cases(suite):
    tm = getattr(s, s._testMethodName)
    testId = s.id()
    if testId.startswith("unittest.loader._FailedTest"):
        loader_errors.append(s._exception)
    else:
        print(testId.replace(".", ":") + ":" + get_sourceline(tm))

for error in loader_errors:
    try:
        print("=== exception start ===")
        print(error.msg)
        print("=== exception end ===")
    except:
        pass
`;

            const runOptions: Options = {
                // unittest needs to load modules in the workspace
                // isolating it breaks unittest discovery
                args: execCode(discoveryScript),
                cwd: options.cwd,
                workspaceFolder: options.workspaceFolder,
                token: options.token,
                outChannel: options.outChannel,
            };

            const deferred = createDeferred<void>();
            this.discovering.set(workspace.uri.fsPath, deferred);

            let rawTestData: RawDiscoveredTests | undefined;
            try {
                const content = await this.discoveryRunner.run(UNITTEST_PROVIDER, runOptions);
                rawTestData = await testDiscoveryParser(
                    options.cwd,
                    path.isAbsolute(startDir) ? path.relative(options.cwd, startDir) : startDir,
                    getTestIds(content),
                    options.token,
                );
                this.testData.set(workspace.uri.fsPath, rawTestData);

                const exceptions = getTestDiscoveryExceptions(content);
                if (exceptions.length === 0) {
                    // Remove error node
                    testController.items.delete(`DiscoveryError:${workspace.uri.fsPath}`);
                } else {
                    traceError('Error discovering unittest tests:\r\n', exceptions.join('\r\n\r\n'));

                    let errorNode = testController.items.get(`DiscoveryError:${workspace.uri.fsPath}`);
                    const message = util.format(
                        'Error discovering unittest tests (see Output > Python):\r\n',
                        exceptions.join('\r\n\r\n'),
                    );
                    if (errorNode === undefined) {
                        errorNode = createErrorTestItem(testController, {
                            id: `DiscoveryError:${workspace.uri.fsPath}`,
                            label: `Unittest Discovery Error [${path.basename(workspace.uri.fsPath)}]`,
                            error: message,
                        });
                        errorNode.canResolveChildren = false;
                        testController.items.add(errorNode);
                    }
                    errorNode.error = message;
                }

                deferred.resolve();
            } catch (ex) {
                sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_DONE, undefined, { tool: 'unittest', failed: true });
                const cancel = options.token?.isCancellationRequested ? 'Cancelled' : 'Error';
                traceError(`${cancel} discovering unittest tests:\r\n`, ex);

                // Report also on the test view.
                testController.items.add(
                    createErrorTestItem(testController, {
                        id: `DiscoveryError:${workspace.uri.fsPath}`,
                        label: `Unittest Discovery Error [${path.basename(workspace.uri.fsPath)}]`,
                        error: util.format(`${cancel} discovering unittest tests (see Output > Python):\r\n`, ex),
                    }),
                );

                deferred.reject(ex as Error);
            } finally {
                // Discovery has finished running we have the raw test data at this point.
                this.discovering.delete(workspace.uri.fsPath);
            }

            if (!rawTestData) {
                // No test data is available
                return Promise.resolve();
            }

            const workspaceNode = testController.items.get(rawTestData.root);
            if (workspaceNode) {
                if (uri.fsPath === workspace.uri.fsPath) {
                    // this is a workspace level refresh
                    // This is an existing workspace test node. Just update the children
                    await this.resolveChildren(testController, workspaceNode);
                } else {
                    // This is a child node refresh
                    const testNode = getNodeByUri(workspaceNode, uri);
                    if (testNode) {
                        // We found the node to update
                        await this.resolveChildren(testController, testNode);
                    } else {
                        // update the entire workspace tree
                        await this.resolveChildren(testController, workspaceNode);
                    }
                }
            } else if (rawTestData.tests.length > 0) {
                // This is a new workspace with tests.
                const newItem = createWorkspaceRootTestItem(testController, this.idToRawData, {
                    id: rawTestData.root,
                    label: path.basename(rawTestData.root),
                    uri: Uri.file(rawTestData.root),
                    runId: rawTestData.root === '.' ? workspace.uri.fsPath : rawTestData.root,
                    rawId: rawTestData.rootid,
                });
                testController.items.add(newItem);

                await this.resolveChildren(testController, newItem);
            }
        }
        sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_DONE, undefined, { tool: 'unittest', failed: false });
        return Promise.resolve();
    }

    public runTests(testRun: ITestRun, workspace: WorkspaceFolder, token: CancellationToken): Promise<void> {
        const settings = this.configService.getSettings(workspace.uri);
        return this.runner.runTests(
            testRun,
            {
                workspaceFolder: workspace.uri,
                cwd: settings.testing.cwd ?? workspace.uri.fsPath,
                token,
                args: settings.testing.unittestArgs,
            },
            this.idToRawData,
        );
    }
}

function getTestDiscoveryExceptions(content: string): string[] {
    const lines = content.split(/\r?\n/g);
    let start = false;
    let data = '';
    const exceptions: string[] = [];
    for (const line of lines) {
        if (start) {
            if (line.startsWith('=== exception end ===')) {
                exceptions.push(data);
                start = false;
            } else {
                data += `${line}\r\n`;
            }
        } else if (line.startsWith('=== exception start ===')) {
            start = true;
            data = '';
        }
    }
    return exceptions;
}

function getTestIds(content: string): string[] {
    let startedCollecting = false;
    const lines = content.split(/\r?\n/g);

    const ids: string[] = [];
    for (const line of lines) {
        if (!startedCollecting) {
            if (line === 'start') {
                startedCollecting = true;
            }
            if (line.startsWith('===')) {
                break;
            }
        }
        ids.push(line.trim());
    }
    return ids.filter((id) => id.length > 0);
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
                    const parentId = folderParts.length === 0 ? testDir : `./${folderParts.join('/')}`;
                    folderParts.push(folder);
                    const pathId = `./${folderParts.join('/')}`;
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
