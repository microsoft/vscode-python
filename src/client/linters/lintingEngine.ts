// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Minimatch } from 'minimatch';
import * as path from 'path';
import * as vscode from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../common/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { IFileSystem } from '../common/platform/types';
import { IConfigurationService, IOutputChannel } from '../common/types';
import { isNotebookCell } from '../common/utils/misc';
import { StopWatch } from '../common/utils/stopWatch';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryWhenDone } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { LinterTrigger, LintingTelemetry } from '../telemetry/types';
import { ILinterInfo, ILinterManager, ILintingEngine, ILintMessage, LintMessageSeverity } from './types';

const PYTHON: vscode.DocumentFilter = { language: 'python' };

const lintSeverityToVSSeverity = new Map<LintMessageSeverity, vscode.DiagnosticSeverity>();
lintSeverityToVSSeverity.set(LintMessageSeverity.Error, vscode.DiagnosticSeverity.Error);
lintSeverityToVSSeverity.set(LintMessageSeverity.Hint, vscode.DiagnosticSeverity.Hint);
lintSeverityToVSSeverity.set(LintMessageSeverity.Information, vscode.DiagnosticSeverity.Information);
lintSeverityToVSSeverity.set(LintMessageSeverity.Warning, vscode.DiagnosticSeverity.Warning);

@injectable()
export class LintingEngine implements ILintingEngine {
    private workspace: IWorkspaceService;
    private documents: IDocumentManager;
    private configurationService: IConfigurationService;
    private linterManager: ILinterManager;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private pendingLintings = new Map<string, vscode.CancellationTokenSource>();
    private outputChannel: vscode.OutputChannel;
    private fileSystem: IFileSystem;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.documents = serviceContainer.get<IDocumentManager>(IDocumentManager);
        this.workspace = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.outputChannel = serviceContainer.get<vscode.OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.linterManager = serviceContainer.get<ILinterManager>(ILinterManager);
        this.fileSystem = serviceContainer.get<IFileSystem>(IFileSystem);
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('python');
    }

    public get diagnostics(): vscode.DiagnosticCollection {
        return this.diagnosticCollection;
    }

    public clearDiagnostics(document: vscode.TextDocument): void {
        if (this.diagnosticCollection.has(document.uri)) {
            this.diagnosticCollection.delete(document.uri);
        }
    }

    public async lintOpenPythonFiles(): Promise<vscode.DiagnosticCollection> {
        this.diagnosticCollection.clear();
        const promises = this.documents.textDocuments.map(async (document) => this.lintDocument(document, 'auto'));
        await Promise.all(promises);
        return this.diagnosticCollection;
    }

    public async lintDocument(document: vscode.TextDocument, trigger: LinterTrigger): Promise<void> {
        if (isNotebookCell(document)) {
            return;
        }
        this.diagnosticCollection.set(document.uri, []);

        // Check if we need to lint this document
        if (!(await this.shouldLintDocument(document))) {
            return;
        }

        if (this.pendingLintings.has(document.uri.fsPath)) {
            this.pendingLintings.get(document.uri.fsPath)!.cancel();
            this.pendingLintings.delete(document.uri.fsPath);
        }

        const cancelToken = new vscode.CancellationTokenSource();
        cancelToken.token.onCancellationRequested(() => {
            if (this.pendingLintings.has(document.uri.fsPath)) {
                this.pendingLintings.delete(document.uri.fsPath);
            }
        });

        this.pendingLintings.set(document.uri.fsPath, cancelToken);

        const activeLinters = await this.linterManager.getActiveLinters(false, document.uri);
        const promises: Promise<ILintMessage[]>[] = activeLinters.map(async (info: ILinterInfo) => {
            const stopWatch = new StopWatch();
            const linter = await this.linterManager.createLinter(
                info.product,
                this.outputChannel,
                this.serviceContainer,
                document.uri,
            );
            const promise = linter.lint(document, cancelToken.token);
            this.sendLinterRunTelemetry(info, document.uri, promise, stopWatch, trigger);
            return promise;
        });

        // linters will resolve asynchronously - keep a track of all
        // diagnostics reported as them come in.
        let diagnostics: vscode.Diagnostic[] = [];
        const settings = this.configurationService.getSettings(document.uri);

        for (const p of promises) {
            const msgs = await p;
            if (cancelToken.token.isCancellationRequested) {
                break;
            }

            if (this.isDocumentOpen(document.uri)) {
                // Build the message and suffix the message with the name of the linter used.
                for (const m of msgs) {
                    diagnostics.push(this.createDiagnostics(m, document));
                }
                // Limit the number of messages to the max value.
                diagnostics = diagnostics.filter((_value, index) => index <= settings.linting.maxNumberOfProblems);
            }
        }
        // Set all diagnostics found in this pass, as this method always clears existing diagnostics.
        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private sendLinterRunTelemetry(
        info: ILinterInfo,
        resource: vscode.Uri,
        promise: Promise<ILintMessage[]>,
        stopWatch: StopWatch,
        trigger: LinterTrigger,
    ): void {
        const linterExecutablePathName = info.pathName(resource);
        const properties: LintingTelemetry = {
            tool: info.id,
            hasCustomArgs: info.linterArgs(resource).length > 0,
            trigger,
            executableSpecified: linterExecutablePathName.length > 0,
        };
        sendTelemetryWhenDone(EventName.LINTING, promise, stopWatch, properties);
    }

    private isDocumentOpen(uri: vscode.Uri): boolean {
        return this.documents.textDocuments.some((document) => document.uri.fsPath === uri.fsPath);
    }

    private createDiagnostics(message: ILintMessage, _document: vscode.TextDocument): vscode.Diagnostic {
        const position = new vscode.Position(message.line - 1, message.column);
        const range = new vscode.Range(position, position);

        const severity = lintSeverityToVSSeverity.get(message.severity!)!;
        const diagnostic = new vscode.Diagnostic(range, message.message, severity);
        diagnostic.code = message.code;
        diagnostic.source = message.provider;
        return diagnostic;
    }

    private async shouldLintDocument(document: vscode.TextDocument): Promise<boolean> {
        if (!(await this.linterManager.isLintingEnabled(false, document.uri))) {
            this.diagnosticCollection.set(document.uri, []);
            return false;
        }

        if (document.languageId !== PYTHON.language) {
            return false;
        }

        const workspaceFolder = this.workspace.getWorkspaceFolder(document.uri);
        const workspaceRootPath =
            workspaceFolder && typeof workspaceFolder.uri.fsPath === 'string' ? workspaceFolder.uri.fsPath : undefined;
        const relativeFileName =
            typeof workspaceRootPath === 'string'
                ? path.relative(workspaceRootPath, document.fileName)
                : document.fileName;

        const settings = this.configurationService.getSettings(document.uri);
        // { dot: true } is important so dirs like `.venv` will be matched by globs
        const ignoreMinmatches = settings.linting.ignorePatterns.map(
            (pattern) => new Minimatch(pattern, { dot: true }),
        );
        if (ignoreMinmatches.some((matcher) => matcher.match(document.fileName) || matcher.match(relativeFileName))) {
            return false;
        }
        if (document.uri.scheme !== 'file' || !document.uri.fsPath) {
            return false;
        }
        return this.fileSystem.fileExists(document.uri.fsPath);
    }
}
