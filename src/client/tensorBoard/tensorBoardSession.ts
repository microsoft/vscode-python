// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ChildProcess } from 'child_process';
import * as path from 'path';
import {
    CancellationToken,
    CancellationTokenSource,
    Progress,
    ProgressLocation,
    ProgressOptions,
    QuickPickItem,
    ViewColumn,
    WebviewPanel,
    window,
} from 'vscode';
import { ICommandManager, IWorkspaceService } from '../common/application/types';
import { createPromiseFromCancellation } from '../common/cancellation';
import { traceError, traceInfo } from '../common/logger';
import { tensorboardLauncher } from '../common/process/internal/scripts';
import { IProcessServiceFactory, ObservableExecutionResult } from '../common/process/types';
import { IDisposableRegistry, IInstaller, InstallerResponse, Product } from '../common/types';
import { createDeferred, sleep } from '../common/utils/async';
import { TensorBoard } from '../common/utils/localize';
import { StopWatch } from '../common/utils/stopWatch';
import { IInterpreterService } from '../interpreter/contracts';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { TensorBoardSessionStartResult } from './constants';

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
    ) {}

    public async initialize(): Promise<void> {
        const e2eStartupDurationStopwatch = new StopWatch();
        const tensorBoardWasInstalled = await this.ensureTensorboardIsInstalled();
        if (!tensorBoardWasInstalled) {
            return;
        }
        const logDir = await this.askUserForLogDir();
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

    // Ensure that the TensorBoard package is installed before we attempt
    // to start a TensorBoard session.
    private async ensureTensorboardIsInstalled() {
        traceInfo('Ensuring TensorBoard package is installed into active interpreter');
        const interpreter =
            (await this.interpreterService.getActiveInterpreter()) ||
            (await this.commandManager.executeCommand('python.setInterpreter'));
        if (!interpreter) {
            return false;
        }
        if (await this.installer.isInstalled(Product.tensorboard, interpreter)) {
            return true;
        }
        const tokenSource = new CancellationTokenSource();
        const installerToken = tokenSource.token;
        const cancellationPromise = createPromiseFromCancellation({
            cancelAction: 'resolve',
            defaultValue: InstallerResponse.Ignore,
            token: installerToken,
        });
        const response = await Promise.race([
            this.installer.promptToInstall(Product.tensorboard, interpreter, installerToken),
            cancellationPromise,
        ]);
        return response === InstallerResponse.Installed;
    }

    // eslint-disable-next-line class-methods-use-this
    private async showFilePicker(): Promise<string | undefined> {
        const selection = await window.showOpenDialog({
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
    private async askUserForLogDir(): Promise<string | undefined> {
        const logDir = this.autopopulateLogDirectoryPath();
        const useCurrentWorkingDirectory = TensorBoard.useCurrentWorkingDirectory();
        const selectAFolder = TensorBoard.selectAFolder();
        const selectAnotherFolder = TensorBoard.selectAnotherFolder();
        const items: QuickPickItem[] = this.getQuickPickItems(logDir);
        const item = await window.showQuickPick(items, {
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

        const result = await window.withProgress(
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
    }

    private createPanel() {
        const webviewPanel = window.createWebviewPanel('tensorBoardSession', 'TensorBoard', ViewColumn.Two, {
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
                    function resizeFrame() {
                        var f = window.document.getElementById('vscode-tensorboard-iframe');
                        if (f) {
                            f.style.height = window.innerHeight / 0.7 + "px";
                            f.style.width = window.innerWidth / 0.7 + "px";
                        }
                    }
                    resizeFrame();
                    window.addEventListener('resize', resizeFrame);
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
                        transform: scale(0.7);
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
