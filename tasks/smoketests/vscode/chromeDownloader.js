// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const fs = require('fs')
const path = require('path')
const electronDownload = require('electron-download')
const extractZip = require('extract-zip')
const versionToDownload = process.argv.length > 2 ? process.argv[2] : '3.1.3';
const downloadDir = process.argv.length > 3 ? process.argv[3] : path.join(__dirname, 'bin');

function download(version, callback) {
    electronDownload({
        version,
        chromedriver: true,
        platform: process.env.npm_config_platform,
        arch: process.env.npm_config_arch,
        strictSSL: process.env.npm_config_strict_ssl === 'true',
        quiet: ['info', 'verbose', 'silly', 'http'].indexOf(process.env.npm_config_loglevel) === -1
    }, callback)
}

function processDownload(err, zipPath) {
    if (err != null) throw err
    extractZip(zipPath, { dir: downloadDir }, error => {
        if (error != null) throw error
        if (process.platform !== 'win32') {
            fs.chmod(path.join(downloadDir, 'chromedriver'), '755', error => {
                if (error != null) throw error
            })
        }
    })
}

download(versionToDownload, (err, zipPath) => {
    if (err) {
        const parts = versionToDownload.split('.')
        const baseVersion = `${parts[0]}.${parts[1]}.0`
        download(baseVersion, processDownload)
    } else {
        processDownload(err, zipPath)
    }
})
