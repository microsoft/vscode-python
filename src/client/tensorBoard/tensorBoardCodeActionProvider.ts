/* eslint-disable @typescript-eslint/no-unused-vars */
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
    Range,
    Selection,
    TextDocument,
} from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { Commands, PYTHON } from '../common/constants';
import { NativeTensorBoard, NativeTensorBoardEntrypoints } from '../common/experiments/groups';
import { IExtensionContext, IExperimentService } from '../common/types';
import { TensorBoard } from '../common/utils/localize';
import { getDocumentLines } from '../telemetry/importTracker';
import { containsTensorBoardImport } from './helpers';

@injectable()
export class TensorBoardCodeActionProvider implements CodeActionProvider, IExtensionSingleActivationService {
    constructor(
        @inject(IExtensionContext) private extensionContext: IExtensionContext,
        @inject(IExperimentService) private experimentService: IExperimentService,
    ) {}

    public async activate(): Promise<void> {
        if (
            (await this.experimentService.inExperiment(NativeTensorBoard.experiment))
            && (await this.experimentService.inExperiment(NativeTensorBoardEntrypoints.codeActions))
        ) {
            this.extensionContext.subscriptions.push(languages.registerCodeActionsProvider(PYTHON, this));
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public provideCodeActions(
        document: TextDocument,
        _range: Range | Selection,
        _context: CodeActionContext,
        _token: CancellationToken,
    ): CodeAction[] {
        if (containsTensorBoardImport(getDocumentLines(document))) {
            const title = TensorBoard.launchNativeTensorBoardSessionCodeAction();
            const nativeTensorBoardSession = new CodeAction(title, CodeActionKind.Empty);
            nativeTensorBoardSession.command = {
                title,
                command: Commands.LaunchTensorBoard,
            };
            return [nativeTensorBoardSession];
        }
        return [];
    }
}
