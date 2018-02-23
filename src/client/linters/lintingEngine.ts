// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Minimatch } from 'minimatch';
import * as path from 'path';
import * as vscode from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../common/application/types';
import { LinterErrors, PythonLanguage, STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { IConfigurationService, IOutputChannel } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { JupyterProvider } from '../jupyter/provider';
import { sendTelemetryWhenDone } from '../telemetry';
import { LINTING } from '../telemetry/constants';
import { StopWatch } from '../telemetry/stopWatch';
import { LinterTrigger, LintingTelemetry } from '../telemetry/types';
import { ILinterInfo, ILinterManager, ILintingEngine, ILintMessage, LintMessageSeverity } from './types';

const PYTHON: vscode.DocumentFilter = { language: 'python' };

const lintSeverityToVSSeverity = new Map<LintMessageSeverity, vscode.DiagnosticSeverity>();
lintSeverityToVSSeverity.set(LintMessageSeverity.Error, vscode.DiagnosticSeverity.Error);
lintSeverityToVSSeverity.set(LintMessageSeverity.Hint, vscode.DiagnosticSeverity.Hint);
lintSeverityToVSSeverity.set(LintMessageSeverity.Information, vscode.DiagnosticSeverity.Information);
lintSeverityToVSSeverity.set(LintMessageSeverity.Warning, vscode.DiagnosticSeverity.Warning);

// tslint:disable-next-line:interface-name
interface DocumentHasJupyterCodeCells {
  // tslint:disable-next-line:callable-types
  (doc: vscode.TextDocument, token: vscode.CancellationToken): Promise<Boolean>;
}

@injectable()
export class LintingEngine implements ILintingEngine {
  private documentHasJupyterCodeCells: DocumentHasJupyterCodeCells;
  private workspace: IWorkspaceService;
  private documents: IDocumentManager;
  private configurationService: IConfigurationService;
  private linterManager: ILinterManager;
  private diagnosticCollection: vscode.DiagnosticCollection;
  private pendingLintings = new Map<string, vscode.CancellationTokenSource>();
  private outputChannel: vscode.OutputChannel;

  constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
    this.documentHasJupyterCodeCells = (a, b) => Promise.resolve(false);
    this.documents = serviceContainer.get<IDocumentManager>(IDocumentManager);
    this.workspace = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    this.configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
    this.outputChannel = serviceContainer.get<vscode.OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
    this.linterManager = serviceContainer.get<ILinterManager>(ILinterManager);
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('python');
  }

  public lintOpenPythonFiles(): void {
    this.documents.textDocuments.forEach(async document => {
      if (document.languageId === PythonLanguage.language) {
        await this.lintDocument(document, 'auto');
      }
    });
  }

  public async lintDocument(document: vscode.TextDocument, trigger: LinterTrigger): Promise<void> {
    // Check if we need to lint this document
    const workspaceFolder = this.workspace.getWorkspaceFolder(document.uri);
    const workspaceRootPath = (workspaceFolder && typeof workspaceFolder.uri.fsPath === 'string') ? workspaceFolder.uri.fsPath : undefined;
    const relativeFileName = typeof workspaceRootPath === 'string' ? path.relative(workspaceRootPath, document.fileName) : document.fileName;
    const settings = this.configurationService.getSettings(document.uri);
    if (document.languageId !== PythonLanguage.language) {
      return;
    }
    if (!this.linterManager.isLintingEnabled(document.uri)) {
      this.diagnosticCollection.set(document.uri, []);
    }
    const ignoreMinmatches = settings.linting.ignorePatterns.map(pattern => {
      return new Minimatch(pattern);
    });

    if (ignoreMinmatches.some(matcher => matcher.match(document.fileName) || matcher.match(relativeFileName))) {
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
    this.outputChannel.clear();

    const promises: Promise<ILintMessage[]>[] = this.linterManager.getActiveLinters(document.uri)
      .map(info => {
        const stopWatch = new StopWatch();
        const linter = this.linterManager.createLinter(info.product, this.outputChannel, this.serviceContainer, document.uri);
        const promise = linter.lint(document, cancelToken.token);
        this.sendLinterRunTelemetry(info, document.uri, promise, stopWatch, trigger);
        return promise;
      });

    const hasJupyterCodeCells = await this.documentHasJupyterCodeCells(document, cancelToken.token);
    // linters will resolve asynchronously - keep a track of all
    // diagnostics reported as them come in.
    let diagnostics: vscode.Diagnostic[] = [];

    for (const p of promises) {
      const msgs = await p;
      if (cancelToken.token.isCancellationRequested) {
        break;
      }

      diagnostics = [];
      if (this.isDocumentOpen(document.uri)) {
        // Build the message and suffix the message with the name of the linter used.
        for (const m of msgs) {
          // Ignore magic commands from jupyter.
          if (hasJupyterCodeCells && document.lineAt(m.line - 1).text.trim().startsWith('%') &&
            (m.code === LinterErrors.pylint.InvalidSyntax ||
              m.code === LinterErrors.prospector.InvalidSyntax ||
              m.code === LinterErrors.flake8.InvalidSyntax)) {
            return;
          }
          diagnostics.push(this.createDiagnostics(m, document));
        }

        // Limit the number of messages to the max value.
        diagnostics = diagnostics.filter((value, index) => index <= settings.linting.maxNumberOfProblems);
      }
      // Set all diagnostics found in this pass, as this method always clears existing diagnostics.
      this.diagnosticCollection.set(document.uri, diagnostics);
    }
  }

  // tslint:disable-next-line:no-any
  public async linkJupiterExtension(jupiter: vscode.Extension<any> | undefined): Promise<void> {
    if (!jupiter) {
      return;
    }
    if (!jupiter.isActive) {
      await jupiter.activate();
    }
    // tslint:disable-next-line:no-unsafe-any
    jupiter.exports.registerLanguageProvider(PYTHON.language, new JupyterProvider());
    // tslint:disable-next-line:no-unsafe-any
    this.documentHasJupyterCodeCells = jupiter.exports.hasCodeCells;
  }

  private sendLinterRunTelemetry(info: ILinterInfo, resource: vscode.Uri, promise: Promise<ILintMessage[]>, stopWatch: StopWatch, trigger: LinterTrigger): void {
    const linterExecutablePathName = info.pathName(resource);
    const properties: LintingTelemetry = {
      tool: info.id,
      hasCustomArgs: info.linterArgs(resource).length > 0,
      trigger,
      executableSpecified: linterExecutablePathName.length > 0
    };
    sendTelemetryWhenDone(LINTING, promise, stopWatch, properties);
  }

  private isDocumentOpen(uri: vscode.Uri): boolean {
    return this.documents.textDocuments.some(document => document.uri.fsPath === uri.fsPath);
  }

  private createDiagnostics(message: ILintMessage, document: vscode.TextDocument): vscode.Diagnostic {
    const position = new vscode.Position(message.line - 1, message.column);
    const range = new vscode.Range(position, position);

    const severity = lintSeverityToVSSeverity.get(message.severity!)!;
    const diagnostic = new vscode.Diagnostic(range, `${message.code}:${message.message}`, severity);
    diagnostic.code = message.code;
    diagnostic.source = message.provider;
    return diagnostic;
  }
}
