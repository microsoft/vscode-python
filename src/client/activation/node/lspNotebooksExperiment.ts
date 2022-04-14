// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { IExperimentService } from '../../common/types';

@injectable()
export class LspNotebooksExperiment {
    private static _isInNotebooksExperiment?: boolean;

    @inject(IExperimentService) private static experiments: IExperimentService;

    public static async isInNotebooksExperiment(): Promise<boolean> {
        if (LspNotebooksExperiment._isInNotebooksExperiment === undefined) {
            LspNotebooksExperiment._isInNotebooksExperiment = await LspNotebooksExperiment.experiments.inExperiment(
                'pylanceLspNotebooksEnabled',
            );
        }

        return LspNotebooksExperiment._isInNotebooksExperiment;
    }
}
