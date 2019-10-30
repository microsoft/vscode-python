// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { DebugSession, WorkspaceFolder } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';

import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { EXTENSION_ROOT_DIR } from '../../../../client/constants';
import { DebugSessionLoggingFactory } from '../../../../client/debugger/extension/adapter/logging';

// tslint:disable-next-line: max-func-body-length
suite('Debugging - Session Logging', () => {
    const oldValueOfVSC_PYTHON_UNIT_TEST = process.env.VSC_PYTHON_UNIT_TEST;
    const oldValueOfVSC_PYTHON_CI_TEST = process.env.VSC_PYTHON_CI_TEST;
    let loggerFactory: DebugSessionLoggingFactory;
    let fsService: FileSystem;
    let writeStream: fs.WriteStream;

    setup(() => {
        fsService = mock(FileSystem);
        writeStream = mock(fs.WriteStream);

        process.env.VSC_PYTHON_UNIT_TEST = undefined;
        process.env.VSC_PYTHON_CI_TEST = undefined;

        loggerFactory = new DebugSessionLoggingFactory(instance(fsService));
    });

    teardown(() => {
        process.env.VSC_PYTHON_UNIT_TEST = oldValueOfVSC_PYTHON_UNIT_TEST;
        process.env.VSC_PYTHON_CI_TEST = oldValueOfVSC_PYTHON_CI_TEST;
    });

    function createSession(id: string, workspaceFolder?: WorkspaceFolder): DebugSession {
        return {
            configuration: {
                name: '',
                request: 'launch',
                type: 'python'
            },
            id: id,
            name: 'python',
            type: 'python',
            workspaceFolder,
            customRequest: () => Promise.resolve()
        };
    }

    function createSessionWithLogging(id: string, logToFile: boolean, workspaceFolder?: WorkspaceFolder): DebugSession {
        const session = createSession(id, workspaceFolder);
        session.configuration.logToFile = logToFile;
        return session;
    }

    class TestMessage implements DebugProtocol.ProtocolMessage {
        public seq: number;
        public type: string;
        public id: number;
        public format: string;
        public variables?: { [key: string]: string } | undefined;
        public sendTelemetry?: boolean | undefined;
        public showUser?: boolean | undefined;
        public url?: string | undefined;
        public urlLabel?: string | undefined;
        constructor(id: number, seq: number, type: string) {
            this.id = id;
            this.format = 'json';
            this.seq = seq;
            this.type = type;
        }
    }

    test('Create logger using session without logToFile', async () => {
        const session = createSession('test1');
        const filePath = path.join(EXTENSION_ROOT_DIR, `debugger.vscode_${session.id}.log`);

        loggerFactory.createDebugAdapterTracker(session);

        verify(fsService.createWriteStream(filePath)).never();
    });

    test('Create logger using session with logToFile set to false', async () => {
        const session = createSessionWithLogging('test2', false);
        const filePath = path.join(EXTENSION_ROOT_DIR, `debugger.vscode_${session.id}.log`);

        loggerFactory.createDebugAdapterTracker(session);

        verify(fsService.createWriteStream(filePath)).never();
    });

    test('Create logger using session with logToFile set to true', async () => {
        const session = createSessionWithLogging('test3', true);
        const filePath = path.join(EXTENSION_ROOT_DIR, `debugger.vscode_${session.id}.log`);
        const logs: string[] = [];

        when(fsService.createWriteStream(filePath)).thenReturn(instance(writeStream));
        when(writeStream.write(anything())).thenCall((msg) => logs.push(msg));

        const message = new TestMessage(1, 1, 'test-message');
        const logger = await loggerFactory.createDebugAdapterTracker(session);

        if (logger) {
            logger.onWillStartSession!();
            assert.ok(logs.pop()!.includes('Starting Session'));

            logger.onDidSendMessage!(message);
            const sentMessage = logs.pop();
            assert.ok(sentMessage!.includes('Client --> Adapter'));
            assert.ok(sentMessage!.includes('test-message'));

            logger.onWillReceiveMessage!(message);
            const receivedMessage = logs.pop();
            assert.ok(receivedMessage!.includes('Client <-- Adapter'));
            assert.ok(receivedMessage!.includes('test-message'));

            logger.onWillStopSession!();
            assert.ok(logs.pop()!.includes('Stopping Session'));

            logger.onError!(new Error('test error message'));
            assert.ok(logs.pop()!.includes('Error'));

            logger.onExit!(0, undefined);
            assert.ok(logs.pop()!.includes('Exit'));
        }

        verify(fsService.createWriteStream(filePath)).once();
        verify(writeStream.write(anything())).times(6);
        assert.deepEqual(logs, []);
    });
});
