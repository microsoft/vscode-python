// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const gulp = require('gulp');
const fs = require("fs-extra");
const vzip = require('gulp-vinyl-zip');
const vfs = require('vinyl-fs');
const untar = require('gulp-untar');
const gunzip = require('gulp-gunzip');
const chmod = require('gulp-chmod');
const filter = require('gulp-filter');

const zipFile = process.argv[2];
const targetDir = process.argv[3];

const unzipFn = (zipFile.indexOf('.gz') > 0 || zipFile.indexOf('.tag') > 0) ? unzipTarGz : unzip;

unzipFn(zipFile, targetDir).catch(ex => {
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

async function unzipTarGz(zipFile, targetFolder) {
    await fs.ensureDir(targetFolder);
    return new Promise((resolve, reject) => {
        var gulpFilter = filter(['VSCode-linux-x64/code', 'VSCode-linux-x64/code-insiders', 'VSCode-linux-x64/resources/app/node_modules*/vscode-ripgrep/**/rg'], { restore: true });
        gulp.src(zipFile)
            .pipe(gunzip())
            .pipe(untar())
            .pipe(gulpFilter)
            .pipe(chmod(493)) // 0o755
            .pipe(gulpFilter.restore)
            .pipe(vfs.dest(targetFolder))
            .on('end', resolve)
            .on('error', reject);
    });
}
