// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IDotNetCompatibilityService } from '../../common/dotnet/types';
import { ILanguageServerCompatibilityService } from '../types';

@injectable()
export class LanguageServerCompatibilityService implements ILanguageServerCompatibilityService {
    constructor(@inject(IDotNetCompatibilityService) private readonly dotnetCompatibility: IDotNetCompatibilityService) { }
    public isSupported(): Promise<boolean> {
        return this.dotnetCompatibility.isSupported();
    }
}
