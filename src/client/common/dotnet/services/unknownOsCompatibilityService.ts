// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { traceDecorators } from '../../logger';
import { IOSDotNetCompatibilityService } from '../types';

@injectable()
export class UnknownOSDotNetCompatibilityService implements IOSDotNetCompatibilityService {
    @traceDecorators.info('Unable to determine compatiblity of DOT.NET with an unknown OS')
    public async isSupported() {
        return false;
    }
}
