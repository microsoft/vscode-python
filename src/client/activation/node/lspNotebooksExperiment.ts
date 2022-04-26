// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable, named } from 'inversify';
import { extensions } from 'vscode';
import * as semver from 'semver';
import { IConfigurationService, IOutputChannel } from '../../common/types';
import { IExtensionSingleActivationService } from '../types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { JUPYTER_EXTENSION_ID, PYLANCE_EXTENSION_ID, STANDARD_OUTPUT_CHANNEL } from '../../common/constants';

@injectable()
export class LspNotebooksExperiment implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: true, virtualWorkspace: true };

    private _isInNotebooksExperiment?: boolean;

    private _jupyterVersion: string | undefined;

    private _pylanceVersion: string | undefined;

    constructor(
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly output: IOutputChannel,
    ) {}

    public async activate(): Promise<void> {
        this._isInNotebooksExperiment = this.configurationService.getSettings().pylanceLspNotebooksEnabled;
        this._jupyterVersion = extensions.getExtension(JUPYTER_EXTENSION_ID)?.packageJSON.version;
        this._pylanceVersion = extensions.getExtension(PYLANCE_EXTENSION_ID)?.packageJSON.version;

        if (this._supportsNotebooksExperiment()) {
            sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS_LSP_NOTEBOOKS);
        }

        this.output.appendLine(
            `LspNotebooksExperiment: activate: isInNotebooksExperiment = ${this.isInNotebooksExperiment()}`,
        );
    }

    public isInNotebooksExperiment(): boolean | undefined {
        return this._isInNotebooksExperiment && this._supportsNotebooksExperiment();
    }

    private _supportsNotebooksExperiment(): boolean {
        return (
            this._jupyterVersion !== undefined &&
            semver.satisfies(this._jupyterVersion, '>=2022.4.100') &&
            this._pylanceVersion !== undefined &&
            semver.satisfies(this._pylanceVersion, '>=2022.4.4-pre.1 || 9999.0.0-dev')
        );
    }
}
