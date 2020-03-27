// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { parse, SemVer } from 'semver';
import { CancellationToken } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { Cancellation, createPromiseFromCancellation, wrapCancellationTokens } from '../../common/cancellation';
import { traceWarning } from '../../common/logger';
import { IPythonExecutionFactory } from '../../common/process/types';
import { IInstaller, InstallerResponse, Product } from '../../common/types';
import { Common, DataScience } from '../../common/utils/localize';
import { PythonInterpreter } from '../../interpreter/contracts';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';

const minimumSupportedPandaVersion = '0.20.0';

function isVersionOfPandasSupported(version: SemVer) {
    return version.compare(minimumSupportedPandaVersion) > 0;
}

/**
 * Responsible for managing dependencies of a Data Viewer.
 */
@injectable()
export class DataViewerDependencyService {
    constructor(
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IInstaller) private readonly installer: IInstaller,
        @inject(IPythonExecutionFactory) private pythonFactory: IPythonExecutionFactory
    ) {}

    public async checkAndInstallMissingDependencies(
        interpreter?: PythonInterpreter,
        token?: CancellationToken
    ): Promise<void> {
        const pandasVersion = await this.getVersionOfPandas(interpreter, token);
        if (Cancellation.isCanceled(token)) {
            return;
        }

        if (pandasVersion) {
            if (isVersionOfPandasSupported(pandasVersion)) {
                return;
            }
            sendTelemetryEvent(Telemetry.PandasTooOld);
            // Warn user that we cannot start because pandas is too old.
            const versionStr = `${pandasVersion.major}.${pandasVersion.minor}.${pandasVersion.build}`;
            throw new Error(DataScience.pandasTooOldForViewingFormat().format(versionStr));
        }

        sendTelemetryEvent(Telemetry.PandasNotInstalled);
        await this.installMissingDependencies(interpreter, token);
    }

    private async installMissingDependencies(
        interpreter?: PythonInterpreter,
        token?: CancellationToken
    ): Promise<void> {
        const selection = await this.applicationShell.showErrorMessage(
            DataScience.pandasRequiredForViewing(),
            Common.install()
        );

        if (Cancellation.isCanceled(token)) {
            return;
        }

        if (selection === Common.install()) {
            const cancellatonPromise = createPromiseFromCancellation({
                cancelAction: 'resolve',
                defaultValue: InstallerResponse.Ignore,
                token,
            });
            // Always pass a cancellation token to `install`, to ensure it waits until the module is installed.
            const response = await Promise.race([
                this.installer.install(Product.pandas, interpreter, wrapCancellationTokens(token)),
                cancellatonPromise,
            ]);
            if (response === InstallerResponse.Installed) {
                sendTelemetryEvent(Telemetry.UserInstalledPandas);
            }
        } else {
            sendTelemetryEvent(Telemetry.UserDidNotInstallPandas);
            throw new Error(DataScience.pandasRequiredForViewing());
        }
    }

    private async getVersionOfPandas(
        interpreter?: PythonInterpreter,
        token?: CancellationToken
    ): Promise<SemVer | undefined> {
        const launcher = await this.pythonFactory.createActivatedEnvironment({
            resource: undefined,
            interpreter,
            allowEnvironmentFetchExceptions: true,
            bypassCondaExecution: true,
        });
        try {
            const result = await launcher.exec(['-c', 'import pandas;print(pandas.__version__)'], {
                throwOnStdErr: true,
                token,
            });
            const versionMatch = /^\s*(\d+)\.(\d+)\.(.+)\s*$/.exec(result.stdout);
            if (versionMatch && versionMatch.length > 2) {
                const major = parseInt(versionMatch[1], 10);
                const minor = parseInt(versionMatch[2], 10);
                const build = parseInt(versionMatch[3], 10);
                return parse(`${major}.${minor}.${build}`, true) ?? undefined;
            }
        } catch (ex) {
            traceWarning('Failed to get version of Pandas to use Data Viewer', ex);
            return;
        }
    }
}
