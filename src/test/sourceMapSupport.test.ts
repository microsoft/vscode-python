// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as fs from 'fs';
import { ConfigurationTarget, Disposable } from 'vscode';
import { FileSystem } from '../client/common/platform/fileSystem';
import { Diagnostics } from '../client/common/utils/localize';
import { SourceMapSupport } from '../client/sourceMapSupport';
import { noop } from './core';

suite('Source Map Support', () => {
    function createVSCStub(isEnabled: boolean = false, selectDisableButton: boolean = false) {
        const stubInfo = {
            configValueRetrieved: false,
            configValueUpdated: false,
            messageDisplayed: false,
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
                            if (
                                prop === 'sourceMapsEnabled' &&
                                value === false &&
                                scope === ConfigurationTarget.Global
                            ) {
                                stubInfo.configValueUpdated = true;
                            }
                        },
                    };
                },
            },
            window: {
                showWarningMessage: () => {
                    stubInfo.messageDisplayed = true;
                    return Promise.resolve(selectDisableButton ? Diagnostics.disableSourceMaps() : undefined);
                },
            },
            ConfigurationTarget: ConfigurationTarget,
        };
        return { stubInfo, vscode };
    }

    const disposables: Disposable[] = [];
    teardown(() => {
        disposables.forEach((disposable) => {
            try {
                disposable.dispose();
            } catch {
                noop();
            }
        });
    });
    test('When disabling source maps, the map file is renamed and vice versa', async () => {
        const fileSystem = new FileSystem();
        const jsFile = await fileSystem.createTemporaryFile('.js');
        disposables.push(jsFile);
        const mapFile = `${jsFile.filePath}.map`;
        disposables.push({
            dispose: () => fs.unlinkSync(mapFile),
        });
        await fileSystem.writeFile(mapFile, 'ABC');
        expect(await fileSystem.fileExists(mapFile)).to.be.true;

        const stub = createVSCStub(true, true);
        const instance = new (class extends SourceMapSupport {
            public async enableSourceMap(enable: boolean, sourceFile: string) {
                return super.enableSourceMap(enable, sourceFile);
            }
        })(stub.vscode as any);

        await instance.enableSourceMap(false, jsFile.filePath);

        expect(await fileSystem.fileExists(jsFile.filePath)).to.be.equal(true, 'Source file does not exist');
        expect(await fileSystem.fileExists(mapFile)).to.be.equal(false, 'Source map file not renamed');
        expect(await fileSystem.fileExists(`${mapFile}.disabled`)).to.be.equal(true, 'Expected renamed file not found');

        await instance.enableSourceMap(true, jsFile.filePath);

        expect(await fileSystem.fileExists(jsFile.filePath)).to.be.equal(true, 'Source file does not exist');
        expect(await fileSystem.fileExists(mapFile)).to.be.equal(true, 'Source map file not found');
        expect(await fileSystem.fileExists(`${mapFile}.disabled`)).to.be.equal(false, 'Source map file not renamed');
    });
});
