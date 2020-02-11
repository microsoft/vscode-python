// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-unused-expression chai-vague-errors no-unnecessary-override max-func-body-length max-classes-per-file match-default-export-name

import { expect } from 'chai';
import * as path from 'path';
import rewiremock from 'rewiremock';
import * as sinon from 'sinon';
import { ConfigurationTarget, Disposable } from 'vscode';
import { Diagnostics } from '../client/common/utils/localize';
import { EXTENSION_ROOT_DIR } from '../client/constants';
import { initialize, SourceMapSupport } from '../client/sourceMapSupport';
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
                // tslint:disable-next-line: no-any
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
                            if (
                                prop === 'sourceMapsEnabled' &&
                                value === false &&
                                scope === ConfigurationTarget.Global
                            ) {
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

    const disposables: Disposable[] = [];
    teardown(() => {
        rewiremock.disable();
        disposables.forEach(disposable => {
            try {
                disposable.dispose();
            } catch {
                noop();
            }
        });
    });
    test('Test message is not displayed when source maps are not enabled', async () => {
        const stub = createVSCStub(false);
        // tslint:disable-next-line: no-any
        initialize(stub.vscode as any);
        await sleep(100);
        expect(stub.stubInfo.configValueRetrieved).to.be.equal(true, 'Config Value not retrieved');
        expect(stub.stubInfo.messageDisplayed).to.be.equal(false, 'Message displayed');
    });
    test('Test message is displayed when source maps are not enabled', async () => {
        const stub = createVSCStub(true);
        const instance = new (class extends SourceMapSupport {
            protected async enableSourceMaps(_enable: boolean) {
                noop();
            }
            // tslint:disable-next-line: no-any
        })(stub.vscode as any);
        rewiremock.enable();
        const installStub = sinon.stub();
        rewiremock('source-map-support').with({ install: installStub });
        await instance.initialize();

        expect(installStub.callCount).to.be.equal(1);
        expect(stub.stubInfo.configValueRetrieved).to.be.equal(true, 'Config Value not retrieved');
        expect(stub.stubInfo.messageDisplayed).to.be.equal(true, 'Message displayed');
        expect(stub.stubInfo.configValueUpdated).to.be.equal(false, 'Config Value updated');
    });
    test('Test message is not displayed when source maps are not enabled', async () => {
        const stub = createVSCStub(true, true);
        const instance = new (class extends SourceMapSupport {
            protected async enableSourceMaps(_enable: boolean) {
                noop();
            }
            // tslint:disable-next-line: no-any
        })(stub.vscode as any);

        await instance.initialize();
        expect(stub.stubInfo.configValueRetrieved).to.be.equal(true, 'Config Value not retrieved');
        expect(stub.stubInfo.messageDisplayed).to.be.equal(true, 'Message displayed');
        expect(stub.stubInfo.configValueUpdated).to.be.equal(true, 'Config Value not updated');
    });
    async function testRenamingFilesWhenEnablingDisablingSourceMaps(enableSourceMaps: boolean) {
        const stub = createVSCStub(true, true);
        const sourceFilesPassed: string[] = [];
        const instance = new (class extends SourceMapSupport {
            public async enableSourceMaps(enable: boolean) {
                return super.enableSourceMaps(enable);
            }
            public async enableSourceMap(enable: boolean, sourceFile: string) {
                expect(enable).to.equal(enableSourceMaps);
                sourceFilesPassed.push(sourceFile);
                return Promise.resolve();
            }
            // tslint:disable-next-line: no-any
        })(stub.vscode as any);

        await instance.enableSourceMaps(enableSourceMaps);
        const extensionSourceMap = path.join(EXTENSION_ROOT_DIR, 'out', 'client', 'extension.js');
        const debuggerSourceMap = path.join(EXTENSION_ROOT_DIR, 'out', 'client', 'debugger', 'debugAdapter', 'main.js');
        expect(sourceFilesPassed).to.deep.equal([extensionSourceMap, debuggerSourceMap]);
    }
    test('Rename extension and debugger source maps when enabling source maps', () =>
        testRenamingFilesWhenEnablingDisablingSourceMaps(true));
    test('Rename extension and debugger source maps when disabling source maps', () =>
        testRenamingFilesWhenEnablingDisablingSourceMaps(false));
});
