// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import { CancellationToken, Position, TestController, TestItem, Uri, Range, Disposable } from 'vscode';
import { Message } from 'vscode-jsonrpc';
import { traceError, traceInfo, traceLog, traceVerbose } from '../../../logging';
import { DebugTestTag, ErrorTestItemOptions, RunTestTag } from './testItemUtilities';
import {
    DiscoveredTestItem,
    DiscoveredTestNode,
    DiscoveredTestPayload,
    ExecutionTestPayload,
    ITestResultResolver,
} from './types';
import { Deferred, createDeferred } from '../../../common/utils/async';
import { createNamedPipeServer, generateRandomPipeName } from '../../../common/pipes/namedPipes';
import { EXTENSION_ROOT_DIR } from '../../../constants';

export function fixLogLinesNoTrailing(content: string): string {
    const lines = content.split(/\r?\n/g);
    return `${lines.join('\r\n')}`;
}

export const MESSAGE_ON_TESTING_OUTPUT_MOVE =
    'Starting now, all test run output will be sent to the Test Result panel,' +
    ' while test discovery output will be sent to the "Python" output channel instead of the "Python Test Log" channel.' +
    ' The "Python Test Log" channel will be deprecated within the next month.' +
    ' See https://github.com/microsoft/vscode-python/wiki/New-Method-for-Output-Handling-in-Python-Testing for details.';

export function createTestingDeferred(): Deferred<void> {
    return createDeferred<void>();
}

export async function startTestIdsNamedPipe(testIds: string[]): Promise<string> {
    const pipeName: string = generateRandomPipeName('python-test-ids');
    // uses callback so the on connect action occurs after the pipe is created
    await createNamedPipeServer(pipeName, ([_reader, writer]) => {
        traceVerbose('Test Ids named pipe connected');
        // const num = await
        const msg = {
            jsonrpc: '2.0',
            params: testIds,
        } as Message;
        writer
            .write(msg)
            .then(() => {
                writer.end();
            })
            .catch((ex) => {
                traceError('Failed to write test ids to named pipe', ex);
            });
    });
    return pipeName;
}

interface ExecutionResultMessage extends Message {
    params: ExecutionTestPayload;
}

/**
 * Writes an array of test IDs to a temporary file.
 *
 * @param testIds - The array of test IDs to write.
 * @returns A promise that resolves to the file name of the temporary file.
 */
export async function writeTestIdsFile(testIds: string[]): Promise<string> {
    // temp file name in format of test-ids-<randomSuffix>.txt
    const randomSuffix = crypto.randomBytes(10).toString('hex');
    const tempName = `test-ids-${randomSuffix}.txt`;
    // create temp file
    let tempFileName: string;
    try {
        traceLog('Attempting to use temp directory for test ids file, file name:', tempName);
        tempFileName = path.join(os.tmpdir(), tempName);
    } catch (error) {
        // Handle the error when accessing the temp directory
        traceError('Error accessing temp directory:', error, ' Attempt to use extension root dir instead');
        // Make new temp directory in extension root dir
        const tempDir = path.join(EXTENSION_ROOT_DIR, '.temp');
        await fs.promises.mkdir(tempDir, { recursive: true });
        tempFileName = path.join(EXTENSION_ROOT_DIR, '.temp', tempName);
        traceLog('New temp file:', tempFileName);
    }
    // write test ids to file
    await fs.promises.writeFile(tempFileName, testIds.join('\n'));
    // return file name
    return tempFileName;
}

export async function startRunResultNamedPipe(
    dataReceivedCallback: (payload: ExecutionTestPayload) => void,
    deferredTillServerClose: Deferred<void>,
    cancellationToken?: CancellationToken,
): Promise<{ name: string } & Disposable> {
    traceVerbose('Starting Test Result named pipe');
    const pipeName: string = generateRandomPipeName('python-test-results');
    let disposeOfServer: () => void = () => {
        deferredTillServerClose.resolve();
        /* noop */
    };
    const server = await createNamedPipeServer(pipeName, ([reader, _writer]) => {
        // this lambda function is: onConnectionCallback
        // this is called once per client connecting to the server
        traceVerbose(`Test Result named pipe ${pipeName} connected`);
        let perConnectionDisposables: (Disposable | undefined)[] = [reader];

        // create a function to dispose of the server
        disposeOfServer = () => {
            // dispose of all data listeners and cancelation listeners
            perConnectionDisposables.forEach((d) => d?.dispose());
            perConnectionDisposables = [];
            deferredTillServerClose.resolve();
        };
        perConnectionDisposables.push(
            // per connection, add a listener for the cancellation token and the data
            cancellationToken?.onCancellationRequested(() => {
                console.log(`Test Result named pipe ${pipeName}  cancelled`);
                // if cancel is called on one connection, dispose of all connections
                disposeOfServer();
            }),
            reader.listen((data: Message) => {
                traceVerbose(`Test Result named pipe ${pipeName} received data`);
                dataReceivedCallback((data as ExecutionResultMessage).params as ExecutionTestPayload);
            }),
        );
        server.serverOnClosePromise().then(() => {
            // this is called once the server close, once per run instance
            traceVerbose(`Test Result named pipe ${pipeName} closed. Disposing of listener/s.`);
            // dispose of all data listeners and cancelation listeners
            disposeOfServer();
        });
    });

    return { name: pipeName, dispose: disposeOfServer };
}

interface DiscoveryResultMessage extends Message {
    params: DiscoveredTestPayload;
}

export async function startDiscoveryNamedPipe(
    callback: (payload: DiscoveredTestPayload) => void,
    cancellationToken?: CancellationToken,
): Promise<{ name: string } & Disposable> {
    traceVerbose('Starting Test Discovery named pipe');
    const pipeName: string = generateRandomPipeName('python-test-discovery');
    let dispose: () => void = () => {
        /* noop */
    };
    await createNamedPipeServer(pipeName, ([reader, _writer]) => {
        traceVerbose(`Test Discovery named pipe ${pipeName} connected`);
        let disposables: (Disposable | undefined)[] = [reader];
        dispose = () => {
            traceVerbose(`Test Discovery named pipe ${pipeName} disposed`);
            disposables.forEach((d) => d?.dispose());
            disposables = [];
        };
        disposables.push(
            cancellationToken?.onCancellationRequested(() => {
                traceVerbose(`Test Discovery named pipe ${pipeName}  cancelled`);
                dispose();
            }),
            reader.listen((data: Message) => {
                traceVerbose(`Test Discovery named pipe ${pipeName} received data`);
                callback((data as DiscoveryResultMessage).params as DiscoveredTestPayload);
            }),
            reader.onClose(() => {
                traceVerbose(`Test Discovery named pipe ${pipeName} closed`);
                dispose();
            }),
        );
    });
    return { name: pipeName, dispose };
}

export function buildErrorNodeOptions(uri: Uri, message: string, testType: string): ErrorTestItemOptions {
    const labelText = testType === 'pytest' ? 'pytest Discovery Error' : 'Unittest Discovery Error';
    return {
        id: `DiscoveryError:${uri.fsPath}`,
        label: `${labelText} [${path.basename(uri.fsPath)}]`,
        error: message,
    };
}

export function populateTestTree(
    testController: TestController,
    testTreeData: DiscoveredTestNode,
    testRoot: TestItem | undefined,
    resultResolver: ITestResultResolver,
    token?: CancellationToken,
): void {
    // If testRoot is undefined, use the info of the root item of testTreeData to create a test item, and append it to the test controller.
    if (!testRoot) {
        testRoot = testController.createTestItem(testTreeData.path, testTreeData.name, Uri.file(testTreeData.path));

        testRoot.canResolveChildren = true;
        testRoot.tags = [RunTestTag, DebugTestTag];

        testController.items.add(testRoot);
    }

    // Recursively populate the tree with test data.
    testTreeData.children.forEach((child) => {
        if (!token?.isCancellationRequested) {
            if (isTestItem(child)) {
                const testItem = testController.createTestItem(child.id_, child.name, Uri.file(child.path));
                testItem.tags = [RunTestTag, DebugTestTag];

                let range: Range | undefined;
                if (child.lineno) {
                    range = new Range(new Position(Number(child.lineno) - 1, 0), new Position(Number(child.lineno), 0));
                }
                testItem.canResolveChildren = false;
                testItem.range = range;
                testItem.tags = [RunTestTag, DebugTestTag];

                testRoot!.children.add(testItem);
                // add to our map
                resultResolver.runIdToTestItem.set(child.runID, testItem);
                resultResolver.runIdToVSid.set(child.runID, child.id_);
                resultResolver.vsIdToRunId.set(child.id_, child.runID);
            } else {
                let node = testController.items.get(child.path);

                if (!node) {
                    node = testController.createTestItem(child.id_, child.name, Uri.file(child.path));

                    node.canResolveChildren = true;
                    node.tags = [RunTestTag, DebugTestTag];
                    testRoot!.children.add(node);
                }
                populateTestTree(testController, child, node, resultResolver, token);
            }
        }
    });
}

function isTestItem(test: DiscoveredTestNode | DiscoveredTestItem): test is DiscoveredTestItem {
    return test.type_ === 'test';
}

export function createExecutionErrorPayload(
    code: number | null,
    signal: NodeJS.Signals | null,
    testIds: string[],
    cwd: string,
): ExecutionTestPayload {
    const etp: ExecutionTestPayload = {
        cwd,
        status: 'error',
        error: `Test run failed, the python test process was terminated before it could exit on its own for workspace ${cwd}`,
        result: {},
    };
    // add error result for each attempted test.
    for (let i = 0; i < testIds.length; i = i + 1) {
        const test = testIds[i];
        etp.result![test] = {
            test,
            outcome: 'error',
            message: ` \n The python test process was terminated before it could exit on its own, the process errored with: Code: ${code}, Signal: ${signal}`,
        };
    }
    return etp;
}

export function createDiscoveryErrorPayload(
    code: number | null,
    signal: NodeJS.Signals | null,
    cwd: string,
): DiscoveredTestPayload {
    return {
        cwd,
        status: 'error',
        error: [
            ` \n The python test process was terminated before it could exit on its own, the process errored with: Code: ${code}, Signal: ${signal} for workspace ${cwd}`,
        ],
    };
}

/**
 * Splits a test name into its parent test name and subtest unique section.
 *
 * @param testName The full test name string.
 * @returns A tuple where the first item is the parent test name and the second item is the subtest section or `testName` if no subtest section exists.
 */
export function splitTestNameWithRegex(testName: string): [string, string] {
    // If a match is found, return the parent test name and the subtest (whichever was captured between parenthesis or square brackets).
    // Otherwise, return the entire testName for the parent and entire testName for the subtest.
    const regex = /^(.*?) ([\[(].*[\])])$/;
    const match = testName.match(regex);
    if (match) {
        return [match[1].trim(), match[2] || match[3] || testName];
    }
    return [testName, testName];
}

/**
 * Takes a list of arguments and adds an key-value pair to the list if the key doesn't already exist. Searches each element
 * in the array for the key to see if it is contained within the element.
 * @param args list of arguments to search
 * @param argToAdd argument to add if it doesn't already exist
 * @returns the list of arguments with the key-value pair added if it didn't already exist
 */
export function addValueIfKeyNotExist(args: string[], key: string, value: string | null): string[] {
    for (const arg of args) {
        if (arg.includes(key)) {
            traceInfo(`arg: ${key} already exists in args, not adding.`);
            return args;
        }
    }
    if (value) {
        args.push(`${key}=${value}`);
    } else {
        args.push(`${key}`);
    }
    return args;
}

/**
 * Checks if a key exists in a list of arguments. Searches each element in the array
 *  for the key to see if it is contained within the element.
 * @param args list of arguments to search
 * @param key string to search for
 * @returns true if the key exists in the list of arguments, false otherwise
 */
export function argKeyExists(args: string[], key: string): boolean {
    for (const arg of args) {
        if (arg.includes(key)) {
            return true;
        }
    }
    return false;
}

/**
 * Checks recursively if any parent directories of the given path are symbolic links.
 * @param {string} currentPath - The path to start checking from.
 * @returns {Promise<boolean>} - Returns true if any parent directory is a symlink, otherwise false.
 */
export async function hasSymlinkParent(currentPath: string): Promise<boolean> {
    try {
        // Resolve the path to an absolute path
        const absolutePath = path.resolve(currentPath);
        // Get the parent directory
        const parentDirectory = path.dirname(absolutePath);
        // Check if the current directory is the root directory
        if (parentDirectory === absolutePath) {
            return false;
        }
        // Check if the parent directory is a symlink
        const stats = await fs.promises.lstat(parentDirectory);
        if (stats.isSymbolicLink()) {
            traceLog(`Symlink found at: ${parentDirectory}`);
            return true;
        }
        // Recurse up the directory tree
        return await hasSymlinkParent(parentDirectory);
    } catch (error) {
        traceError('Error checking symlinks:', error);
        return false;
    }
}
