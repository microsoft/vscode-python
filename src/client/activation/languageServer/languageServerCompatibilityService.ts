// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IDotNetCompatibilityService } from '../../common/dotnet/types';
import { sendTelemetryEvent } from '../../telemetry';
import { PYTHON_LANGUAGE_SERVER_PLATFORM_SUPPORTED } from '../../telemetry/constants';
import { ILanguageServerCompatibilityService } from '../types';

@injectable()
export class LanguageServerCompatibilityService implements ILanguageServerCompatibilityService {
    constructor(@inject(IDotNetCompatibilityService) private readonly dotnetCompatibility: IDotNetCompatibilityService) { }
    public async isSupported(): Promise<boolean> {
        const supported = await this.dotnetCompatibility.isSupported();
        sendTelemetryEvent(PYTHON_LANGUAGE_SERVER_PLATFORM_SUPPORTED, undefined, { supported });
        return supported;
    }
}
