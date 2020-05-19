// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-classes-per-file

import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { sleep } from '../../client/common/utils/async';
import { getDebugpyLauncherArgs } from '../../client/debugger/extension/adapter/remoteLaunchers';
import { PythonFixture } from '../fixtures';
import { Proc, ProcOutput, ProcResult } from '../proc';

const launchJSON = path.join(EXTENSION_ROOT_DIR, 'src', 'test', '.vscode', 'launch.json');

export function getConfig(name: string): vscode.DebugConfiguration {
    const configs = fs.readJSONSync(launchJSON);
    for (const config of configs.configurations) {
        if (config.name === name) {
            return config;
        }
    }
    throw Error(`debug config "${name}" not found`);
}

// See: https://microsoft.github.io/debug-adapter-protocol/specification#arrow_left-output-event
interface IDAPOutputMessage {
    type: 'event';
    event: 'output';
    // tslint:disable-next-line:no-any
    body: {
        category?: string; // stdout, stderr, console, etc.
        output: string;
    };
}

class DebugAdapterTracker {
    constructor(
        // VS Code provides the session through the factory.
        public readonly session: vscode.DebugSession,
        private readonly tracked: TrackedDebugger
    ) {}

    // tslint:disable-next-line:no-any
    public onWillReceiveMessage(message: any): void {
        // Un-comment this to see the DAP messages sent from debugpy:
        //console.log('|', message, '|');
        const msg = message as IDAPOutputMessage;
        if (msg.type !== 'event' || msg.event !== 'output') {
            return;
        }
        if (msg.body.category === undefined) {
            msg.body.category = 'stdout';
        }

        const data = Buffer.from(msg.body.output, 'utf-8');
        if (msg.body.category === 'stdout') {
            this.tracked.output.addStdout(data);
        } else if (msg.body.category === 'stderr') {
            this.tracked.output.addStderr(data);
        } else {
            // Ignore it.
        }
    }

    public onExit(code: number | undefined, signal: string | undefined): void {
        if (code) {
            this.tracked.exitCode = code;
        } else if (signal) {
            this.tracked.exitCode = 1;
        } else {
            this.tracked.exitCode = 0;
        }
    }

    // The following vscode.DebugAdapterTracker methods are not implemented:
    //
    //  * onWillStartSession(): void;
    //  * onDidSendMessage(message: any): void;
    //  * onWillStopSession(): void;
    //  * onError(error: Error): void;
}

type TrackedDebugger = {
    id: number;
    output: ProcOutput;
    exitCode?: number;
};

class Debuggers {
    private nextID = 0;
    private tracked: { [id: number]: TrackedDebugger } = {};
    private results: { [id: number]: ProcResult } = {};

    public track(config: vscode.DebugConfiguration, output?: ProcOutput): number {
        if (this.nextID === 0) {
            vscode.debug.registerDebugAdapterTrackerFactory('python', this);
        }
        if (output === undefined) {
            output = new ProcOutput();
        }
        this.nextID += 1;
        const id = this.nextID;
        this.tracked[id] = { id, output };
        config._test_session_id = id;
        return id;
    }

    public async waitUntilDone(id: number): Promise<ProcResult> {
        const cachedResult = this.results[id];
        if (cachedResult !== undefined) {
            return cachedResult;
        }
        const tracked = this.tracked[id];
        if (tracked === undefined) {
            throw Error(`untracked debugger ${id}`);
        } else {
            while (tracked.exitCode === undefined) {
                await sleep(10); // milliseconds
            }
            const result = {
                exitCode: tracked.exitCode,
                stdout: tracked.output.stdout
            };
            this.results[id] = result;
            return result;
        }
    }

    // This is for DebugAdapterTrackerFactory:
    public createDebugAdapterTracker(session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterTracker> {
        const id = session.configuration._test_session_id;
        const tracked = this.tracked[id];
        if (tracked !== undefined) {
            return new DebugAdapterTracker(session, tracked);
        } else if (id !== undefined) {
            // This should not have happened, but we don't worry about
            // it for now.
        }
        return undefined;
    }
}
const debuggers = new Debuggers();

class DebuggerSession {
    private started: boolean = false;
    constructor(
        public readonly id: number,
        public readonly config: vscode.DebugConfiguration,
        private readonly wsRoot?: vscode.WorkspaceFolder,
        private readonly proc?: Proc
    ) {}

    public async start() {
        if (this.started) {
            throw Error('already started');
        }
        this.started = true;

        const started = await vscode.debug.startDebugging(this.wsRoot, this.config);
        expect(started).to.be.equal(true, 'Debugger did not sart');
    }

    public async waitUntilDone(): Promise<ProcResult> {
        if (this.proc) {
            return this.proc.waitUntilDone();
        } else {
            return debuggers.waitUntilDone(this.id);
        }
    }

    // The old debug adapter tests used
    // 'vscode-debugadapter-testsupport'.DebugClient to interact with
    // the debugger.  This is helpful info when we are considering
    // additional debugger-related tests.  Here are the methods/props
    // the old tests used:
    //
    // * defaultTimeout
    // * start()
    // * stop()
    // * initializeRequest()
    // * configurationSequence()
    // * launch()
    // * attachRequest()
    // * waitForEvent()
    // * assertOutput()
    // * threadsRequest()
    // * continueRequest()
    // * scopesRequest()
    // * variablesRequest()
    // * setBreakpointsRequest()
    // * setExceptionBreakpointsRequest()
    // * assertStoppedLocation()
}

export class DebuggerFixture extends PythonFixture {
    public resolveDebugger(
        configName: string,
        file: string,
        scriptArgs: string[],
        wsRoot?: vscode.WorkspaceFolder
    ): DebuggerSession {
        const config = getConfig(configName);
        let proc: Proc | undefined;
        if (config.request === 'launch') {
            config.program = file;
            config.args = scriptArgs;
            config.redirectOutput = false;
            // XXX set the file in the current vscode editor?
        } else if (config.request === 'attach') {
            if (config.port) {
                proc = this.runDebugger(config.port, file, ...scriptArgs);
                if (wsRoot && config.name === 'attach to a local port') {
                    config.pathMappings.localRoot = wsRoot.uri.fsPath;
                }
            } else if (config.processId) {
                proc = this.runScript(file, ...scriptArgs);
                config.processId = proc.pid;
            } else {
                throw Error(`unsupported attach config "${configName}"`);
            }
        } else {
            throw Error(`unsupported request type "${config.request}"`);
        }
        const id = debuggers.track(config);
        return new DebuggerSession(id, config, wsRoot, proc);
    }

    public getLaunchTarget(filename: string, args: string[]): vscode.DebugConfiguration {
        return {
            type: 'python',
            name: 'debug',
            request: 'launch',
            program: filename,
            args: args,
            console: 'integratedTerminal'
        };
    }

    public getAttachTarget(filename: string, args: string[], port?: number): vscode.DebugConfiguration {
        if (port) {
            this.runDebugger(port, filename, ...args);
            return {
                type: 'python',
                name: 'debug',
                request: 'attach',
                port: port,
                host: 'localhost',
                pathMappings: [
                    {
                        // tslint:disable-next-line:no-invalid-template-strings
                        localRoot: '${workspaceFolder}',
                        remoteRoot: '.'
                    }
                ]
            };
        } else {
            const proc = this.runScript(filename, ...args);
            return {
                type: 'python',
                name: 'debug',
                request: 'attach',
                processId: proc.pid
            };
        }
    }

    public runDebugger(port: number, filename: string, ...scriptArgs: string[]) {
        const args = getDebugpyLauncherArgs({
            host: 'localhost',
            port: port,
            // This causes problems if we set it to true.
            waitUntilDebuggerAttaches: false
        });
        args.push(filename, ...scriptArgs);
        return this.runScript(args[0], ...args.slice(1));
    }
}

//-------------------------------------

import * as request from 'request';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { DebuggerTypeName } from '../../client/debugger/constants';
import { DEBUGGER_TIMEOUT } from './common/constants';

const testAdapterFilePath = path.join(EXTENSION_ROOT_DIR, 'out', 'client', 'debugger', 'debugAdapter', 'main.js');
const debuggerType = DebuggerTypeName;

/**
 * Creates the debug adapter.
 * @returns {DebugClient}
 */
export async function createDebugAdapter(): Promise<DebugClient> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const debugClient = new DebugClient(process.env.NODE_PATH || 'node', testAdapterFilePath, debuggerType);
    debugClient.defaultTimeout = DEBUGGER_TIMEOUT;
    await debugClient.start();
    return debugClient;
}

export async function continueDebugging(debugClient: DebugClient) {
    const threads = await debugClient.threadsRequest();
    expect(threads).to.be.not.equal(undefined, 'no threads response');
    expect(threads.body.threads).to.be.lengthOf(1);

    await debugClient.continueRequest({ threadId: threads.body.threads[0].id });
}

export type ExpectedVariable = { type: string; name: string; value: string };
export async function validateVariablesInFrame(
    debugClient: DebugClient,
    stackTrace: DebugProtocol.StackTraceResponse,
    expectedVariables: ExpectedVariable[],
    numberOfScopes?: number
) {
    const frameId = stackTrace.body.stackFrames[0].id;

    const scopes = await debugClient.scopesRequest({ frameId });
    if (numberOfScopes) {
        expect(scopes.body.scopes).of.length(1, 'Incorrect number of scopes');
    }

    const variablesReference = scopes.body.scopes[0].variablesReference;
    const variables = await debugClient.variablesRequest({ variablesReference });

    for (const expectedVariable of expectedVariables) {
        const variable = variables.body.variables.find((item) => item.name === expectedVariable.name)!;
        expect(variable).to.be.not.equal('undefined', `variable '${expectedVariable.name}' is undefined`);
        expect(variable.type).to.be.equal(expectedVariable.type);
        expect(variable.value).to.be.equal(expectedVariable.value);
    }
}
export function makeHttpRequest(uri: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        // tslint:disable-next-line:no-any
        request.get(uri, (error: any, response: request.Response, body: any) => {
            if (error) {
                return reject(error);
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Status code = ${response.statusCode}`));
            } else {
                resolve(body.toString());
            }
        });
    });
}
export async function hitHttpBreakpoint(
    debugClient: DebugClient,
    uri: string,
    file: string,
    line: number
): Promise<[DebugProtocol.StackTraceResponse, Promise<string>]> {
    const breakpointLocation = { path: file, column: 1, line };
    await debugClient.setBreakpointsRequest({
        lines: [breakpointLocation.line],
        breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
        source: { path: breakpointLocation.path }
    });

    // Make the request, we want the breakpoint to be hit.
    const breakpointPromise = debugClient.assertStoppedLocation('breakpoint', breakpointLocation);
    const httpResult = makeHttpRequest(uri);
    return [await breakpointPromise, httpResult];
}
