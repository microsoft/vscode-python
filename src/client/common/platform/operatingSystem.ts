// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { arch, release } from 'os';
import { IOperatingSystem } from './types';

export class OperatingSystem implements IOperatingSystem {
  public release(): string {
    return release();
  }
  public arch(): string {
    return arch();
  }
}
