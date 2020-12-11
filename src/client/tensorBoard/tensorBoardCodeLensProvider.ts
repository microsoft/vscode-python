// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { CancellationToken, CodeLens, Command, languages, Position, Range, TextDocument } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { Commands, PYTHON } from '../common/constants';
import { NativeTensorBoard, NativeTensorBoardEntrypoints } from '../common/experiments/groups';
import { IDisposableRegistry, IExperimentService } from '../common/types';
import { TensorBoard } from '../common/utils/localize';
import { containsTensorBoardImport } from './helpers';

@injectable()
export class TensorBoardCodeLensProvider implements IExtensionSingleActivationService {
    constructor(
        @inject(IExperimentService) private experimentService: IExperimentService,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry
    ) {}

    public async activate(): Promise<void> {
        this.activateInternal().ignoreErrors();
    }

    // eslint-disable-next-line class-methods-use-this
    public provideCodeLenses(document: TextDocument, _token: CancellationToken): CodeLens[] {
        const command: Command = {
            title: TensorBoard.launchNativeTensorBoardSessionCodeLens(),
            command: Commands.LaunchTensorBoard
        };
        const codelenses: CodeLens[] = [];
        for (let index = 0; index < document.lineCount; index += 1) {
            const line = document.lineAt(index);
            if (containsTensorBoardImport([line.text])) {
                const range = new Range(new Position(line.lineNumber, 0), new Position(line.lineNumber, 1));
                codelenses.push(new CodeLens(range, command));
            }
        }
        return codelenses;
    }

    private async activateInternal() {
        if (
            (await this.experimentService.inExperiment(NativeTensorBoard.experiment)) &&
            (await this.experimentService.inExperiment(NativeTensorBoardEntrypoints.codeLenses))
        ) {
            this.disposables.push(languages.registerCodeLensProvider(PYTHON, this));
        }
    }
}
