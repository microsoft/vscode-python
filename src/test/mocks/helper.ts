// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Readable } from 'stream';

export class FakeReadableStream extends Readable {
    _read(_size: unknown): void | null {
        // custom reading logic here
        this.push(null); // end the stream
    }
}
