// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-classes-per-file max-func-body-length no-invalid-this

import { expect } from 'chai';
import * as path from 'path';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Disposable, FileSystemWatcher, Uri, WorkspaceFolder } from 'vscode';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { isUnitTestExecution } from '../../../client/common/constants';
import { PlatformService } from '../../../client/common/platform/platformService';
import { PythonExecutionFactory } from '../../../client/common/process/pythonExecutionFactory';
import { sleep } from '../../../client/common/utils/async';
import { noop } from '../../../client/common/utils/misc';
import { OSType } from '../../../client/common/utils/platform';
import { WorkspaceVirtualEnvWatcherService } from '../../../client/interpreter/locators/services/workspaceVirtualEnvWatcherService';

suite('Interpreters - Workspace VirtualEnv Watcher Service', () => {
    let disposables: Disposable[] = [];
    setup(function() {
        if (!isUnitTestExecution()) {
            return this.skip();
        }
    });
    teardown(() => {
        disposables.forEach(d => {
            try {
                d.dispose();
            } catch {
                noop();
            }
        });
        disposables = [];
    });

    async function checkForFileChanges(os: OSType, resource: Uri | undefined, hasWorkspaceFolder: boolean) {
        const workspaceService = mock(WorkspaceService);
        const platformService = mock(PlatformService);
        const execFactory = mock(PythonExecutionFactory);
        const watcher = new WorkspaceVirtualEnvWatcherService(
            [],
            instance(workspaceService),
            instance(platformService),
            instance(execFactory)
        );

        when(platformService.isWindows).thenReturn(os === OSType.Windows);
        when(platformService.isLinux).thenReturn(os === OSType.Linux);
        when(platformService.isMac).thenReturn(os === OSType.OSX);

        class FSWatcher {
            public onDidCreate(_listener: (e: Uri) => any, _thisArgs?: any, _disposables?: Disposable[]): Disposable {
                return { dispose: noop };
            }
        }

        const workspaceFolder: WorkspaceFolder = { name: 'one', index: 1, uri: Uri.file(path.join('root', 'dev')) };
        if (!hasWorkspaceFolder || !resource) {
            when(workspaceService.getWorkspaceFolder(anything())).thenReturn(undefined);
        } else {
            when(workspaceService.getWorkspaceFolder(resource)).thenReturn(workspaceFolder);
        }

        const fsWatcher = mock(FSWatcher);
        when(workspaceService.createFileSystemWatcher(anything())).thenReturn(
            instance((fsWatcher as any) as FileSystemWatcher)
        );

        await watcher.register(resource);

        verify(workspaceService.createFileSystemWatcher(anything())).twice();
        verify(fsWatcher.onDidCreate(anything(), anything(), anything())).twice();
    }
    for (const uri of [undefined, Uri.file('abc')]) {
        for (const hasWorkspaceFolder of [true, false]) {
            const uriSuffix = uri
                ? ` (with resource & ${hasWorkspaceFolder ? 'with' : 'without'} workspace folder)`
                : '';
            test(`Register for file changes on windows ${uriSuffix}`, async () => {
                await checkForFileChanges(OSType.Windows, uri, hasWorkspaceFolder);
            });
            test(`Register for file changes on Mac ${uriSuffix}`, async () => {
                await checkForFileChanges(OSType.OSX, uri, hasWorkspaceFolder);
            });
            test(`Register for file changes on Linux ${uriSuffix}`, async () => {
                await checkForFileChanges(OSType.Linux, uri, hasWorkspaceFolder);
            });
        }
    }
    async function ensureFileChanesAreHandled(os: OSType) {
        const workspaceService = mock(WorkspaceService);
        const platformService = mock(PlatformService);
        const execFactory = mock(PythonExecutionFactory);
        const watcher = new WorkspaceVirtualEnvWatcherService(
            disposables,
            instance(workspaceService),
            instance(platformService),
            instance(execFactory)
        );

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
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn(undefined);
        when(workspaceService.createFileSystemWatcher(anything())).thenReturn((fsWatcher as any) as FileSystemWatcher);
        await watcher.register(undefined);
        let invoked = false;
        watcher.onDidCreate(() => (invoked = true), watcher);

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
