// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Disposable, TextEditor } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { IDocumentManager } from '../common/application/types';
import { isTestExecution } from '../common/constants';
import { IDisposableRegistry } from '../common/types';
import { getDocumentLines } from '../telemetry/importTracker';
import { TensorBoardEntrypointTrigger } from './constants';
import { containsTensorBoardImport } from './helpers';
import { TensorBoardPrompt } from './tensorBoardPrompt';
import { TensorboardExperiment } from './tensorboarExperiment';

const testExecution = isTestExecution();

// Prompt the user to start an integrated TensorBoard session whenever the active Python file or Python notebook
// contains a valid TensorBoard import.
@injectable()
export class TensorBoardUsageTracker implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    constructor(
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(TensorBoardPrompt) private prompt: TensorBoardPrompt,
        @inject(TensorboardExperiment) private readonly experiment: TensorboardExperiment,
    ) {
        disposables.push(this);
    }

    public dispose(): void {
        Disposable.from(...this.disposables).dispose();
    }

    public async activate(): Promise<void> {
        if (TensorboardExperiment.isTensorboardExtensionInstalled) {
            return;
        }
        this.experiment.disposeOnInstallingTensorboard(this);
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
