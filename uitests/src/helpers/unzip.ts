// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-var-requires no-require-imports no-default-export no-console

const gulp = require('gulp');
const vzip = require('gulp-vinyl-zip');
const vfs = require('vinyl-fs');
const untar = require('gulp-untar');
const gunzip = require('gulp-gunzip');
const chmod = require('gulp-chmod');
const filter = require('gulp-filter');
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as path from 'path';
import { debug } from './logger';

export function unzipVSCode(zipFile: string, targetDir: string) {
    debug(`Unzip VSCode ${zipFile} into ${targetDir}`);
    const fn = zipFile.indexOf('.gz') > 0 || zipFile.indexOf('.tag') > 0 ? unzipTarGz : unzipFile;
    return fn(zipFile, targetDir);
}

export async function unzipFile(zipFile: string, targetFolder: string) {
    debug(`Unzip (unzipFile) ${zipFile} into ${targetFolder}`);
    await fs.ensureDir(targetFolder);
    return new Promise((resolve, reject) => {
        gulp.src(zipFile)
            .pipe(vzip.src())
            .pipe(vfs.dest(targetFolder))
            .on('end', resolve)
            .on('error', reject);
    });
}

export async function unzipTarGz(zipFile: string, targetFolder: string) {
    debug(`Unzip (unzipTarGz) ${zipFile} into ${targetFolder}`);
    const fileToFixPermissions = ['VSCode-linux-x64/code', 'VSCode-linux-x64/code-insiders', 'VSCode-linux-x64/resources/app/node_modules*/vscode-ripgrep/**/rg'];
    await fs.ensureDir(targetFolder);
    await new Promise((resolve, reject) => {
        const gulpFilter = filter(fileToFixPermissions, { restore: true });
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

    for (const fileGlob of fileToFixPermissions) {
        const files = await new Promise<string[]>((resolve, reject) => {
            glob(path.join(targetFolder, fileGlob), (ex, items) => (ex ? reject(ex) : resolve(items)));
        });
        await Promise.all(files.map(file => fs.chmod(file, '755')));
    }
}
