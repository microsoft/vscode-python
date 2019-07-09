// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const path = require('path');
const fs = require('fs-extra');

const rootDirectory = path.join(__dirname, '..', '..', '..');
const tsConfig = path.join(__dirname, 'test', 'smoke', 'tsconfig.json');
const packageJson = path.join(__dirname, 'test', 'smoke', 'package.json');
const vscodeSmokeDirector = path.join(__dirname, 'test', 'smoke');
const packageJsonDirectory = path.dirname(packageJson);

function udpateTsConfig() {
    const json = JSON.parse(fs.readFileSync(tsConfig).toString());
    json.compilerOptions.outDir = path.relative(packageJsonDirectory, path.join(rootDirectory, 'out', 'smoke', 'vscode'));
    json.compilerOptions.declaration = true;
    fs.writeFileSync(tsConfig, JSON.stringify(json, undefined, 4));
    console.log(`Updated tsConfig ${tsConfig}`);
}

function updatePackageJson() {
    const sourceDriverJs = path.join(vscodeSmokeDirector, 'src', 'vscode', 'driver.js');
    const sourceDriverTs = path.join(vscodeSmokeDirector, 'src', 'vscode', 'driver.d.ts');
    const outDirVSCFullPath = path.join(rootDirectory, 'out', 'smoke', 'vscode', 'vscode');
    fs.ensureDirSync(outDirVSCFullPath);
    console.log(`Full path ${outDirVSCFullPath}`);
    fs.copyFileSync(sourceDriverJs, path.join(outDirVSCFullPath, path.basename(sourceDriverJs)));
    console.log(`Copied file '${sourceDriverJs}' into ${sourceDriverJs}`);
    fs.copyFileSync(sourceDriverTs, path.join(outDirVSCFullPath, path.basename(sourceDriverTs)));
    console.log(`Copied file '${sourceDriverTs}' into ${sourceDriverJs}`);
}

udpateTsConfig();
updatePackageJson();
