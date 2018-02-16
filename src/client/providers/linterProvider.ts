// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { IDocumentManager } from '../common/application/types';
import { ConfigSettingMonitor } from '../common/configSettingMonitor';
import { IFileSystem } from '../common/platform/types';
import { IConfigurationService } from '../common/types';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { ILinterManager, ILintingEngine } from '../linters/types';

const uriSchemesToIgnore = ['git', 'showModifications', 'svn'];

export class LinterProvider implements vscode.Disposable {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private context: vscode.ExtensionContext;
    private disposables: vscode.Disposable[];
    private configMonitor: ConfigSettingMonitor;
    private interpreterService: IInterpreterService;
    private documents: IDocumentManager;
    private configuration: IConfigurationService;
    private linterManager: ILinterManager;
    private engine: ILintingEngine;
    private fs: IFileSystem;

    public constructor(context: vscode.ExtensionContext, serviceContainer: IServiceContainer) {
        this.context = context;
        this.disposables = [];

        this.fs = serviceContainer.get<IFileSystem>(IFileSystem);
        this.engine = serviceContainer.get<ILintingEngine>(ILintingEngine);
        this.linterManager = serviceContainer.get<ILinterManager>(ILinterManager);
        this.interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);
        this.documents = serviceContainer.get<IDocumentManager>(IDocumentManager);
        this.configuration = serviceContainer.get<IConfigurationService>(IConfigurationService);

        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('python');
        this.disposables.push(this.interpreterService.onDidChangeInterpreter(() => this.engine.lintOpenPythonFiles()));

        this.documents.onDidOpenTextDocument(e => this.onDocumentOpened(e), this.context.subscriptions);
        this.documents.onDidCloseTextDocument(e => this.onDocumentClosed(e), this.context.subscriptions);
        this.documents.onDidSaveTextDocument((e) => this.onDocumentSaved(e), this.context.subscriptions);

        this.configMonitor = new ConfigSettingMonitor('linting');
        this.configMonitor.on('change', this.lintSettingsChangedHandler.bind(this));
    }

    public get diagnostics(): vscode.DiagnosticCollection {
        return this.diagnosticCollection;
    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
        this.configMonitor.dispose();
    }

    private isDocumentOpen(uri: vscode.Uri): boolean {
        return this.documents.textDocuments.some(document => this.fs.arePathsSame(document.uri.fsPath, uri.fsPath));
    }

    private lintSettingsChangedHandler(configTarget: ConfigurationTarget, wkspaceOrFolder: Uri) {
        if (configTarget === ConfigurationTarget.Workspace) {
            this.engine.lintOpenPythonFiles();
            return;
        }
        // Look for python files that belong to the specified workspace folder.
        workspace.textDocuments.forEach(async document => {
            const wkspaceFolder = workspace.getWorkspaceFolder(document.uri);
            if (wkspaceFolder && wkspaceFolder.uri.fsPath === wkspaceOrFolder.fsPath) {
                await this.engine.lintDocument(document, 'auto');
            }
        });
    }

    private async onDocumentOpened(document: vscode.TextDocument): Promise<void> {
        const settings = this.configuration.getSettings(document.uri);
        if (document.languageId !== 'python' || !settings.linting.enabled) {
            return;
        }
        // Exclude files opened by vscode when showing a diff view.
        if (uriSchemesToIgnore.indexOf(document.uri.scheme) >= 0) {
            return;
        }
        if (!document.uri.path ||
            (path.basename(document.uri.path) === document.uri.path && !await this.fs.fileExistsAsync(document.uri.path))) {
            return;
        }
        this.engine.lintDocument(document, 'auto').ignoreErrors();
    }

    private onDocumentSaved(document: vscode.TextDocument) {
        const settings = this.configuration.getSettings(document.uri);
        if (document.languageId === 'python' && settings.linting.enabled && settings.linting.lintOnSave) {
            this.engine.lintDocument(document, 'save').ignoreErrors();
            return;
        }

        const linters = this.linterManager.getActiveLinters(document.uri);
        const fileName = path.basename(document.uri.fsPath).toLowerCase();
        const watchers = linters.filter((info) => info.configFileNames.indexOf(fileName) >= 0);
        if (watchers.length > 0) {
            setTimeout(() => this.engine.lintOpenPythonFiles(), 1000);
        }
    }

    private onDocumentClosed(document: vscode.TextDocument) {
        if (!document || !document.fileName || !document.uri) {
            return;
        }
        // Check if this document is still open as a duplicate editor.
        if (!this.isDocumentOpen(document.uri) && this.diagnosticCollection.has(document.uri)) {
            this.diagnosticCollection.set(document.uri, []);
        }
    }
}
