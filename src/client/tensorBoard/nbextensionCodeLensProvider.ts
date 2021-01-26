// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { once } from 'lodash';
import { CodeLens, Command, languages, Position, Range, TextDocument } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { Commands, NotebookCellScheme, PYTHON_LANGUAGE } from '../common/constants';
import { NativeTensorBoard } from '../common/experiments/groups';
import { IDisposableRegistry, IExperimentService } from '../common/types';
import { TensorBoard } from '../common/utils/localize';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { TensorBoardEntrypoint, TensorBoardEntrypointTrigger } from './constants';
import { containsNotebookExtension } from './helpers';

@injectable()
export class TensorBoardNbextensionCodeLensProvider implements IExtensionSingleActivationService {
    private sendTelemetryOnce = once(
        sendTelemetryEvent.bind(this, EventName.TENSORBOARD_ENTRYPOINT_SHOWN, undefined, {
            trigger: TensorBoardEntrypointTrigger.nbextension,
            entrypoint: TensorBoardEntrypoint.codelens,
        }),
    );

    constructor(
        @inject(IExperimentService) private experimentService: IExperimentService,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
    ) {}

    public async activate(): Promise<void> {
        this.activateInternal().ignoreErrors();
    }

    private async activateInternal() {
        if (await this.experimentService.inExperiment(NativeTensorBoard.experiment)) {
            this.disposables.push(
                languages.registerCodeLensProvider(
                    [
                        { scheme: NotebookCellScheme, language: PYTHON_LANGUAGE },
                        { scheme: 'vscode-notebook', language: PYTHON_LANGUAGE },
                    ],
                    this,
                ),
            );
        }
    }

    public provideCodeLenses(document: TextDocument): CodeLens[] {
        const command: Command = {
            title: TensorBoard.launchNativeTensorBoardSessionCodeLens(),
            command: Commands.LaunchTensorBoard,
            arguments: [
                { trigger: TensorBoardEntrypointTrigger.nbextension, entrypoint: TensorBoardEntrypoint.codelens },
            ],
        };
        const codelenses: CodeLens[] = [];
        for (let index = 0; index < document.lineCount; index += 1) {
            const line = document.lineAt(index);
            if (containsNotebookExtension([line.text])) {
                const range = new Range(new Position(line.lineNumber, 0), new Position(line.lineNumber, 1));
                codelenses.push(new CodeLens(range, command));
                this.sendTelemetryOnce();
            }
        }
        return codelenses;
    }
}
