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
    const json = JSON.parse(fs.readFileSync(packageJson).toString());
    const sourceDrvierJs = path.join(vscodeSmokeDirector, 'src', 'vscode', 'driver.js');
    const sourceDrvierTs = path.join(vscodeSmokeDirector, 'src', 'vscode', 'driver.d.ts');
    const outDirVSC = path.join(rootDirectory, 'out', 'smoke', 'vscode', 'vscode');
    fs.ensureDirSync(outDirVSC);
    json.scripts['copy-driver'] = '';
    fs.copyFile(sourceDrvierJs, path.join(outDirVSC, path.basename(sourceDrvierJs)));
    console.log(`Copied file '${sourceDrvierJs}' into ${outDirVSC}`);
    fs.copyFile(sourceDrvierTs, path.join(outDirVSC, path.basename(sourceDrvierTs)));
    console.log(`Copied file '${sourceDrvierTs}' into ${outDirVSC}`);
    fs.writeFileSync(packageJson, JSON.stringify(json, undefined, 4));
    console.log(`Updated packageJson ${packageJson}`);
}

udpateTsConfig();
updatePackageJson();
