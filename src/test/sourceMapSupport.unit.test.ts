// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import { ConfigurationTarget } from 'vscode';
import { Diagnostics } from '../client/common/utils/localize';
import * as sourceMaps from '../client/sourceMapSupport';
import { noop, sleep } from './core';

suite('Source Map Support', () => {
    function createVSCStub(isEnabled: boolean = false, selectDisableButton: boolean = false) {
        const stubInfo = {
            configValueRetrieved: false,
            configValueUpdated: false,
            messageDisplayed: false
        };
        const vscode = {
            workspace: {
                getConfiguration: (setting: string, _defaultValue: any) => {
                    if (setting !== 'python.diagnostics') {
                        return;
                    }
                    return {
                        get: (prop: string) => {
                            stubInfo.configValueRetrieved = prop === 'sourceMapsEnabled';
                            return isEnabled;
                        },
                        update: (prop: string, value: boolean, scope: ConfigurationTarget) => {
                            if (prop === 'sourceMapsEnabled' && value === false && scope === ConfigurationTarget.Global) {
                                stubInfo.configValueUpdated = true;
                            }
                        }
                    };
                }
            },
            window: {
                showWarningMessage: () => {
                    stubInfo.messageDisplayed = true;
                    return Promise.resolve(selectDisableButton ? Diagnostics.disableSourceMaps() : undefined);
                }
            },
            ConfigurationTarget: ConfigurationTarget
        };
        return { stubInfo, vscode };
    }
    test('Test message is not displayed when source maps are not enabled', async () => {
        const stub = createVSCStub(false);
        sourceMaps.default(stub.vscode as any);
        await sleep(100);
        expect(stub.stubInfo.configValueRetrieved).to.be.equal(true, 'Config Value not retrieved');
        expect(stub.stubInfo.messageDisplayed).to.be.equal(false, 'Message displayed');
    });
    test('Test message is not displayed when source maps are not enabled', async () => {
        const stub = createVSCStub(true);
        const instance = new class extends sourceMaps.SourceMapSupport {
            protected initializeSourceMaps() {
                noop();
            }
        }(stub.vscode as any);
        await instance.initialize();
        expect(stub.stubInfo.configValueRetrieved).to.be.equal(true, 'Config Value not retrieved');
        expect(stub.stubInfo.messageDisplayed).to.be.equal(true, 'Message displayed');
        expect(stub.stubInfo.configValueUpdated).to.be.equal(false, 'Config Value updated');
    });
    test('Test message is not displayed when source maps are not enabled', async () => {
        const stub = createVSCStub(true, true);
        const instance = new class extends sourceMaps.SourceMapSupport {
            protected initializeSourceMaps() {
                noop();
            }
        }(stub.vscode as any);
        await instance.initialize();
        expect(stub.stubInfo.configValueRetrieved).to.be.equal(true, 'Config Value not retrieved');
        expect(stub.stubInfo.messageDisplayed).to.be.equal(true, 'Message displayed');
        expect(stub.stubInfo.configValueUpdated).to.be.equal(true, 'Config Value not updated');
    });
});
