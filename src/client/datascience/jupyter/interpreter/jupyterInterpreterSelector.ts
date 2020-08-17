// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { QuickPickOptions } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { IApplicationShell, IWorkspaceService } from '../../../common/application/types';
import { Cancellation } from '../../../common/cancellation';
import { IPathUtils } from '../../../common/types';
import { DataScience } from '../../../common/utils/localize';
import { IInterpreterSelector } from '../../../interpreter/configuration/types';
import { PythonEnvironment } from '../../../pythonEnvironments/info';
import { JupyterInterpreterStateStore } from './jupyterInterpreterStateStore';

/**
 * Displays interpreter select and returns the selection to the user.
 *
 * @export
 * @class JupyterInterpreterSelector
 */
@injectable()
export class JupyterInterpreterSelector {
    constructor(
        @inject(IInterpreterSelector) private readonly interpreterSelector: IInterpreterSelector,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(JupyterInterpreterStateStore) private readonly interpreterSelectionState: JupyterInterpreterStateStore,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils
    ) {}
    /**
     * Displays interpreter selector and returns the selection.
     *
     * @param {CancellationToken} [token]
     * @returns {(Promise<PythonEnvironment | undefined>)}
     * @memberof JupyterInterpreterSelector
     */
    public async selectInterpreter(token?: CancellationToken): Promise<PythonEnvironment | undefined> {
        const workspace = this.workspace.getWorkspaceFolder(undefined);
        const currentPythonPath = this.interpreterSelectionState.selectedPythonPath
            ? this.pathUtils.getDisplayName(this.interpreterSelectionState.selectedPythonPath, workspace?.uri.fsPath)
            : undefined;

        const suggestions = await this.interpreterSelector.getSuggestions(undefined);
        if (Cancellation.isCanceled(token)) {
            return;
        }
        const quickPickOptions: QuickPickOptions = {
            matchOnDetail: true,
            matchOnDescription: true,
            placeHolder: currentPythonPath
                ? DataScience.currentlySelectedJupyterInterpreterForPlaceholder().format(currentPythonPath)
                : ''
        };

        const selection = await this.applicationShell.showQuickPick(suggestions, quickPickOptions);
        if (!selection) {
            return;
        }
        return selection.interpreter;
    }
}
