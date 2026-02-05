// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// Native Repl class that holds instance of pythonServer and replController

import { NotebookController, NotebookDocument, QuickPickItem, TextEditor, Uri, WorkspaceFolder } from 'vscode';
import * as path from 'path';
import { Disposable } from 'vscode-jsonrpc';
import { PVSC_EXTENSION_ID } from '../common/constants';
import { showNotebookDocument, showQuickPick } from '../common/vscodeApis/windowApis';
import { getWorkspaceFolders, onDidCloseNotebookDocument } from '../common/vscodeApis/workspaceApis';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { createPythonServer, PythonServer } from './pythonServer';
import { executeNotebookCell, openInteractiveREPL, selectNotebookKernel } from './replCommandHandler';
import { createReplController } from './replController';
import { EventName } from '../telemetry/constants';
import { sendTelemetryEvent } from '../telemetry';
import { VariablesProvider } from './variables/variablesProvider';
import { VariableRequester } from './variables/variableRequester';
import { getTabNameForUri } from './replUtils';
import { getWorkspaceStateValue, updateWorkspaceStateValue } from '../common/persistentState';
import { onDidChangeEnvironmentEnvExt, useEnvExtension } from '../envExt/api.internal';
import { getActiveInterpreterLegacy } from '../envExt/api.legacy';

export const NATIVE_REPL_URI_MEMENTO = 'nativeReplUri';
let nativeRepl: NativeRepl | undefined;
export class NativeRepl implements Disposable {
    // Adding ! since it will get initialized in create method, not the constructor.
    private pythonServer!: PythonServer;

    private cwd: string | undefined;

    private interpreter!: PythonEnvironment;

    private disposables: Disposable[] = [];

    private replController!: NotebookController;

    private notebookDocument: NotebookDocument | undefined;

    public newReplSession: boolean | undefined = true;

    private envChangeListenerRegistered = false;

    private pendingInterpreterChange?: { resource?: Uri };

    // TODO: In the future, could also have attribute of URI for file specific REPL.
    private constructor() {
        this.watchNotebookClosed();
    }

    // Static async factory method to handle asynchronous initialization
    public static async create(interpreter: PythonEnvironment): Promise<NativeRepl> {
        const nativeRepl = new NativeRepl();
        nativeRepl.interpreter = interpreter;
        await nativeRepl.setReplDirectory();
        nativeRepl.pythonServer = createPythonServer([interpreter.path as string], nativeRepl.cwd);
        nativeRepl.disposables.push(nativeRepl.pythonServer);
        nativeRepl.setReplController();
        nativeRepl.registerInterpreterChangeHandler();

        return nativeRepl;
    }

    dispose(): void {
        this.disposables.forEach((d) => d.dispose());
    }

    /**
     * Function that watches for Notebook Closed event.
     * This is for the purposes of correctly updating the notebookEditor and notebookDocument on close.
     */
    private watchNotebookClosed(): void {
        this.disposables.push(
            onDidCloseNotebookDocument(async (nb) => {
                if (this.notebookDocument && nb.uri.toString() === this.notebookDocument.uri.toString()) {
                    this.notebookDocument = undefined;
                    this.newReplSession = true;
                    await updateWorkspaceStateValue<string | undefined>(NATIVE_REPL_URI_MEMENTO, undefined);
                    this.pythonServer.dispose();
                    this.pythonServer = createPythonServer([this.interpreter.path as string], this.cwd);
                    this.disposables.push(this.pythonServer);
                    if (this.replController) {
                        this.replController.dispose();
                    }
                    nativeRepl = undefined;
                }
            }),
        );
    }

    /**
     * Function that set up desired directory for REPL.
     * If there is multiple workspaces, prompt the user to choose
     * which directory we should set in context of native REPL.
     */
    private async setReplDirectory(): Promise<void> {
        // Figure out uri via workspaceFolder as uri parameter always
        // seem to be undefined from parameter when trying to access from replCommands.ts
        const workspaces: readonly WorkspaceFolder[] | undefined = getWorkspaceFolders();

        if (workspaces) {
            // eslint-disable-next-line no-shadow
            const workspacesQuickPickItems: QuickPickItem[] = workspaces.map((workspace) => ({
                label: workspace.name,
                description: workspace.uri.fsPath,
            }));

            if (workspacesQuickPickItems.length === 0) {
                this.cwd = process.cwd(); // Yields '/' on no workspace scenario.
            } else if (workspacesQuickPickItems.length === 1) {
                this.cwd = workspacesQuickPickItems[0].description;
            } else {
                // Show choices of workspaces for user to choose from.
                const selection = (await showQuickPick(workspacesQuickPickItems, {
                    placeHolder: 'Select current working directory for new REPL',
                    matchOnDescription: true,
                    ignoreFocusOut: true,
                })) as QuickPickItem;
                this.cwd = selection?.description;
            }
        }
    }

    /**
     * Function that check if NotebookController for REPL exists, and returns it in Singleton manner.
     */
    public setReplController(force: boolean = false): NotebookController {
        if (!this.replController || force) {
            this.replController = createReplController(this.interpreter!.path, this.disposables, this.cwd);
            this.replController.variableProvider = new VariablesProvider(
                new VariableRequester(this.pythonServer),
                () => this.notebookDocument,
                this.pythonServer.onCodeExecuted,
            );
        }
        return this.replController;
    }

    private registerInterpreterChangeHandler(): void {
        if (!useEnvExtension() || this.envChangeListenerRegistered) {
            return;
        }
        this.envChangeListenerRegistered = true;
        this.disposables.push(
            onDidChangeEnvironmentEnvExt((event) => {
                this.updateInterpreterForChange(event.uri).catch(() => undefined);
            }),
        );
        this.disposables.push(
            this.pythonServer.onCodeExecuted(() => {
                if (this.pendingInterpreterChange) {
                    const { resource } = this.pendingInterpreterChange;
                    this.pendingInterpreterChange = undefined;
                    this.updateInterpreterForChange(resource).catch(() => undefined);
                }
            }),
        );
    }

    private async updateInterpreterForChange(resource?: Uri): Promise<void> {
        if (this.pythonServer?.isExecuting) {
            this.pendingInterpreterChange = { resource };
            return;
        }
        if (!this.shouldApplyInterpreterChange(resource)) {
            return;
        }
        const scope = resource ?? (this.cwd ? Uri.file(this.cwd) : undefined);
        const interpreter = await getActiveInterpreterLegacy(scope);
        if (!interpreter || interpreter.path === this.interpreter?.path) {
            return;
        }

        this.interpreter = interpreter;
        this.pythonServer.dispose();
        this.pythonServer = createPythonServer([interpreter.path as string], this.cwd);
        this.disposables.push(this.pythonServer);
        if (this.replController) {
            this.replController.dispose();
        }
        this.setReplController(true);

        if (this.notebookDocument) {
            const notebookEditor = await showNotebookDocument(this.notebookDocument, { preserveFocus: true });
            await selectNotebookKernel(notebookEditor, this.replController.id, PVSC_EXTENSION_ID);
        }
    }

    private shouldApplyInterpreterChange(resource?: Uri): boolean {
        if (!resource || !this.cwd) {
            return true;
        }
        const relative = path.relative(this.cwd, resource.fsPath);
        return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    }

    /**
     * Function that checks if native REPL's text input box contains complete code.
     * @returns Promise<boolean> - True if complete/Valid code is present, False otherwise.
     */
    public async checkUserInputCompleteCode(activeEditor: TextEditor | undefined): Promise<boolean> {
        let completeCode = false;
        let userTextInput;
        if (activeEditor) {
            const { document } = activeEditor;
            userTextInput = document.getText();
        }

        // Check if userTextInput is a complete Python command
        if (userTextInput) {
            completeCode = await this.pythonServer.checkValidCommand(userTextInput);
        }

        return completeCode;
    }

    /**
     * Function that opens interactive repl, selects kernel, and send/execute code to the native repl.
     */
    public async sendToNativeRepl(code?: string | undefined, preserveFocus: boolean = true): Promise<void> {
        let wsMementoUri: Uri | undefined;

        if (!this.notebookDocument) {
            const wsMemento = getWorkspaceStateValue<string>(NATIVE_REPL_URI_MEMENTO);
            wsMementoUri = wsMemento ? Uri.parse(wsMemento) : undefined;

            if (!wsMementoUri || getTabNameForUri(wsMementoUri) !== 'Python REPL') {
                await updateWorkspaceStateValue<string | undefined>(NATIVE_REPL_URI_MEMENTO, undefined);
                wsMementoUri = undefined;
            }
        }

        const result = await openInteractiveREPL(this.notebookDocument ?? wsMementoUri, preserveFocus);
        if (result) {
            this.notebookDocument = result.notebookEditor.notebook;
            await updateWorkspaceStateValue<string | undefined>(
                NATIVE_REPL_URI_MEMENTO,
                this.notebookDocument.uri.toString(),
            );

            if (result.documentCreated) {
                await selectNotebookKernel(result.notebookEditor, this.replController.id, PVSC_EXTENSION_ID);
            }
            if (code) {
                await executeNotebookCell(result.notebookEditor, code);
            }
        }
    }
}

/**
 * Get Singleton Native REPL Instance
 * @param interpreter
 * @returns Native REPL instance
 */
export async function getNativeRepl(interpreter: PythonEnvironment, disposables: Disposable[]): Promise<NativeRepl> {
    if (!nativeRepl) {
        nativeRepl = await NativeRepl.create(interpreter);
        disposables.push(nativeRepl);
    }
    if (nativeRepl && nativeRepl.newReplSession) {
        sendTelemetryEvent(EventName.REPL, undefined, { replType: 'Native' });
        nativeRepl.newReplSession = false;
    }
    return nativeRepl;
}
