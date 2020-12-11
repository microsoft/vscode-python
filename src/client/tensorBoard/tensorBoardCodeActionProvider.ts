// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import {
    CancellationToken,
    CodeAction,
    CodeActionContext,
    CodeActionKind,
    CodeActionProvider,
    languages,
    Selection,
    TextDocument
} from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { Commands, PYTHON } from '../common/constants';
import { NativeTensorBoard, NativeTensorBoardEntrypoints } from '../common/experiments/groups';
import { IDisposableRegistry, IExperimentService } from '../common/types';
import { TensorBoard } from '../common/utils/localize';
import { containsTensorBoardImport } from './helpers';

@injectable()
export class TensorBoardCodeActionProvider implements CodeActionProvider, IExtensionSingleActivationService {
    constructor(
        @inject(IExperimentService) private experimentService: IExperimentService,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry
    ) {}

    public async activate(): Promise<void> {
        // Don't hold up activation for this
        this.activateInternal().ignoreErrors();
    }

    // eslint-disable-next-line class-methods-use-this
    public provideCodeActions(
        document: TextDocument,
        range: Selection,
        _context: CodeActionContext,
        _token: CancellationToken
    ): CodeAction[] {
        const cursorPosition = range.active;
        const { text } = document.lineAt(cursorPosition);
        if (containsTensorBoardImport([text])) {
            const title = TensorBoard.launchNativeTensorBoardSessionCodeAction();
            const nativeTensorBoardSession = new CodeAction(title, CodeActionKind.QuickFix);
            nativeTensorBoardSession.command = {
                title,
                command: Commands.LaunchTensorBoard
            };
            return [nativeTensorBoardSession];
        }
        return [];
    }

    private async activateInternal() {
        if (
            (await this.experimentService.inExperiment(NativeTensorBoard.experiment)) &&
            (await this.experimentService.inExperiment(NativeTensorBoardEntrypoints.codeActions))
        ) {
            this.disposables.push(
                languages.registerCodeActionsProvider(PYTHON, this, {
                    providedCodeActionKinds: [CodeActionKind.QuickFix]
                })
            );
        }
    }
}
