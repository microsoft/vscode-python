// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IDisposable } from '@phosphor/disposable';
import * as fs from 'fs-extra';
import * as temp from 'temp';
import * as tp from 'typed-promisify';
import { Disposable } from 'vscode-jsonrpc';

import { IPythonExecutionFactory, IPythonExecutionService } from '../common/process/types';
import { ILogger } from '../common/types';
import { createDeferred, Deferred } from '../common/utils/async';
import * as localize from '../common/utils/localize';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';

export class JupyterImporter implements IDisposable {
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
    private interpreterService : IInterpreterService;
    private settingsChangedDiposable : Disposable;
    private logger : ILogger;

    constructor(private serviceContainer: IServiceContainer) {
        this.logger = this.serviceContainer.get<ILogger>(ILogger);
        this.interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        this.settingsChangedDiposable = this.interpreterService.onDidChangeInterpreter(this.onSettingsChanged);
        this.templatePromise = this.createTemplateFile();
        this.createExecutionServicePromise();
    }

    public importFromFile = async (file: string) : Promise<string> => {
        const template = await this.templatePromise;

        // Use the jupyter nbconvert functionality to turn the notebook into a python file
        if (await this.isSupported()) {
            const executionService = await this.getExecutionService();
            const result = await executionService.execModule('jupyter', ['nbconvert', file, '--to', 'python', '--stdout', '--template', template], { throwOnStdErr: false, encoding: 'utf8' });
            if (result.stdout.trim().length === 0) {
                throw result.stderr;
            }
            return result.stdout;
        }

        throw localize.DataScience.jupyterNotSupported();
    }

    public isSupported = async () : Promise<boolean> => {
        try {
            // Make sure we have nbconvert installed
            const executionService = await this.getExecutionService();
            const result = await executionService.execModule('jupyter', ['nbconvert', '--version'], { throwOnStdErr: true, encoding: 'utf8' });
            return (!result.stderr);
        } catch (err) {
            this.logger.logError(err);
            return false;
        }
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
        const asyncOpen = tp.promisify(temp.open);
        const file: temp.OpenFile = await asyncOpen({ suffix: '.tpl'});

        // Write our template into it
        await fs.appendFile(file.path, this.nbconvertTemplate);

        // Now we should have a template that will convert
        return file.path;
    }

    private onSettingsChanged = () => {
        // Recreate our promise for our execution service whenever the settings change
        this.createExecutionServicePromise();
    }

    private createExecutionServicePromise = () => {
        // Create a deferred promise that resolves when we have an execution service
        this.pythonExecutionService = createDeferred<IPythonExecutionService>();
        this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory)
            .create({})
            .then((p : IPythonExecutionService) => { if (this.pythonExecutionService) { this.pythonExecutionService.resolve(p); } })
            .catch(err => { if (this.pythonExecutionService) { this.pythonExecutionService.reject(err); } });
    }
}
