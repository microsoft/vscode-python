// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable: no-any

import { createHash } from 'crypto';
import { injectable } from 'inversify';
import { traceError } from './logger';
import { ICryptoUtils, IHashFormat } from './types';

/**
 * Implements tools related to cryptography
 */
@injectable()
export class CryptoUtils implements ICryptoUtils {
    public createHash<E extends keyof IHashFormat>(
        data: string,
        hashFormat: E,
        algorithm: 'SHA512' | 'SHA256' | 'FNV' = 'FNV',
    ): IHashFormat[E] {
        let hash: string;
        if (algorithm === 'FNV') {
            // tslint:disable-next-line:no-require-imports
            const fnv = require('@enonic/fnv-plus');
            hash = fnv.fast1a32hex(data) as string;
        } else if (algorithm === 'SHA256') {
            hash = createHash('sha256').update(data).digest('hex');
        } else {
            hash = createHash('sha512').update(data).digest('hex');
        }
        if (hashFormat === 'number') {
            const result = parseInt(hash, 16);
            if (isNaN(result)) {
                traceError(`Number hash for data '${data}' is NaN`);
            }
            return result as any;
        }
        return hash as any;
    }
}
