// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';

import { IPythonExecutionFactory } from '../../common/process/types';
import { IAsyncDisposable, IAsyncDisposableRegistry } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { IServiceContainer } from '../../ioc/types';
import { IDataViewer, IDataViewerProvider, IJupyterExecution, IJupyterVariables, INotebook } from '../types';

@injectable()
export class DataViewerProvider implements IDataViewerProvider, IAsyncDisposable {
    private activeExplorers: IDataViewer[] = [];
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IJupyterVariables) private variables: IJupyterVariables,
        @inject(IPythonExecutionFactory) private pythonFactory: IPythonExecutionFactory,
        @inject(IJupyterExecution) private readonly jupyterExecution: IJupyterExecution
    ) {
        asyncRegistry.push(this);
    }

    public async dispose() {
        await Promise.all(this.activeExplorers.map(d => d.dispose()));
    }

    public async create(variable: string, notebook: INotebook): Promise<IDataViewer> {
        // Make sure this is a valid variable
        const variables = await this.variables.getVariables(notebook);
        const index = variables.findIndex(v => v && v.name === variable);
        if (index >= 0) {
            const dataExplorer = this.serviceContainer.get<IDataViewer>(IDataViewer);
            this.activeExplorers.push(dataExplorer);
            await dataExplorer.showVariable(variables[index], notebook);
            return dataExplorer;
        }

        throw new Error(localize.DataScience.dataExplorerInvalidVariableFormat().format(variable));
    }

    public async getPandasVersion(): Promise<{ major: number; minor: number; build: number } | undefined> {
        const interpreter = await this.jupyterExecution.getUsableJupyterPython();
        const launcher = await this.pythonFactory.createActivatedEnvironment({ resource: undefined, interpreter, allowEnvironmentFetchExceptions: true });
        try {
            const result = await launcher.exec(['-c', 'import pandas;print(pandas.__version__)'], { throwOnStdErr: true });
            const versionMatch = /^\s*(\d+)\.(\d+)\.(.+)\s*$/.exec(result.stdout);
            if (versionMatch && versionMatch.length > 2) {
                const major = parseInt(versionMatch[1], 10);
                const minor = parseInt(versionMatch[2], 10);
                const build = parseInt(versionMatch[3], 10);
                return { major, minor, build };
            }
        } catch {
            noop();
        }
    }
}
