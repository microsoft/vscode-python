// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { ConfigSettingMonitor } from '../common/configSettingMonitor';
import { PythonSettings } from '../common/configSettings';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { ILinterManager, ILintingEngine } from '../linters/types';
import { LinterTrigger } from '../telemetry/types';

const uriSchemesToIgnore = ['git', 'showModifications', 'svn'];

export class LinterProvider implements vscode.Disposable {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private context: vscode.ExtensionContext;
    private disposables: vscode.Disposable[];
    private configMonitor: ConfigSettingMonitor;
    private interpreterService: IInterpreterService;
    private linterManager: ILinterManager;
    private engine: ILintingEngine;

    public constructor(
        context: vscode.ExtensionContext,
        serviceContainer: IServiceContainer) {

        this.context = context;
        this.disposables = [];

        this.engine = serviceContainer.get<ILintingEngine>(ILintingEngine);
        this.linterManager = serviceContainer.get<ILinterManager>(ILinterManager);
        this.interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);

        this.disposables.push(this.interpreterService.onDidChangeInterpreter(() => this.engine.lintOpenPythonFiles()));
        this.disposables.push(vscode.workspace.onDidSaveTextDocument((e) => this.onDocumentSaved(e)));

        this.initialize();
        this.configMonitor = new ConfigSettingMonitor('linting');
        this.configMonitor.on('change', this.lintSettingsChangedHandler.bind(this));
    }
    public dispose() {
        this.disposables.forEach(d => d.dispose());
        this.configMonitor.dispose();
    }
    private isDocumentOpen(uri: vscode.Uri): boolean {
        return vscode.workspace.textDocuments.some(document => document.uri.fsPath === uri.fsPath);
    }

    private initialize() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('python');

        let disposable = vscode.workspace.onDidSaveTextDocument((e) => {
            const settings = PythonSettings.getInstance(e.uri);
            if (e.languageId !== 'python' || !settings.linting.enabled || !settings.linting.lintOnSave) {
                return;
            }
            this.lintDocument(e, 100, 'save');
        });
        this.context.subscriptions.push(disposable);

        vscode.workspace.onDidOpenTextDocument((e) => {
            const settings = PythonSettings.getInstance(e.uri);
            if (e.languageId !== 'python' || !settings.linting.enabled) {
                return;
            }
            // Exclude files opened by vscode when showing a diff view.
            if (uriSchemesToIgnore.indexOf(e.uri.scheme) >= 0) {
                return;
            }
            if (!e.uri.path || (path.basename(e.uri.path) === e.uri.path && !fs.existsSync(e.uri.path))) {
                return;
            }
            this.lintDocument(e, 100, 'auto');
        }, this.context.subscriptions);

        disposable = vscode.workspace.onDidCloseTextDocument(textDocument => {
            if (!textDocument || !textDocument.fileName || !textDocument.uri) {
                return;
            }

            // Check if this document is still open as a duplicate editor.
            if (!this.isDocumentOpen(textDocument.uri) && this.diagnosticCollection.has(textDocument.uri)) {
                this.diagnosticCollection.set(textDocument.uri, []);
            }
        });
        this.context.subscriptions.push(disposable);
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

    // tslint:disable-next-line:member-ordering no-any
    private lastTimeout: any;
    private lintDocument(document: vscode.TextDocument, delay: number, trigger: LinterTrigger): void {
        // Since this is a hack, lets wait for 2 seconds before linting.
        // Give user to continue typing before we waste CPU time.
        if (this.lastTimeout) {
            clearTimeout(this.lastTimeout);
            this.lastTimeout = 0;
        }

        this.lastTimeout = setTimeout(async () => {
            await this.engine.lintDocument(document, trigger);
        }, delay);
    }

    private onDocumentSaved(document: vscode.TextDocument) {
        const linters = this.linterManager.getActiveLinters(document.uri);
        const fileName = path.basename(document.uri.fsPath).toLowerCase();
        const watchers = linters.filter((info) => info.configFileNames.indexOf(fileName) >= 0);
        if (watchers.length > 0) {
            setTimeout(() => this.engine.lintOpenPythonFiles(), 1000);
        }
    }
}
