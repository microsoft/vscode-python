import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { ConfigSettingMonitor } from '../common/configSettingMonitor';
import { PythonSettings } from '../common/configSettings';
import { LinterErrors, PythonLanguage } from '../common/constants';
import { IServiceContainer } from '../ioc/types';
import { ILinterInfo, ILinterManager, ILintMessage, LintMessageSeverity } from '../linters/types';
import { sendTelemetryWhenDone } from '../telemetry';
import { LINTING } from '../telemetry/constants';
import { StopWatch } from '../telemetry/stopWatch';
import { LinterTrigger, LintingTelemetry } from '../telemetry/types';

// tslint:disable-next-line:no-require-imports no-var-requires
const Minimatch = require('minimatch').Minimatch;

const uriSchemesToIgnore = ['git', 'showModifications', 'svn'];
const lintSeverityToVSSeverity = new Map<LintMessageSeverity, vscode.DiagnosticSeverity>();
lintSeverityToVSSeverity.set(LintMessageSeverity.Error, vscode.DiagnosticSeverity.Error);
lintSeverityToVSSeverity.set(LintMessageSeverity.Hint, vscode.DiagnosticSeverity.Hint);
lintSeverityToVSSeverity.set(LintMessageSeverity.Information, vscode.DiagnosticSeverity.Information);
lintSeverityToVSSeverity.set(LintMessageSeverity.Warning, vscode.DiagnosticSeverity.Warning);

function createDiagnostics(message: ILintMessage, document: vscode.TextDocument): vscode.Diagnostic {
    const position = new vscode.Position(message.line - 1, message.column);
    const range = new vscode.Range(position, position);

    const severity = lintSeverityToVSSeverity.get(message.severity!)!;
    const diagnostic = new vscode.Diagnostic(range, `${message.code}:${message.message}`, severity);
    diagnostic.code = message.code;
    diagnostic.source = message.provider;
    return diagnostic;
}

// tslint:disable-next-line:interface-name
interface DocumentHasJupyterCodeCells {
    // tslint:disable-next-line:callable-types
    (doc: vscode.TextDocument, token: vscode.CancellationToken): Promise<Boolean>;
}
export class LinterProvider implements vscode.Disposable {
    private linterManager: ILinterManager;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private pendingLintings = new Map<string, vscode.CancellationTokenSource>();
    private outputChannel: vscode.OutputChannel;
    private context: vscode.ExtensionContext;
    private disposables: vscode.Disposable[];
    private configMonitor: ConfigSettingMonitor;
    public constructor(
        context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel,
        public documentHasJupyterCodeCells: DocumentHasJupyterCodeCells,
        private serviceContainer: IServiceContainer) {

        this.linterManager = serviceContainer.get<ILinterManager>(ILinterManager);
        this.outputChannel = outputChannel;
        this.context = context;
        this.disposables = [];
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
        this.lintOpenPythonFiles();
    }

    private lintOpenPythonFiles() {
        workspace.textDocuments.forEach(async document => {
            if (document.languageId === PythonLanguage.language) {
                await this.onLintDocument(document, 'auto');
            }
        });
    }
    private lintSettingsChangedHandler(configTarget: ConfigurationTarget, wkspaceOrFolder: Uri) {
        if (configTarget === ConfigurationTarget.Workspace) {
            this.lintOpenPythonFiles();
            return;
        }
        // Look for python files that belong to the specified workspace folder.
        workspace.textDocuments.forEach(async document => {
            const wkspaceFolder = workspace.getWorkspaceFolder(document.uri);
            if (wkspaceFolder && wkspaceFolder.uri.fsPath === wkspaceOrFolder.fsPath) {
                await this.onLintDocument(document, 'auto');
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
            await this.onLintDocument(document, trigger);
        }, delay);
    }
    private async onLintDocument(document: vscode.TextDocument, trigger: LinterTrigger): Promise<void> {
        // Check if we need to lint this document
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const workspaceRootPath = (workspaceFolder && typeof workspaceFolder.uri.fsPath === 'string') ? workspaceFolder.uri.fsPath : undefined;
        const relativeFileName = typeof workspaceRootPath === 'string' ? path.relative(workspaceRootPath, document.fileName) : document.fileName;
        const settings = PythonSettings.getInstance(document.uri);
        if (document.languageId !== PythonLanguage.language) {
            return;
        }
        if (!this.linterManager.isLintingEnabled()) {
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
                const linter = this.linterManager.createLinter(info.product, this.outputChannel, this.serviceContainer);
                const promise = linter.lint(document, cancelToken.token);
                this.sendLinterRunTelemetry(info, document.uri, promise, stopWatch, trigger);
                return promise;
            });
        this.documentHasJupyterCodeCells(document, cancelToken.token)
            .then(hasJupyterCodeCells => {
                // linters will resolve asynchronously - keep a track of all
                // diagnostics reported as them come in.
                let diagnostics: vscode.Diagnostic[] = [];

                promises.forEach(p => {
                    p.then(msgs => {
                        if (cancelToken.token.isCancellationRequested) {
                            return;
                        }

                        // Build the message and suffix the message with the name of the linter used.
                        msgs.forEach(d => {
                            // Ignore magic commands from jupyter.
                            if (hasJupyterCodeCells && document.lineAt(d.line - 1).text.trim().startsWith('%') &&
                                (d.code === LinterErrors.pylint.InvalidSyntax ||
                                    d.code === LinterErrors.prospector.InvalidSyntax ||
                                    d.code === LinterErrors.flake8.InvalidSyntax)) {
                                return;
                            }
                            diagnostics.push(createDiagnostics(d, document));
                        });

                        // Limit the number of messages to the max value.
                        diagnostics = diagnostics.filter((value, index) => index <= settings.linting.maxNumberOfProblems);

                        if (!this.isDocumentOpen(document.uri)) {
                            diagnostics = [];
                        }
                        // Set all diagnostics found in this pass, as this method always clears existing diagnostics.
                        this.diagnosticCollection.set(document.uri, diagnostics);
                    })
                        .catch(ex => console.error('Python Extension: documentHasJupyterCodeCells.promises', ex));
                });
            })
            .catch(ex => console.error('Python Extension: documentHasJupyterCodeCells', ex));
    }

    private sendLinterRunTelemetry(info: ILinterInfo, resource: Uri, promise: Promise<ILintMessage[]>, stopWatch: StopWatch, trigger: LinterTrigger): void {
        const linterExecutablePathName = info.pathName(resource);
        const properties: LintingTelemetry = {
            tool: info.id,
            hasCustomArgs: info.linterArgs(resource).length > 0,
            trigger,
            executableSpecified: linterExecutablePathName.length > 0
        };
        sendTelemetryWhenDone(LINTING, promise, stopWatch, properties);
    }
}
