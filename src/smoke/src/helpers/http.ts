// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: import-name no-console

import * as fs from 'fs-extra';
import ProgressBar from 'progress';
import * as request from 'request';
// tslint:disable: no-var-requires no-require-imports
const progress = require('request-progress');
const progressBar = require('progress') as typeof ProgressBar;

export async function downloadFile(url: string, targetFile: string, downloadMessage = 'Downloading') {
    return new Promise<void>((resolve, reject) => {
        const bar = new progressBar(`${downloadMessage} [:bar]`, {
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: 100
        });
        progress(request(url))
            .on('progress', (state: { percent: number }) => bar.update(state.percent))
            .on('error', reject)
            .on('end', () => { bar.update(100); resolve(); })
            .pipe(fs.createWriteStream(targetFile));
    })
        // To ensure subsequent messages do not end up in the same line as progress message.
        .finally(() => console.log(''));
}
