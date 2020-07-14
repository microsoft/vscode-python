// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as uuid from 'uuid/v4';
import { WebviewPanel } from 'vscode';

import {
    ICommandManager,
    ICustomEditorService,
    IDocumentManager,
    IWorkspaceService
} from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry } from '../../client/common/types';
import { InteractiveWindowMessageListener } from '../../client/datascience/interactive-common/interactiveWindowMessageListener';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { NativeEditor } from '../../client/datascience/interactive-ipynb/nativeEditor';
import { NativeEditorProvider } from '../../client/datascience/interactive-ipynb/nativeEditorProvider';
import { NativeEditorProviderOld } from '../../client/datascience/interactive-ipynb/nativeEditorProviderOld';
import { INotebookStorageProvider } from '../../client/datascience/interactive-ipynb/notebookStorageProvider';
import { IDataScienceErrorHandler, INotebookEditor, INotebookModel } from '../../client/datascience/types';
import { IServiceContainer } from '../../client/ioc/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { IMountedWebView } from './mountedWebView';
import { mountConnectedMainPanel } from './testHelpers';

export interface ITestNativeEditorProvider {
    getMountedWebView(window: INotebookEditor | undefined): IMountedWebView;
}

@injectable()
export class TestNativeEditorProvider extends NativeEditorProvider implements ITestNativeEditorProvider {
    private windowToMountMap = new Map<string, string>();
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(IConfigurationService) configuration: IConfigurationService,
        @inject(ICustomEditorService) customEditorService: ICustomEditorService,
        @inject(INotebookStorageProvider) storage: INotebookStorageProvider,
        @inject(DataScienceIocContainer) private readonly ioc: DataScienceIocContainer
    ) {
        super(serviceContainer, asyncRegistry, disposables, workspace, configuration, customEditorService, storage);
    }

    public getMountedWebView(window: INotebookEditor | undefined): IMountedWebView {
        const key = window ? window.file.toString() : this.editors[0].file.toString();
        if (!this.windowToMountMap.has(key)) {
            throw new Error('Test Failure: Window not mounted yet.');
        }
        return this.ioc.getWebPanel(this.windowToMountMap.get(key)!);
    }

    protected createNotebookEditor(model: INotebookModel, panel?: WebviewPanel): INotebookEditor {
        // Generate the mount wrapper using a custom id
        const id = uuid();
        this.ioc.createWebView(() => mountConnectedMainPanel('native'), id);

        const result = super.createNotebookEditor(model, panel);

        // Associate the real create with our id in order to find the wrapper
        this.windowToMountMap.set(result.file.toString(), id);

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
}

@injectable()
export class TestNativeEditorProviderOld extends NativeEditorProviderOld implements ITestNativeEditorProvider {
    private windowToMountMap = new Map<string, string>();
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
        @inject(INotebookStorageProvider) storage: INotebookStorageProvider,
        @inject(DataScienceIocContainer) private readonly ioc: DataScienceIocContainer
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

    public getMountedWebView(window: INotebookEditor | undefined): IMountedWebView {
        const key = window ? window.file.toString() : this.editors[0].file.toString();
        if (!this.windowToMountMap.has(key)) {
            throw new Error('Test Failure: Window not mounted yet.');
        }
        return this.ioc.getWebPanel(this.windowToMountMap.get(key)!);
    }

    protected createNotebookEditor(model: INotebookModel, panel?: WebviewPanel): INotebookEditor {
        // Generate the mount wrapper using a custom id
        const id = uuid();
        this.ioc.createWebView(() => mountConnectedMainPanel('native'), id);

        const result = super.createNotebookEditor(model, panel);

        // Associate the real create with our id in order to find the wrapper
        this.windowToMountMap.set(result.file.toString(), id);

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
}
