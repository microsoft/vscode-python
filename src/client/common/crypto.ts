// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { createHash } from 'crypto';
import { injectable } from 'inversify';
import { traceError } from './logger';
import { ICryptoUtils, IHashFormat } from './types';

/**
 * Implements tools related to cryptography
 */
@injectable()
export class CryptoUtils implements ICryptoUtils {
    // eslint-disable-next-line class-methods-use-this
    public createHash<E extends keyof IHashFormat>(
        data: string,
        hashFormat: E,
        algorithm: 'SHA512' | 'SHA256' | 'FNV' = 'FNV',
    ): IHashFormat[E] {
        let hash: string;
        if (algorithm === 'FNV') {
            // eslint-disable-next-line global-require
            const fnv = require('@enonic/fnv-plus');
            hash = fnv.fast1a32hex(data) as string;
        } else if (algorithm === 'SHA256') {
            hash = createHash('sha256').update(data).digest('hex'); // NOSONAR
        } else {
            hash = createHash('sha512').update(data).digest('hex');
        }
        if (hashFormat === 'number') {
            const result = parseInt(hash, 16);
            if (Number.isNaN(result)) {
                traceError(`Number hash for data '${data}' is NaN`);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return result as any;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return hash as any;
    }
}
