// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { WorkspaceFolder } from 'vscode';
import { DocumentFilter } from 'vscode-languageserver-protocol';
import { IWorkspaceService } from '../../common/application/types';

import { LanguageServerAnalysisOptionsBase } from '../common/analysisOptions';
import { ILanguageServerOutputChannel } from '../types';
import { LspNotebooksExperiment } from './lspNotebooksExperiment';

export class NodeLanguageServerAnalysisOptions extends LanguageServerAnalysisOptionsBase {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(lsOutputChannel: ILanguageServerOutputChannel, workspace: IWorkspaceService) {
        super(lsOutputChannel, workspace);
    }

    // eslint-disable-next-line class-methods-use-this
    protected async getInitializationOptions(): Promise<LanguageClientOptions> {
        return ({
            experimentationSupport: true,
            trustedWorkspaceSupport: true,
            lspNotebooksSupport: await LspNotebooksExperiment.isInNotebooksExperiment(),
        };
    }

    protected async getDocumentFilters(_workspaceFolder?: WorkspaceFolder): Promise<DocumentFilter[]> {
        let filters = await super.getDocumentFilters(_workspaceFolder);

        if (await LspNotebooksExperiment.isInNotebooksExperiment()) {
            return [
                ...filters,
                {
                    notebookDocument: { notebookType: 'jupyter-notebook', pattern: '**/*.ipynb' },
                    cellLanguage: 'python',
                },
            ];
        }

        return filters;
    }
}
