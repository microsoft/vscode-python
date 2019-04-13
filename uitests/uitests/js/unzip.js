// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const gulp = require('gulp');
const fs = require("fs-extra");
const vzip = require('gulp-vinyl-zip');
const vfs = require('vinyl-fs');
const zipFile = process.argv[2];
const targetDir = process.argv[3];

unzip(zipFile, targetDir).catch(ex => {
    console.error(ex);
    return Promise.reject(ex);
});

async function unzip(zipFile, targetFolder) {
    await fs.ensureDir(targetFolder);
    return new Promise((resolve, reject) => {
        gulp.src(zipFile)
            .pipe(vzip.src())
            .pipe(vfs.dest(targetFolder))
            .on('end', resolve)
            .on('error', reject);
    });
}
