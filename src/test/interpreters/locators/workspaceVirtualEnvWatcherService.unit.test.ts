// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-classes-per-file max-func-body-length

import { expect } from 'chai';
import * as path from 'path';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Disposable, FileSystemWatcher, Uri } from 'vscode';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { PlatformService } from '../../../client/common/platform/platformService';
import { sleep } from '../../../client/common/utils/async';
import { noop } from '../../../client/common/utils/misc';
import { OSType } from '../../../client/common/utils/platform';
import { WorkspaceVirtualEnvWatcherService } from '../../../client/interpreter/locators/services/workspaceVirtualEnvWatcherService';

suite('Interpreters - Workspace VirtualEnv Watcher Service', () => {
    let disposables: Disposable[] = [];
    teardown(() => {
        disposables.forEach(d => {
            try {
                d.dispose();
            } catch { noop(); }
        });
        disposables = [];
    });

    async function checkForFileChanges(os: OSType, expectedGlobs: string[]) {
        const workspaceService = mock(WorkspaceService);
        const platformService = mock(PlatformService);
        const watcher = new WorkspaceVirtualEnvWatcherService([], instance(workspaceService), instance(platformService));

        when(platformService.isWindows).thenReturn(os === OSType.Windows);
        when(platformService.isLinux).thenReturn(os === OSType.Linux);
        when(platformService.isMac).thenReturn(os === OSType.OSX);

        class FSWatcher {
            public onDidCreate(_listener: (e: Uri) => any, _thisArgs?: any, _disposables?: Disposable[]): Disposable {
                return { dispose: noop };
            }
        }
        const fsWatchers: FSWatcher[] = [];
        for (const glob of expectedGlobs) {
            const fsWatcher = mock(FSWatcher);
            fsWatchers.push(fsWatcher);
            when(workspaceService.createFileSystemWatcher(glob)).thenReturn(instance(fsWatcher as any as FileSystemWatcher));
        }
        await watcher.register();

        for (const glob of expectedGlobs) {
            verify(workspaceService.createFileSystemWatcher(glob)).once();
        }
        for (const fsWatcher of fsWatchers) {
            verify(fsWatcher.onDidCreate(anything(), anything(), anything())).once();
        }
    }
    test('Register for file changes on windows', async () => {
        await checkForFileChanges(OSType.Windows, [
            path.join('**', '*python*.exe'),
            path.join('**', '*Python*.exe'),
            path.join('**', 'Scripts', 'activate.*'),
            path.join('**', 'Scripts', 'Activate.*')
        ]);
    });
    test('Register for file changes on Mac', async () => {
        await checkForFileChanges(OSType.OSX, [
            path.join('**', '*python*'),
            path.join('*', 'bin', 'activate*')
        ]);
    });
    test('Register for file changes on Linux', async () => {
        await checkForFileChanges(OSType.Linux, [
            path.join('**', '*python*'),
            path.join('*', 'bin', 'activate*')
        ]);
    });

    async function ensureFileChanesAreHandled(os: OSType) {
        const workspaceService = mock(WorkspaceService);
        const platformService = mock(PlatformService);
        const watcher = new WorkspaceVirtualEnvWatcherService(disposables, instance(workspaceService), instance(platformService));

        when(platformService.isWindows).thenReturn(os === OSType.Windows);
        when(platformService.isLinux).thenReturn(os === OSType.Linux);
        when(platformService.isMac).thenReturn(os === OSType.OSX);

        class FSWatcher {
            private listener?: (e: Uri) => any;
            public onDidCreate(listener: (e: Uri) => any, _thisArgs?: any, _disposables?: Disposable[]): Disposable {
                this.listener = listener;
                return { dispose: noop };
            }
            public invokeListener(e: Uri) {
                this.listener!(e);
            }
        }
        const fsWatcher = new FSWatcher();
        when(workspaceService.createFileSystemWatcher(anything())).thenReturn(fsWatcher as any as FileSystemWatcher);
        await watcher.register();
        let invoked = false;
        watcher.onDidCreate(() => invoked = true, watcher);

        fsWatcher.invokeListener(Uri.file(''));
        // We need this sleep, as we have a debounce (so lets wait).
        await sleep(10);

        expect(invoked).to.be.equal(true, 'invalid');
    }
    test('Check file change handler on Windows', async () => {
        await ensureFileChanesAreHandled(OSType.Windows);
    });
    test('Check file change handler on Mac', async () => {
        await ensureFileChanesAreHandled(OSType.OSX);
    });
    test('Check file change handler on Linux', async () => {
        await ensureFileChanesAreHandled(OSType.Linux);
    });
});
