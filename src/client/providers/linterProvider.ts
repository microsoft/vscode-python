// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ConfigurationChangeEvent, Disposable, TextDocument, Uri, workspace } from 'vscode';
import { IExtensionActivationService } from '../activation/types';
import { IDocumentManager, IWorkspaceService } from '../common/application/types';
import { isTestExecution } from '../common/constants';
import '../common/extensions';
import { IFileSystem } from '../common/platform/types';
import { IConfigurationService, IDisposable } from '../common/types';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { ILinterManager, ILintingEngine } from '../linters/types';

@injectable()
export class LinterProvider implements IExtensionActivationService, Disposable {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    private interpreterService: IInterpreterService;

    private documents: IDocumentManager;

    private configuration: IConfigurationService;

    private linterManager: ILinterManager;

    private engine: ILintingEngine;

    private fs: IFileSystem;

    private readonly disposables: IDisposable[] = [];

    private workspaceService: IWorkspaceService;

    private activatedOnce = false;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.serviceContainer = serviceContainer;
        this.fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        this.engine = this.serviceContainer.get<ILintingEngine>(ILintingEngine);
        this.linterManager = this.serviceContainer.get<ILinterManager>(ILinterManager);
        this.interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        this.documents = this.serviceContainer.get<IDocumentManager>(IDocumentManager);
        this.configuration = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }

    public async activate(): Promise<void> {
        if (this.activatedOnce) {
            return;
        }
        this.activatedOnce = true;
        this.disposables.push(this.interpreterService.onDidChangeInterpreter(() => this.engine.lintOpenPythonFiles()));

        this.documents.onDidOpenTextDocument((e) => this.onDocumentOpened(e), this.disposables);
        this.documents.onDidCloseTextDocument((e) => this.onDocumentClosed(e), this.disposables);
        this.documents.onDidSaveTextDocument((e) => this.onDocumentSaved(e), this.disposables);

        const disposable = this.workspaceService.onDidChangeConfiguration(this.lintSettingsChangedHandler.bind(this));
        this.disposables.push(disposable);

        // On workspace reopen we don't get `onDocumentOpened` since it is first opened
        // and then the extension is activated. So schedule linting pass now.
        if (!isTestExecution()) {
            const timer = setTimeout(() => this.engine.lintOpenPythonFiles().ignoreErrors(), 1200);
            this.disposables.push({ dispose: () => clearTimeout(timer) });
        }
    }

    public dispose(): void {
        this.disposables.forEach((d) => d.dispose());
    }

    private isDocumentOpen(uri: Uri): boolean {
        return this.documents.textDocuments.some((document) => this.fs.arePathsSame(document.uri.fsPath, uri.fsPath));
    }

    private lintSettingsChangedHandler(e: ConfigurationChangeEvent) {
        // Look for python files that belong to the specified workspace folder.
        workspace.textDocuments.forEach((document) => {
            if (e.affectsConfiguration('python.linting', document.uri)) {
                this.engine.lintDocument(document, 'auto').ignoreErrors();
            }
        });
    }

    private onDocumentOpened(document: TextDocument): void {
        this.engine.lintDocument(document, 'auto').ignoreErrors();
    }

    private onDocumentSaved(document: TextDocument): void {
        const settings = this.configuration.getSettings(document.uri);
        if (document.languageId === 'python' && settings.linting.enabled && settings.linting.lintOnSave) {
            this.engine.lintDocument(document, 'save').ignoreErrors();
            return;
        }

        this.linterManager
            .getActiveLinters(document.uri)
            .then((linters) => {
                const fileName = path.basename(document.uri.fsPath).toLowerCase();
                const watchers = linters.filter((info) => info.configFileNames.indexOf(fileName) >= 0);
                if (watchers.length > 0) {
                    setTimeout(() => this.engine.lintOpenPythonFiles(), 1000);
                }
            })
            .ignoreErrors();
    }

    private onDocumentClosed(document: TextDocument) {
        if (!document || !document.fileName || !document.uri) {
            return;
        }
        // Check if this document is still open as a duplicate editor.
        if (!this.isDocumentOpen(document.uri)) {
            this.engine.clearDiagnostics(document);
        }
    }
}
