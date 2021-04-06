// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as sinon from 'sinon';
import { getOSType, OSType } from '../../../../../client/common/utils/platform';
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
    const baseDir = '/this/is/a/fake/path';
    const callback = async () => Promise.resolve(PythonEnvKind.System);
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
        constructor(
            watcherKind: FSWatcherKind,
            opts: {
                envStructure?: binWatcher.PythonEnvStructure;
            } = {},
        ) {
            super(() => baseDir, callback, opts, watcherKind);
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

    [
        binWatcher.PythonEnvStructure.Standard,
        binWatcher.PythonEnvStructure.Flat,
        // `undefined` means "use the default".
        undefined,
    ].forEach((envStructure) => {
        suite(`${envStructure || 'default'} structure`, () => {
            const expected =
                getOSType() === OSType.Windows
                    ? [
                          // The first one is the basename glob.
                          'python.exe',
                          '*/python.exe',
                          '*/Scripts/python.exe',
                      ]
                    : [
                          // The first one is the basename glob.
                          'python',
                          '*/python',
                          '*/bin/python',
                      ];
            if (envStructure === binWatcher.PythonEnvStructure.Flat) {
                while (expected.length > 1) {
                    expected.pop();
                }
            }

            const watcherKinds = [FSWatcherKind.Global, FSWatcherKind.Workspace];
            const watcherExperiment = [true, false];

            const opts = {
                envStructure,
            };

            watcherKinds.forEach((watcherKind) => {
                suite(`watching ${FSWatcherKind[watcherKind]}`, () => {
                    watcherExperiment.forEach((experiment) => {
                        test(`${experiment ? '' : 'not '}in experiment`, async () => {
                            inExperimentStub.resolves(experiment);

                            const testWatcher = new TestWatcher(watcherKind, opts);
                            await testWatcher.initialize();

                            // Watcher should be called for all workspace locators. For global locators it should be called only if
                            // the watcher experiment allows it
                            if (
                                (watcherKind === FSWatcherKind.Global && experiment) ||
                                watcherKind === FSWatcherKind.Workspace
                            ) {
                                assert.equal(watchLocationStub.callCount, expected.length);
                                expected.forEach((glob) => {
                                    assert.ok(watchLocationStub.calledWithMatch(baseDir, sinon.match.any, glob));
                                });
                            } else {
                                assert.ok(watchLocationStub.notCalled);
                            }
                        });
                    });
                });
            });
        });
    });
});
