// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import { Disposable } from 'vscode-jsonrpc';

import { IFileSystem } from '../common/platform/types';
import { IPythonExecutionFactory, IPythonExecutionService } from '../common/process/types';
import { IDisposableRegistry } from '../common/types';
import { createDeferred, Deferred } from '../common/utils/async';
import * as localize from '../common/utils/localize';
import { IInterpreterService } from '../interpreter/contracts';
import { IJupyterAvailability, INotebookImporter } from './types';

@injectable()
export class JupyterImporter implements INotebookImporter {
    public isDisposed : boolean = false;
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

    private pythonExecutionService : Deferred<IPythonExecutionService> | undefined;
    private templatePromise : Promise<string>;
    private settingsChangedDiposable : Disposable;

    constructor(
        @inject(IPythonExecutionFactory) private executionFactory: IPythonExecutionFactory,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(IJupyterAvailability) private availability : IJupyterAvailability) {

        this.settingsChangedDiposable = this.interpreterService.onDidChangeInterpreter(this.onSettingsChanged);
        this.templatePromise = this.createTemplateFile();
        this.createExecutionServicePromise();
    }

    public importFromFile = async (file: string) : Promise<string> => {
        const template = await this.templatePromise;

        // Use the jupyter nbconvert functionality to turn the notebook into a python file
        if (await this.availability.isImportSupported()) {
            const executionService = await this.getExecutionService();
            const result = await executionService.execModule('jupyter', ['nbconvert', file, '--to', 'python', '--stdout', '--template', template], { throwOnStdErr: false, encoding: 'utf8' });
            if (result.stdout.trim().length === 0) {
                throw result.stderr;
            }
            return result.stdout;
        }

        throw localize.DataScience.jupyterNotSupported();
    }

    public dispose = () => {
        this.isDisposed = true;
        this.settingsChangedDiposable.dispose();
    }

    private getExecutionService = () : Promise<IPythonExecutionService> => {
        if (this.pythonExecutionService) {
            return this.pythonExecutionService.promise;
        }

        return Promise.reject();
    }

    private createTemplateFile = async () : Promise<string> => {
        // Create a temp file on disk
        const file = await this.fileSystem.createTemporaryFile('.tpl');

        // Write our template into it
        await fs.appendFile(file.filePath, this.nbconvertTemplate);

        // Save this file into our disposables so the temp file goes away
        this.disposableRegistry.push(file);

        // Now we should have a template that will convert
        return file.filePath;
    }

    private onSettingsChanged = () => {
        // Recreate our promise for our execution service whenever the settings change
        this.createExecutionServicePromise();
    }

    private createExecutionServicePromise = () => {
        // Create a deferred promise that resolves when we have an execution service
        this.pythonExecutionService = createDeferred<IPythonExecutionService>();
        this.executionFactory
            .create({})
            .then((p : IPythonExecutionService) => { if (this.pythonExecutionService) { this.pythonExecutionService.resolve(p); } })
            .catch(err => { if (this.pythonExecutionService) { this.pythonExecutionService.reject(err); } });
    }
}
