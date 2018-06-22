// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IServiceContainer } from '../../../ioc/types';
import { DiagnosticScope, IDiagnostic, IDiagnosticFilterService } from '../types';
import { BaseDiagnosticCommand } from './base';

export class IgnoreDiagnosticCommand extends BaseDiagnosticCommand {
    constructor(diagnostic: IDiagnostic, private serviceContainer: IServiceContainer, private readonly scope: DiagnosticScope) {
        super(diagnostic);
    }
    public invoke(): Promise<void> {
        const filter = this.serviceContainer.get<IDiagnosticFilterService>(IDiagnosticFilterService);
        return filter.ignoreDiagnostic(this.diagnostic.code, this.scope);
    }
}
