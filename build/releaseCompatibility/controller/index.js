// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const {
    check,
    samePath,
    verifyMode,
    verifyInstalledExtension,
    verifyPythonResult,
    observeMethod,
} = require('../checks');

const TIMEOUT = 60000;
let controllerContext;

function activate(context) {
    controllerContext = context;
}

async function bounded(label, operation) {
    let timer;
    try {
        return await Promise.race([
            operation,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), TIMEOUT);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}

async function until(label, read) {
    const deadline = Date.now() + TIMEOUT;
    do {
        const result = await bounded(label, read());
        if (result) return result;
        await new Promise((resolve) => setTimeout(resolve, 200));
    } while (Date.now() < deadline);
    throw new Error(`Timed out waiting for ${label}`);
}

function extension(expected) {
    const actual = vscode.extensions.getExtension(expected.id);
    verifyInstalledExtension(expected, actual, __dirname);
    return actual;
}

function configuredMode(testCase) {
    const config = vscode.workspace.getConfiguration('python', vscode.Uri.file(testCase.workspace));
    const effective = config.get('useEnvironmentsExtension');
    const explicit = config.inspect('useEnvironmentsExtension')?.globalValue;
    verifyMode(testCase.mode, effective, explicit);
    return { requested: testCase.mode, effective, explicitGlobal: explicit };
}

function environmentExecutable(environment) {
    const value = environment?.execInfo?.run?.executable;
    return typeof value === 'string' ? value : value?.fsPath;
}

async function discovered(testCase, coreApi, environmentApi) {
    if (testCase.mode) {
        await bounded('Environments refresh', environmentApi.refreshEnvironments(undefined));
    } else {
        await bounded('core legacy refresh', coreApi.environments.refreshEnvironments({ forceRefresh: true }));
    }
    return until('both fixture environments to be discovered, not merely resolved by explicit path', async () => {
        const environments = testCase.mode ? await environmentApi.getEnvironments('all') : coreApi.environments.known;
        const matches = testCase.fixtures.map((fixture) =>
            environments.find((item) => {
                const executable = testCase.mode ? environmentExecutable(item) : item.executable?.uri?.fsPath;
                return executable && samePath(executable, fixture.executable);
            }),
        );
        return matches.every(Boolean) ? matches : undefined;
    });
}

async function selected(testCase, coreApi, environmentApi, resource, expected) {
    return until('selected environment to match the requested fixture', async () => {
        const actual = testCase.mode
            ? await environmentApi.getEnvironment(resource)
            : coreApi.environments.getActiveEnvironmentPath(resource);
        const executable = testCase.mode ? environmentExecutable(actual) : actual?.path;
        return executable && samePath(executable, expected.executable) ? { executable } : undefined;
    });
}

async function executeFixture(testCase, fixture, index, environmentApi) {
    const file = path.join(testCase.workspace, `probe-${testCase.phase}-${index}.py`);
    const resultFile = file.slice(0, -3) + '.json';
    const nonce = `${testCase.nonce}-${index}`;
    fs.writeFileSync(
        file,
        [
            'import json',
            'import pathlib',
            'import sys',
            'result = pathlib.Path(__file__).with_suffix(".json")',
            'temporary = result.with_suffix(".tmp")',
            `temporary.write_text(json.dumps({"executable": sys.executable, "prefix": sys.prefix, "nonce": "${nonce}"}), encoding="utf-8")`,
            'temporary.replace(result)',
            '',
        ].join('\n'),
    );
    const uri = vscode.Uri.file(file);
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
    const observation = testCase.mode ? observeMethod(environmentApi, 'runInTerminal') : undefined;
    try {
        await bounded(
            'normal core python.execInTerminal',
            vscode.commands.executeCommand('python.execInTerminal', uri),
        );
        const actual = await until('real Python execution result', async () => {
            if (!fs.existsSync(resultFile)) return undefined;
            const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
            verifyPythonResult(fixture, result, nonce);
            return result;
        });
        if (observation) {
            check(
                observation.calls.length === 1,
                'Core did not delegate normal execution to Environments exactly once',
            );
            check(
                samePath(environmentExecutable(observation.calls[0][0]), fixture.executable),
                'Core delegated execution using the wrong selected environment',
            );
        }
        return { file, resultFile, ...actual, delegatedCalls: observation?.calls.length ?? 0 };
    } finally {
        observation?.restore();
    }
}

async function run() {
    const testCase = JSON.parse(fs.readFileSync(process.env.PYTHON_COMPATIBILITY_CASE, 'utf8'));
    const report = { status: 'failed', mode: testCase.mode, phase: testCase.phase, runs: [] };
    try {
        check(vscode.version === testCase.vscodeVersion, 'The extension host is not the pinned VS Code version');
        const controller = vscode.extensions.getExtension(
            'vscode-python-tests.python-release-compatibility-controller',
        );
        check(controller, 'Independent test controller is missing');
        await bounded('controller activation', controller.activate());
        check(
            controllerContext?.extensionMode === vscode.ExtensionMode.Test,
            'Controller is not in the isolated test host',
        );
        check(
            samePath(controllerContext.extensionPath, __dirname),
            'Controller loaded from an unexpected development path',
        );
        report.controller = {
            location: controllerContext.extensionPath,
            extensionMode: controllerContext.extensionMode,
        };
        report.vscode = { version: vscode.version, platform: process.platform, arch: process.arch };
        report.configurationBefore = configuredMode(testCase);
        const core = extension(testCase.core);
        const environments = extension(testCase.environments);
        report.extensions = [core, environments].map((item) => ({
            id: item.id,
            version: item.packageJSON.version,
            location: item.extensionPath,
            installation: 'installed-vsix-outside-sole-controller-development-path',
            extensionContextMode: null,
        }));
        const coreApi = await bounded('core activation', core.activate());
        await bounded('core ready', coreApi.ready);
        const environmentApi = testCase.mode
            ? await bounded('Environments activation', environments.activate())
            : undefined;
        check(coreApi.environments, 'Core public environments API is missing');
        if (testCase.mode) {
            for (const method of [
                'refreshEnvironments',
                'getEnvironments',
                'setEnvironment',
                'getEnvironment',
                'runInTerminal',
            ]) {
                check(typeof environmentApi?.[method] === 'function', `Environments public API is missing ${method}`);
            }
        }
        report.configurationAfterActivation = configuredMode(testCase);
        const matches = await discovered(testCase, coreApi, environmentApi);
        report.discovery = matches.map((item) => ({
            executable: testCase.mode ? environmentExecutable(item) : item.executable.uri.fsPath,
            prefix: testCase.mode ? item.sysPrefix : item.executable.sysPrefix,
        }));
        const resource = vscode.Uri.file(path.join(testCase.workspace, 'selection.py'));
        if (testCase.persisted) {
            // This read must precede any selection write in the upgraded host.
            report.persistedSelection = await selected(testCase, coreApi, environmentApi, resource, testCase.persisted);
        }
        for (let index = 0; index < testCase.fixtures.length; index += 1) {
            const fixture = testCase.fixtures[index];
            if (testCase.mode) {
                await bounded(
                    'Environments selection',
                    environmentApi.setEnvironment(vscode.Uri.file(testCase.workspace), matches[index]),
                );
            } else {
                await bounded(
                    'legacy core selection',
                    coreApi.environments.updateActiveEnvironmentPath(fixture.executable, resource),
                );
            }
            const selection = await selected(testCase, coreApi, environmentApi, resource, fixture);
            const execution = await executeFixture(testCase, fixture, index, environmentApi);
            report.runs.push({ selection, execution });
        }
        report.configurationAfterExecution = configuredMode(testCase);
        report.status = 'passed';
    } catch (error) {
        report.status = error.status ?? 'failed';
        report.error = { name: error.name, message: error.message, stack: error.stack };
        throw error;
    } finally {
        fs.writeFileSync(testCase.stateFile, `${JSON.stringify(report, null, 2)}\n`);
        for (const terminal of vscode.window.terminals) terminal.dispose();
    }
}

module.exports = { activate, run };
