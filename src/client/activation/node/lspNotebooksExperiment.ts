// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { IConfigurationService } from '../../common/types';
import { IExtensionSingleActivationService } from '../types';

@injectable()
export class LspNotebooksExperiment implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: true, virtualWorkspace: true };

    private _isInNotebooksExperiment?: boolean;

    constructor(@inject(IConfigurationService) private readonly configurationService: IConfigurationService) {}

    public async activate(): Promise<void> {
        this._isInNotebooksExperiment = this.configurationService.getSettings().pylanceLspNotebooksEnabled;
    }

    public isInNotebooksExperiment(): boolean {
        return !this._isInNotebooksExperiment;
    }
}
