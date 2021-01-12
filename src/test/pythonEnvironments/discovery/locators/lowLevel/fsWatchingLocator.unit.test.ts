// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as sinon from 'sinon';
import { Disposables } from '../../../../../client/common/utils/resourceLifecycle';
import { PythonEnvInfo, PythonEnvKind } from '../../../../../client/pythonEnvironments/base/info';
import { IPythonEnvsIterator } from '../../../../../client/pythonEnvironments/base/locator';
import {
    FSWatcherKind,
    FSWatchingLocator,
} from '../../../../../client/pythonEnvironments/base/locators/lowLevel/fsWatchingLocator';
import * as externalDeps from '../../../../../client/pythonEnvironments/common/externalDependencies';
import * as binWatcher from '../../../../../client/pythonEnvironments/common/pythonBinariesWatcher';

suite('File System Watching Locator Tests', () => {
    let inExperimentStub: sinon.SinonStub;
    let watchLocationStub: sinon.SinonStub;

    setup(() => {
        inExperimentStub = sinon.stub(externalDeps, 'inExperiment');

        watchLocationStub = sinon.stub(binWatcher, 'watchLocationForPythonBinaries');
        watchLocationStub.resolves(new Disposables());
    });

    teardown(() => {
        inExperimentStub.restore();
        watchLocationStub.restore();
    });

    class TestWatcher extends FSWatchingLocator {
        constructor(watcherKind: FSWatcherKind) {
            super(
                () => '/this/is/a/fake/path',
                async () => Promise.resolve(PythonEnvKind.System),
                {},
                watcherKind,
            );
        }

        public async initialize() {
            await this.initWatchers();
        }

        // eslint-disable-next-line class-methods-use-this
        protected doIterEnvs(): IPythonEnvsIterator {
            throw new Error('Method not implemented.');
        }

        // eslint-disable-next-line class-methods-use-this
        protected doResolveEnv(): Promise<PythonEnvInfo | undefined> {
            throw new Error('Method not implemented.');
        }
    }

    const watcherKinds = [FSWatcherKind.Global, FSWatcherKind.Workspace];
    const watcherExperiment = [true, false];

    watcherKinds.forEach((watcherKind) => {
        watcherExperiment.forEach((experiment) => {
            test(`When watcher experiment is ${experiment} and watching ${FSWatcherKind[watcherKind]}`, async () => {
                inExperimentStub.resolves(experiment);

                const testWatcher = new TestWatcher(watcherKind);
                await testWatcher.initialize();

                // Watcher should be called for all workspace locators. For global locators it should be called only if
                // the watcher experiment allows it
                if ((watcherKind === FSWatcherKind.Global && experiment) || watcherKind === FSWatcherKind.Workspace) {
                    assert.ok(watchLocationStub.calledOnce);
                } else {
                    assert.ok(watchLocationStub.notCalled);
                }
            });
        });
    });
});
