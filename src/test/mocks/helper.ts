// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Readable } from 'stream';

export class MyReadableStream extends Readable {
    _read(size: unknown): void | null {
        // custom reading logic here
        console.log(size);
        this.push(null); // end the stream
    }
}
