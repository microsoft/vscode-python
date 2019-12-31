// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { Event, EventEmitter, Uri } from 'vscode';

import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry } from '../../client/common/types';
import { InteractiveWindowMessageListener } from '../../client/datascience/interactive-common/interactiveWindowMessageListener';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { NativeEditor } from '../../client/datascience/interactive-ipynb/nativeEditor';
import { NativeEditorProvider } from '../../client/datascience/interactive-ipynb/nativeEditorProvider';
import { IDataScienceErrorHandler, INotebookEditor, INotebookEditorProvider, INotebookServerOptions } from '../../client/datascience/types';
import { IServiceContainer } from '../../client/ioc/types';

@injectable()
export class TestNativeEditorProvider implements INotebookEditorProvider {
    private realProvider: NativeEditorProvider;
    private _onDidOpenNotebookEditor = new EventEmitter<INotebookEditor>();
    public get onDidOpenNotebookEditor(): Event<INotebookEditor> {
        return this._onDidOpenNotebookEditor.event;
    }

    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(IConfigurationService) configuration: IConfigurationService,
        @inject(IFileSystem) fileSystem: IFileSystem,
        @inject(IDocumentManager) documentManager: IDocumentManager,
        @inject(ICommandManager) cmdManager: ICommandManager,
        @inject(IDataScienceErrorHandler) dataScienceErrorHandler: IDataScienceErrorHandler
    ) {
        this.realProvider = new NativeEditorProvider(
            serviceContainer,
            asyncRegistry,
            disposables,
            workspace,
            configuration,
            fileSystem,
            documentManager,
            cmdManager,
            dataScienceErrorHandler
        );
        this.realProvider.onDidOpenNotebookEditor(e => this._onDidOpenNotebookEditor.fire(e));
    }

    public get activeEditor(): INotebookEditor | undefined {
        return this.realProvider.activeEditor;
    }

    public get editors(): INotebookEditor[] {
        return this.realProvider.editors;
    }

    public async open(file: Uri, contents: string): Promise<INotebookEditor> {
        const result = await this.realProvider.open(file, contents);

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

    public show(file: Uri): Promise<INotebookEditor | undefined> {
        return this.realProvider.show(file);
    }

    public async createNew(): Promise<INotebookEditor> {
        const result = await this.realProvider.createNew();

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

    public async getNotebookOptions(): Promise<INotebookServerOptions> {
        return this.realProvider.getNotebookOptions();
    }
}
