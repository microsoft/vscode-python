// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { Event, EventEmitter, Uri } from 'vscode';
import { IPlatformService } from '../../../../client/common/platform/types';
import { IDisposableRegistry } from '../../../../client/common/types';
import { createDeferred } from '../../../../client/common/utils/async';
import { getNamesAndValues } from '../../../../client/common/utils/enum';
import { Architecture, OSType } from '../../../../client/common/utils/platform';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    IInterpreterLocatorHelper,
    IInterpreterLocatorService,
    KNOWN_PATH_SERVICE,
    PIPENV_SERVICE,
    WINDOWS_REGISTRY_SERVICE,
    WORKSPACE_VIRTUAL_ENV_SERVICE,
} from '../../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../../client/ioc/types';
import { PythonEnvInfo, PythonEnvKind } from '../../../../client/pythonEnvironments/base/info';
import { PythonEnvsChangedEvent } from '../../../../client/pythonEnvironments/base/watcher';
import {
    PythonInterpreterLocatorService,
    WorkspaceLocators,
} from '../../../../client/pythonEnvironments/discovery/locators';
import { EnvironmentType, PythonEnvironment } from '../../../../client/pythonEnvironments/info';
import {
    createEnv, createLocatedEnv, getEnvs, SimpleLocator,
} from '../../base/common';

class WorkspaceFolders {
    public added = new EventEmitter<Uri>();

    public removed = new EventEmitter<Uri>();

    public readonly roots: Uri[];

    constructor(roots: (Uri | string)[]) {
        this.roots = roots.map((r) => (typeof r === 'string' ? Uri.file(r) : r));
    }

    public get onAdded(): Event<Uri> {
        return this.added.event;
    }

    public get onRemoved(): Event<Uri> {
        return this.removed.event;
    }
}

suite('WorkspaceLocators', () => {
    suite('activate', () => {
        test('factories get triggered', () => {
            const expected: [Uri, number][] = [
                // from activate():
                [Uri.file('foo'), 1],
                [Uri.file('foo'), 2],
                [Uri.file('bar'), 1],
                [Uri.file('bar'), 2],
                // from onAdded:
                [Uri.file('baz'), 1],
                [Uri.file('baz'), 2],
            ];
            // Force r._formatted to be set.
            expected.forEach(([r]) => r.toString());
            const calls: [Uri, number][] = [];
            const locators = new WorkspaceLocators([
                (r) => {
                    calls.push([r, 1]);
                    return [];
                },
                (r) => {
                    calls.push([r, 2]);
                    return [];
                },
            ]);
            const folders = new WorkspaceFolders(['foo', 'bar']);

            locators.activate(folders);
            folders.added.fire(Uri.file('baz'));

            expect(calls).to.deep.equal(expected);
        });
    });

    suite('onChanged', () => {
        test('no roots', () => {
            const expected: PythonEnvsChangedEvent[] = [];
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const loc1 = new SimpleLocator([env1]);
            const locators = new WorkspaceLocators([
                () => [loc1],
            ]);
            const folders = new WorkspaceFolders([]);
            locators.activate(folders);
            const events: PythonEnvsChangedEvent[] = [];
            locators.onChanged((e) => events.push(e));
            const event1: PythonEnvsChangedEvent = { kind: PythonEnvKind.Unknown };

            loc1.fire(event1);

            expect(events).to.deep.equal(expected);
        });

        test('no factories', () => {
            const expected: PythonEnvsChangedEvent[] = [];
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const loc1 = new SimpleLocator([env1]);
            const locators = new WorkspaceLocators([]);
            const folders = new WorkspaceFolders(['foo', 'bar']);
            locators.activate(folders);
            const events: PythonEnvsChangedEvent[] = [];
            locators.onChanged((e) => events.push(e));
            const event1: PythonEnvsChangedEvent = { kind: PythonEnvKind.Unknown };

            loc1.fire(event1);

            expect(events).to.deep.equal(expected);
        });

        test('consolidates events across roots', () => {
            const root1 = Uri.file('foo');
            const root2 = Uri.file('bar');
            const expected: PythonEnvsChangedEvent[] = [
                { searchLocation: root1, kind: PythonEnvKind.Unknown },
                { searchLocation: root2, kind: PythonEnvKind.Venv },
                { searchLocation: root1 },
                { searchLocation: root2, kind: PythonEnvKind.Venv },
                { searchLocation: root2, kind: PythonEnvKind.Pipenv },
                { searchLocation: root1, kind: PythonEnvKind.Conda },
            ];
            const event1: PythonEnvsChangedEvent = { kind: PythonEnvKind.Unknown };
            const event2: PythonEnvsChangedEvent = { kind: PythonEnvKind.Venv };
            const event3: PythonEnvsChangedEvent = {};
            const event4: PythonEnvsChangedEvent = { kind: PythonEnvKind.Venv };
            const event5: PythonEnvsChangedEvent = { kind: PythonEnvKind.Pipenv };
            const event6: PythonEnvsChangedEvent = { kind: PythonEnvKind.Conda };
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const loc1 = new SimpleLocator([env1]);
            const loc2 = new SimpleLocator([]);
            const loc3 = new SimpleLocator([]);
            const loc4 = new SimpleLocator([]);
            const loc5 = new SimpleLocator([]);
            const loc6 = new SimpleLocator([]);
            const locators = new WorkspaceLocators([
                (r) => (r === root1 ? [loc1] : [loc2]),
                (r) => (r === root1 ? [loc3] : [loc4, loc5]),
                (r) => (r === root1 ? [loc6] : []),
            ]);
            const folders = new WorkspaceFolders([root1, root2]);
            locators.activate(folders);
            const events: PythonEnvsChangedEvent[] = [];
            locators.onChanged((e) => events.push(e));

            loc1.fire(event1);
            loc2.fire(event2);
            loc3.fire(event3);
            loc4.fire(event4);
            loc5.fire(event5);
            loc6.fire(event6);

            expect(events).to.deep.equal(expected);
        });

        test('identifies roots during activation', () => {
            const root1 = Uri.file('foo');
            const root2 = Uri.file('bar');
            // Force r._formatted to be set.
            [root1, root2].forEach((r) => r.toString());
            const expected: PythonEnvsChangedEvent[] = [
                { searchLocation: root1 },
                { searchLocation: root2 },
            ];
            const locators = new WorkspaceLocators([]);
            const folders = new WorkspaceFolders(['foo', 'bar']);
            const events: PythonEnvsChangedEvent[] = [];
            locators.onChanged((e) => events.push(e));

            locators.activate(folders);

            expect(events).to.deep.equal(expected);
        });

        test('identifies added roots', () => {
            const added = Uri.file('baz');
            const expected: PythonEnvsChangedEvent[] = [
                { searchLocation: added },
            ];
            const locators = new WorkspaceLocators([]);
            const folders = new WorkspaceFolders(['foo', 'bar']);
            locators.activate(folders);
            const events: PythonEnvsChangedEvent[] = [];
            locators.onChanged((e) => events.push(e));

            folders.added.fire(added);

            expect(events).to.deep.equal(expected);
        });

        test('identifies removed roots', () => {
            const root1 = Uri.file('foo');
            const root2 = Uri.file('bar');
            // Force r._formatted to be set.
            [root1, root2].forEach((r) => r.toString());
            const expected: PythonEnvsChangedEvent[] = [
                { searchLocation: root2 },
            ];
            const locators = new WorkspaceLocators([]);
            const folders = new WorkspaceFolders([root1, root2]);
            locators.activate(folders);
            const events: PythonEnvsChangedEvent[] = [];
            locators.onChanged((e) => events.push(e));

            folders.removed.fire(root2);

            expect(events).to.deep.equal(expected);
        });

        test('does not emit events from removed roots', () => {
            const root1 = Uri.file('foo');
            const root2 = Uri.file('bar');
            const expected: PythonEnvsChangedEvent[] = [
                { searchLocation: root1, kind: PythonEnvKind.Unknown },
                { searchLocation: root2, kind: PythonEnvKind.Venv },
                { searchLocation: root2 }, // removed
                { searchLocation: root1 },
            ];
            const event1: PythonEnvsChangedEvent = { kind: PythonEnvKind.Unknown };
            const event2: PythonEnvsChangedEvent = { kind: PythonEnvKind.Venv };
            const event3: PythonEnvsChangedEvent = {};
            const event4: PythonEnvsChangedEvent = { kind: PythonEnvKind.Venv };
            const loc1 = new SimpleLocator([]);
            const loc2 = new SimpleLocator([]);
            const locators = new WorkspaceLocators([
                (r) => (r === root1 ? [loc1] : [loc2]),
            ]);
            const folders = new WorkspaceFolders([root1, root2]);
            locators.activate(folders);
            const events: PythonEnvsChangedEvent[] = [];
            locators.onChanged((e) => events.push(e));

            loc1.fire(event1);
            loc2.fire(event2);
            folders.removed.fire(root2);
            loc1.fire(event3);
            loc2.fire(event4);

            expect(events).to.deep.equal(expected);
        });
    });

    suite('iterEnvs()', () => {
        test('no roots', async () => {
            const expected: PythonEnvInfo[] = [];
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const loc1 = new SimpleLocator([env1]);
            const locators = new WorkspaceLocators([
                () => [loc1],
            ]);
            const folders = new WorkspaceFolders([]);
            locators.activate(folders);

            const iterators = locators.iterEnvs();
            const envs = await getEnvs(iterators);

            expect(envs).to.deep.equal(expected);
        });

        test('no factories', async () => {
            const expected: PythonEnvInfo[] = [];
            const locators = new WorkspaceLocators([]);
            const folders = new WorkspaceFolders(['foo', 'bar']);
            locators.activate(folders);

            const iterators = locators.iterEnvs();
            const envs = await getEnvs(iterators);

            expect(envs).to.deep.equal(expected);
        });

        test('one empty', async () => {
            const root1 = Uri.file('foo');
            const expected: PythonEnvInfo[] = [];
            const loc1 = new SimpleLocator([]);
            const locators = new WorkspaceLocators([
                () => [loc1],
            ]);
            const folders = new WorkspaceFolders([root1]);
            locators.activate(folders);

            const iterators = locators.iterEnvs();
            const envs = await getEnvs(iterators);

            expect(envs).to.deep.equal(expected);
        });

        test('one not empty', async () => {
            const root1 = Uri.file('foo');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const expected: PythonEnvInfo[] = [env1];
            const loc1 = new SimpleLocator([env1]);
            const locators = new WorkspaceLocators([
                () => [loc1],
            ]);
            const folders = new WorkspaceFolders([root1]);
            locators.activate(folders);

            const iterators = locators.iterEnvs();
            const envs = await getEnvs(iterators);

            expect(envs).to.deep.equal(expected);
        });

        test('empty locator ignored', async () => {
            const root1 = Uri.file('foo');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const env2 = createEnv('python2', '2.7', PythonEnvKind.Pipenv);
            const expected: PythonEnvInfo[] = [env1, env2];
            const loc1 = new SimpleLocator([env1]);
            const loc2 = new SimpleLocator([], { before: loc1.done });
            const loc3 = new SimpleLocator([env2], { before: loc2.done });
            const locators = new WorkspaceLocators([
                () => [loc1, loc2, loc3],
            ]);
            const folders = new WorkspaceFolders([root1]);
            locators.activate(folders);

            const iterators = locators.iterEnvs();
            const envs = await getEnvs(iterators);

            expect(envs).to.deep.equal(expected);
        });

        test('consolidates envs across roots', async () => {
            const root1 = Uri.file('foo');
            const root2 = Uri.file('bar');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const env2 = createLocatedEnv('foo/some-dir', '3.8.1', PythonEnvKind.Conda);
            const env3 = createEnv('python2', '2.7', PythonEnvKind.Pipenv);
            const env4 = createEnv('42', '3.9.0rc2', PythonEnvKind.Pyenv);
            const env5 = createEnv('hello world', '3.8', PythonEnvKind.VirtualEnv);
            const env6 = createEnv('spam', '3.10.0a0', PythonEnvKind.OtherVirtual);
            const env7 = createEnv('eggs', '3.9.1a0', PythonEnvKind.Venv);
            const env8 = createEnv('foo', '3.5.12b1', PythonEnvKind.Venv);
            const expected: PythonEnvInfo[] = [env1, env2, env3, env4, env5, env6, env7, env8];
            const loc1 = new SimpleLocator([env1, env2]);
            const loc2 = new SimpleLocator([env3, env4], { before: loc1.done });
            const loc3 = new SimpleLocator([env5, env6], { before: loc2.done });
            const loc4 = new SimpleLocator([env7, env8], { before: loc3.done });
            const locators = new WorkspaceLocators([
                (r) => (r === root1 ? [loc1] : [loc3]),
                (r) => (r === root1 ? [loc2] : [loc4]),
            ]);
            const folders = new WorkspaceFolders([root1, root2]);
            locators.activate(folders);

            const iterators = locators.iterEnvs();
            const envs = await getEnvs(iterators);

            expect(envs).to.deep.equal(expected);
        });

        test('query matches a root', async () => {
            const root1 = Uri.file('foo');
            const root2 = Uri.file('bar');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const env2 = createEnv('python2', '2.7', PythonEnvKind.Pipenv);
            const env3 = createEnv('hello world', '3.8', PythonEnvKind.VirtualEnv);
            const env4 = createEnv('spam', '3.10.0a0', PythonEnvKind.OtherVirtual);
            const expected: PythonEnvInfo[] = [env1, env2];
            const loc1 = new SimpleLocator([env1]);
            const loc2 = new SimpleLocator([env2], { before: loc1.done });
            const loc3 = new SimpleLocator([env3], { before: loc2.done });
            const loc4 = new SimpleLocator([env4], { before: loc3.done });
            const locators = new WorkspaceLocators([
                (r) => (r === root1 ? [loc1] : [loc3]),
                (r) => (r === root1 ? [loc2] : [loc4]),
            ]);
            const folders = new WorkspaceFolders([root1, root2]);
            locators.activate(folders);

            const iterators = locators.iterEnvs({ searchLocations: [root1] });
            const envs = await getEnvs(iterators);

            expect(envs).to.deep.equal(expected);
        });

        test('query matches all roots', async () => {
            const root1 = Uri.file('foo');
            const root2 = Uri.file('bar');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const env2 = createEnv('python2', '2.7', PythonEnvKind.Pipenv);
            const env3 = createEnv('hello world', '3.8', PythonEnvKind.VirtualEnv);
            const env4 = createEnv('spam', '3.10.0a0', PythonEnvKind.OtherVirtual);
            const expected: PythonEnvInfo[] = [env1, env2, env3, env4];
            const loc1 = new SimpleLocator([env1]);
            const loc2 = new SimpleLocator([env2], { before: loc1.done });
            const loc3 = new SimpleLocator([env3], { before: loc2.done });
            const loc4 = new SimpleLocator([env4], { before: loc3.done });
            const locators = new WorkspaceLocators([
                (r) => (r === root1 ? [loc1] : [loc3]),
                (r) => (r === root1 ? [loc2] : [loc4]),
            ]);
            const folders = new WorkspaceFolders([root1, root2]);
            locators.activate(folders);

            const iterators = locators.iterEnvs({ searchLocations: [root1, root2] });
            const envs = await getEnvs(iterators);

            expect(envs).to.deep.equal(expected);
        });

        test('query does not match a root', async () => {
            const root1 = Uri.file('foo');
            const root2 = Uri.file('bar');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const env2 = createEnv('python2', '2.7', PythonEnvKind.Pipenv);
            const env3 = createEnv('hello world', '3.8', PythonEnvKind.VirtualEnv);
            const env4 = createEnv('spam', '3.10.0a0', PythonEnvKind.OtherVirtual);
            const loc1 = new SimpleLocator([env1]);
            const loc2 = new SimpleLocator([env2], { before: loc1.done });
            const loc3 = new SimpleLocator([env3], { before: loc2.done });
            const loc4 = new SimpleLocator([env4], { before: loc3.done });
            const locators = new WorkspaceLocators([
                (r) => (r === root1 ? [loc1] : [loc3]),
                (r) => (r === root1 ? [loc2] : [loc4]),
            ]);
            const folders = new WorkspaceFolders([root1, root2]);
            locators.activate(folders);

            const iterators = locators.iterEnvs({ searchLocations: [Uri.file('baz')] });
            const envs = await getEnvs(iterators);

            expect(envs).to.deep.equal([]);
        });

        test('query has no searchLocation', async () => {
            const root1 = Uri.file('foo');
            const root2 = Uri.file('bar');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const env2 = createEnv('python2', '2.7', PythonEnvKind.Pipenv);
            const env3 = createEnv('hello world', '3.8', PythonEnvKind.VirtualEnv);
            const env4 = createEnv('spam', '3.10.0a0', PythonEnvKind.OtherVirtual);
            const expected: PythonEnvInfo[] = [env1, env2, env3, env4];
            const loc1 = new SimpleLocator([env1]);
            const loc2 = new SimpleLocator([env2], { before: loc1.done });
            const loc3 = new SimpleLocator([env3], { before: loc2.done });
            const loc4 = new SimpleLocator([env4], { before: loc3.done });
            const locators = new WorkspaceLocators([
                (r) => (r === root1 ? [loc1] : [loc3]),
                (r) => (r === root1 ? [loc2] : [loc4]),
            ]);
            const folders = new WorkspaceFolders([root1, root2]);
            locators.activate(folders);

            const iterators = locators.iterEnvs({ kinds: [PythonEnvKind.Unknown] });
            const envs = await getEnvs(iterators);

            expect(envs).to.deep.equal(expected);
        });

        test('iterate out of order', async () => {
            const root1 = Uri.file('foo');
            const root2 = Uri.file('bar');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const env2 = createLocatedEnv('foo/some-dir', '3.8.1', PythonEnvKind.Conda);
            const env3 = createEnv('python2', '2.7', PythonEnvKind.Pipenv);
            const env4 = createEnv('42', '3.9.0rc2', PythonEnvKind.Pyenv);
            const env5 = createEnv('hello world', '3.8', PythonEnvKind.VirtualEnv);
            const env6 = createEnv('spam', '3.10.0a0', PythonEnvKind.OtherVirtual);
            const env7 = createEnv('eggs', '3.9.1a0', PythonEnvKind.Venv);
            const env8 = createEnv('foo', '3.5.12b1', PythonEnvKind.Venv);
            const expected: PythonEnvInfo[] = [env5, env6, env1, env2, env3, env4, env7, env8];
            const loc3 = new SimpleLocator([env5, env6]);
            const loc1 = new SimpleLocator([env1, env2], { before: loc3.done });
            const loc2 = new SimpleLocator([env3, env4], { before: loc1.done });
            const loc4 = new SimpleLocator([env7, env8], { before: loc2.done });
            const locators = new WorkspaceLocators([
                (r) => (r === root1 ? [loc1] : [loc3]),
                (r) => (r === root1 ? [loc2] : [loc4]),
            ]);
            const folders = new WorkspaceFolders([root1, root2]);
            locators.activate(folders);

            const iterators = locators.iterEnvs();
            const envs = await getEnvs(iterators);

            expect(envs).to.deep.equal(expected);
        });

        test('iterate intermingled', async () => {
            const root1 = Uri.file('foo');
            const root2 = Uri.file('bar');
            const env1 = createEnv('foo-x', '3.8.1', PythonEnvKind.Venv);
            const env2 = createLocatedEnv('foo/some-dir', '3.8.1', PythonEnvKind.Conda);
            const env3 = createEnv('python2', '2.7', PythonEnvKind.Pipenv);
            const env4 = createEnv('42', '3.9.0rc2', PythonEnvKind.Pyenv);
            const env5 = createEnv('hello world', '3.8', PythonEnvKind.VirtualEnv);
            const env6 = createEnv('spam', '3.10.0a0', PythonEnvKind.OtherVirtual);
            const env7 = createEnv('eggs', '3.9.1a0', PythonEnvKind.Venv);
            const env8 = createEnv('foo-y', '3.5.12b1', PythonEnvKind.Venv);
            const expected = [env3, env6, env1, env2, env8, env4, env5, env7];
            const ordered = [env1, env2, env3, env4, env5, env6, env7, env8];
            const deferreds = [
                createDeferred<void>(),
                createDeferred<void>(),
                createDeferred<void>(),
                createDeferred<void>(),
                createDeferred<void>(),
                createDeferred<void>(),
                createDeferred<void>(),
                createDeferred<void>(),
            ];
            async function beforeEach(env: PythonEnvInfo) {
                const index = expected.indexOf(env);
                if (index === 0) {
                    return;
                }
                const blockedBy = ordered.indexOf(expected[index - 1]);
                await deferreds[blockedBy].promise;
            }
            async function afterEach(env: PythonEnvInfo) {
                const index = ordered.indexOf(env);
                deferreds[index].resolve();
            }
            const loc1 = new SimpleLocator([env1, env2], { beforeEach, afterEach });
            const loc2 = new SimpleLocator([env3, env4], { beforeEach, afterEach });
            const loc3 = new SimpleLocator([env5, env6], { beforeEach, afterEach });
            const loc4 = new SimpleLocator([env7, env8], { beforeEach, afterEach });
            const locators = new WorkspaceLocators([
                (r) => (r === root1 ? [loc1] : [loc3]),
                (r) => (r === root1 ? [loc2] : [loc4]),
            ]);
            const folders = new WorkspaceFolders([root1, root2]);
            locators.activate(folders);

            const iterator = locators.iterEnvs();
            const envs = await getEnvs(iterator);

            expect(envs).to.deep.equal(expected);
        });

        test('respects roots set during activation', async () => {
            const root1 = Uri.file('foo');
            const root2 = Uri.file('bar');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const env2 = createLocatedEnv('foo/some-dir', '3.8.1', PythonEnvKind.Conda);
            const env3 = createEnv('python2', '2.7', PythonEnvKind.Pipenv);
            const env4 = createEnv('42', '3.9.0rc2', PythonEnvKind.Pyenv);
            const env5 = createEnv('hello world', '3.8', PythonEnvKind.VirtualEnv);
            const env6 = createEnv('spam', '3.10.0a0', PythonEnvKind.OtherVirtual);
            const env7 = createEnv('eggs', '3.9.1a0', PythonEnvKind.Venv);
            const env8 = createEnv('foo', '3.5.12b1', PythonEnvKind.Venv);
            const expected: PythonEnvInfo[] = [env1, env2, env3, env4, env5, env6, env7, env8];
            const loc1 = new SimpleLocator([env1, env2]);
            const loc2 = new SimpleLocator([env3, env4], { before: loc1.done });
            const loc3 = new SimpleLocator([env5, env6], { before: loc2.done });
            const loc4 = new SimpleLocator([env7, env8], { before: loc3.done });
            const locators = new WorkspaceLocators([
                (r) => (r === root1 ? [loc1] : [loc3]),
                (r) => (r === root1 ? [loc2] : [loc4]),
            ]);
            const folders = new WorkspaceFolders([root1, root2]);

            const iteratorBefore = locators.iterEnvs();
            const envsBefore = await getEnvs(iteratorBefore);
            locators.activate(folders);
            const iteratorAfter = locators.iterEnvs();
            const envsAfter = await getEnvs(iteratorAfter);

            expect(envsBefore).to.deep.equal([]);
            expect(envsAfter).to.deep.equal(expected);
        });

        test('respects added roots', async () => {
            const root1 = Uri.file('foo');
            const root2 = Uri.file('bar');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const env2 = createLocatedEnv('foo/some-dir', '3.8.1', PythonEnvKind.Conda);
            const env3 = createEnv('python2', '2.7', PythonEnvKind.Pipenv);
            const env4 = createEnv('42', '3.9.0rc2', PythonEnvKind.Pyenv);
            const env5 = createEnv('hello world', '3.8', PythonEnvKind.VirtualEnv);
            const env6 = createEnv('spam', '3.10.0a0', PythonEnvKind.OtherVirtual);
            const env7 = createEnv('eggs', '3.9.1a0', PythonEnvKind.Venv);
            const env8 = createEnv('foo', '3.5.12b1', PythonEnvKind.Venv);
            const expected: PythonEnvInfo[] = [env1, env2, env3, env4, env5, env6, env7, env8];
            const loc1 = new SimpleLocator([env1, env2]);
            const loc2 = new SimpleLocator([env3, env4], { before: loc1.done });
            const loc3 = new SimpleLocator([env5, env6], { before: loc2.done });
            const loc4 = new SimpleLocator([env7, env8], { before: loc3.done });
            const locators = new WorkspaceLocators([
                (r) => (r === root1 ? [loc1] : [loc3]),
                (r) => (r === root1 ? [loc2] : [loc4]),
            ]);
            const folders = new WorkspaceFolders([]);
            locators.activate(folders);

            const iteratorBefore = locators.iterEnvs();
            const envsBefore = await getEnvs(iteratorBefore);
            folders.added.fire(root1);
            folders.added.fire(root2);
            const iteratorAfter = locators.iterEnvs();
            const envsAfter = await getEnvs(iteratorAfter);

            expect(envsBefore).to.deep.equal([]);
            expect(envsAfter).to.deep.equal(expected);
        });

        test('ignores removed roots', async () => {
            const root1 = Uri.file('foo');
            const root2 = Uri.file('bar');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const env2 = createLocatedEnv('foo/some-dir', '3.8.1', PythonEnvKind.Conda);
            const env3 = createEnv('python2', '2.7', PythonEnvKind.Pipenv);
            const env4 = createEnv('42', '3.9.0rc2', PythonEnvKind.Pyenv);
            const env5 = createEnv('hello world', '3.8', PythonEnvKind.VirtualEnv);
            const env6 = createEnv('spam', '3.10.0a0', PythonEnvKind.OtherVirtual);
            const env7 = createEnv('eggs', '3.9.1a0', PythonEnvKind.Venv);
            const env8 = createEnv('foo', '3.5.12b1', PythonEnvKind.Venv);
            const expectedBefore = [env1, env2, env3, env4, env5, env6, env7, env8];
            const expectedAfter = [env1, env2, env3, env4];
            const loc1 = new SimpleLocator([env1, env2]);
            const loc2 = new SimpleLocator([env3, env4], { before: loc1.done });
            const loc3 = new SimpleLocator([env5, env6], { before: loc2.done });
            const loc4 = new SimpleLocator([env7, env8], { before: loc3.done });
            const locators = new WorkspaceLocators([
                (r) => (r === root1 ? [loc1] : [loc3]),
                (r) => (r === root1 ? [loc2] : [loc4]),
            ]);
            const folders = new WorkspaceFolders([root1, root2]);
            locators.activate(folders);

            const iteratorBefore = locators.iterEnvs();
            const envsBefore = await getEnvs(iteratorBefore);
            folders.removed.fire(root2);
            const iteratorAfter = locators.iterEnvs();
            const envsAfter = await getEnvs(iteratorAfter);

            expect(envsBefore).to.deep.equal(expectedBefore);
            expect(envsAfter).to.deep.equal(expectedAfter);
        });
    });

    suite('resolveEnv()', () => {
        function getResolver(seen: number[], id: number, match = true) {
            return async (env: PythonEnvInfo) => {
                seen.push(id);
                return match ? env : undefined;
            };
        }

        test('no roots', async () => {
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const loc1 = new SimpleLocator([env1]);
            const locators = new WorkspaceLocators([
                () => [loc1],
            ]);
            const folders = new WorkspaceFolders([]);
            locators.activate(folders);

            const resolved = await locators.resolveEnv(env1);

            expect(resolved).to.equal(undefined, 'failed');
        });

        test('no factories', async () => {
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const locators = new WorkspaceLocators([]);
            const folders = new WorkspaceFolders(['foo', 'bar']);
            locators.activate(folders);

            const resolved = await locators.resolveEnv(env1);

            expect(resolved).to.equal(undefined, 'failed');
        });

        test('one locator, not resolved', async () => {
            const root1 = Uri.file('foo');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const loc1 = new SimpleLocator([env1], { resolve: null });
            const locators = new WorkspaceLocators([
                () => [loc1],
            ]);
            const folders = new WorkspaceFolders([root1]);
            locators.activate(folders);

            const resolved = await locators.resolveEnv(env1);

            expect(resolved).to.equal(undefined, 'failed');
        });

        test('one locator, resolved', async () => {
            const root1 = Uri.file('foo');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const expected = env1;
            const loc1 = new SimpleLocator([env1]);
            const locators = new WorkspaceLocators([
                () => [loc1],
            ]);
            const folders = new WorkspaceFolders([root1]);
            locators.activate(folders);

            const resolved = await locators.resolveEnv(env1);

            expect(resolved).to.deep.equal(expected);
        });

        test('one root, first locator resolves', async () => {
            const root1 = Uri.file('foo');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const expected = env1;
            const seen: number[] = [];
            const loc1 = new SimpleLocator([env1], { resolve: getResolver(seen, 1) });
            const loc2 = new SimpleLocator([], { resolve: getResolver(seen, 2) });
            const locators = new WorkspaceLocators([
                () => [loc1, loc2],
            ]);
            const folders = new WorkspaceFolders([root1]);
            locators.activate(folders);

            const resolved = await locators.resolveEnv(env1);

            expect(resolved).to.deep.equal(expected);
            expect(seen).to.deep.equal([1]);
        });

        test('one root, second locator resolves', async () => {
            const root1 = Uri.file('foo');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const expected = env1;
            const seen: number[] = [];
            const loc1 = new SimpleLocator([env1], { resolve: getResolver(seen, 1, false) });
            const loc2 = new SimpleLocator([], { resolve: getResolver(seen, 2) });
            const locators = new WorkspaceLocators([
                () => [loc1, loc2],
            ]);
            const folders = new WorkspaceFolders([root1]);
            locators.activate(folders);

            const resolved = await locators.resolveEnv(env1);

            expect(resolved).to.deep.equal(expected);
            expect(seen).to.deep.equal([1, 2]);
        });

        test('one root, not resolved', async () => {
            const root1 = Uri.file('foo');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const seen: number[] = [];
            const loc1 = new SimpleLocator([env1], { resolve: getResolver(seen, 1, false) });
            const loc2 = new SimpleLocator([], { resolve: getResolver(seen, 2, false) });
            const locators = new WorkspaceLocators([
                () => [loc1, loc2],
            ]);
            const folders = new WorkspaceFolders([root1]);
            locators.activate(folders);

            const resolved = await locators.resolveEnv(env1);

            expect(resolved).to.equal(undefined, 'failed');
            expect(seen).to.deep.equal([1, 2]);
        });

        test('many roots, no searchLocation, second root matches', async () => {
            const root1 = Uri.file('foo');
            const root2 = Uri.file('bar');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            const expected = env1;
            const seen: number[] = [];
            const loc1 = new SimpleLocator([env1], { resolve: getResolver(seen, 1, false) });
            const loc2 = new SimpleLocator([], { resolve: getResolver(seen, 2) });
            const locators = new WorkspaceLocators([
                (r) => (r === root1 ? [loc1] : [loc2]),
            ]);
            const folders = new WorkspaceFolders([root1, root2]);
            locators.activate(folders);

            const resolved = await locators.resolveEnv(env1);

            expect(resolved).to.deep.equal(expected);
            expect(seen).to.deep.equal([1, 2]);
        });

        test('many roots, searchLocation matches', async () => {
            const root1 = Uri.file('foo');
            const root2 = Uri.file('bar');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            env1.searchLocation = root2;
            const expected = env1;
            const seen: number[] = [];
            const loc1 = new SimpleLocator([], { resolve: getResolver(seen, 1) });
            const loc2 = new SimpleLocator([], { resolve: getResolver(seen, 2) });
            const locators = new WorkspaceLocators([
                (r) => (r === root1 ? [loc1] : [loc2]),
            ]);
            const folders = new WorkspaceFolders([root1, root2]);
            locators.activate(folders);

            const resolved = await locators.resolveEnv(env1);

            expect(resolved).to.deep.equal(expected);
            expect(seen).to.deep.equal([2]);
        });

        test('many roots, searchLocation does not match', async () => {
            const root1 = Uri.file('foo');
            const root2 = Uri.file('bar');
            const env1 = createEnv('foo', '3.8.1', PythonEnvKind.Venv);
            env1.searchLocation = Uri.file('baz');
            const expected = env1;
            const seen: number[] = [];
            const loc1 = new SimpleLocator([env1], { resolve: getResolver(seen, 1) });
            const loc2 = new SimpleLocator([], { resolve: getResolver(seen, 2) });
            const locators = new WorkspaceLocators([
                (r) => (r === root1 ? [loc1] : [loc2]),
            ]);
            const folders = new WorkspaceFolders([root1, root2]);
            locators.activate(folders);

            const resolved = await locators.resolveEnv(env1);

            expect(resolved).to.equal(expected);
            expect(seen).to.deep.equal([1]);
        });
    });
});

suite('Interpreters - Locators Index', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let platformSvc: TypeMoq.IMock<IPlatformService>;
    let helper: TypeMoq.IMock<IInterpreterLocatorHelper>;
    let locator: IInterpreterLocatorService;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        platformSvc = TypeMoq.Mock.ofType<IPlatformService>();
        helper = TypeMoq.Mock.ofType<IInterpreterLocatorHelper>();
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IDisposableRegistry))).returns(() => []);
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IPlatformService))).returns(() => platformSvc.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterLocatorHelper)))
            .returns(() => helper.object);

        locator = new PythonInterpreterLocatorService(serviceContainer.object);
    });
    [undefined, Uri.file('Something')].forEach((resource) => {
        getNamesAndValues<OSType>(OSType).forEach((osType) => {
            if (osType.value === OSType.Unknown) {
                return;
            }
            const testSuffix = `(on ${osType.name}, with${resource ? '' : 'out'} a resource)`;
            test(`All Interpreter Sources are used ${testSuffix}`, async () => {
                const locatorsTypes: string[] = [];
                if (osType.value === OSType.Windows) {
                    locatorsTypes.push(WINDOWS_REGISTRY_SERVICE);
                }
                platformSvc.setup((p) => p.osType).returns(() => osType.value);
                platformSvc.setup((p) => p.isWindows).returns(() => osType.value === OSType.Windows);
                platformSvc.setup((p) => p.isLinux).returns(() => osType.value === OSType.Linux);
                platformSvc.setup((p) => p.isMac).returns(() => osType.value === OSType.OSX);

                locatorsTypes.push(CONDA_ENV_SERVICE);
                locatorsTypes.push(CONDA_ENV_FILE_SERVICE);
                locatorsTypes.push(PIPENV_SERVICE);
                locatorsTypes.push(GLOBAL_VIRTUAL_ENV_SERVICE);
                locatorsTypes.push(WORKSPACE_VIRTUAL_ENV_SERVICE);
                locatorsTypes.push(KNOWN_PATH_SERVICE);
                locatorsTypes.push(CURRENT_PATH_SERVICE);

                const locatorsWithInterpreters = locatorsTypes.map((typeName) => {
                    const interpreter: PythonEnvironment = {
                        architecture: Architecture.Unknown,
                        displayName: typeName,
                        path: typeName,
                        sysPrefix: typeName,
                        sysVersion: typeName,
                        envType: EnvironmentType.Unknown,
                        version: new SemVer('0.0.0-alpha'),
                    };

                    const typeLocator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
                    typeLocator
                        .setup((l) => l.hasInterpreters)
                        .returns(() => Promise.resolve(true))
                        .verifiable(TypeMoq.Times.once());

                    typeLocator
                        .setup((l) => l.getInterpreters(TypeMoq.It.isValue(resource)))
                        .returns(() => Promise.resolve([interpreter]))
                        .verifiable(TypeMoq.Times.once());

                    serviceContainer
                        .setup(
                            (c) => c.get(TypeMoq.It.isValue(IInterpreterLocatorService), TypeMoq.It.isValue(typeName)),
                        )
                        .returns(() => typeLocator.object);

                    return {
                        type: typeName,
                        locator: typeLocator,
                        interpreters: [interpreter],
                    };
                });

                helper
                    .setup((h) => h.mergeInterpreters(TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve(locatorsWithInterpreters.map((item) => item.interpreters[0])))
                    .verifiable(TypeMoq.Times.once());

                await locator.getInterpreters(resource);

                locatorsWithInterpreters.forEach((item) => item.locator.verifyAll());
                helper.verifyAll();
            });
            test(`Interpreter Sources are sorted correctly and merged ${testSuffix}`, async () => {
                const locatorsTypes: string[] = [];
                if (osType.value === OSType.Windows) {
                    locatorsTypes.push(WINDOWS_REGISTRY_SERVICE);
                }
                platformSvc.setup((p) => p.osType).returns(() => osType.value);
                platformSvc.setup((p) => p.isWindows).returns(() => osType.value === OSType.Windows);
                platformSvc.setup((p) => p.isLinux).returns(() => osType.value === OSType.Linux);
                platformSvc.setup((p) => p.isMac).returns(() => osType.value === OSType.OSX);

                locatorsTypes.push(CONDA_ENV_SERVICE);
                locatorsTypes.push(CONDA_ENV_FILE_SERVICE);
                locatorsTypes.push(PIPENV_SERVICE);
                locatorsTypes.push(GLOBAL_VIRTUAL_ENV_SERVICE);
                locatorsTypes.push(WORKSPACE_VIRTUAL_ENV_SERVICE);
                locatorsTypes.push(KNOWN_PATH_SERVICE);
                locatorsTypes.push(CURRENT_PATH_SERVICE);

                const locatorsWithInterpreters = locatorsTypes.map((typeName) => {
                    const interpreter: PythonEnvironment = {
                        architecture: Architecture.Unknown,
                        displayName: typeName,
                        path: typeName,
                        sysPrefix: typeName,
                        sysVersion: typeName,
                        envType: EnvironmentType.Unknown,
                        version: new SemVer('0.0.0-alpha'),
                    };

                    const typeLocator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
                    typeLocator
                        .setup((l) => l.hasInterpreters)
                        .returns(() => Promise.resolve(true))
                        .verifiable(TypeMoq.Times.once());

                    typeLocator
                        .setup((l) => l.getInterpreters(TypeMoq.It.isValue(resource)))
                        .returns(() => Promise.resolve([interpreter]))
                        .verifiable(TypeMoq.Times.once());

                    serviceContainer
                        .setup(
                            (c) => c.get(TypeMoq.It.isValue(IInterpreterLocatorService), TypeMoq.It.isValue(typeName)),
                        )
                        .returns(() => typeLocator.object);

                    return {
                        type: typeName,
                        locator: typeLocator,
                        interpreters: [interpreter],
                    };
                });

                const expectedInterpreters = locatorsWithInterpreters.map((item) => item.interpreters[0]);

                helper
                    .setup((h) => h.mergeInterpreters(TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve(expectedInterpreters))
                    .verifiable(TypeMoq.Times.once());

                const interpreters = await locator.getInterpreters(resource);

                locatorsWithInterpreters.forEach((item) => item.locator.verifyAll());
                helper.verifyAll();
                expect(interpreters).to.be.deep.equal(expectedInterpreters);
            });
            test(`didTriggerInterpreterSuggestions is set to true in the locators if onSuggestion is true ${testSuffix}`, async () => {
                const locatorsTypes: string[] = [];
                if (osType.value === OSType.Windows) {
                    locatorsTypes.push(WINDOWS_REGISTRY_SERVICE);
                }
                platformSvc.setup((p) => p.osType).returns(() => osType.value);
                platformSvc.setup((p) => p.isWindows).returns(() => osType.value === OSType.Windows);
                platformSvc.setup((p) => p.isLinux).returns(() => osType.value === OSType.Linux);
                platformSvc.setup((p) => p.isMac).returns(() => osType.value === OSType.OSX);

                locatorsTypes.push(CONDA_ENV_SERVICE);
                locatorsTypes.push(CONDA_ENV_FILE_SERVICE);
                locatorsTypes.push(PIPENV_SERVICE);
                locatorsTypes.push(GLOBAL_VIRTUAL_ENV_SERVICE);
                locatorsTypes.push(WORKSPACE_VIRTUAL_ENV_SERVICE);
                locatorsTypes.push(KNOWN_PATH_SERVICE);
                locatorsTypes.push(CURRENT_PATH_SERVICE);

                const locatorsWithInterpreters = locatorsTypes.map((typeName) => {
                    const interpreter: PythonEnvironment = {
                        architecture: Architecture.Unknown,
                        displayName: typeName,
                        path: typeName,
                        sysPrefix: typeName,
                        sysVersion: typeName,
                        envType: EnvironmentType.Unknown,
                        version: new SemVer('0.0.0-alpha'),
                    };

                    const typeLocator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
                    typeLocator
                        .setup((l) => l.hasInterpreters)
                        .returns(() => Promise.resolve(true))
                        .verifiable(TypeMoq.Times.once());

                    typeLocator
                        .setup((l) => l.getInterpreters(TypeMoq.It.isValue(resource)))
                        .returns(() => Promise.resolve([interpreter]))
                        .verifiable(TypeMoq.Times.once());

                    serviceContainer
                        .setup(
                            (c) => c.get(TypeMoq.It.isValue(IInterpreterLocatorService), TypeMoq.It.isValue(typeName)),
                        )
                        .returns(() => typeLocator.object);

                    return {
                        type: typeName,
                        locator: typeLocator,
                        interpreters: [interpreter],
                    };
                });

                helper
                    .setup((h) => h.mergeInterpreters(TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve(locatorsWithInterpreters.map((item) => item.interpreters[0])));

                await locator.getInterpreters(resource, { onSuggestion: true });

                locatorsWithInterpreters.forEach((item) => item.locator.verify(
                    (l) => { l.didTriggerInterpreterSuggestions = true; }, TypeMoq.Times.once(),
                ));
                expect(locator.didTriggerInterpreterSuggestions).to.equal(
                    true,
                    'didTriggerInterpreterSuggestions should be set to true.',
                );
            });
        });
    });
});
