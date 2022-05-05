// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';

import { LanguageClientMiddlewareBase } from '../languageClientMiddlewareBase';
import { LanguageServerType } from '../types';

export class JediLanguageClientMiddleware extends LanguageClientMiddlewareBase {
    public constructor(serviceContainer: IServiceContainer, serverVersion?: string) {
        super(serviceContainer, LanguageServerType.Jedi, sendTelemetryEvent, serverVersion);
    }
}
