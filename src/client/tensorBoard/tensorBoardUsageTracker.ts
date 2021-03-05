// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { TextEditor } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { IDocumentManager } from '../common/application/types';
import { isTestExecution } from '../common/constants';
import { NativeTensorBoard } from '../common/experiments/groups';
import { IDisposableRegistry, IExperimentService } from '../common/types';
import { getDocumentLines } from '../telemetry/importTracker';
import { TensorBoardEntrypointTrigger } from './constants';
import { containsTensorBoardImport } from './helpers';
import { TensorBoardPrompt } from './tensorBoardPrompt';

const testExecution = isTestExecution();

// Prompt the user to start an integrated TensorBoard session whenever the active Python file or Python notebook
// contains a valid TensorBoard import.
@injectable()
export class TensorBoardUsageTracker implements IExtensionSingleActivationService {
    constructor(
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(TensorBoardPrompt) private prompt: TensorBoardPrompt,
        @inject(IExperimentService) private experimentService: IExperimentService,
    ) {}

    public async activate(): Promise<void> {
        if (!(await this.experimentService.inExperiment(NativeTensorBoard.experiment))) {
            return;
        }
        if (testExecution) {
            await this.activateInternal();
        } else {
            this.activateInternal().ignoreErrors();
        }
    }

    private async activateInternal() {
        // Process currently active text editor
        this.onChangedActiveTextEditor(this.documentManager.activeTextEditor);
        // Process changes to active text editor as well
        this.documentManager.onDidChangeActiveTextEditor(
            (e) => this.onChangedActiveTextEditor(e),
            this,
            this.disposables,
        );
    }

    private onChangedActiveTextEditor(editor: TextEditor | undefined): void {
        if (!editor || !editor.document) {
            return;
        }
        const { document } = editor;
        const extName = path.extname(document.fileName).toLowerCase();
        if (extName === '.py' || (extName === '.ipynb' && document.languageId === 'python')) {
            const lines = getDocumentLines(document);
            if (containsTensorBoardImport(lines)) {
                this.prompt.showNativeTensorBoardPrompt(TensorBoardEntrypointTrigger.fileimport).ignoreErrors();
            }
        }
    }
}
