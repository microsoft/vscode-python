// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import { Disposable } from 'vscode-jsonrpc';
import { IWorkspaceService } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IPythonExecutionFactory, IPythonExecutionService } from '../../common/process/types';
import { IConfigurationService, IDisposableRegistry } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { IInterpreterService } from '../../interpreter/contracts';
import { CodeSnippits } from '../constants';
import { IJupyterExecution, INotebookImporter } from '../types';

@injectable()
export class JupyterImporter implements INotebookImporter {
    public isDisposed: boolean = false;
    // Template that changes markdown cells to have # %% [markdown] in the comments
    private readonly nbconvertTemplate =
        // tslint:disable-next-line:no-multiline-string
        `{%- extends 'null.tpl' -%}
{% block codecell %}
#%%
{{ super() }}
{% endblock codecell %}
{% block in_prompt %}{% endblock in_prompt %}
{% block input %}{{ cell.source | ipython2python }}{% endblock input %}
{% block markdowncell scoped %}#%% [markdown]
{{ cell.source | comment_lines }}
{% endblock markdowncell %}`;

    private templatePromise : Promise<string>;
    
    constructor(
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(IJupyterExecution) private jupyterExecution: IJupyterExecution,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService) {
        this.templatePromise = this.createTemplateFile();
    }

    public async importFromFile(file: string): Promise<string> {
        const template = await this.templatePromise;

        // If the user has requested it, add a cd command to the imported file so that relative paths still work
        const settings = this.configuration.getSettings();
        let directoryChange: string | undefined;
        if (settings.datascience.changeDirOnImportExport) {
            directoryChange = this.calculateDirectoryChange(file);
        }

        // Use the jupyter nbconvert functionality to turn the notebook into a python file
        if (await this.jupyterExecution.isImportSupported()) {
            const fileOutput: string = await this.jupyterExecution.importNotebook(file, template);
            if (directoryChange) {
                return this.addDirectoryChange(fileOutput, directoryChange);
            } else {
                return fileOutput;
            }
        }

        throw new Error(localize.DataScience.jupyterNbConvertNotSupported());
    }

    public dispose = () => {
        this.isDisposed = true;
    }

    private addDirectoryChange = (pythonOutput: string, directoryChange: string): string => {
        const newCode = CodeSnippits.ChangeDirectory.join(os.EOL).format(localize.DataScience.importChangeDirectoryComment(), directoryChange);
        return newCode.concat(pythonOutput);
    }

    // When importing a file, calculate if we can create a %cd so that the relative paths work
    private calculateDirectoryChange = (notebookFile: string): string | undefined => {
        let directoryChange: string | undefined;
        const notebookFilePath = path.dirname(notebookFile);
        // First see if we have a workspace open, this only works if we have a workspace root to be relative to
        if (this.workspaceService.hasWorkspaceFolders) {
            const workspacePath = this.workspaceService.workspaceFolders![0].uri.fsPath;

            // Make sure that we have everything that we need here
            if (workspacePath && path.isAbsolute(workspacePath) && notebookFilePath && path.isAbsolute(notebookFilePath)) {
                directoryChange = path.relative(workspacePath, notebookFilePath);
            }
        }

        // If path.relative can't calculate a relative path, then it just returns the full second path
        // so check here, we only want this if we were able to calculate a relative path, no network shares or drives
        if (directoryChange && !path.isAbsolute(directoryChange)) {
            return directoryChange;
        } else {
            return undefined;
        }
    }

    private async createTemplateFile(): Promise<string> {
        // Create a temp file on disk
        const file = await this.fileSystem.createTemporaryFile('.tpl');

        // Write our template into it
        await fs.appendFile(file.filePath, this.nbconvertTemplate);

        // Save this file into our disposables so the temp file goes away
        this.disposableRegistry.push(file);

        // Now we should have a template that will convert
        return file.filePath;
    }
}
