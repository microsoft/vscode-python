// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { notebook } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { ICommandManager } from '../../common/application/types';
import { NativeNotebook } from '../../common/experimentGroups';
import { IFileSystem } from '../../common/platform/types';
import { IDisposableRegistry, IExperimentsManager, IExtensionContext } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { NotebookContentProvider } from './contentProvider';

/**
 * This class basically registers the necessary providers and the like with VSC.
 * I.e. this is where we integrate our stuff with VS Code via their extension endpoints.
 */
@injectable()
export class NotebookIntegration implements IExtensionSingleActivationService {
    constructor(
        @inject(IExperimentsManager) private readonly experiment: IExperimentsManager,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(NotebookContentProvider) private readonly notebookContentProvider: NotebookContentProvider,
        @inject(IExtensionContext) private readonly context: IExtensionContext,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(ICommandManager) private readonly commandManager: ICommandManager
    ) {}
    public async activate(): Promise<void> {
        // This condition is temporary.
        // If user belongs to the experiment, then make the necessary changes to package.json.
        // Once the API is final, we won't need to modify the package.json.
        if (!this.experiment.inExperiment(NativeNotebook.experiment)) {
            return;
        }
        const packageJsonFile = path.join(this.context.extensionPath, 'package.json');
        const content = JSON.parse(await this.fs.readFile(packageJsonFile));

        // This code is temporary.
        if (
            !content.enableProposedApi ||
            !Array.isArray(content.contributes.notebookOutputRenderer) ||
            !Array.isArray(content.contributes.notebookProvider)
        ) {
            content.enableProposedApi = true;
            content.contributes.notebookOutputRenderer = [
                {
                    viewType: 'jupyter-notebook-renderer',
                    displayName: 'Jupyter Notebook Renderer',
                    mimeTypes: ['text/latex', 'application/vnd.plotly.v1+json', 'application/vnd.vega.v5+json']
                }
            ];
            content.contributes.notebookProvider = [
                {
                    viewType: 'jupyter-notebook',
                    displayName: 'Jupyter Notebook',
                    selector: [
                        {
                            filenamePattern: '*.ipynb'
                        }
                    ]
                }
            ];

            await this.fs.writeFile(packageJsonFile, JSON.stringify(content, undefined, 4));
            await this.commandManager
                .executeCommand('python.reloadVSCode', 'Please reload VS Code to use the new VS Code Notebook API')
                .then(noop, noop);
        }

        this.disposables.push(
            notebook.registerNotebookContentProvider('jupyter-notebook', this.notebookContentProvider)
        );
    }
}
