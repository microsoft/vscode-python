// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
    CheckFailure,
    InfrastructureError,
    check,
    hashFile,
    samePath,
    validatePlan,
    inspectVsix,
    installVsix,
    verifyInstalledFiles,
    locatorStarts,
    verifyPetIdentity,
    childEnvironment,
} = require('./checks');

const HOST_TIMEOUT = 5 * 60 * 1000;

function writeJson(file, value) {
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function errorRecord(error) {
    return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        status: error.status ?? 'infrastructure-error',
        ownedProcessPid: error.ownedProcessPid ?? null,
        cleanupError: error.cleanupError ?? null,
    };
}

function stopTree(child) {
    if (process.platform === 'win32') {
        if (child.exitCode !== null || child.signalCode !== null) return;
        const executable = path.join(process.env.SystemRoot, 'System32', 'taskkill.exe');
        const result = spawnSync(executable, ['/PID', String(child.pid), '/T', '/F'], {
            encoding: 'utf8',
            windowsHide: true,
            timeout: 10000,
        });
        if (result.error || result.status !== 0) {
            throw new InfrastructureError(
                `Could not stop owned test process ${child.pid}: ${result.error ?? result.stderr}`,
            );
        }
    } else {
        try {
            process.kill(-child.pid, 'SIGKILL');
        } catch (error) {
            if (error.code !== 'ESRCH') throw error;
        }
    }
}

function liveGroupMembers(group) {
    const members = [];
    for (const pid of fs.readdirSync('/proc').filter((name) => /^[0-9]+$/.test(name))) {
        let stat;
        try {
            stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
        } catch (error) {
            if (error.code === 'ENOENT' || error.code === 'ESRCH') continue;
            throw error;
        }
        const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
        if (Number(fields[2]) === group && fields[0] !== 'Z' && fields[0] !== 'X') members.push(Number(pid));
    }
    return members;
}

async function finishOwnedGroup(child) {
    const members = liveGroupMembers(child.pid);
    const cleanup = { kind: 'owned-posix-group', forcedDescendantCleanup: members.length > 0, members };
    const deadline = Date.now() + 5000;
    while (liveGroupMembers(child.pid).length > 0) {
        stopTree(child);
        if (Date.now() >= deadline) {
            throw new InfrastructureError(`Owned process group ${child.pid} did not terminate within cleanup bounds`);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return cleanup;
}

function runProcess(command, args, options) {
    return new Promise((resolve, reject) => {
        let executable = command;
        let argumentsToLaunch = args;
        if (process.platform === 'win32') {
            const request = path.join(options.cwd, `.compatibility-process-${crypto.randomUUID()}.json`);
            writeJson(request, { command, args, cwd: options.cwd, timeout: options.timeout ?? 60000 });
            executable = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
            argumentsToLaunch = [
                '-NoProfile',
                '-NonInteractive',
                '-File',
                path.join(__dirname, 'process.ps1'),
                '-RequestFile',
                request,
            ];
        }
        const child = spawn(executable, argumentsToLaunch, {
            cwd: options.cwd,
            env: options.env,
            shell: false,
            detached: process.platform !== 'win32',
            windowsHide: true,
        });
        let stdout = '';
        let stderr = '';
        let failure;
        let settled = false;
        let cleaning = false;
        let cleanupTimer;
        let timer;
        const settle = async (code, signal) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            clearTimeout(cleanupTimer);
            let containment;
            try {
                containment =
                    process.platform === 'linux'
                        ? await finishOwnedGroup(child)
                        : { kind: 'private-windows-job-completed' };
            } catch (error) {
                failure = failure ?? new InfrastructureError(`Cannot complete owned process cleanup: ${error.message}`);
                failure.cleanupError = error.message;
            }
            try {
                if (options.log) {
                    fs.writeFileSync(
                        options.log,
                        `COMMAND ${command}\nARGS ${JSON.stringify(args)}\n${stdout}\nSTDERR\n${stderr}`,
                    );
                }
            } catch (error) {
                failure = new InfrastructureError(`Cannot retain test process output: ${error.message}`);
            }
            if (!failure && code === 124 && process.platform === 'win32') {
                failure = new InfrastructureError(`Owned Windows process job exceeded its deadline: ${command}`);
            }
            if (failure) {
                failure.ownedProcessPid = child.pid;
                reject(failure);
            } else resolve({ code, signal, stdout, stderr, pid: child.pid, cleanup: containment });
        };
        const cleanup = () => {
            if (cleaning) return;
            cleaning = true;
            clearTimeout(timer);
            try {
                stopTree(child);
            } catch (error) {
                failure.cleanupError = `Owned process ${child.pid} cleanup failed: ${error.message}`;
            }
            cleanupTimer = setTimeout(() => {
                child.stdout.destroy();
                child.stderr.destroy();
                child.stdin.destroy();
                child.unref();
                failure.cleanupError =
                    failure.cleanupError ?? 'Owned process pipes did not close after bounded cleanup';
                settle(null, 'cleanup-deadline');
            }, 5000);
        };
        timer = setTimeout(() => {
            failure = new InfrastructureError(`Owned test process exceeded ${options.timeout ?? 60000}ms: ${command}`);
            cleanup();
        }, options.timeout ?? 60000);
        const capture = (target, data) => {
            const text = data.toString();
            const remaining = Math.max(0, 16 * 1024 * 1024 - stdout.length - stderr.length);
            if (target === 'stdout') stdout += text.slice(0, remaining);
            else stderr += text.slice(0, remaining);
            if (!failure && text.length > remaining) {
                failure = new InfrastructureError(`Test process output exceeds capture bounds: ${command}`);
                cleanup();
            }
        };
        child.stdout.on('data', (data) => capture('stdout', data));
        child.stderr.on('data', (data) => capture('stderr', data));
        child.on('error', (error) => {
            failure = new InfrastructureError(`Cannot start ${command}: ${error.message}`);
        });
        child.on('close', settle);
        child.stdin.end();
    });
}

async function pythonProbe(executable, cwd, env) {
    const result = await runProcess(
        executable,
        ['-c', 'import json,sys; print(json.dumps({"executable":sys.executable,"prefix":sys.prefix}))'],
        { cwd, env },
    );
    if (result.code !== 0) {
        throw new InfrastructureError(`Cannot probe fixture Python: ${result.stderr}`);
    }
    return JSON.parse(result.stdout);
}

function logFiles(directory) {
    if (!fs.existsSync(directory)) return [];
    const files = [];
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, item.name);
        if (item.isDirectory()) files.push(...logFiles(file));
        else if (item.isFile() && item.name.endsWith('.log')) files.push(file);
    }
    return files;
}

function logOffsets(directory) {
    return Object.fromEntries(logFiles(directory).map((file) => [file, fs.statSync(file).size]));
}

function observeLogs(directory, offsets) {
    const starts = [];
    const errors = [];
    for (const file of logFiles(directory)) {
        const size = fs.statSync(file).size;
        if (size > 64 * 1024 * 1024) throw new InfrastructureError(`Host log exceeds capture bounds: ${file}`);
        const offset = size >= (offsets[file] ?? 0) ? offsets[file] ?? 0 : 0;
        const text = fs.readFileSync(file).subarray(offset).toString('utf8');
        starts.push(...locatorStarts(text, file));
        errors.push(
            ...text
                .split(/\r?\n/)
                .filter((line) => /\[error\]|process error|exited immediately/i.test(line))
                .map((line) => ({ logFile: file, line })),
        );
    }
    return { starts, errors };
}

async function makeProfile(directory, mode, pythonExecutable) {
    const workspace = path.join(directory, 'workspace');
    const userData = path.join(directory, 'user-data');
    const home = path.join(directory, 'home');
    const extensions = path.join(directory, 'extensions');
    for (const dir of [workspace, path.join(workspace, '.vscode'), path.join(userData, 'User'), extensions]) {
        await fs.promises.mkdir(dir, { recursive: true });
    }
    const env = childEnvironment(process.env, home);
    for (const key of [
        'HOME',
        'APPDATA',
        'LOCALAPPDATA',
        'XDG_CONFIG_HOME',
        'XDG_CACHE_HOME',
        'XDG_DATA_HOME',
        'TEMP',
    ]) {
        await fs.promises.mkdir(env[key], { recursive: true });
    }
    const settings = {
        'python.useEnvironmentsExtension': mode,
        'python.languageServer': 'None',
        'python.terminal.executeInFileDir': true,
        'python.terminal.focusAfterLaunch': false,
        'python-envs.workspaceSearchPaths': ['./**/.venv'],
        'extensions.autoUpdate': false,
        'extensions.autoCheckUpdates': false,
        'update.mode': 'none',
        'telemetry.telemetryLevel': 'off',
        'terminal.integrated.enablePersistentSessions': false,
    };
    if (process.platform === 'win32') {
        settings['terminal.integrated.profiles.windows'] = {
            'Compatibility Command Prompt': {
                path: process.env.ComSpec ?? path.join(process.env.SystemRoot, 'System32', 'cmd.exe'),
            },
        };
        settings['terminal.integrated.defaultProfile.windows'] = 'Compatibility Command Prompt';
    } else {
        settings['terminal.integrated.profiles.linux'] = {
            'Compatibility Bash': { path: '/bin/bash', args: ['--noprofile', '--norc'] },
        };
        settings['terminal.integrated.defaultProfile.linux'] = 'Compatibility Bash';
    }
    writeJson(path.join(userData, 'User', 'settings.json'), settings);
    writeJson(path.join(workspace, '.vscode', 'settings.json'), settings);
    const fixtures = [];
    for (const name of ['one', 'two']) {
        const prefix = path.join(workspace, name, '.venv');
        const creation = await runProcess(pythonExecutable, ['-m', 'venv', '--without-pip', prefix], {
            cwd: workspace,
            env,
        });
        if (creation.code !== 0) throw new InfrastructureError(`Fixture venv creation failed: ${creation.stderr}`);
        const executable = path.join(
            prefix,
            process.platform === 'win32' ? 'Scripts' : 'bin',
            process.platform === 'win32' ? 'python.exe' : 'python',
        );
        const fixture = await pythonProbe(executable, workspace, env);
        check(samePath(fixture.executable, executable), 'Fixture bootstrap used an unexpected Python executable');
        check(samePath(fixture.prefix, prefix), 'Fixture bootstrap did not create an isolated venv');
        fixtures.push(fixture);
    }
    return { directory, workspace, userData, home, extensions, env, fixtures };
}

async function runPhase(plan, profile, core, environments, phase, vscodeExecutablePath, persisted) {
    const record = { mode: profile.mode, phase, status: 'infrastructure-error' };
    const phaseDirectory = path.join(profile.directory, phase);
    fs.mkdirSync(phaseDirectory);
    const coreLocation = path.join(profile.extensions, core.id);
    const environmentLocation = path.join(profile.extensions, environments.id);
    const stateFile = path.join(phaseDirectory, 'host-report.json');
    const caseFile = path.join(phaseDirectory, 'case.json');
    const logDirectory = path.join(profile.userData, 'logs');
    const offsets = logOffsets(logDirectory);
    writeJson(caseFile, {
        mode: profile.mode,
        phase,
        workspace: profile.workspace,
        stateFile,
        core: { id: core.id, version: core.version, location: coreLocation },
        environments: { id: environments.id, version: environments.version, location: environmentLocation },
        fixtures: profile.fixtures,
        persisted,
        vscodeVersion: plan.vscodeVersion,
        nonce: crypto.randomBytes(16).toString('hex'),
        vscodeExecutablePath,
        userData: profile.userData,
        extensions: profile.extensions,
    });
    try {
        const result = await runProcess(process.execPath, [__filename, '--worker', caseFile], {
            cwd: phaseDirectory,
            env: profile.env,
            timeout: HOST_TIMEOUT,
            log: path.join(phaseDirectory, 'process.log'),
        });
        record.process = { pid: result.pid, exitCode: result.code, signal: result.signal, cleanup: result.cleanup };
        if (fs.existsSync(stateFile)) record.host = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        if (record.host?.status === 'failed') throw new CheckFailure(record.host.error.message);
        if (record.host?.status === 'infrastructure-error') throw new InfrastructureError(record.host.error.message);
        if (result.code !== 0 || record.host?.status !== 'passed') {
            throw new InfrastructureError(`Extension host did not complete successfully; see ${phaseDirectory}`);
        }
        record.logs = observeLogs(logDirectory, offsets);
        const component = profile.mode ? 'environments' : 'core';
        const starts = record.logs.starts.filter((start) => start.component === component);
        check(starts.length > 0, `No runtime ${component} PET startup evidence was captured`);
        const supplier = profile.mode && environments.pet ? environments : core;
        const location = supplier === core ? coreLocation : environmentLocation;
        const expected = {
            path: path.join(location, ...supplier.pet.relativePath.split('/')),
            sha256: supplier.pet.sha256,
        };
        record.pet = { supplier: supplier.id, expected, observations: [] };
        for (const start of starts) {
            check(samePath(expected.path, start.path), 'Runtime PET selected an unexpected location');
            check(fs.existsSync(start.path), 'The runtime-selected PET binary is missing');
            const actual = { ...start, sha256: await hashFile(start.path) };
            verifyPetIdentity(expected, actual);
            record.pet.observations.push(actual);
        }
        try {
            const info = await runProcess(expected.path, ['--version'], {
                cwd: phaseDirectory,
                env: profile.env,
                timeout: 10000,
            });
            record.pet.info = {
                status: info.code === 0 ? 'observed' : 'unavailable',
                command: '--version',
                exitCode: info.code,
                stdout: info.stdout,
                stderr: info.stderr,
            };
        } catch (infoError) {
            record.pet.info = { status: 'unavailable', command: '--version', error: errorRecord(infoError) };
        }
        await verifyInstalledFiles(core, coreLocation);
        await verifyInstalledFiles(environments, environmentLocation);
        record.status = 'passed';
    } catch (error) {
        record.status = error.status ?? 'infrastructure-error';
        record.error = errorRecord(error);
        if (!record.logs) {
            try {
                record.logs = observeLogs(logDirectory, offsets);
            } catch (logError) {
                record.logCaptureError = errorRecord(logError);
            }
        }
    }
    writeJson(path.join(phaseDirectory, 'result.json'), record);
    return record;
}

async function worker(caseFile) {
    const testCase = JSON.parse(fs.readFileSync(caseFile, 'utf8'));
    const { runTests } = require('@vscode/test-electron');
    await runTests({
        vscodeExecutablePath: testCase.vscodeExecutablePath,
        extensionDevelopmentPath: path.join(__dirname, 'controller'),
        extensionTestsPath: path.join(__dirname, 'controller', 'index.js'),
        extensionTestsEnv: { PYTHON_COMPATIBILITY_CASE: caseFile },
        launchArgs: [
            testCase.workspace,
            '--extensions-dir',
            testCase.extensions,
            '--user-data-dir',
            testCase.userData,
            '--disable-workspace-trust',
            '--skip-welcome',
            '--skip-release-notes',
            '--disable-updates',
            '--enable-proposed-api=ms-python.python',
            '--enable-proposed-api=ms-python.vscode-python-envs',
            ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
        ],
    });
}

async function run(planFile, output) {
    if (!path.isAbsolute(output) || fs.existsSync(output)) {
        throw new InfrastructureError(
            '--output must be a new absolute directory; existing evidence is never overwritten',
        );
    }
    fs.mkdirSync(output, { recursive: true });
    const reportFile = path.join(output, 'report.json');
    const report = {
        schemaVersion: 1,
        status: 'infrastructure-error',
        platform: process.platform,
        arch: process.arch,
        requestedModes: [true, false],
        cases: [],
    };
    writeJson(reportFile, report);
    try {
        if ((process.platform !== 'win32' && process.platform !== 'linux') || process.arch !== 'x64') {
            throw new InfrastructureError('This bounded compatibility runner supports Windows x64 and Linux x64 only');
        }
        const plan = validatePlan(JSON.parse(fs.readFileSync(planFile, 'utf8')), path.dirname(path.resolve(planFile)));
        report.plan = plan;
        for (const mode of [true, false]) {
            for (const phase of plan.upgradeFromEnvironments ? ['before-upgrade', 'after-upgrade'] : ['candidate']) {
                report.cases.push({
                    mode,
                    phase,
                    status: 'not-run',
                    reason: 'Input/profile/host preconditions not yet satisfied',
                });
            }
        }
        writeJson(reportFile, report);
        const core = await inspectVsix(plan.core, 'ms-python.python');
        const environments = await inspectVsix(plan.environments, 'ms-python.vscode-python-envs');
        const baseline = plan.upgradeFromEnvironments
            ? await inspectVsix(plan.upgradeFromEnvironments, 'ms-python.vscode-python-envs')
            : undefined;
        report.artifacts = { core, environments, baseline: baseline ?? null };
        const { downloadAndUnzipVSCode } = require('@vscode/test-electron');
        const vscodeExecutablePath = await downloadAndUnzipVSCode({
            version: plan.vscodeVersion,
            cachePath: path.join(output, 'vscode-cache'),
        });
        report.vscode = { requestedVersion: plan.vscodeVersion, executable: vscodeExecutablePath };
        report.vscode.extensionDevelopmentPaths = [path.join(__dirname, 'controller')];
        for (const mode of [true, false]) {
            const profile = await makeProfile(
                path.join(output, mode ? 'environments-on' : 'explicit-off'),
                mode,
                plan.pythonExecutable,
            );
            profile.mode = mode;
            await installVsix(core, path.join(profile.extensions, core.id));
            await installVsix(baseline ?? environments, path.join(profile.extensions, environments.id));
            const phase = baseline ? 'before-upgrade' : 'candidate';
            const result = await runPhase(
                plan,
                profile,
                core,
                baseline ?? environments,
                phase,
                vscodeExecutablePath,
                undefined,
            );
            report.cases[report.cases.findIndex((item) => item.mode === mode && item.phase === phase)] = result;
            if (baseline && result.status === 'passed') {
                // Only the installed product directory is replaced; workspace and profile storage survive.
                fs.rmSync(path.join(profile.extensions, environments.id), { recursive: true });
                await installVsix(environments, path.join(profile.extensions, environments.id));
                const upgraded = await runPhase(
                    plan,
                    profile,
                    core,
                    environments,
                    'after-upgrade',
                    vscodeExecutablePath,
                    profile.fixtures[1],
                );
                report.cases[
                    report.cases.findIndex((item) => item.mode === mode && item.phase === 'after-upgrade')
                ] = upgraded;
            } else if (baseline) {
                const pending = report.cases.find((item) => item.mode === mode && item.phase === 'after-upgrade');
                pending.reason = 'Baseline did not establish a verified persisted selection; upgrade was not certified';
            }
            writeJson(reportFile, report);
        }
        for (const artifact of [core, environments, ...(baseline ? [baseline] : [])]) {
            check((await hashFile(artifact.path)) === artifact.sha256, 'Input VSIX bytes changed during validation');
        }
        report.status = report.cases.some((item) => item.status === 'failed')
            ? 'failed'
            : report.cases.some((item) => item.status !== 'passed')
            ? 'infrastructure-error'
            : 'passed';
    } catch (error) {
        report.status = error.status ?? 'infrastructure-error';
        report.error = errorRecord(error);
    }
    writeJson(reportFile, report);
    return report;
}

async function main(args) {
    if (args.length === 2 && args[0] === '--worker') return worker(args[1]);
    if (args.length !== 4 || args[0] !== '--plan' || args[2] !== '--output') {
        throw new InfrastructureError('Usage: node run.js --plan <plan.json> --output <new absolute directory>');
    }
    const report = await run(path.resolve(args[1]), args[3]);
    console.log(JSON.stringify({ status: report.status, report: path.join(args[3], 'report.json') }));
    process.exitCode = report.status === 'passed' ? 0 : report.status === 'failed' ? 1 : 2;
}

if (require.main === module) {
    main(process.argv.slice(2)).catch((error) => {
        console.error(JSON.stringify(errorRecord(error)));
        process.exitCode = error.status === 'failed' ? 1 : 2;
    });
}

module.exports = { run, runProcess, observeLogs, errorRecord };
