// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable, named } from 'inversify';

import * as vscode from 'vscode';
import { Cancellation } from '../../common/cancellation';
import { PYTHON } from '../../common/constants';
import { RunByLine } from '../../common/experimentGroups';
import { traceError } from '../../common/logger';
import { IExperimentsManager } from '../../common/types';
import { sleep } from '../../common/utils/async';
import { noop } from '../../common/utils/misc';
import { Identifiers } from '../constants';
import { ICell, IJupyterVariables, INotebookExecutionLogger, INotebookProvider } from '../types';

// This class provides hashes for debugging jupyter cells. Call getHashes just before starting debugging to compute all of the
// hashes for cells.
@injectable()
export class HoverProvider implements INotebookExecutionLogger, vscode.HoverProvider {
    private runFiles = new Set<string>();
    private enabled = false;
    private hoverProviderRegistration: vscode.Disposable | undefined;

    constructor(
        @inject(IExperimentsManager) experimentsManager: IExperimentsManager,
        @inject(IJupyterVariables) @named(Identifiers.KERNEL_VARIABLES) private variableProvider: IJupyterVariables,
        @inject(INotebookProvider) private notebookProvider: INotebookProvider
    ) {
        this.enabled = experimentsManager.inExperiment(RunByLine.experiment);
    }

    public dispose() {
        if (this.hoverProviderRegistration) {
            this.hoverProviderRegistration.dispose();
        }
    }

    // tslint:disable-next-line: no-any
    public onKernelRestarted() {
        this.runFiles.clear();
    }

    public async preExecute(cell: ICell, silent: boolean): Promise<void> {
        try {
            if (!silent && cell.file && cell.file !== Identifiers.EmptyFileName) {
                const size = this.runFiles.size;
                this.runFiles.add(cell.file.toLocaleLowerCase());
                if (size !== this.runFiles.size) {
                    this.initializeHoverProvider();
                }
            }
        } catch (exc) {
            // Don't let exceptions in a preExecute mess up normal operation
            traceError(exc);
        }
    }

    public async postExecute(_cell: ICell, _silent: boolean): Promise<void> {
        noop();
    }

    public provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const timeoutHandler = async () => {
            await sleep(100);
            return null;
        };
        return Promise.race([timeoutHandler(), this.getVariableHover(document, position, token)]);
    }

    private initializeHoverProvider() {
        if (!this.hoverProviderRegistration) {
            if (this.enabled) {
                this.hoverProviderRegistration = vscode.languages.registerHoverProvider(PYTHON, this);
            } else {
                this.hoverProviderRegistration = {
                    dispose: noop
                };
            }
        }
    }

    private getVariableHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {
        // Make sure to fail as soon as the cancel token is signaled
        return Cancellation.race(async (t) => {
            const range = document.getWordRangeAtPosition(position);
            if (range) {
                const word = document.getText(range);
                if (word) {
                    // Only do this for the interactive window notebook
                    const notebook = await this.notebookProvider.getOrCreateNotebook({
                        getOnly: true,
                        identity: vscode.Uri.parse(Identifiers.InteractiveWindowIdentity),
                        token: t
                    });
                    if (notebook) {
                        const match = await this.variableProvider.getMatchingVariable(notebook, word, t);
                        if (match) {
                            return {
                                contents: [`${word} = ${match.value}`]
                            };
                        }
                    }
                }
            }
            return null;
        }, token);
    }
}
