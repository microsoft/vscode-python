// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable, named } from 'inversify';

import * as vscode from 'vscode';
import { Cancellation } from '../../common/cancellation';
import { PYTHON } from '../../common/constants';
import { RunByLine } from '../../common/experiments/groups';
import { traceError } from '../../common/logger';

import { IExperimentsManager } from '../../common/types';
import { sleep } from '../../common/utils/async';
import { noop } from '../../common/utils/misc';
import { Identifiers } from '../constants';
import {
    ICell,
    IDataScienceFileSystem,
    IInteractiveWindowProvider,
    IJupyterVariables,
    INotebook,
    INotebookExecutionLogger
} from '../types';

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
        @inject(IInteractiveWindowProvider) private interactiveProvider: IInteractiveWindowProvider,
        @inject(IDataScienceFileSystem) private readonly fs: IDataScienceFileSystem
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
                    // See if we have any matching notebooks
                    const notebooks = this.getMatchingNotebooks(document);
                    if (notebooks && notebooks.length) {
                        // Just use the first one to reply if more than one.
                        const match = await Promise.race(
                            notebooks.map((n) => this.variableProvider.getMatchingVariable(n, word, t))
                        );
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

    private getMatchingNotebooks(document: vscode.TextDocument): INotebook[] {
        // First see if we have an interactive window who's owner is this document
        let result = this.interactiveProvider.windows
            .filter((w) => w.notebook && w.owner && this.fs.arePathsSame(w.owner, document.uri))
            .map((w) => w.notebook!);
        if (!result || result.length === 0) {
            // Not a match on the owner, find all that were submitters? Might be a bit risky
            result = this.interactiveProvider.windows
                .filter((w) => w.notebook && w.submitters.find((s) => this.fs.arePathsSame(s, document.uri)))
                .map((w) => w.notebook!);
        }
        return result;
    }
}
