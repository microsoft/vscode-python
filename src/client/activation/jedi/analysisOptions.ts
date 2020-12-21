// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';

import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { LanguageServerAnalysisOptionsBase } from '../common/analysisOptions';
import { ILanguageServerOutputChannel } from '../types';

@injectable()
export class JediLanguageServerAnalysisOptions extends LanguageServerAnalysisOptionsBase {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(
        @inject(IEnvironmentVariablesProvider) envVarsProvider: IEnvironmentVariablesProvider,
        @inject(ILanguageServerOutputChannel) lsOutputChannel: ILanguageServerOutputChannel,
    ) {
        super(envVarsProvider, lsOutputChannel);
    }
}
