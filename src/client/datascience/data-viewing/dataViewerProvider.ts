// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';

import { IPythonExecutionFactory } from '../../common/process/types';
import { IAsyncDisposable, IAsyncDisposableRegistry } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { IInterpreterService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { IDataViewer, IDataViewerProvider, IJupyterVariables } from '../types';

@injectable()
export class DataViewerProvider implements IDataViewerProvider, IAsyncDisposable {

    private activeExplorers: IDataViewer[] = [];
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IJupyterVariables) private variables: IJupyterVariables,
        @inject(IPythonExecutionFactory) private pythonFactory: IPythonExecutionFactory,
        @inject(IInterpreterService) private interpreterService: IInterpreterService
    ) {
        asyncRegistry.push(this);
    }

    public async dispose() {
        await Promise.all(this.activeExplorers.map(d => d.dispose()));
    }

    public async create(variable: string): Promise<IDataViewer> {
        let result: IDataViewer | undefined;

        // Create the data explorer (this should show the window)
        const dataExplorer = this.serviceContainer.get<IDataViewer>(IDataViewer);
        try {
            // Verify this is allowed.
            await this.checkPandas();

            // Make sure this is a valid variable
            const variables = await this.variables.getVariables();
            const index = variables.findIndex(v => v && v.name === variable);
            if (index >= 0) {
                // Then load the data.
                this.activeExplorers.push(dataExplorer);
                await dataExplorer.showVariable(variables[index]);
                result = dataExplorer;
            } else {
                throw new Error(localize.DataScience.dataExplorerInvalidVariableFormat().format(variable));
            }
        } finally {
            if (!result) {
                // If throw any errors, close the window we opened.
                dataExplorer.dispose();
            }
        }
        return result;
    }

    private async getPandasVersion(): Promise<{ major: number; minor: number; build: number } | undefined> {
        const interpreter = await this.interpreterService.getActiveInterpreter();
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

    private async checkPandas(): Promise<void> {
        const pandasVersion = await this.getPandasVersion();
        if (!pandasVersion) {
            sendTelemetryEvent(Telemetry.PandasNotInstalled);
            // Warn user that there is no pandas.
            throw new Error(localize.DataScience.pandasRequiredForViewing());
        } else if (pandasVersion.major < 1 && pandasVersion.minor < 20) {
            sendTelemetryEvent(Telemetry.PandasTooOld);
            // Warn user that we cannot start because pandas is too old.
            const versionStr = `${pandasVersion.major}.${pandasVersion.minor}.${pandasVersion.build}`;
            throw new Error(localize.DataScience.pandasTooOldForViewingFormat().format(versionStr));
        }
    }
}
