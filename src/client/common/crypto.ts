// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { injectable } from 'inversify';

import { createHash, HexBase64Latin1Encoding } from 'crypto';
import { ICryptoUtils, IHashFormat } from './types';

/**
 * Implements tools related to cryptography
 */
@injectable()
export class CryptoUtils implements ICryptoUtils {
    public createHash<E extends keyof IHashFormat>(data: string, encoding: HexBase64Latin1Encoding, hashFormat: E): IHashFormat[E] {
        const hash = createHash('sha512').update(data).digest(encoding);
        return hashFormat === 'number' ? parseInt(hash, undefined) : hash;
    }
}
