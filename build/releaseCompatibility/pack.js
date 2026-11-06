// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const fs = require('fs');
const path = require('path');
const { check, digest, within } = require('./checks');

function packageRoot(name, from) {
    try {
        return path.dirname(require.resolve(`${name}/package.json`, { paths: [from] }));
    } catch (error) {
        if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error;
    }
    let directory = path.dirname(require.resolve(name, { paths: [from] }));
    for (;;) {
        const file = path.join(directory, 'package.json');
        if (fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).name === name) return directory;
        const parent = path.dirname(directory);
        check(parent !== directory, `Cannot find installed dependency manifest: ${name}`);
        directory = parent;
    }
}

async function pack(output) {
    check(path.isAbsolute(output) && output.endsWith('.zip'), 'Output must be an absolute ZIP path');
    check(!fs.existsSync(output), 'An existing harness archive is never overwritten');
    const JSZip = require('jszip');
    const zip = new JSZip();
    const files = [];
    const date = new Date('2000-01-01T00:00:00Z');
    const add = (name, data, mode = 0o644) => {
        zip.file(name, data, { date, unixPermissions: mode });
        files.push({ path: name, sha256: digest(data) });
    };
    const addDirectory = (directory, destination, root) => {
        for (const item of fs
            .readdirSync(directory, { withFileTypes: true })
            .sort((a, b) => a.name.localeCompare(b.name))) {
            if (item.name === 'node_modules') continue;
            const file = path.join(directory, item.name);
            const name = `${destination}/${item.name}`;
            if (item.isDirectory()) addDirectory(file, name, root);
            else {
                check(
                    item.isFile() || (item.isSymbolicLink() && within(root, fs.realpathSync(file))),
                    `Unsupported dependency file: ${file}`,
                );
                add(name, fs.readFileSync(file), fs.statSync(file).mode & 0o777);
            }
        }
    };
    const addDependency = (name, from, destination, ancestors = []) => {
        const root = packageRoot(name, from);
        if (ancestors.includes(root)) return;
        const installed = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        const target = `${destination}/${name}`;
        addDirectory(root, target, root);
        for (const dependency of Object.keys(installed.dependencies ?? {}).sort()) {
            addDependency(dependency, root, `${target}/node_modules`, [...ancestors, root]);
        }
    };
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const repository = path.resolve(__dirname, '..', '..');
    const lockFile = fs.readFileSync(path.join(repository, 'package-lock.json'));
    const lock = JSON.parse(lockFile.toString('utf8'));
    for (const [name, version] of Object.entries(manifest.dependencies)) {
        const root = packageRoot(name, __dirname);
        check(
            JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version === version,
            `Harness dependency ${name} does not match its pinned version`,
        );
        check(
            lock.packages[`node_modules/${name}`]?.version === version,
            `Harness dependency ${name} does not match the repository lockfile`,
        );
        addDependency(name, __dirname, 'node_modules');
    }
    for (const file of ['run.js', 'checks.js', 'process.ps1', 'package.json', 'README.md']) {
        add(file, fs.readFileSync(path.join(__dirname, file)));
    }
    addDirectory(path.join(__dirname, 'controller'), 'controller', path.join(__dirname, 'controller'));
    add('repository-package-lock.json', lockFile);
    add(
        'harness-manifest.json',
        Buffer.from(
            JSON.stringify(
                {
                    schemaVersion: 1,
                    nodeVersion: process.version,
                    repositoryLockSha256: digest(lockFile),
                    files: files.sort((a, b) => a.path.localeCompare(b.path)),
                },
                null,
                2,
            ),
        ),
    );
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const bytes = await zip.generateAsync({
        type: 'nodebuffer',
        platform: 'UNIX',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
    });
    fs.writeFileSync(output, bytes, { flag: 'wx' });
    return { path: output, sha256: digest(bytes) };
}

if (require.main === module) {
    pack(process.argv[2])
        .then((result) => console.log(JSON.stringify(result)))
        .catch((error) => {
            console.error(error);
            process.exitCode = 1;
        });
}

module.exports = { pack };
