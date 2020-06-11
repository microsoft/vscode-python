// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-classes-per-file max-func-body-length

import { expect } from 'chai';
import * as md5 from 'md5';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Disposable, Uri, WorkspaceFolder } from 'vscode';
import { IWorkspaceService } from '../../../../client/common/application/types';
import { WorkspaceService } from '../../../../client/common/application/workspace';
import { Resource } from '../../../../client/common/types';
import { noop } from '../../../../client/common/utils/misc';
import { IInterpreterWatcher } from '../../../../client/interpreter/contracts';
import { ServiceContainer } from '../../../../client/ioc/container';
import { IServiceContainer } from '../../../../client/ioc/types';
import { CacheableLocatorService } from '../../../../client/pythonEnvironments/discovery/locators/services/cacheableLocatorService';
import { PythonInterpreter } from '../../../../client/pythonEnvironments/discovery/types';

suite('Interpreters - Cacheable Locator Service', () => {
    suite('Caching', () => {
        class Locator extends CacheableLocatorService {
            constructor(name: string, serviceCcontainer: IServiceContainer, private readonly mockLocator: MockLocator) {
                super(name, serviceCcontainer);
            }
            public dispose() {
                noop();
            }
            protected async getInterpretersImplementation(_resource?: Uri): Promise<PythonInterpreter[]> {
                return this.mockLocator.getInterpretersImplementation();
            }
            protected getCachedInterpreters(_resource?: Uri): PythonInterpreter[] | undefined {
                return this.mockLocator.getCachedInterpreters();
            }
            protected async cacheInterpreters(_interpreters: PythonInterpreter[], _resource?: Uri) {
                return this.mockLocator.cacheInterpreters();
            }
            protected getCacheKey(_resource?: Uri) {
                return this.mockLocator.getCacheKey();
            }
        }
        class MockLocator {
            public async getInterpretersImplementation(): Promise<PythonInterpreter[]> {
                return [];
            }
            public getCachedInterpreters(): PythonInterpreter[] | undefined {
                return;
            }
            public async cacheInterpreters() {
                return;
            }
            public getCacheKey(): string {
                return '';
            }
        }
        let serviceContainer: ServiceContainer;
        setup(() => {
            serviceContainer = mock(ServiceContainer);
        });

        test('Interpreters must be retrieved once, then cached', async () => {
            const expectedInterpreters = [1, 2] as any;
            const mockedLocatorForVerification = mock(MockLocator);
            const locator = new (class extends Locator {
                protected async addHandlersForInterpreterWatchers(
                    _cacheKey: string,
                    _resource: Resource
                ): Promise<void> {
                    noop();
                }
            })('dummy', instance(serviceContainer), instance(mockedLocatorForVerification));

            when(mockedLocatorForVerification.getInterpretersImplementation()).thenResolve(expectedInterpreters);
            when(mockedLocatorForVerification.getCacheKey()).thenReturn('xyz');
            when(mockedLocatorForVerification.getCachedInterpreters()).thenResolve();

            const [items1, items2, items3] = await Promise.all([
                locator.getInterpreters(),
                locator.getInterpreters(),
                locator.getInterpreters()
            ]);
            expect(items1).to.be.deep.equal(expectedInterpreters);
            expect(items2).to.be.deep.equal(expectedInterpreters);
            expect(items3).to.be.deep.equal(expectedInterpreters);

            verify(mockedLocatorForVerification.getInterpretersImplementation()).once();
            verify(mockedLocatorForVerification.getCachedInterpreters()).atLeast(1);
            verify(mockedLocatorForVerification.cacheInterpreters()).atLeast(1);
        });

        test('Ensure onDidCreate event handler is attached', async () => {
            const mockedLocatorForVerification = mock(MockLocator);
            class Watcher implements IInterpreterWatcher {
                public onDidCreate(
                    _listener: (e: Resource) => any,
                    _thisArgs?: any,
                    _disposables?: Disposable[]
                ): Disposable {
                    return { dispose: noop };
                }
            }
            const watcher: IInterpreterWatcher = mock(Watcher);

            const locator = new (class extends Locator {
                protected async getInterpreterWatchers(_resource: Resource): Promise<IInterpreterWatcher[]> {
                    return [instance(watcher)];
                }
            })('dummy', instance(serviceContainer), instance(mockedLocatorForVerification));

            await locator.getInterpreters();

            verify(watcher.onDidCreate(anything(), anything(), anything())).once();
        });

        test('Ensure cache is cleared when watcher event fires', async () => {
            const expectedInterpreters = [1, 2] as any;
            const mockedLocatorForVerification = mock(MockLocator);
            class Watcher implements IInterpreterWatcher {
                private listner?: (e: Resource) => any;
                public onDidCreate(
                    listener: (e: Resource) => any,
                    _thisArgs?: any,
                    _disposables?: Disposable[]
                ): Disposable {
                    this.listner = listener;
                    return { dispose: noop };
                }
                public invokeListeners() {
                    this.listner!(undefined);
                }
            }
            const watcher = new Watcher();

            const locator = new (class extends Locator {
                protected async getInterpreterWatchers(_resource: Resource): Promise<IInterpreterWatcher[]> {
                    return [watcher];
                }
            })('dummy', instance(serviceContainer), instance(mockedLocatorForVerification));

            when(mockedLocatorForVerification.getInterpretersImplementation()).thenResolve(expectedInterpreters);
            when(mockedLocatorForVerification.getCacheKey()).thenReturn('xyz');
            when(mockedLocatorForVerification.getCachedInterpreters()).thenResolve();

            const [items1, items2, items3] = await Promise.all([
                locator.getInterpreters(),
                locator.getInterpreters(),
                locator.getInterpreters()
            ]);
            expect(items1).to.be.deep.equal(expectedInterpreters);
            expect(items2).to.be.deep.equal(expectedInterpreters);
            expect(items3).to.be.deep.equal(expectedInterpreters);

            verify(mockedLocatorForVerification.getInterpretersImplementation()).once();
            verify(mockedLocatorForVerification.getCachedInterpreters()).atLeast(1);
            verify(mockedLocatorForVerification.cacheInterpreters()).once();

            watcher.invokeListeners();

            const [items4, items5, items6] = await Promise.all([
                locator.getInterpreters(),
                locator.getInterpreters(),
                locator.getInterpreters()
            ]);
            expect(items4).to.be.deep.equal(expectedInterpreters);
            expect(items5).to.be.deep.equal(expectedInterpreters);
            expect(items6).to.be.deep.equal(expectedInterpreters);

            // We must get the list of interperters again and cache the new result again.
            verify(mockedLocatorForVerification.getInterpretersImplementation()).twice();
            verify(mockedLocatorForVerification.cacheInterpreters()).twice();
        });
        test('Ensure locating event is raised', async () => {
            const mockedLocatorForVerification = mock(MockLocator);
            const locator = new (class extends Locator {
                protected async getInterpreterWatchers(_resource: Resource): Promise<IInterpreterWatcher[]> {
                    return [];
                }
            })('dummy', instance(serviceContainer), instance(mockedLocatorForVerification));

            let locatingEventRaised = false;
            locator.onLocating(() => (locatingEventRaised = true));

            when(mockedLocatorForVerification.getInterpretersImplementation()).thenResolve([1, 2] as any);
            when(mockedLocatorForVerification.getCacheKey()).thenReturn('xyz');
            when(mockedLocatorForVerification.getCachedInterpreters()).thenResolve();

            await locator.getInterpreters();
            expect(locatingEventRaised).to.be.equal(true, 'Locating Event not raised');
        });
    });
    suite('Cache Key', () => {
        class Locator extends CacheableLocatorService {
            public dispose() {
                noop();
            }
            // tslint:disable-next-line:no-unnecessary-override
            public getCacheKey(resource?: Uri) {
                return super.getCacheKey(resource);
            }
            protected async getInterpretersImplementation(_resource?: Uri): Promise<PythonInterpreter[]> {
                return [];
            }
            protected getCachedInterpreters(_resource?: Uri): PythonInterpreter[] | undefined {
                return [];
            }
            protected async cacheInterpreters(_interpreters: PythonInterpreter[], _resource?: Uri) {
                noop();
            }
        }
        let serviceContainer: ServiceContainer;
        setup(() => {
            serviceContainer = mock(ServiceContainer);
        });

        test('Cache Key must contain name of locator', async () => {
            const locator = new Locator('hello-World', instance(serviceContainer));

            const key = locator.getCacheKey();

            expect(key).contains('hello-World');
        });

        test('Cache Key must not contain path to workspace', async () => {
            const workspace = mock(WorkspaceService);
            const workspaceFolder: WorkspaceFolder = { name: '1', index: 1, uri: Uri.file(__dirname) };

            when(workspace.hasWorkspaceFolders).thenReturn(true);
            when(workspace.workspaceFolders).thenReturn([workspaceFolder]);
            when(workspace.getWorkspaceFolder(anything())).thenReturn(workspaceFolder);
            when(serviceContainer.get<IWorkspaceService>(IWorkspaceService)).thenReturn(instance(workspace));
            when(serviceContainer.get<IWorkspaceService>(IWorkspaceService, anything())).thenReturn(
                instance(workspace)
            );

            const locator = new Locator('hello-World', instance(serviceContainer), false);

            const key = locator.getCacheKey(Uri.file('something'));

            expect(key).contains('hello-World');
            expect(key).not.contains(md5(workspaceFolder.uri.fsPath));
        });

        test('Cache Key must contain path to workspace', async () => {
            const workspace = mock(WorkspaceService);
            const workspaceFolder: WorkspaceFolder = { name: '1', index: 1, uri: Uri.file(__dirname) };
            const resource = Uri.file('a');

            when(workspace.hasWorkspaceFolders).thenReturn(true);
            when(workspace.workspaceFolders).thenReturn([workspaceFolder]);
            when(workspace.getWorkspaceFolder(resource)).thenReturn(workspaceFolder);
            when(serviceContainer.get<IWorkspaceService>(IWorkspaceService)).thenReturn(instance(workspace));
            when(serviceContainer.get<IWorkspaceService>(IWorkspaceService, anything())).thenReturn(
                instance(workspace)
            );

            const locator = new Locator('hello-World', instance(serviceContainer), true);

            const key = locator.getCacheKey(resource);

            expect(key).contains('hello-World');
            expect(key).contains(md5(workspaceFolder.uri.fsPath));
        });
    });
});
