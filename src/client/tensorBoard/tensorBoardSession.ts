// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ChildProcess, spawn } from 'child_process';
import { CancellationTokenSource, ViewColumn, WebviewPanel, window } from 'vscode';
import { createPromiseFromCancellation } from '../common/cancellation';
import { traceError, traceInfo } from '../common/logger';
import { IInstaller, InstallerResponse, Product } from '../common/types';
import { TensorBoard } from '../common/utils/localize';
import { IInterpreterService } from '../interpreter/contracts';
import * as path from 'path';
import { _SCRIPTS_DIR } from '../common/process/internal/scripts';
import { sleep } from '../common/utils/async';

const LAUNCH_TENSORBOARD = path.join(_SCRIPTS_DIR, 'tensorboard_launcher.py');

export class TensorBoardSession {
    private webviewPanel: WebviewPanel | undefined;
    private url: string | undefined;
    private process: ChildProcess | undefined;

    constructor(private readonly installer: IInstaller, private readonly interpreterService: IInterpreterService) {}

    public async initialize() {
        await this.ensureTensorboardIsInstalled();
        const logDir = await this.askUserForLogDir();
        await this.startTensorboardSession(logDir);
        this.showPanel();
    }

    private async ensureTensorboardIsInstalled() {
        traceInfo('Ensuring TensorBoard package is installed');
        if (await this.installer.isInstalled(Product.tensorboard)) {
            return;
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
            await this.installer.promptToInstall(Product.tensorboard, interpreter, installerToken),
            cancellationPromise
        ]);
        if (response !== InstallerResponse.Installed) {
            throw new Error(TensorBoard.tensorBoardInstallRequired());
        }
    }

    private async askUserForLogDir(): Promise<string> {
        const options = {
            prompt: TensorBoard.logDirectoryPrompt(),
            placeHolder: TensorBoard.logDirectoryPlaceholder(),
            validateInput: (value: string) => {
                return value.trim().length > 0 ? undefined : TensorBoard.invalidLogDirectory();
            }
        };
        const logDir = await window.showInputBox(options);
        if (!logDir) {
            throw new Error(TensorBoard.invalidLogDirectory());
        }
        return logDir;
    }

    private async startTensorboardSession(logDir: string) {
        traceInfo('Starting TensorBoard');
        const pythonExecutable = await this.interpreterService.getActiveInterpreter();
        // TODO If a workspace folder is open, ensure we pass it as cwd to the spawned process
        // This is so that TensorBoard can resolve the filepath
        const tensorBoardProcess = new Promise((resolve, reject) => {
            const proc = spawn(pythonExecutable?.path || 'python', [LAUNCH_TENSORBOARD, logDir]);
            proc.stdout.on('data', (data: Buffer) => {
                const output = data.toString('utf8');
                const match = output.match(/TensorBoard started at (.*)/);
                if (match && match[1]) {
                    this.url = match[1];
                    resolve(proc);
                }
                traceInfo(output);
            });
            proc.stderr.on('error', (err) => {
                traceError(err);
                reject();
            });
            proc.on('close', (code) => {
                traceInfo(`TensorBoard child process exited with code ${code}.`);
                this.process = undefined;
                reject();
            });
            proc.on('disconnect', () => {
                traceInfo(`TensorBoard child process disconnected.`);
                this.process = undefined;
                reject();
            });
        });

        const timeout = 60_000;
        const result = await Promise.race([sleep(timeout), tensorBoardProcess]);
        if (result !== timeout) {
            this.process = result as ChildProcess;
        } else {
            throw new Error('Failed to start TensorBoard.');
        }
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
            // Kill the running tensorboard session
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
}
