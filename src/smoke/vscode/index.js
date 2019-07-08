// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const path = require('path');
const fs = require('fs');

const rootDirectory = path.join(__dirname, '..', '..', '..');
const tsConfig = path.join(__dirname, 'test', 'smoke', 'tsconfig.json');
const packageJson = path.join(__dirname, 'test', 'smoke', 'package.json');
const packageJsonDirectory = path.dirname(packageJson);

function udpateTsConfig() {
    const json = JSON.parse(fs.readFileSync(tsConfig).toString());
    json.compilerOptions.outDir = path.relative(packageJsonDirectory, path.join(rootDirectory, 'out', 'smoke', 'vscode'));
    json.compilerOptions.declaration = true;
    fs.writeFileSync(tsConfig, JSON.stringify(json, undefined, 4));
}

function updatePackageJson() {
    const json = JSON.parse(fs.readFileSync(packageJson).toString());
    const sourceDrvierJs = path.join('src', 'vscode', 'driver.js')
    const sourceDrvierTs = path.join('src', 'vscode', 'driver.d.ts')
    const outDirVSC = path.relative(packageJsonDirectory, path.join(rootDirectory, 'out', 'smoke', 'vscode', 'vscode'));
    json.scripts['copy-driver'] = `cpx ${sourceDrvierJs} ${outDirVSC} && cpx ${sourceDrvierTs} ${outDirVSC} `
    fs.writeFileSync(packageJson, JSON.stringify(json, undefined, 4));
}

udpateTsConfig();
updatePackageJson();
