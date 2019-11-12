// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-http-string

import { expect } from 'chai';
import * as path from 'path';
import * as request from 'request';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { DebuggerTypeName } from '../../client/debugger/constants';
import { DEBUGGER_TIMEOUT } from './common/constants';

const testAdapterFilePath = path.join(EXTENSION_ROOT_DIR, 'out', 'client', 'debugger', 'debugAdapter', 'main.js');
const debuggerType = DebuggerTypeName;

/**
 * Creates the debug adapter.
 * @returns {DebugClient}
 */
export async function createDebugAdapter(): Promise<DebugClient> {
    await new Promise(resolve => setTimeout(resolve, 1000));
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
        const variable = variables.body.variables.find(item => item.name === expectedVariable.name)!;
        expect(variable).to.be.not.equal('undefined', `variable '${expectedVariable.name}' is undefined`);
        expect(variable.type).to.be.equal(expectedVariable.type);
        expect(variable.value).to.be.equal(expectedVariable.value);
    }
}
export function makeHttpRequest(uri: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
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
export async function hitHttpBreakpoint(debugClient: DebugClient, uri: string, file: string, line: number): Promise<[DebugProtocol.StackTraceResponse, Promise<string>]> {
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
