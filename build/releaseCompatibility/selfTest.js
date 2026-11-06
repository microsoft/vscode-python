// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const fs = require('fs');
const path = require('path');
const { check, hashFile, InfrastructureError } = require('./checks');
const { run, errorRecord } = require('./run');
const pins = require('./released-pairs.json');

async function download(url, file) {
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok || !response.body) {
        throw new InfrastructureError(`Released fixture download failed: ${response.status} ${url}`);
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
        size += chunk.length;
        check(size <= 512 * 1024 * 1024, 'Released fixture exceeds download bounds');
        chunks.push(Buffer.from(chunk));
    }
    fs.writeFileSync(file, Buffer.concat(chunks, size), { flag: 'wx' });
}

async function selfTest(output, python) {
    if (!path.isAbsolute(output) || fs.existsSync(output)) {
        throw new InfrastructureError('Self-test output must be a new absolute directory');
    }
    fs.mkdirSync(output, { recursive: true });
    const reportFile = path.join(output, 'input-report.json');
    const report = { schemaVersion: 1, status: 'infrastructure-error', scope: 'released-package-harness-self-test' };
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    try {
        const target = pins.platforms[process.platform];
        if (process.arch !== 'x64' || !target) {
            throw new InfrastructureError('Released harness self-test requires Windows or Linux x64');
        }
        const artifacts = {};
        for (const [role, name, version, expected] of [
            ['core', 'python', pins.coreVersion, target.coreSha256],
            ['environments', 'vscode-python-envs', pins.environmentsVersion, target.environmentsSha256],
        ]) {
            const url = `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/ms-python/vsextensions/${name}/${version}/vspackage?targetPlatform=${target.target}`;
            const file = path.join(output, `${role}-${version}-${target.target}.vsix`);
            await download(url, file);
            check((await hashFile(file)) === expected, `Frozen ${role} released fixture SHA-256 differs`);
            artifacts[role] = {
                path: file,
                version,
                sha256: expected,
                provenance: { channel: 'released-package-harness-self-test' },
            };
        }
        artifacts.environments.pet = 'bundled';
        const plan = {
            schemaVersion: 1,
            candidate: 'core',
            vscodeVersion: pins.vscodeVersion,
            pythonExecutable: python,
            ...artifacts,
        };
        const planFile = path.join(output, 'plan.json');
        fs.writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`);
        const result = await run(planFile, path.join(output, 'run'));
        report.status = result.status;
        report.plan = planFile;
        report.runnerReport = path.join(output, 'run', 'report.json');
        report.certifiesOfficialCandidateOrSignedPublication = false;
    } catch (error) {
        report.status = error.status ?? 'infrastructure-error';
        report.error = errorRecord(error);
    }
    fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
    return report;
}

if (require.main === module) {
    selfTest(process.argv[2], process.argv[3])
        .then((report) => {
            console.log(JSON.stringify(report));
            process.exitCode = report.status === 'passed' ? 0 : report.status === 'failed' ? 1 : 2;
        })
        .catch((error) => {
            console.error(error);
            process.exitCode = 2;
        });
}

module.exports = { selfTest };
