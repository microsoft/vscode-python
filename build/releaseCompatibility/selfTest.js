// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const fs = require('fs');
const path = require('path');
const { check, hashFile, readArchive, inspectVsix, InfrastructureError } = require('./checks');
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

async function candidateCore(file, provenance = {}) {
    if (typeof file !== 'string' || !path.isAbsolute(file) || !fs.existsSync(file)) {
        throw new InfrastructureError(`Original candidate Core VSIX is missing: ${file}`);
    }
    let manifest;
    await readArchive(file, (entry, data) => {
        if (entry.name === 'extension/package.json') manifest = JSON.parse(data.toString('utf8'));
    });
    check(manifest?.publisher === 'ms-python' && manifest?.name === 'python', 'Candidate artifact is not Python Core');
    check(typeof manifest.version === 'string' && manifest.version.length > 0, 'Candidate Core version is missing');
    const artifact = {
        path: file,
        version: manifest.version,
        sha256: await hashFile(file),
        provenance: {
            ...provenance,
            repository: 'microsoft/vscode-python',
            channel: 'same-run-ci-built-core-candidate',
        },
    };
    await inspectVsix(artifact, 'ms-python.python');
    return artifact;
}

async function selfTest(output, python, candidate) {
    const hasCandidate = candidate !== undefined;
    if (!path.isAbsolute(output) || fs.existsSync(output)) {
        throw new InfrastructureError('Self-test output must be a new absolute directory');
    }
    fs.mkdirSync(output, { recursive: true });
    const reportFile = path.join(output, 'input-report.json');
    const report = {
        schemaVersion: 1,
        status: 'infrastructure-error',
        scope: hasCandidate ? 'ci-built-candidate-core-compatibility' : 'released-package-harness-self-test',
    };
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    try {
        const target = pins.platforms[process.platform];
        if (process.arch !== 'x64' || !target) {
            throw new InfrastructureError('Released harness self-test requires Windows or Linux x64');
        }
        const artifacts = {};
        if (hasCandidate) {
            artifacts.core = await candidateCore(candidate, {
                producerRepository: process.env.GITHUB_REPOSITORY ?? null,
                sourceCommit: process.env.GITHUB_SHA ?? null,
                headCommit: process.env.PYTHON_CANDIDATE_HEAD_SHA ?? null,
                buildId: process.env.GITHUB_RUN_ID ?? null,
                buildAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
                artifactName: process.env.PYTHON_CANDIDATE_ARTIFACT ?? null,
            });
            report.candidate = artifacts.core;
        }
        for (const [role, name, version, expected] of [
            ['core', 'python', pins.coreVersion, target.coreSha256],
            ['environments', 'vscode-python-envs', pins.environmentsVersion, target.environmentsSha256],
        ]) {
            if (hasCandidate && role === 'core') continue;
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
    selfTest(process.argv[2], process.argv[3], process.argv[4])
        .then((report) => {
            console.log(JSON.stringify(report));
            process.exitCode = report.status === 'passed' ? 0 : report.status === 'failed' ? 1 : 2;
        })
        .catch((error) => {
            console.error(error);
            process.exitCode = 2;
        });
}

module.exports = { selfTest, candidateCore };
