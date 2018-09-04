'use strict';
// tslint:disable: no-any one-line no-suspicious-comment prefer-template prefer-const no-unnecessary-callback-wrapper no-function-expression no-string-literal no-control-regex no-shadowed-variable

import * as os from 'os';

export const IS_WINDOWS = /^win/.test(process.platform);
export const Is_64Bit = os.arch() === 'x64';
