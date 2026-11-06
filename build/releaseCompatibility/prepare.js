// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const fs = require('fs');
const path = require('path');
const { check, hashFile, validateHash, validatePlan, extractArchive, within } = require('./checks');

async function prepare(args) {
    const allowed = [
        '--inputs',
        '--inputs-sha256',
        '--candidate',
        '--candidate-sha256',
        '--candidate-version',
        '--python',
        '--output',
    ];
    check(args.length === allowed.length * 2, 'Missing compatibility preparation inputs');
    const values = {};
    for (let index = 0; index < args.length; index += 2) {
        check(
            allowed.includes(args[index]) && values[args[index]] === undefined,
            'Unknown or repeated preparation argument',
        );
        values[args[index]] = args[index + 1];
    }
    const output = values['--output'];
    check(path.isAbsolute(output) && !fs.existsSync(output), 'Preparation output must be a new absolute directory');
    fs.mkdirSync(output, { recursive: true });
    const reportFile = path.join(output, 'adapter-report.json');
    const report = { schemaVersion: 1, status: 'infrastructure-error', validationScope: 'pre-sign-build-artifact' };
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    try {
        const inputs = path.resolve(values['--inputs']);
        check(
            (await hashFile(inputs)) === validateHash(values['--inputs-sha256'], 'inputs ZIP hash'),
            'Pinned compatibility inputs ZIP changed',
        );
        const extracted = path.join(output, 'inputs');
        await extractArchive(inputs, extracted);
        const metadata = JSON.parse(fs.readFileSync(path.join(extracted, 'inputs.json'), 'utf8'));
        check(
            metadata.schemaVersion === 1 && metadata.environments,
            'inputs.json must contain a pinned Environments partner',
        );
        const partner = (artifact) => {
            check(
                artifact && typeof artifact.path === 'string' && !path.isAbsolute(artifact.path),
                'Companion VSIX paths must be relative to the inputs ZIP',
            );
            const file = path.resolve(extracted, artifact.path);
            check(within(extracted, file), 'Companion VSIX escaped the checked inputs ZIP');
            return { ...artifact, path: file };
        };
        const plan = validatePlan(
            {
                schemaVersion: 1,
                candidate: 'core',
                vscodeVersion: metadata.vscodeVersion,
                pythonExecutable: values['--python'],
                core: {
                    path: path.resolve(values['--candidate']),
                    version: values['--candidate-version'],
                    sha256: values['--candidate-sha256'],
                },
                environments: partner(metadata.environments),
                ...(metadata.upgradeFromEnvironments
                    ? { upgradeFromEnvironments: partner(metadata.upgradeFromEnvironments) }
                    : {}),
            },
            output,
        );
        const planFile = path.join(output, 'plan.json');
        fs.writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`);
        report.status = 'inputs-prepared';
        report.inputs = { path: inputs, sha256: await hashFile(inputs) };
        report.plan = planFile;
        report.requiresFinalSignedHashReconciliation = true;
        return report;
    } catch (error) {
        report.status = error.status ?? 'infrastructure-error';
        report.error = { name: error.name, message: error.message, stack: error.stack };
        throw error;
    } finally {
        fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
    }
}

if (require.main === module) {
    prepare(process.argv.slice(2))
        .then((report) => console.log(JSON.stringify(report)))
        .catch((error) => {
            console.error(error);
            process.exitCode = error.status === 'failed' ? 1 : 2;
        });
}

module.exports = { prepare };
