// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as windowApis from '../../../client/common/vscodeApis/windowApis';
import * as telemetryModule from '../../../client/telemetry';
import { EventName } from '../../../client/telemetry/constants';
import { registerTriggerForTerminalREPL } from '../../../client/terminals/codeExecution/terminalReplWatcher';

suite('Terminal REPL Watcher', () => {
    let windowApisStub: sinon.SinonStub;
    let telemetryStub: sinon.SinonStub;

    setup(() => {
        windowApisStub = sinon.stub(windowApis, 'onDidStartTerminalShellExecution').returns({
            dispose: () => {
                // Do nothing
            },
        });
        telemetryStub = sinon.stub(telemetryModule, 'sendTelemetryEvent');
    });

    teardown(() => {
        sinon.restore();
    });

    test('Should send REPL telemetry when Python is invoked', () => {
        windowApisStub.callsFake((callback) => {
            callback({
                execution: {
                    commandLine: {
                        value: 'python script.py',
                        isTrusted: true,
                    },
                },
            });
            return {
                dispose: () => {
                    // Do nothing
                },
            };
        });

        registerTriggerForTerminalREPL([]);

        expect(telemetryStub.calledOnce).to.be.true;
        expect(telemetryStub.args[0][0]).to.equal(EventName.REPL);
        expect(telemetryStub.args[0][2]).to.deep.equal({ replType: 'runningScript' });
    });

    test('Should send unittest CLI telemetry when pytest is invoked', () => {
        windowApisStub.callsFake((callback) => {
            callback({
                execution: {
                    commandLine: {
                        value: 'python -m pytest',
                        isTrusted: true,
                    },
                },
            });
            return {
                dispose: () => {
                    // Do nothing
                },
            };
        });

        registerTriggerForTerminalREPL([]);

        expect(telemetryStub.calledOnce).to.be.true;
        expect(telemetryStub.args[0][0]).to.equal(EventName.UNITTEST_RUN_CLI);
    });

    test('Should send unittest CLI telemetry when unittest is invoked', () => {
        windowApisStub.callsFake((callback) => {
            callback({
                execution: {
                    commandLine: {
                        value: 'python -m unittest discover',
                        isTrusted: true,
                    },
                },
            });
            return {
                dispose: () => {
                    // Do nothing
                },
            };
        });

        registerTriggerForTerminalREPL([]);

        expect(telemetryStub.calledOnce).to.be.true;
        expect(telemetryStub.args[0][0]).to.equal(EventName.UNITTEST_RUN_CLI);
    });

    test('Should send unittest CLI telemetry when py.test is invoked', () => {
        windowApisStub.callsFake((callback) => {
            callback({
                execution: {
                    commandLine: {
                        value: 'py.test',
                        isTrusted: true,
                    },
                },
            });
            return {
                dispose: () => {
                    // Do nothing
                },
            };
        });

        registerTriggerForTerminalREPL([]);

        expect(telemetryStub.calledOnce).to.be.true;
        expect(telemetryStub.args[0][0]).to.equal(EventName.UNITTEST_RUN_CLI);
    });
});
