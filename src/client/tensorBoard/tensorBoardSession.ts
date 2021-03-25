// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as fs from 'fs-extra';
import { ChildProcess } from 'child_process';
import * as path from 'path';
import {
    CancellationToken,
    CancellationTokenSource,
    Position,
    Progress,
    ProgressLocation,
    ProgressOptions,
    QuickPickItem,
    Selection,
    Uri,
    ViewColumn,
    WebviewPanel,
    WebviewPanelOnDidChangeViewStateEvent,
    window,
    workspace,
} from 'vscode';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../common/application/types';
import { createPromiseFromCancellation } from '../common/cancellation';
import { traceError, traceInfo } from '../common/logger';
import { tensorboardLauncher } from '../common/process/internal/scripts';
import { IProcessServiceFactory, ObservableExecutionResult } from '../common/process/types';
import {
    IDisposableRegistry,
    IInstaller,
    InstallerResponse,
    ProductInstallStatus,
    Product,
    IPersistentState,
} from '../common/types';
import { createDeferred, sleep } from '../common/utils/async';
import { Common, TensorBoard } from '../common/utils/localize';
import { StopWatch } from '../common/utils/stopWatch';
import { IInterpreterService } from '../interpreter/contracts';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { ImportTracker } from '../telemetry/importTracker';
import { TensorBoardPromptSelection, TensorBoardSessionStartResult } from './constants';

enum Messages {
    JumpToSource = 'jump_to_source',
}

/**
 * Manages the lifecycle of a TensorBoard session.
 * Specifically, it:
 * - ensures the TensorBoard Python package is installed,
 * - asks the user for a log directory to start TensorBoard with
 * - spawns TensorBoard in a background process which must stay running
 *   to serve the TensorBoard website
 * - frames the TensorBoard website in a VSCode webview
 * - shuts down the TensorBoard process when the webview is closed
 */
export class TensorBoardSession {
    public get panel(): WebviewPanel | undefined {
        return this.webviewPanel;
    }

    public get daemon(): ChildProcess | undefined {
        return this.process;
    }

    private active = false;

    private webviewPanel: WebviewPanel | undefined;

    private url: string | undefined;

    private process: ChildProcess | undefined;

    // This tracks the total duration of time that the user kept the TensorBoard panel open
    private sessionDurationStopwatch: StopWatch | undefined;

    constructor(
        private readonly installer: IInstaller,
        private readonly interpreterService: IInterpreterService,
        private readonly workspaceService: IWorkspaceService,
        private readonly processServiceFactory: IProcessServiceFactory,
        private readonly commandManager: ICommandManager,
        private readonly disposables: IDisposableRegistry,
        private readonly applicationShell: IApplicationShell,
        private readonly isInTorchProfilerExperiment: boolean,
        private readonly globalMemento: IPersistentState<ViewColumn>,
    ) {}

    public async initialize(): Promise<void> {
        const e2eStartupDurationStopwatch = new StopWatch();
        const tensorBoardWasInstalled = await this.ensurePrerequisitesAreInstalled();
        if (!tensorBoardWasInstalled) {
            return;
        }
        const logDir = await this.getLogDirectory();
        if (!logDir) {
            return;
        }
        const startedSuccessfully = await this.startTensorboardSession(logDir);
        if (startedSuccessfully) {
            this.showPanel();
            // Not using captureTelemetry on this method as we only want to send
            // this particular telemetry event if the whole session creation succeeded
            sendTelemetryEvent(
                EventName.TENSORBOARD_SESSION_E2E_STARTUP_DURATION,
                e2eStartupDurationStopwatch.elapsedTime,
            );
        }
        this.sessionDurationStopwatch = new StopWatch();
    }

    private async promptToInstall(
        tensorBoardInstallStatus: ProductInstallStatus,
        shouldInstallProfilerPlugin: boolean,
    ) {
        sendTelemetryEvent(EventName.TENSORBOARD_INSTALL_PROMPT_SHOWN);
        const yes = Common.bannerLabelYes();
        const no = Common.bannerLabelNo();
        const isUpgrade = tensorBoardInstallStatus === ProductInstallStatus.NeedsUpgrade;
        let message;

        if (tensorBoardInstallStatus === ProductInstallStatus.Installed && shouldInstallProfilerPlugin) {
            // PyTorch user already has TensorBoard, just ask if they want the profiler plugin
            message = TensorBoard.installProfilerPluginPrompt();
        } else if (shouldInstallProfilerPlugin) {
            // PyTorch user doesn't have compatible TensorBoard or the profiler plugin
            message = TensorBoard.installTensorBoardAndProfilerPluginPrompt();
        } else if (isUpgrade) {
            // Not a PyTorch user and needs upgrade, don't need to mention profiler plugin
            message = TensorBoard.upgradePrompt();
        } else {
            // Not a PyTorch user and needs install, again don't need to mention profiler plugin
            message = TensorBoard.installPrompt();
        }
        const selection = await this.applicationShell.showErrorMessage(message, ...[yes, no]);
        let telemetrySelection = TensorBoardPromptSelection.None;
        if (selection === yes) {
            telemetrySelection = TensorBoardPromptSelection.Yes;
        } else if (selection === no) {
            telemetrySelection = TensorBoardPromptSelection.No;
        }
        sendTelemetryEvent(EventName.TENSORBOARD_INSTALL_PROMPT_SELECTION, undefined, {
            selection: telemetrySelection,
            operationType: isUpgrade ? 'upgrade' : 'install',
        });
        return selection;
    }

    // Ensure that the TensorBoard package is installed before we attempt
    // to start a TensorBoard session. If the user has a torch import in
    // any of their open documents, also try to install the torch-tb-plugin
    // package, but don't block if installing that fails.
    private async ensurePrerequisitesAreInstalled() {
        traceInfo('Ensuring TensorBoard package is installed into active interpreter');
        const interpreter =
            (await this.interpreterService.getActiveInterpreter()) ||
            (await this.commandManager.executeCommand('python.setInterpreter'));
        if (!interpreter) {
            return false;
        }

        // First see what dependencies we're missing
        let [tensorboardInstallStatus, profilerPluginInstallStatus] = await Promise.all([
            this.installer.isProductVersionCompatible(Product.tensorboard, '>= 2.4.1', interpreter),
            this.installer.isInstalled(Product.torchProfilerImportName, interpreter),
        ]);
        const isTorchUserAndInExperiment = ImportTracker.hasModuleImport('torch') && this.isInTorchProfilerExperiment;
        const needsTensorBoardInstall = tensorboardInstallStatus !== ProductInstallStatus.Installed;
        const needsProfilerPluginInstall = isTorchUserAndInExperiment && profilerPluginInstallStatus !== true;
        if (
            // PyTorch user, in profiler install experiment, TensorBoard and profiler plugin already installed
            (isTorchUserAndInExperiment && !needsTensorBoardInstall && profilerPluginInstallStatus === true) ||
            // Not PyTorch user or not in profiler install experiment, so no need for profiler plugin,
            // and TensorBoard is already installed
            (!isTorchUserAndInExperiment && tensorboardInstallStatus === ProductInstallStatus.Installed)
        ) {
            return true;
        }

        // Ask the user if they want to install packages to start a TensorBoard session
        const selection = await this.promptToInstall(
            tensorboardInstallStatus,
            isTorchUserAndInExperiment && !profilerPluginInstallStatus,
        );
        if (selection !== Common.bannerLabelYes() && !needsTensorBoardInstall) {
            return true;
        }
        if (selection !== Common.bannerLabelYes()) {
            return false;
        }

        // User opted to install packages. Figure out which ones we need and install them
        const tokenSource = new CancellationTokenSource();
        const installerToken = tokenSource.token;
        const cancellationPromise = createPromiseFromCancellation({
            cancelAction: 'resolve',
            defaultValue: InstallerResponse.Ignore,
            token: installerToken,
        });
        const installPromises = [];
        // If need to install torch.profiler and it's not already installed, add it to our list of promises
        if (needsTensorBoardInstall) {
            installPromises.push(
                this.installer.install(
                    Product.tensorboard,
                    interpreter,
                    installerToken,
                    tensorboardInstallStatus === ProductInstallStatus.NeedsUpgrade,
                ),
            );
        }
        if (needsProfilerPluginInstall) {
            installPromises.push(this.installer.install(Product.torchProfilerInstallName, interpreter, installerToken));
        }
        await Promise.race([...installPromises, cancellationPromise]);

        // Check install status again after installing
        [tensorboardInstallStatus, profilerPluginInstallStatus] = await Promise.all([
            this.installer.isProductVersionCompatible(Product.tensorboard, '>= 2.4.1', interpreter),
            this.installer.isInstalled(Product.torchProfilerImportName, interpreter),
        ]);
        // Send telemetry regarding results of install
        sendTelemetryEvent(EventName.TENSORBOARD_PACKAGE_INSTALL_RESULT, undefined, {
            wasTensorBoardAttempted: needsTensorBoardInstall,
            wasProfilerPluginAttempted: needsProfilerPluginInstall,
            wasTensorBoardInstalled: tensorboardInstallStatus === ProductInstallStatus.Installed,
            wasProfilerPluginInstalled: profilerPluginInstallStatus,
        });
        // Profiler plugin is not required to start TensorBoard. If it failed, note that it failed
        // in the log, but report success only based on TensorBoard package install status.
        if (isTorchUserAndInExperiment && profilerPluginInstallStatus === false) {
            traceError(`Failed to install torch-tb-plugin. Profiler plugin will not appear in TensorBoard session.`);
        }
        return tensorboardInstallStatus === ProductInstallStatus.Installed;
    }

    // eslint-disable-next-line class-methods-use-this
    private async showFilePicker(): Promise<string | undefined> {
        const selection = await this.applicationShell.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
        });
        // If the user selected a folder, return the uri.fsPath
        // There will only be one selection since canSelectMany: false
        if (selection) {
            return selection[0].fsPath;
        }
        return undefined;
    }

    // eslint-disable-next-line class-methods-use-this
    private getQuickPickItems(logDir: string | undefined) {
        if (logDir) {
            const useCwd = {
                label: TensorBoard.useCurrentWorkingDirectory(),
                detail: TensorBoard.useCurrentWorkingDirectoryDetail(),
            };
            const selectAnotherFolder = {
                label: TensorBoard.selectAnotherFolder(),
                detail: TensorBoard.selectAnotherFolderDetail(),
            };
            return [useCwd, selectAnotherFolder];
        }
        const selectAFolder = {
            label: TensorBoard.selectAFolder(),
            detail: TensorBoard.selectAFolderDetail(),
        };
        return [selectAFolder];
    }

    // Display a quickpick asking the user to acknowledge our autopopulated log directory or
    // select a new one using the file picker. Default this to the folder that is open in
    // the editor, if any, then the directory that the active text editor is in, if any.
    private async getLogDirectory(): Promise<string | undefined> {
        // See if the user told us to always use a specific log directory
        const setting = this.workspaceService.getConfiguration('python.tensorBoard');
        const settingValue = setting.get<string>('logDirectory');
        if (settingValue) {
            traceInfo(`Using log directory specified by python.tensorBoard.logDirectory setting: ${settingValue}`);
            return settingValue;
        }
        // No log directory in settings. Ask the user which directory to use
        const logDir = this.autopopulateLogDirectoryPath();
        const useCurrentWorkingDirectory = TensorBoard.useCurrentWorkingDirectory();
        const selectAFolder = TensorBoard.selectAFolder();
        const selectAnotherFolder = TensorBoard.selectAnotherFolder();
        const items: QuickPickItem[] = this.getQuickPickItems(logDir);
        const item = await this.applicationShell.showQuickPick(items, {
            canPickMany: false,
            ignoreFocusOut: false,
            placeHolder: logDir ? TensorBoard.currentDirectory().format(logDir) : undefined,
        });
        switch (item?.label) {
            case useCurrentWorkingDirectory:
                return logDir;
            case selectAFolder:
            case selectAnotherFolder:
                return this.showFilePicker();
            default:
                return undefined;
        }
    }

    // Spawn a process which uses TensorBoard's Python API to start a TensorBoard session.
    // Times out if it hasn't started up after 1 minute.
    // Hold on to the process so we can kill it when the webview is closed.
    private async startTensorboardSession(logDir: string): Promise<boolean> {
        const pythonExecutable = await this.interpreterService.getActiveInterpreter();
        if (!pythonExecutable) {
            return false;
        }

        // Timeout waiting for TensorBoard to start after 60 seconds.
        // This is the same time limit that TensorBoard itself uses when waiting for
        // its webserver to start up.
        const timeout = 60_000;

        // Display a progress indicator as TensorBoard takes at least a couple seconds to launch
        const progressOptions: ProgressOptions = {
            title: TensorBoard.progressMessage(),
            location: ProgressLocation.Notification,
            cancellable: true,
        };

        const processService = await this.processServiceFactory.create();
        const args = tensorboardLauncher([logDir]);
        const sessionStartStopwatch = new StopWatch();
        const observable = processService.execObservable(pythonExecutable.path, args);

        const result = await this.applicationShell.withProgress(
            progressOptions,
            (_progress: Progress<unknown>, token: CancellationToken) => {
                traceInfo(`Starting TensorBoard with log directory ${logDir}...`);

                const spawnTensorBoard = this.waitForTensorBoardStart(observable);
                const userCancellation = createPromiseFromCancellation({
                    token,
                    cancelAction: 'resolve',
                    defaultValue: 'canceled',
                });

                return Promise.race([sleep(timeout), spawnTensorBoard, userCancellation]);
            },
        );

        switch (result) {
            case 'canceled':
                traceInfo('Canceled starting TensorBoard session.');
                sendTelemetryEvent(
                    EventName.TENSORBOARD_SESSION_DAEMON_STARTUP_DURATION,
                    sessionStartStopwatch.elapsedTime,
                    {
                        result: TensorBoardSessionStartResult.cancel,
                    },
                );
                observable.dispose();
                return false;
            case 'success':
                this.process = observable.proc;
                sendTelemetryEvent(
                    EventName.TENSORBOARD_SESSION_DAEMON_STARTUP_DURATION,
                    sessionStartStopwatch.elapsedTime,
                    {
                        result: TensorBoardSessionStartResult.success,
                    },
                );
                return true;
            case timeout:
                sendTelemetryEvent(
                    EventName.TENSORBOARD_SESSION_DAEMON_STARTUP_DURATION,
                    sessionStartStopwatch.elapsedTime,
                    {
                        result: TensorBoardSessionStartResult.error,
                    },
                );
                throw new Error(`Timed out after ${timeout / 1000} seconds waiting for TensorBoard to launch.`);
            default:
                // We should never get here
                throw new Error(`Failed to start TensorBoard, received unknown promise result: ${result}`);
        }
    }

    private async waitForTensorBoardStart(observable: ObservableExecutionResult<string>) {
        const urlThatTensorBoardIsRunningAt = createDeferred<string>();

        observable.out.subscribe({
            next: (output) => {
                if (output.source === 'stdout') {
                    const match = output.out.match(/TensorBoard started at (.*)/);
                    if (match && match[1]) {
                        // eslint-disable-next-line prefer-destructuring
                        this.url = match[1];
                        urlThatTensorBoardIsRunningAt.resolve('success');
                    }
                    traceInfo(output.out);
                } else if (output.source === 'stderr') {
                    traceError(output.out);
                }
            },
            error: (err) => {
                traceError(err);
            },
        });

        return urlThatTensorBoardIsRunningAt.promise;
    }

    private showPanel() {
        traceInfo('Showing TensorBoard panel');
        const panel = this.webviewPanel || this.createPanel();
        panel.reveal();
        this.active = true;
    }

    private createPanel() {
        const webviewPanel = window.createWebviewPanel('tensorBoardSession', 'TensorBoard', this.globalMemento.value, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        webviewPanel.webview.html = `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'unsafe-inline'; frame-src ${this.url} http: https:;">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>TensorBoard</title>
            </head>
            <body>
                <script type="text/javascript">
                    const vscode = acquireVsCodeApi();
                    function resizeFrame() {
                        var f = window.document.getElementById('vscode-tensorboard-iframe');
                        if (f) {
                            f.style.height = window.innerHeight / 0.8 + "px";
                            f.style.width = window.innerWidth / 0.8 + "px";
                        }
                    }
                    resizeFrame();
                    window.onload = function() {
                        resizeFrame();
                    }
                    window.addEventListener('resize', resizeFrame);
                    window.addEventListener('message', (event) => {
                        if (!"${this.url}".startsWith(event.origin) || !event.data || !event.data.filename || !event.data.line) {
                            return;
                        }
                        const args = { filename: event.data.filename, line: event.data.line };
                        vscode.postMessage({ command: '${Messages.JumpToSource}', args: args });
                    });
                </script>
                <iframe
                    id="vscode-tensorboard-iframe"
                    class="responsive-iframe"
                    sandbox="allow-scripts allow-forms allow-same-origin allow-pointer-lock"
                    src="${this.url}"
                    frameborder="0"
                    border="0"
                    allowfullscreen
                ></iframe>
                <style>
                    .responsive-iframe {
                        transform: scale(0.8);
                        transform-origin: 0 0;
                        position: absolute;
                        top: 0;
                        left: 0;
                        overflow: hidden;
                        display: block;
                    }
                </style>
            </body>
        </html>`;
        this.webviewPanel = webviewPanel;
        this.disposables.push(
            webviewPanel.onDidDispose(() => {
                this.webviewPanel = undefined;
                // Kill the running TensorBoard session
                this.process?.kill();
                sendTelemetryEvent(EventName.TENSORBOARD_SESSION_DURATION, this.sessionDurationStopwatch?.elapsedTime);
                this.process = undefined;
            }),
        );
        this.disposables.push(
            webviewPanel.onDidChangeViewState(async (args: WebviewPanelOnDidChangeViewStateEvent) => {
                // The webview has been moved to a different viewgroup if it was active before and remains active now
                if (this.active && args.webviewPanel.active) {
                    await this.globalMemento.updateValue(webviewPanel.viewColumn ?? ViewColumn.Active);
                }
                this.active = args.webviewPanel.active;
            }),
        );
        this.disposables.push(
            webviewPanel.webview.onDidReceiveMessage((message) => {
                // Handle messages posted from the webview
                switch (message.command) {
                    case Messages.JumpToSource:
                        jumpToSource(message.args.filename, message.args.line);
                        break;
                    default:
                        break;
                }
            }),
        );
        return webviewPanel;
    }

    private autopopulateLogDirectoryPath(): string | undefined {
        if (this.workspaceService.rootPath) {
            return this.workspaceService.rootPath;
        }
        const { activeTextEditor } = window;
        if (activeTextEditor) {
            return path.dirname(activeTextEditor.document.uri.fsPath);
        }
        return undefined;
    }
}

function jumpToSource(fsPath: string, line: number) {
    if (fs.existsSync(fsPath)) {
        const uri = Uri.file(fsPath);
        workspace
            .openTextDocument(uri)
            .then((doc) => window.showTextDocument(doc, ViewColumn.Beside))
            .then((editor) => {
                // Select the line if it exists in the document
                if (line < editor.document.lineCount) {
                    const position = new Position(line, 0);
                    editor.selection = new Selection(position, editor.document.lineAt(line).range.end);
                }
            });
    } else {
        traceError(`Requested jump to source filepath ${fsPath} does not exist`);
    }
}
