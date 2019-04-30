// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { injectable } from 'inversify';

import { createHash, HexBase64Latin1Encoding } from 'crypto';
import { ICryptoUtils } from './types';

@injectable()
export class CryptoUtils implements ICryptoUtils {

    public async createHash(algorithm: string, data: string, encoding: HexBase64Latin1Encoding, hashFormat: 'number' | 'string'): Promise<number | string | Buffer> {
        const hash = createHash(algorithm).update(data).digest(encoding);
        return hashFormat === 'number' ? +hash : hash;
    }
}
