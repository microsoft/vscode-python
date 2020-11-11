// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import { cloneDeep } from 'lodash';
import * as path from 'path';
import * as sinon from 'sinon';
import * as executablesAPI from '../../../../../client/common/utils/exec';
import * as platformAPI from '../../../../../client/common/utils/platform';
import {
    PythonEnvInfo,
    PythonEnvKind,
    PythonExecutableInfo,
} from '../../../../../client/pythonEnvironments/base/info';
import * as envInfoAPI from '../../../../../client/pythonEnvironments/base/info/env';
import { PythonLocatorQuery } from '../../../../../client/pythonEnvironments/base/locator';
import {
    WindowsKnownPathsLocator,
} from '../../../../../client/pythonEnvironments/base/locators/lowLevel/windowsKnownPathsLocator';
import { PythonEnvsChangedEvent } from '../../../../../client/pythonEnvironments/base/watcher';
import * as extDeps from '../../../../../client/pythonEnvironments/common/externalDependencies';
import { createNamedEnv, getEnvs } from '../../common';

const EMPTY_EXECUTABLE: PythonExecutableInfo = {
    filename: '',
    ctime: -1,
    mtime: -1,
    sysPrefix: '',
};

function createMinEnv(verStr: string, exec: string): PythonEnvInfo {
    const env = createNamedEnv('', verStr, PythonEnvKind.Unknown, exec);
    env.arch = platformAPI.Architecture.Unknown;
    return env;
}

suite('Python envs locator - WindowsKnownPathsLocator', () => {
    let cleanUps: (() => void)[];
    let stubs: {
        getPATH: sinon.SinonStub;
        isExecutable: sinon.SinonStub;
        normFile: sinon.SinonStub;
        listDir: sinon.SinonStub;
        isDir: sinon.SinonStub;
        getInfo: sinon.SinonStub;
        getOSType: sinon.SinonStub;
    };

    suiteSetup(function () {
        if (platformAPI.getOSType() !== platformAPI.OSType.Windows) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
    });
    setup(() => {
        cleanUps = [];

        stubs = {
            getPATH: sinon.stub(executablesAPI, 'getSearchPathEntries'),
            isExecutable: sinon.stub(executablesAPI, 'isValidAndExecutable'),
            normFile: sinon.stub(extDeps, 'normalizePath'),
            listDir: sinon.stub(extDeps, 'listDir'),
            isDir: sinon.stub(extDeps, 'isDirectory'),
            getInfo: sinon.stub(envInfoAPI, 'getMaxDerivedEnvInfo'),
            getOSType: sinon.stub(platformAPI, 'getOSType'),
        };
        cleanUps.push(
            stubs.getPATH.restore,
            stubs.isExecutable.restore,
            stubs.normFile.restore,
            stubs.listDir.restore,
            stubs.isDir.restore,
            stubs.getInfo.restore,
            stubs.getOSType.restore,
        );

        stubs.getOSType.returns(platformAPI.OSType.Windows);
        stubs.normFile.callsFake((f: string) => {
            const norm = path.normalize(f);
            if (path.sep === '/') {
                return norm;
            }
            return norm.toLowerCase();
        });
    });
    teardown(() => {
        cleanUps.forEach((f) => f());
    });

    function setExecutables(executables: string[]): string[] {
        function parseInput(exec: string): [string, boolean, boolean] {
            let file = exec.trim();
            let isExecutable = true;
            let isDir = false;
            if (file.startsWith('(')) {
                if (!file.endsWith(')')) {
                    throw Error(`bad input "${exec}"`);
                }
                file = file.slice(1, -1);
                if (file.endsWith('/')) {
                    throw Error(`bad input "${exec}"`);
                }
                isExecutable = false;
            } else if (file.startsWith(')')) {
                throw Error(`bad input "${exec}"`);
            } else if (file.endsWith('/')) {
                isDir = true;
                file = file.slice(0, -1);
            }
            file = path.normalize(file);
            return [file, isDir, isExecutable];
        }

        const filesOnPATH: string[] = [];
        const roots: string[] = [];
        let curRoot = '';
        let curFiles: string[] = [];
        for (const executable of executables) {
            // We ignore "isExecutable'.  See below for more info.
            const [normalized, isDir] = parseInput(executable);
            if (!executable.startsWith(' ')) {
                // It's a $PATH entry.
                if (!isDir) {
                    throw Error(`bad input "${executable}"`);
                }
                if (curRoot !== '') {
                    // Set up for the previous root before replacing it.
                    stubs.listDir.withArgs(curRoot).resolves(curFiles);
                }
                roots.push(normalized);
                curRoot = normalized;
                curFiles = [];
            } else {
                const basename = normalized;
                if (basename.includes('/')) {
                    throw Error(`bad input "${executable}"`);
                }
                curFiles.push(basename);
                const filename = path.join(curRoot, basename);
                if (!isDir) {
                    filesOnPATH.push(filename);
                    // At the moment node does not give us a good way
                    // to known on Windows if a file is executable.
                    // So for now we admit we do not know by
                    // returning `undefined`.
                    stubs.isExecutable.withArgs(filename).resolves(undefined);
                }
                stubs.isDir.withArgs(filename).resolves(isDir);
            }
        }
        if (curRoot !== '') {
            // Set up the last root (if there was one).
            stubs.listDir.withArgs(curRoot).resolves(curFiles);
        }
        stubs.getPATH.returns(roots);
        return filesOnPATH;
    }

    suite('onChanged()', () => {
        test('not triggered if not initialized', async () => {
            const locator = new WindowsKnownPathsLocator();
            let triggered: PythonEnvsChangedEvent | undefined;

            locator.onChanged((event) => {
                triggered = event;
            });

            assert.equal(triggered, undefined);
        });

        // For now `onChanged` is never triggered,
        // so there are no other cases to test.
    });

    suite('iterEnvs()', () => {
        test('no executables found', async () => {
            const expected: PythonEnvInfo[] = [];
            const locator = new WindowsKnownPathsLocator();
            setExecutables([]);
            stubs.getInfo.throws('unexpected');
            const query: PythonLocatorQuery | undefined = undefined;

            const iterator = locator.iterEnvs(query);
            const envs = await getEnvs(iterator);

            assert.deepEqual(envs, expected);
        });

        test('no Python executables found', async () => {
            const expected: PythonEnvInfo[] = [];
            const locator = new WindowsKnownPathsLocator();
            setExecutables([
                '/x/y/z/',
                '  (spam.txt)',
                '  spam.exe',
                '  (python)',
                '  (python3)',
                '  (python3.8)',
                '  python2.7.11.exe',
                '  python3.8.1.exe',
                '  python3.8.1rc1.10213.exe',
                '  pythonX.exe',
                '  my-python.exe',
                '  (python.txt)',
            ]);
            stubs.getInfo.throws('unexpected');
            const query: PythonLocatorQuery | undefined = undefined;

            const iterator = locator.iterEnvs(query);
            const envs = await getEnvs(iterator);

            assert.deepEqual(envs, expected);
        });

        test('Python executables found (initialized)', async () => {
            const expected: PythonEnvInfo[] = [
                // On Windows we do not assume 2.7 for "python.exe".
                createMinEnv('', '/x/y/z/python.exe'),
                createMinEnv('2.7', '/x/y/z/python2.exe'),
                createMinEnv('2.7', '/x/y/z/python2.7.exe'),
                createMinEnv('3', '/x/y/z/python3.exe'),
                createMinEnv('3.8', '/x/y/z/python3.8.exe'),
                createMinEnv('3.11', '/x/y/z/python3.11.exe'),
            ];
            const locator = new WindowsKnownPathsLocator();
            setExecutables([
                '/x/y/z/',
                '  (spam.txt)',
                '  spam.exe',
                '  python.exe',
                '  python2.exe',
                '  python2.7.exe',
                '  python3.exe',
                '  python3.8.exe',
                '  python3.11.exe',
            ]);
            stubs.getInfo.resolvesArg(0);
            await locator.initialize();
            const query: PythonLocatorQuery | undefined = undefined;

            const iterator = locator.iterEnvs(query);
            const envs = await getEnvs(iterator);

            assert.deepEqual(envs, expected);
        });

        test('Python executables found (not initialized)', async () => {
            const expected: PythonEnvInfo[] = [
                createMinEnv('2.7', '/x/y/z/python2.exe'),
                createMinEnv('3.8', '/x/y/z/python3.8.exe'),
            ];
            const locator = new WindowsKnownPathsLocator();
            setExecutables([
                '/x/y/z/',
                '  spam.exe',
                '  python2.exe',
                '  python3.8.exe',
            ]);
            stubs.getInfo.resolvesArg(0);
            const query: PythonLocatorQuery | undefined = undefined;

            const iterator = locator.iterEnvs(query);
            const envs = await getEnvs(iterator);

            assert.deepEqual(envs, expected);
        });
    });

    suite('resolveEnv()', () => {
        function setFullEnvs(files: string[]) {
            setExecutables(files);

            const seen : PythonEnvInfo[] = [];
            stubs.getInfo.callsFake((e) => {
                const updated = cloneDeep(e);
                updated.name = `env${seen.length + 1}`;
                seen.push(e);
                return Promise.resolve(updated);
            });
        }

        test('filename provided, env already known', async () => {
            const filename = '/x/y/z/python3.8.exe';
            const expected = createMinEnv('3.8', filename);
            expected.name = 'env2';
            const locator = new WindowsKnownPathsLocator();
            setFullEnvs([
                '/x/y/z/',
                '  python3.exe', // env1
                '  python3.8.exe', // env2
            ]);
            await locator.initialize();

            const resolved = await locator.resolveEnv(filename);

            assert.deepEqual(resolved, expected);
        });

        test('filename provided, env not already known but matches', async () => {
            const filename = '/x/y/z/python3.8.exe';
            const expected = createMinEnv('3.8', filename);
            expected.name = 'env2';
            const locator = new WindowsKnownPathsLocator();
            setFullEnvs([
                '/x/y/z/',
                '  python3.exe', // env1
                '  python3.8.exe', // env2
            ]);
            // Note that we do not call `locator.initialize()`.

            const resolved = await locator.resolveEnv(filename);

            assert.deepEqual(resolved, expected);
        });

        test('filename provided, env does not match', async () => {
            const filename = '/x/y/z/python.exe';
            const locator = new WindowsKnownPathsLocator();
            setFullEnvs([
                '/x/y/z/',
                '  python3.exe', // env1
                '  python3.8.exe', // env2
            ]);
            await locator.initialize();

            const resolved = await locator.resolveEnv(filename);

            assert.equal(resolved, undefined);
        });

        test('partial env info provided (with executable filename)', async () => {
            const filename = '/x/y/z/python3.8.exe';
            const expected = createMinEnv('3.8', filename);
            expected.name = 'env2';
            const partialEnv: Partial<PythonEnvInfo> = {
                executable: { ...EMPTY_EXECUTABLE, filename },
            };
            const locator = new WindowsKnownPathsLocator();
            setFullEnvs([
                '/x/y/z/',
                '  python3.exe', // env1
                '  python3.8.exe', // env2
            ]);
            await locator.initialize();

            const resolved = await locator.resolveEnv(partialEnv);

            assert.deepEqual(resolved, expected);
        });

        test('partial env info provided (without executable filename)', async () => {
            const partialEnv: Partial<PythonEnvInfo> = {
                name: 'env1', // matches the first one
            };
            const locator = new WindowsKnownPathsLocator();
            setFullEnvs([
                '/x/y/z/',
                '  python3.exe', // env1
                '  python3.8.exe', // env2
            ]);
            await locator.initialize();

            const resolved = await locator.resolveEnv(partialEnv);

            assert.equal(resolved, undefined);
        });

        test('empty filename provided', async () => {
            const locator = new WindowsKnownPathsLocator();
            setFullEnvs([
                '/x/y/z/',
                '  python3.exe', // env1
                '  python3.8.exe', // env2
            ]);
            await locator.initialize();

            const resolved = await locator.resolveEnv('');

            assert.equal(resolved, undefined);
        });

        test('empty partial env info provided', async () => {
            const locator = new WindowsKnownPathsLocator();
            setFullEnvs([
                '/x/y/z/',
                '  python3.exe', // env1
                '  python3.8.exe', // env2
            ]);
            await locator.initialize();

            const resolved = await locator.resolveEnv({});

            assert.equal(resolved, undefined);
        });
    });
});
