// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: import-name no-console no-var-requires no-require-imports

import * as fs from 'fs-extra';
import ProgressBar from 'progress';
import * as request from 'request';
import { debug } from './logger';
const progress = require('request-progress');
const progressBar = require('progress') as typeof ProgressBar;

export async function downloadFile(url: string, targetFile: string, downloadMessage = 'Downloading') {
    debug(`Downloading ${url} as ${targetFile}`);
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
            .on('end', () => {
                bar.update(100);
                resolve();
            })
            .pipe(fs.createWriteStream(targetFile));
    });
}
