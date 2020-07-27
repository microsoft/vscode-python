// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { ConfigurationTarget } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import {
    IApplicationEnvironment,
    IApplicationShell,
    IVSCodeNotebook,
    IWorkspaceService
} from '../../common/application/types';
import { NotebookEditorSupport } from '../../common/experiments/groups';
import { traceError } from '../../common/logger';
import { IDisposableRegistry, IExperimentsManager, IExtensionContext } from '../../common/types';
import { DataScience } from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { JupyterNotebookView } from './constants';
import { isJupyterNotebook } from './helpers/helpers';
import { NotebookKernel } from './notebookKernel';
import { NotebookOutputRenderer } from './renderer';
import { INotebookContentProvider } from './types';

const EditorAssociationUpdatedKey = 'EditorAssociationUpdatedToUseNotebooks';

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
        @inject(INotebookContentProvider) private readonly notebookContentProvider: INotebookContentProvider,
        @inject(NotebookKernel) private readonly notebookKernel: NotebookKernel,
        @inject(NotebookOutputRenderer) private readonly renderer: NotebookOutputRenderer,
        @inject(IApplicationEnvironment) private readonly env: IApplicationEnvironment,
        @inject(IApplicationShell) private readonly shell: IApplicationShell,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IExtensionContext) private readonly extensionContext: IExtensionContext
    ) {}
    public async activate(): Promise<void> {
        // This condition is temporary.
        // If user belongs to the experiment, then make the necessary changes to package.json.
        // Once the API is final, we won't need to modify the package.json.
        if (this.experiment.inExperiment(NotebookEditorSupport.nativeNotebookExperiment)) {
            await this.enableNotebooks();
        } else {
            // Possible user was in experiment, then they opted out. In this case we need to revert the changes made to the settings file.
            // Again, this is temporary code.
            await this.disableNotebooks();
        }
        if (this.env.channel !== 'insiders') {
            return;
        }
        try {
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
                            'image/png',
                            'image/jpeg',
                            'text/latex',
                            'text/vnd.plotly.v1+html'
                        ]
                    },
                    this.renderer
                )
            );
        } catch (ex) {
            // If something goes wrong, and we're not in Insiders & not using the NativeEditor experiment, then swallow errors.
            traceError('Failed to register VS Code Notebook API', ex);
            if (this.experiment.inExperiment(NotebookEditorSupport.nativeNotebookExperiment)) {
                throw ex;
            }
        }
    }
    private async enableNotebooks() {
        if (this.env.channel === 'stable') {
            this.shell.showErrorMessage(DataScience.previewNotebookOnlySupportedInVSCInsiders()).then(noop, noop);
            return;
        }

        await this.enableDisableEditorAssociation(true);
    }
    private async enableDisableEditorAssociation(enable: boolean) {
        // This code is temporary.
        const settings = this.workspace.getConfiguration('workbench', undefined);
        const editorAssociations = settings.get('editorAssociations') as {
            viewType: string;
            filenamePattern: string;
        }[];

        // Update the settings.
        if (
            enable &&
            (!Array.isArray(editorAssociations) ||
                editorAssociations.length === 0 ||
                !editorAssociations.find((item) => isJupyterNotebook(item.viewType)))
        ) {
            editorAssociations.push({
                viewType: 'jupyter-notebook',
                filenamePattern: '*.ipynb'
            });
            await Promise.all([
                this.extensionContext.globalState.update(EditorAssociationUpdatedKey, true),
                settings.update('editorAssociations', editorAssociations, ConfigurationTarget.Global)
            ]);
        }

        // Revert the settings.
        if (
            !enable &&
            this.extensionContext.globalState.get<boolean>(EditorAssociationUpdatedKey, false) &&
            Array.isArray(editorAssociations) &&
            editorAssociations.find((item) => isJupyterNotebook(item.viewType))
        ) {
            const updatedSettings = editorAssociations.filter((item) => !isJupyterNotebook(item.viewType));
            await Promise.all([
                this.extensionContext.globalState.update(EditorAssociationUpdatedKey, false),
                settings.update('editorAssociations', updatedSettings, ConfigurationTarget.Global)
            ]);
        }
    }
    private async disableNotebooks() {
        if (this.env.channel === 'stable') {
            return;
        }
        // If we never modified the settings, then nothing to do.
        if (!this.extensionContext.globalState.get<boolean>(EditorAssociationUpdatedKey, false)) {
            return;
        }
        await this.enableDisableEditorAssociation(false);
    }
}
