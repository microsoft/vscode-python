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
    ViewColumn,
    WebviewPanel,
    window
} from 'vscode';
import { IWorkspaceService } from '../common/application/types';
import { createPromiseFromCancellation } from '../common/cancellation';
import { traceError, traceInfo } from '../common/logger';
import { IFileSystem } from '../common/platform/types';
import { _SCRIPTS_DIR, tensorboardLauncher } from '../common/process/internal/scripts';
import { IProcessServiceFactory, ObservableExecutionResult } from '../common/process/types';
import { IInstaller, InstallerResponse, Product } from '../common/types';
import { createDeferred, sleep } from '../common/utils/async';
import { TensorBoard } from '../common/utils/localize';
import { IInterpreterService } from '../interpreter/contracts';

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
    private webviewPanel: WebviewPanel | undefined;
    private url: string | undefined;
    private process: ChildProcess | undefined;

    constructor(
        private readonly installer: IInstaller,
        private readonly interpreterService: IInterpreterService,
        private readonly workspaceService: IWorkspaceService,
        private readonly fileSystem: IFileSystem,
        private readonly processServiceFactory: IProcessServiceFactory
    ) {}

    public async initialize() {
        const tensorBoardWasInstalled = await this.ensureTensorboardIsInstalled();
        if (!tensorBoardWasInstalled) {
            return;
        }
        const logDir = await this.askUserForLogDir();
        const startedSuccessfully = await this.startTensorboardSession(logDir);
        if (startedSuccessfully) {
            this.showPanel();
        }
    }

    // Ensure that the TensorBoard package is installed before we attempt
    // to start a TensorBoard session.
    private async ensureTensorboardIsInstalled() {
        traceInfo('Ensuring TensorBoard package is installed');
        if (await this.installer.isInstalled(Product.tensorboard)) {
            return true;
        }
        const interpreter = await this.interpreterService.getActiveInterpreter();
        const tokenSource = new CancellationTokenSource();
        const installerToken = tokenSource.token;
        const cancellationPromise = createPromiseFromCancellation({
            cancelAction: 'resolve',
            defaultValue: InstallerResponse.Ignore,
            token: installerToken
        });
        const response = await Promise.race([
            this.installer.promptToInstall(Product.tensorboard, interpreter, installerToken),
            cancellationPromise
        ]);
        return response === InstallerResponse.Installed;
    }

    // Display an input box asking the user for an absolute or relative log directory
    // to tfevent files. Default this to the directory that the active text editor is in,
    // if any, then the folder that is open in the editor, if any.
    private async askUserForLogDir(): Promise<string> {
        const options = {
            prompt: TensorBoard.logDirectoryPrompt(),
            value: this.autopopulateLogDirectoryPath(),
            placeHolder: TensorBoard.logDirectoryPlaceholder(),
            ignoreFocusOut: true,
            validateInput: (value: string) => {
                return value.trim().length > 0 ? undefined : TensorBoard.invalidLogDirectory();
            }
        };
        const logDir = await window.showInputBox(options);

        // Even though we validateInput above, the result of showInputBox may still be
        // null if the user hit `esc`. The user may also have provided a log directory
        // that does not exist. Validate it and fail fast here.
        if (!logDir || !(await this.isValidLogDirectory(logDir))) {
            throw new Error(TensorBoard.invalidLogDirectory());
        }
        return logDir;
    }

    // Spawn a process which uses TensorBoard's Python API to start a TensorBoard session.
    // Times out if it hasn't started up after 1 minute.
    // Hold on to the process so we can kill it when the webview is closed.
    private async startTensorboardSession(logDir: string): Promise<boolean> {
        const cwd = this.getFullyQualifiedLogDirectory(logDir);
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
            cancellable: true
        };

        const processService = await this.processServiceFactory.create();
        const args = tensorboardLauncher([logDir]);
        const observable = processService.execObservable(pythonExecutable.path, args, { cwd });

        const result = await window.withProgress(
            progressOptions,
            (_progress: Progress<{}>, token: CancellationToken) => {
                traceInfo(`Starting TensorBoard with log directory ${cwd}...`);

                const spawnTensorBoard = this.waitForTensorBoardStart(observable);
                const userCancellation = createPromiseFromCancellation({
                    token,
                    cancelAction: 'resolve',
                    defaultValue: 'canceled'
                });

                return Promise.race([sleep(timeout), spawnTensorBoard, userCancellation]);
            }
        );

        switch (result) {
            case timeout:
                throw new Error(`Timed out after ${timeout / 1000} seconds waiting for TensorBoard to launch.`);
            case 'canceled':
                traceInfo('Canceled starting TensorBoard session.');
                return false;
            case 'success':
                this.process = observable.proc;
                return true;
            default:
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
                        this.url = match[1];
                        urlThatTensorBoardIsRunningAt.resolve('success');
                    }
                } else if (output.source === 'stderr') {
                    traceError(output.out);
                }
            },
            error: (err) => {
                traceError(err);
            }
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
            enableScripts: true
        });
        this.webviewPanel = webviewPanel;
        webviewPanel.onDidDispose(() => {
            this.webviewPanel = undefined;
            // Kill the running TensorBoard session
            this.process?.kill();
            this.process = undefined;
        });
        webviewPanel.onDidChangeViewState((_e) => {
            if (webviewPanel.visible) {
                this.update();
            }
        }, null);
        return webviewPanel;
    }

    private update() {
        if (this.webviewPanel) {
            this.webviewPanel.webview.html = `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'unsafe-inline'; frame-src ${this.url};">
                <iframe
                    width="100%"
                    height="800"
                    sandbox="allow-scripts allow-forms allow-same-origin allow-pointer-lock"
                    src="${this.url}"
                    frameborder="0"
                    allowfullscreen
                ></iframe>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>TensorBoard</title>
            </head>
            </html>`;
        }
    }

    // TensorBoard accepts absolute or relative log directory paths to tfevent files.
    // It uses these files to populate its visualizations. If given a relative path,
    // TensorBoard resolves them against the current working directory. Make the
    // chosen filepath explicit in our logs. If a workspace folder is open, ensure
    // we pass it as cwd to the spawned process. If there is no rootPath available,
    // explicitly pass process.cwd, which is what `spawn` would use by default anyway.
    private getFullyQualifiedLogDirectory(logDir: string) {
        if (path.isAbsolute(logDir)) {
            return logDir;
        }
        const rootPath = this.workspaceService.rootPath;
        if (rootPath) {
            return path.resolve(rootPath, logDir);
        } else {
            return path.resolve(process.cwd(), logDir);
        }
    }

    private autopopulateLogDirectoryPath(): string | undefined {
        const activeTextEditor = window.activeTextEditor;
        if (activeTextEditor) {
            return path.dirname(activeTextEditor.document.uri.fsPath);
        }
        return this.workspaceService.rootPath;
    }

    private isValidLogDirectory(logDir: string) {
        return this.fileSystem.directoryExists(logDir);
    }
}
