// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IExtensionSingleActivationService } from '../../activation/types';
import { ICommandManager, IVSCodeNotebook } from '../../common/application/types';
import { NotebookEditorSupport } from '../../common/experiments/groups';
import { IFileSystem } from '../../common/platform/types';
import { IDisposableRegistry, IExperimentsManager, IExtensionContext } from '../../common/types';
import { DataScience } from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { JupyterNotebookView } from './constants';
import { NotebookContentProvider } from './contentProvider';
import { NotebookKernel } from './notebookKernel';
import { NotebookOutputRenderer } from './renderer';

/**
 * This class basically registers the necessary providers and the like with VSC.
 * I.e. this is where we integrate our stuff with VS Code via their extension endpoints.
 */

@injectable()
export class NotebookIntegration implements IExtensionSingleActivationService {
    constructor(
        @inject(IVSCodeNotebook) private readonly vscNotebook: IVSCodeNotebook,
        @inject(IExperimentsManager) private readonly experiment: IExperimentsManager,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(NotebookContentProvider) private readonly notebookContentProvider: NotebookContentProvider,
        @inject(IExtensionContext) private readonly context: IExtensionContext,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(NotebookKernel) private readonly notebookKernel: NotebookKernel,
        @inject(NotebookOutputRenderer) private readonly renderer: NotebookOutputRenderer
    ) {}
    public get isEnabled() {
        const packageJsonFile = path.join(this.context.extensionPath, 'package.json');
        const content = JSON.parse(this.fs.readFileSync(packageJsonFile));

        // This code is temporary.
        return (
            content.enableProposedApi &&
            Array.isArray(content.contributes.notebookOutputRenderer) &&
            (content.contributes.notebookOutputRenderer as []).length > 0 &&
            Array.isArray(content.contributes.notebookProvider) &&
            (content.contributes.notebookProvider as []).length > 0
        );
    }
    public async enableSideBySideUsage() {
        await this.enableNotebooks(false);
    }
    public async activate(): Promise<void> {
        // This condition is temporary.
        // If user belongs to the experiment, then make the necessary changes to package.json.
        // Once the API is final, we won't need to modify the package.json.
        if (this.experiment.inExperiment(NotebookEditorSupport.nativeNotebookExperiment)) {
            await this.enableNotebooks(true);
        }
        this.disposables.push(
            this.vscNotebook.registerNotebookContentProvider(JupyterNotebookView, this.notebookContentProvider)
        );
        this.disposables.push(
            this.vscNotebook.registerNotebookKernel(JupyterNotebookView, ['**/*.ipynb'], this.notebookKernel)
        );
        this.disposables.push(
            this.vscNotebook.registerNotebookOutputRenderer(
                'jupyter-notebook-renderer',
                {
                    type: 'display_data',
                    subTypes: [
                        'application/geo+json',
                        'application/vdom.v1+json',
                        'application/vnd.dataresource+json',
                        'application/vnd.plotly.v1+json',
                        'application/vnd.vega.v2+json',
                        'application/vnd.vega.v3+json',
                        'application/vnd.vega.v4+json',
                        'application/vnd.vega.v5+json',
                        'application/vnd.vegalite.v1+json',
                        'application/vnd.vegalite.v2+json',
                        'application/vnd.vegalite.v3+json',
                        'application/vnd.vegalite.v4+json',
                        'application/x-nteract-model-debug+json',
                        'image/gif',
                        'text/latex',
                        'text/vnd.plotly.v1+html'
                    ]
                },
                this.renderer
            )
        );
    }
    private async enableNotebooks(useVSCodeNotebookAsDefaultEditor: boolean) {
        const packageJsonFile = path.join(this.context.extensionPath, 'package.json');
        const content = JSON.parse(this.fs.readFileSync(packageJsonFile));

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
                    mimeTypes: [
                        'application/geo+json',
                        'application/vdom.v1+json',
                        'application/vnd.dataresource+json',
                        'application/vnd.plotly.v1+json',
                        'application/vnd.vega.v2+json',
                        'application/vnd.vega.v3+json',
                        'application/vnd.vega.v4+json',
                        'application/vnd.vega.v5+json',
                        'application/vnd.vegalite.v1+json',
                        'application/vnd.vegalite.v2+json',
                        'application/vnd.vegalite.v3+json',
                        'application/vnd.vegalite.v4+json',
                        'application/x-nteract-model-debug+json',
                        'image/gif',
                        'text/latex',
                        'text/vnd.plotly.v1+html'
                    ]
                }
            ];
            content.contributes.notebookProvider = [
                {
                    viewType: JupyterNotebookView,
                    displayName: 'Jupyter Notebook (preview)',
                    selector: [
                        {
                            filenamePattern: '*.ipynb'
                        }
                    ],
                    priority: useVSCodeNotebookAsDefaultEditor ? 'default' : 'option'
                }
            ];

            await this.fs.writeFile(packageJsonFile, JSON.stringify(content, undefined, 4));
            await this.commandManager
                .executeCommand('python.reloadVSCode', DataScience.reloadVSCodeNotebookEditor())
                .then(noop, noop);
        }
    }
}
