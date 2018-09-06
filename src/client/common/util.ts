// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as os from 'os';

// tslint:disable-next-line: no-suspicious-comment
// TODO: Usage of these should be replaced by OSInfo.* or
// IPlatformService.* (from src/client/common/platform).
export const IS_WINDOWS = /^win/.test(process.platform);
export const Is_64Bit = os.arch() === 'x64';
