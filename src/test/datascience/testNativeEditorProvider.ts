// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as uuid from 'uuid/v4';
import { Uri, WebviewPanel } from 'vscode';

import {
    ICommandManager,
    ICustomEditorService,
    IDocumentManager,
    IWorkspaceService
} from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry } from '../../client/common/types';
import { createDeferred, Deferred } from '../../client/common/utils/async';
import { InteractiveWindowMessageListener } from '../../client/datascience/interactive-common/interactiveWindowMessageListener';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { NativeEditor } from '../../client/datascience/interactive-ipynb/nativeEditor';
import { NativeEditorProvider } from '../../client/datascience/interactive-ipynb/nativeEditorProvider';
import { NativeEditorProviderOld } from '../../client/datascience/interactive-ipynb/nativeEditorProviderOld';
import { INotebookStorageProvider } from '../../client/datascience/interactive-ipynb/notebookStorageProvider';
import {
    IDataScienceErrorHandler,
    INotebookEditor,
    INotebookEditorProvider,
    INotebookModel
} from '../../client/datascience/types';
import { ClassType, IServiceContainer } from '../../client/ioc/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { IMountedWebView, WaitForMessageOptions } from './mountedWebView';
import { mountConnectedMainPanel } from './testHelpers';

export interface ITestNativeEditorProvider extends INotebookEditorProvider {
    getMountedWebView(window: INotebookEditor | undefined): IMountedWebView;
    waitForMessage(file: Uri | undefined, message: string, options?: WaitForMessageOptions): Promise<void>;
}

// Mixin class to provide common functionality between the two different native editor providers.
function TestNativeEditorProviderMixin<T extends ClassType<NativeEditorProvider>>(SuperClass: T) {
    return class extends SuperClass implements ITestNativeEditorProvider {
        private windowToMountMap = new Map<string, IMountedWebView>();
        private pendingMessageWait:
            | { message: string; options?: WaitForMessageOptions; deferred: Deferred<void> }
            | undefined;

        // tslint:disable-next-line: no-any
        constructor(...rest: any[]) {
            super(...rest);
        }
        public getMountedWebView(window: INotebookEditor | undefined): IMountedWebView {
            const key = window ? window.file.toString() : this.editors[0].file.toString();
            if (!this.windowToMountMap.has(key)) {
                throw new Error('Test Failure: Window not mounted yet.');
            }
            return this.windowToMountMap.get(key)!;
        }
        public waitForMessage(file: Uri | undefined, message: string, options?: WaitForMessageOptions): Promise<void> {
            // We may already have this editor. Check
            const key = file ? file.toString() : undefined;
            if (key && this.windowToMountMap.has(key)) {
                return this.windowToMountMap.get(key)!.waitForMessage(message, options);
            }

            // Otherwise pend for the next create.
            this.pendingMessageWait = { message, options, deferred: createDeferred() };
            return this.pendingMessageWait.deferred.promise;
        }

        protected createNotebookEditor(model: INotebookModel, panel?: WebviewPanel): NativeEditor {
            // Generate the mount wrapper using a custom id
            const id = uuid();
            const mounted = this.ioc!.createWebView(() => mountConnectedMainPanel('native'), id);

            // Might have a pending wait for message
            if (this.pendingMessageWait) {
                const state = { ...this.pendingMessageWait };
                this.pendingMessageWait = undefined;
                mounted
                    .waitForMessage(state.message, state.options)
                    .then(() => {
                        state.deferred.resolve();
                    })
                    .catch((e) => state.deferred.reject(e));
            }

            // Create the real editor.
            const result = super.createNotebookEditor(model, panel);

            // Associate the real create with our mount in order to find the wrapper
            this.windowToMountMap.set(result.file.toString(), mounted);

            // During testing the MainPanel sends the init message before our interactive window is created.
            // Pretend like it's happening now
            // tslint:disable-next-line: no-any
            const listener = (result as any).messageListener as InteractiveWindowMessageListener;
            listener.onMessage(InteractiveWindowMessages.Started, {});

            // Also need the css request so that other messages can go through
            const webHost = result as NativeEditor;
            webHost.setTheme(false);

            return result;
        }
        private get ioc(): DataScienceIocContainer | undefined {
            return this.serviceContainer.get<DataScienceIocContainer>(DataScienceIocContainer);
        }
    };
}

@injectable()
export class TestNativeEditorProvider extends TestNativeEditorProviderMixin(NativeEditorProvider) {
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(IConfigurationService) configuration: IConfigurationService,
        @inject(ICustomEditorService) customEditorService: ICustomEditorService,
        @inject(INotebookStorageProvider) storage: INotebookStorageProvider
    ) {
        super(serviceContainer, asyncRegistry, disposables, workspace, configuration, customEditorService, storage);
    }
}

@injectable()
export class TestNativeEditorProviderOld extends TestNativeEditorProviderMixin(NativeEditorProviderOld) {
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(IConfigurationService) configuration: IConfigurationService,
        @inject(ICustomEditorService) customEditorService: ICustomEditorService,
        @inject(IFileSystem) fs: IFileSystem,
        @inject(IDocumentManager) documentManager: IDocumentManager,
        @inject(ICommandManager) cmdManager: ICommandManager,
        @inject(IDataScienceErrorHandler) dataScienceErrorHandler: IDataScienceErrorHandler,
        @inject(INotebookStorageProvider) storage: INotebookStorageProvider
    ) {
        super(
            serviceContainer,
            asyncRegistry,
            disposables,
            workspace,
            configuration,
            customEditorService,
            fs,
            documentManager,
            cmdManager,
            dataScienceErrorHandler,
            storage
        );
    }
}
