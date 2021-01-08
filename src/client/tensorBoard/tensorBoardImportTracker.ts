// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { TextEditor } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { IDocumentManager } from '../common/application/types';
import { isTestExecution } from '../common/constants';
import { IDisposableRegistry } from '../common/types';
import { getDocumentLines } from '../telemetry/importTracker';
import { TensorBoardEntrypointTrigger } from './constants';
import { containsTensorBoardImport } from './helpers';
import { TensorBoardPrompt } from './tensorBoardPrompt';

const testExecution = isTestExecution();
@injectable()
export class TensorBoardImportTracker implements IExtensionSingleActivationService {
    constructor(
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(TensorBoardPrompt) private prompt: TensorBoardPrompt,
    ) {}

    public async activate(): Promise<void> {
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

    private onChangedActiveTextEditor(editor: TextEditor | undefined) {
        if (!editor || !editor.document) {
            return;
        }
        const { document } = editor;
        if (
            (path.extname(document.fileName) === '.ipynb' && document.languageId === 'python') ||
            path.extname(document.fileName) === '.py'
        ) {
            const lines = getDocumentLines(document);
            if (containsTensorBoardImport(lines)) {
                this.prompt.showNativeTensorBoardPrompt(TensorBoardEntrypointTrigger.fileimport).ignoreErrors();
            }
        }
    }
}
