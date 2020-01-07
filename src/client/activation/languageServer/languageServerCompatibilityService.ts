// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IDotNetCompatibilityService } from '../../common/dotnet/types';
import { traceError } from '../../common/logger';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { ILanguageServerCompatibilityService } from '../types';

@injectable()
export class LanguageServerCompatibilityService implements ILanguageServerCompatibilityService {
    constructor(@inject(IDotNetCompatibilityService) private readonly dotnetCompatibility: IDotNetCompatibilityService) {}
    public async isSupported(): Promise<boolean> {
        try {
            const supported = await this.dotnetCompatibility.isSupported();
            sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_PLATFORM_SUPPORTED, undefined, { supported: supported });
            return supported;
        } catch (ex) {
            traceError('Unable to determine whether LS is supported', ex);
            sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_PLATFORM_SUPPORTED, undefined, { supported: false, failureType: 'UnknownError' });
            return false;
        }
    }
}
