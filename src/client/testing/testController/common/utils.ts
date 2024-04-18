// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs';
import { CancellationToken, Position, TestController, TestItem, Uri, Range, Disposable } from 'vscode';
import { Message } from 'vscode-jsonrpc';
import { traceError, traceInfo, traceLog, traceVerbose } from '../../../logging';
import { EnableTestAdapterRewrite } from '../../../common/experiments/groups';
import { IExperimentService } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { DebugTestTag, ErrorTestItemOptions, RunTestTag } from './testItemUtilities';
import {
    DiscoveredTestItem,
    DiscoveredTestNode,
    DiscoveredTestPayload,
    EOTTestPayload,
    ExecutionTestPayload,
    ITestResultResolver,
} from './types';
import { Deferred, createDeferred } from '../../../common/utils/async';
import { createNamedPipeServer, generateRandomPipeName } from '../../../common/pipes/namedPipes';

export function fixLogLines(content: string): string {
    const lines = content.split(/\r?\n/g);
    return `${lines.join('\r\n')}\r\n`;
}

export function fixLogLinesNoTrailing(content: string): string {
    const lines = content.split(/\r?\n/g);
    return `${lines.join('\r\n')}`;
}
export interface IJSONRPCData {
    extractedJSON: string;
    remainingRawData: string;
}

export interface ParsedRPCHeadersAndData {
    headers: Map<string, string>;
    remainingRawData: string;
}

export interface ExtractOutput {
    uuid: string | undefined;
    cleanedJsonData: string | undefined;
    remainingRawData: string;
}

export const JSONRPC_UUID_HEADER = 'Request-uuid';
export const JSONRPC_CONTENT_LENGTH_HEADER = 'Content-Length';
export const JSONRPC_CONTENT_TYPE_HEADER = 'Content-Type';
export const MESSAGE_ON_TESTING_OUTPUT_MOVE =
    'Starting now, all test run output will be sent to the Test Result panel,' +
    ' while test discovery output will be sent to the "Python" output channel instead of the "Python Test Log" channel.' +
    ' The "Python Test Log" channel will be deprecated within the next month.' +
    ' See https://github.com/microsoft/vscode-python/wiki/New-Method-for-Output-Handling-in-Python-Testing for details.';

export function createTestingDeferred(): Deferred<void> {
    return createDeferred<void>();
}

export function extractJsonPayload(rawData: string, uuids: Array<string>): ExtractOutput {
    /**
     * Extracts JSON-RPC payload from the provided raw data.
     * @param {string} rawData - The raw string data from which the JSON payload will be extracted.
     * @param {Array<string>} uuids - The list of UUIDs that are active.
     * @returns {string} The remaining raw data after the JSON payload is extracted.
     */

    const rpcHeaders: ParsedRPCHeadersAndData = parseJsonRPCHeadersAndData(rawData);

    // verify the RPC has a UUID and that it is recognized
    let uuid = rpcHeaders.headers.get(JSONRPC_UUID_HEADER);
    uuid = checkUuid(uuid, uuids);

    const payloadLength = rpcHeaders.headers.get('Content-Length');

    // separate out the data within context length of the given payload from the remaining data in the buffer
    const rpcContent: IJSONRPCData = ExtractJsonRPCData(payloadLength, rpcHeaders.remainingRawData);
    const cleanedJsonData = rpcContent.extractedJSON;
    const { remainingRawData } = rpcContent;

    // if the given payload has the complete json, process it otherwise wait for the rest in the buffer
    if (cleanedJsonData.length === Number(payloadLength)) {
        // call to process this data
        // remove this data from the buffer
        return { uuid, cleanedJsonData, remainingRawData };
    }
    // wait for the remaining
    return { uuid: undefined, cleanedJsonData: undefined, remainingRawData: rawData };
}

export function checkUuid(uuid: string | undefined, uuids: Array<string>): string | undefined {
    if (!uuid) {
        // no UUID found, this could occurred if the payload is full yet so send back without erroring
        return undefined;
    }
    if (!uuids.includes(uuid)) {
        // no UUID found, this could occurred if the payload is full yet so send back without erroring
        throw new Error('On data received: Error occurred because the payload UUID is not recognized');
    }
    return uuid;
}

export function parseJsonRPCHeadersAndData(rawData: string): ParsedRPCHeadersAndData {
    /**
     * Parses the provided raw data to extract JSON-RPC specific headers and remaining data.
     *
     * This function aims to extract specific JSON-RPC headers (like UUID, content length,
     * and content type) from the provided raw string data. Headers are expected to be
     * delimited by newlines and the format should be "key:value". The function stops parsing
     * once it encounters an empty line, and the rest of the data after this line is treated
     * as the remaining raw data.
     *
     * @param {string} rawData - The raw string containing headers and possibly other data.
     * @returns {ParsedRPCHeadersAndData} An object containing the parsed headers as a map and the
     * remaining raw data after the headers.
     */
    const lines = rawData.split('\n');
    let remainingRawData = '';
    const headerMap = new Map<string, string>();
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (line === '') {
            remainingRawData = lines.slice(i + 1).join('\n');
            break;
        }
        const [key, value] = line.split(':');
        if (value && value.trim()) {
            if ([JSONRPC_UUID_HEADER, JSONRPC_CONTENT_LENGTH_HEADER, JSONRPC_CONTENT_TYPE_HEADER].includes(key)) {
                headerMap.set(key.trim(), value.trim());
            }
        }
    }

    return {
        headers: headerMap,
        remainingRawData,
    };
}

export function ExtractJsonRPCData(payloadLength: string | undefined, rawData: string): IJSONRPCData {
    /**
     * Extracts JSON-RPC content based on provided headers and raw data.
     *
     * This function uses the `Content-Length` header from the provided headers map
     * to determine how much of the rawData string represents the actual JSON content.
     * After extracting the expected content, it also returns any remaining data
     * that comes after the extracted content as remaining raw data.
     *
     * @param {string | undefined} payloadLength - The value of the `Content-Length` header.
     * @param {string} rawData - The raw string data from which the JSON content will be extracted.
     *
     * @returns {IJSONRPCContent} An object containing the extracted JSON content and any remaining raw data.
     */
    const length = parseInt(payloadLength ?? '0', 10);
    const data = rawData.slice(0, length);
    const remainingRawData = rawData.slice(length);
    return {
        extractedJSON: data,
        remainingRawData,
    };
}

export function pythonTestAdapterRewriteEnabled(serviceContainer: IServiceContainer): boolean {
    const experiment = serviceContainer.get<IExperimentService>(IExperimentService);
    return experiment.inExperimentSync(EnableTestAdapterRewrite.experiment);
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
    params: ExecutionTestPayload | EOTTestPayload;
}

export async function startRunResultNamedPipe(
    dataReceivedCallback: (payload: ExecutionTestPayload | EOTTestPayload) => void,
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
                // if EOT, call decrement connection count (callback)
                dataReceivedCallback((data as ExecutionResultMessage).params as ExecutionTestPayload | EOTTestPayload);
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
    params: DiscoveredTestPayload | EOTTestPayload;
}

export async function startDiscoveryNamedPipe(
    callback: (payload: DiscoveredTestPayload | EOTTestPayload) => void,
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
                callback((data as DiscoveryResultMessage).params as DiscoveredTestPayload | EOTTestPayload);
            }),
            reader.onClose(() => {
                callback(createEOTPayload(true));
                traceVerbose(`Test Discovery named pipe ${pipeName} closed`);
                dispose();
            }),
        );
    });
    return { name: pipeName, dispose };
}

export async function startTestIdServer(testIds: string[]): Promise<number> {
    const startServer = (): Promise<number> =>
        new Promise((resolve, reject) => {
            const server = net.createServer((socket: net.Socket) => {
                // Convert the test_ids array to JSON
                const testData = JSON.stringify(testIds);

                // Create the headers
                const headers = [`Content-Length: ${Buffer.byteLength(testData)}`, 'Content-Type: application/json'];

                // Create the payload by concatenating the headers and the test data
                const payload = `${headers.join('\r\n')}\r\n\r\n${testData}`;

                // Send the payload to the socket
                socket.write(payload);

                // Handle socket events
                socket.on('data', (data) => {
                    traceLog('Received data:', data.toString());
                });

                socket.on('end', () => {
                    traceLog('Client disconnected');
                });
            });

            server.listen(0, () => {
                const { port } = server.address() as net.AddressInfo;
                traceLog(`Server listening on port ${port}`);
                resolve(port);
            });

            server.on('error', (error: Error) => {
                reject(error);
            });
        });

    // Start the server and wait until it is listening
    let returnPort = 0;
    try {
        await startServer()
            .then((assignedPort) => {
                traceVerbose(`Server started for pytest test ids server and listening on port ${assignedPort}`);
                returnPort = assignedPort;
            })
            .catch((error) => {
                traceError('Error starting server for pytest test ids server:', error);
                return 0;
            })
            .finally(() => returnPort);
        return returnPort;
    } catch {
        traceError('Error starting server for pytest test ids server, cannot get port.');
        return returnPort;
    }
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

                const range = new Range(
                    new Position(Number(child.lineno) - 1, 0),
                    new Position(Number(child.lineno), 0),
                );
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

export function createEOTPayload(executionBool: boolean): EOTTestPayload {
    return {
        commandType: executionBool ? 'execution' : 'discovery',
        eot: true,
    } as EOTTestPayload;
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
        console.error('Error checking symlinks:', error);
        return false;
    }
}
