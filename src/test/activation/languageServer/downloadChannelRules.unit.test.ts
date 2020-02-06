// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import { SemVer } from 'semver';
import * as typeMoq from 'typemoq';
import { DownloadBetaChannelRule, DownloadDailyChannelRule, DownloadStableChannelRule } from '../../../client/activation/common/downloadChannelRules';
import { IPersistentState, IPersistentStateFactory } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';

suite('Language Server Download Channel Rules', () => {
    [undefined, path.join('a', 'b')].forEach(currentFolderPath => {
        const currentFolder = currentFolderPath ? { path: currentFolderPath, version: new SemVer('0.0.0') } : undefined;
        const testSuffix = ` (${currentFolderPath ? 'with' : 'without'} an existing Language Server Folder`;

        test(`Daily channel should always download ${testSuffix}`, async () => {
            const rule = new DownloadDailyChannelRule();
            expect(await rule.shouldLookForNewLanguageServer(currentFolder)).to.be.equal(true, 'invalid value');
        });

        test(`Stable channel should be download only if folder doesn't exist ${testSuffix}`, async () => {
            const rule = new DownloadStableChannelRule();
            const hasExistingLSFolder = currentFolderPath ? false : true;
            expect(await rule.shouldLookForNewLanguageServer(currentFolder)).to.be.equal(hasExistingLSFolder, 'invalid value');
        });

        suite('Betal channel', () => {
            let serviceContainer: typeMoq.IMock<IServiceContainer>;
            let stateFactory: typeMoq.IMock<IPersistentStateFactory>;
            let state: typeMoq.IMock<IPersistentState<Boolean>>;

            setup(() => {
                serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
                stateFactory = typeMoq.Mock.ofType<IPersistentStateFactory>();
                state = typeMoq.Mock.ofType<IPersistentState<Boolean>>();
                stateFactory
                    .setup(s => s.createGlobalPersistentState(typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny()))
                    .returns(() => state.object)
                    .verifiable(typeMoq.Times.once());

                serviceContainer.setup(c => c.get(typeMoq.It.isValue(IPersistentStateFactory))).returns(() => stateFactory.object);
            });
            function setupStateValue(value: boolean) {
                state
                    .setup(s => s.value)
                    .returns(() => value)
                    .verifiable(typeMoq.Times.atLeastOnce());
            }
            test(`Should be download only if not checked previously ${testSuffix}`, async () => {
                const rule = new DownloadBetaChannelRule(serviceContainer.object);
                setupStateValue(true);
                expect(await rule.shouldLookForNewLanguageServer(currentFolder)).to.be.equal(true, 'invalid value');
            });
            test(`Should be download only if checked previously ${testSuffix}`, async () => {
                const rule = new DownloadBetaChannelRule(serviceContainer.object);
                setupStateValue(false);
                const shouldDownload = currentFolderPath ? false : true;
                expect(await rule.shouldLookForNewLanguageServer(currentFolder)).to.be.equal(shouldDownload, 'invalid value');
            });
        });
    });
});
