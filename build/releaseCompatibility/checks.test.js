// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');
const {
    CheckFailure,
    InfrastructureError,
    digest,
    validatePlan,
    archivePath,
    readArchive,
    inspectVsix,
    installVsix,
    verifyInstalledFiles,
    verifyMode,
    verifyInstalledExtension,
    verifyPythonResult,
    locatorStarts,
    legacyDiscoveryLines,
    locatorBackend,
    fixtureLayout,
    profileSettings,
    verifyPetIdentity,
    observeMethod,
    childEnvironment,
} = require('./checks');
const { run, runProcess } = require('./run');
const { prepare } = require('./prepare');
const { pack } = require('./pack');
const { candidateCore, selfTest } = require('./selfTest');

const hash = 'a'.repeat(64);
const version = '2026.10.0';
let directory;

function plan() {
    return {
        schemaVersion: 1,
        candidate: 'core',
        vscodeVersion: '1.105.0',
        pythonExecutable: process.execPath,
        core: { path: 'core.vsix', version, sha256: hash },
        environments: { path: 'env.vsix', version: '1.42.0', sha256: hash, pet: 'bundled' },
    };
}

async function fixtureVsix(id = 'ms-python.python', pet = true, target = `${process.platform}-x64`) {
    const zip = new JSZip();
    const [publisher, name] = id.split('.');
    zip.file('extension/package.json', JSON.stringify({ publisher, name, version, main: './index.js' }));
    zip.file(
        'extension.vsixmanifest',
        `<PackageManifest><Metadata><Identity Id="${name}" Publisher="${publisher}" Version="${version}" TargetPlatform="${target}"/></Metadata></PackageManifest>`,
    );
    zip.file('extension/index.js', 'module.exports = {};');
    if (pet)
        zip.file(
            `extension/python-env-tools/bin/${process.platform === 'win32' ? 'pet.exe' : 'pet'}`,
            'unit-test-only PET bytes',
        );
    const data = await zip.generateAsync({ type: 'nodebuffer' });
    const file = path.join(directory, `${name}.vsix`);
    fs.writeFileSync(file, data);
    return { path: file, version, sha256: digest(data) };
}

describe('Packaged release compatibility guards', () => {
    beforeEach(() => {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'python-release-compatibility-'));
    });
    afterEach(() => {
        fs.rmSync(directory, { recursive: true });
    });

    it('accepts pinned inputs and resolves only local artifact paths', () => {
        const result = validatePlan(plan(), directory);
        assert.strictEqual(result.core.path, path.join(directory, 'core.vsix'));
        assert.strictEqual(result.core.provenance, null);
    });

    it('rejects moving VS Code inputs, missing hashes, and unexpected provenance', () => {
        const moving = plan();
        moving.vscodeVersion = 'stable';
        assert.throws(() => validatePlan(moving, directory), CheckFailure);
        const missing = plan();
        delete missing.environments.sha256;
        assert.throws(() => validatePlan(missing, directory), CheckFailure);
        const provenance = plan();
        provenance.core.provenance = { repository: 'untrusted/fork' };
        assert.throws(() => validatePlan(provenance, directory), CheckFailure);
    });

    it('requires a real bundled-PET to omitted-PET upgrade', () => {
        const value = plan();
        value.upgradeFromEnvironments = { ...value.environments };
        assert.throws(() => validatePlan(value, directory), CheckFailure);
        value.environments.pet = 'omitted';
        assert.throws(() => validatePlan(value, directory), CheckFailure);
        value.upgradeFromEnvironments.sha256 = 'b'.repeat(64);
        assert.strictEqual(validatePlan(value, directory).upgradeFromEnvironments.pet, 'bundled');
    });

    it('rejects archive traversal, Windows streams, and ambiguous separators', () => {
        for (const entry of [
            '../outside',
            'extension/../../outside',
            '/absolute',
            'C:/outside',
            'extension\\outside',
            'extension/file:stream',
            'extension/CON.txt',
            'extension/file.',
            'extension/file ',
            'extension//file',
        ]) {
            assert.throws(() => archivePath(entry), CheckFailure, entry);
        }
        assert.strictEqual(archivePath('extension/package.json'), 'extension/package.json');
    });

    it('enforces actual streamed ZIP bytes even when a data descriptor bypasses library size checks', async () => {
        const zip = new JSZip();
        zip.file('payload.bin', Buffer.alloc(65536, 65));
        const data = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
        const central = data.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
        data.writeUInt16LE(data.readUInt16LE(6) | 0x08, 6);
        data.writeUInt16LE(data.readUInt16LE(central + 8) | 0x08, central + 8);
        data.writeUInt32LE(1, 22);
        data.writeUInt32LE(1, central + 24);
        const file = path.join(directory, 'underreported.zip');
        fs.writeFileSync(file, data);
        await assert.rejects(
            readArchive(file, () => assert.fail('Oversized payload must never reach the visitor')),
            (error) => error instanceof CheckFailure && /Expanded archive/.test(error.message),
        );
    });

    it('rejects a package for the wrong target platform', async () => {
        const artifact = await fixtureVsix('ms-python.python', true, 'darwin-arm64');
        await assert.rejects(inspectVsix(artifact, 'ms-python.python'), CheckFailure);
    });

    it('checks artifact hash, manifest identity, and version rather than trusting filenames', async () => {
        const artifact = await fixtureVsix();
        await assert.rejects(inspectVsix({ ...artifact, sha256: hash }, 'ms-python.python'), CheckFailure);
        await assert.rejects(inspectVsix(artifact, 'ms-python.vscode-python-envs'), CheckFailure);
        await assert.rejects(inspectVsix({ ...artifact, version: '2026.8.0' }, 'ms-python.python'), CheckFailure);
    });

    it('uses the original candidate VSIX version and hash without replacing its bytes or PET', async () => {
        const fixture = await fixtureVsix();
        const before = fs.readFileSync(fixture.path);
        const candidate = await candidateCore(fixture.path, { buildId: '123', artifactName: 'same-run-core' });
        assert.strictEqual(candidate.version, fixture.version);
        assert.strictEqual(candidate.sha256, fixture.sha256);
        assert.notStrictEqual(
            candidate.sha256,
            require('./released-pairs.json').platforms[process.platform].coreSha256,
        );
        assert.strictEqual(candidate.provenance.channel, 'same-run-ci-built-core-candidate');
        assert.strictEqual(candidate.provenance.buildId, '123');
        assert.deepStrictEqual(fs.readFileSync(fixture.path), before);
    });

    it('fails missing, wrong-product or PET-free candidate inputs instead of substituting a released Core', async () => {
        await assert.rejects(candidateCore(path.join(directory, 'missing.vsix')), InfrastructureError);
        const wrong = await fixtureVsix('ms-python.vscode-python-envs');
        await assert.rejects(candidateCore(wrong.path), CheckFailure);
        const missingPet = await fixtureVsix('ms-python.python', false);
        await assert.rejects(candidateCore(missingPet.path), CheckFailure);
    });

    it('does not turn an explicitly empty candidate input into the frozen released-pair self-test', async () => {
        const output = path.join(directory, 'empty-candidate');
        const report = await selfTest(output, process.execPath, '');
        assert.strictEqual(report.scope, 'ci-built-candidate-core-compatibility');
        assert.strictEqual(report.status, 'infrastructure-error');
        assert.match(report.error.message, /Original candidate Core VSIX is missing/);
        assert(!fs.existsSync(path.join(output, 'plan.json')));
    });

    it('distinguishes a missing artifact from a missing packaged PET', async () => {
        await assert.rejects(
            inspectVsix({ path: path.join(directory, 'missing.vsix'), sha256: hash }, 'ms-python.python'),
            InfrastructureError,
        );
        const missing = await fixtureVsix('ms-python.python', false);
        await assert.rejects(inspectVsix(missing, 'ms-python.python'), CheckFailure);
        const bundled = await fixtureVsix('ms-python.vscode-python-envs');
        await assert.rejects(inspectVsix({ ...bundled, pet: 'omitted' }, 'ms-python.vscode-python-envs'), CheckFailure);
    });

    it('accepts genuine archive omission without injecting a binary', async () => {
        const artifact = await fixtureVsix('ms-python.vscode-python-envs', false);
        const inspected = await inspectVsix({ ...artifact, pet: 'omitted' }, 'ms-python.vscode-python-envs');
        const installed = path.join(directory, 'installed');
        await installVsix(inspected, installed);
        assert.strictEqual(inspected.pet, null);
        assert(!fs.existsSync(path.join(installed, 'python-env-tools', 'bin')));
    });

    it('detects installed package mutation after extraction', async () => {
        const inspected = await inspectVsix(await fixtureVsix(), 'ms-python.python');
        const installed = path.join(directory, 'installed');
        await installVsix(inspected, installed);
        fs.writeFileSync(path.join(installed, 'index.js'), 'changed');
        await assert.rejects(verifyInstalledFiles(inspected, installed), CheckFailure);
    });

    it('rejects incorrect mode and does not treat explicit false as absence', () => {
        verifyMode(false, false, false);
        assert.throws(() => verifyMode(false, true, false), CheckFailure);
        assert.throws(() => verifyMode(false, false, undefined), CheckFailure);
        assert.throws(() => verifyMode(true, false, true), CheckFailure);
    });

    it('proves installed product locations without inventing a public Extension.extensionMode field', () => {
        const location = path.join(directory, 'installed', 'core');
        const development = path.join(directory, 'controller');
        const expected = { id: 'ms-python.python', location, version };
        const actual = { id: expected.id, extensionPath: location, packageJSON: { version } };
        verifyInstalledExtension(expected, actual, development);
        assert.throws(
            () => verifyInstalledExtension(expected, { ...actual, extensionPath: development }, development),
            CheckFailure,
        );
        assert.throws(
            () => verifyInstalledExtension(expected, { ...actual, packageJSON: { version: '2026.8.0' } }, development),
            CheckFailure,
        );
    });

    it('checks actual executable, prefix, and per-run nonce', () => {
        const expected = { executable: 'C:\\fixture\\.venv\\Scripts\\python.exe', prefix: 'C:\\fixture\\.venv' };
        verifyPythonResult(expected, { ...expected, nonce: 'current' }, 'current', 'win32');
        verifyPythonResult(
            expected,
            { executable: expected.executable.toUpperCase(), prefix: expected.prefix, nonce: 'current' },
            'current',
            'win32',
        );
        assert.throws(
            () =>
                verifyPythonResult(
                    expected,
                    { executable: 'C:\\global\\python.exe', prefix: expected.prefix, nonce: 'current' },
                    'current',
                    'win32',
                ),
            CheckFailure,
        );
        assert.throws(
            () =>
                verifyPythonResult(
                    expected,
                    { executable: expected.executable, prefix: 'C:\\global', nonce: 'current' },
                    'current',
                    'win32',
                ),
            CheckFailure,
        );
        assert.throws(
            () => verifyPythonResult(expected, { ...expected, nonce: 'stale' }, 'current', 'win32'),
            CheckFailure,
        );
    });

    it('uses actual startup logs and rejects wrong runtime supplier or hash', () => {
        const text =
            '[info] [pet] Starting Python Locator C:\\installed\\core\\python-env-tools\\bin\\pet.exe server\n' +
            '[info] Starting Python Locator C:\\installed\\core\\python-env-tools\\bin\\pet.exe server';
        const starts = locatorStarts(text, 'locator.log');
        assert.deepStrictEqual(
            starts.map((item) => item.component),
            ['environments', 'core'],
        );
        const expected = { path: starts[0].path, sha256: hash };
        verifyPetIdentity(expected, { path: starts[0].path, sha256: hash }, 'win32');
        assert.throws(
            () => verifyPetIdentity(expected, { path: 'C:\\locally-built\\pet.exe', sha256: hash }, 'win32'),
            CheckFailure,
        );
        assert.throws(
            () => verifyPetIdentity(expected, { path: starts[0].path, sha256: 'b'.repeat(64) }, 'win32'),
            CheckFailure,
        );
        assert.deepStrictEqual(locatorStarts('a package contains pet.exe, but no locator started', 'empty.log'), []);
    });

    it('keeps fixture interpreters within the legacy workspace locator two-directory search depth', () => {
        const layout = fixtureLayout(directory);
        assert.strictEqual(layout.prefixes.length, 2);
        for (const prefix of layout.prefixes) {
            assert.strictEqual(path.dirname(prefix), directory);
            const relative = path.relative(directory, path.join(prefix, 'bin', 'python'));
            assert.strictEqual(relative.split(path.sep).length - 1, 2);
        }
        assert.deepStrictEqual(layout.searchPaths, ['./.venv-one', './.venv-two']);
    });

    it('sets workspace-only search paths only in workspace settings while preserving explicit global opt-out', () => {
        const layout = fixtureLayout(directory);
        const settings = profileSettings(false, layout);
        assert.strictEqual(settings.user['python.useEnvironmentsExtension'], false);
        assert.strictEqual(settings.workspace['python.useEnvironmentsExtension'], false);
        assert.strictEqual(settings.user['python-envs.workspaceSearchPaths'], undefined);
        assert.deepStrictEqual(settings.workspace['python-envs.workspaceSearchPaths'], layout.searchPaths);
        assert.strictEqual(settings.workspace['extensions.autoUpdate'], undefined);
    });

    it('accepts positively observed legacy JS discovery only for off mode, without fabricating PET identity', () => {
        const legacy = legacyDiscoveryLines(
            '[info] Searching for custom virtual environments',
            '/logs/ms-python.python/Python.log',
        );
        assert.strictEqual(locatorBackend(false, [], legacy).kind, 'legacy-javascript');
        assert.throws(() => locatorBackend(true, [], legacy), CheckFailure);
        assert.throws(() => locatorBackend(false, [], []), CheckFailure);
        assert.throws(() => locatorBackend(false, [{ component: 'environments' }], legacy), CheckFailure);
        assert.strictEqual(locatorBackend(false, [{ component: 'core' }], legacy).kind, 'pet');
        assert.deepStrictEqual(
            legacyDiscoveryLines('[info] Searching for custom virtual environments', '/other/Python.log'),
            [],
        );
    });

    it('observes delegation without changing the result, receiver, or thrown error', () => {
        const result = {};
        const api = {
            value: result,
            runInTerminal() {
                return this.value;
            },
        };
        const original = api.runInTerminal;
        const observation = observeMethod(api, 'runInTerminal');
        assert.strictEqual(api.runInTerminal('argument'), result);
        assert.deepStrictEqual(observation.calls, [['argument']]);
        observation.restore();
        assert.strictEqual(api.runInTerminal, original);
        const error = new Error('original failure');
        const failing = {
            runInTerminal() {
                throw error;
            },
        };
        const failedObservation = observeMethod(failing, 'runInTerminal');
        assert.throws(
            () => failing.runInTerminal(),
            (actual) => actual === error,
        );
        failedObservation.restore();
    });

    it('fails observability explicitly for an immutable API', () => {
        assert.throws(() => observeMethod(Object.freeze({ runInTerminal() {} }), 'runInTerminal'), InfrastructureError);
    });

    it('shadows a class prototype method without mutating its prototype and deletes the shadow on restoration', () => {
        class Api {
            runInTerminal(value) {
                return { receiver: this, value };
            }
        }
        class InheritedApi extends Api {}
        const api = new InheritedApi();
        const original = Api.prototype.runInTerminal;
        const before = Object.getOwnPropertyNames(api);
        const observation = observeMethod(api, 'runInTerminal');
        assert(Object.prototype.hasOwnProperty.call(api, 'runInTerminal'));
        assert.strictEqual(Api.prototype.runInTerminal, original);
        const result = api.runInTerminal('argument');
        assert.strictEqual(result.receiver, api);
        assert.strictEqual(result.value, 'argument');
        observation.restore();
        assert.strictEqual(api.runInTerminal, original);
        assert.deepStrictEqual(Object.getOwnPropertyNames(api), before);
        assert.strictEqual(Api.prototype.runInTerminal, original);
        assert.throws(() => observeMethod(Object.preventExtensions(new Api()), 'runInTerminal'), InfrastructureError);
    });

    it('does not pass credentials, Python overrides, or developer test flags to candidates', () => {
        const env = childEnvironment(
            {
                PATH: 'allowed',
                SYSTEM_ACCESSTOKEN: 'secret',
                GITHUB_TOKEN: 'secret',
                VSCE_PAT: 'secret',
                NODE_OPTIONS: '--require developer-hook',
                PYTHONPATH: 'developer-path',
                VSC_PYTHON_SMOKE_TEST: '1',
            },
            directory,
        );
        assert.strictEqual(env.PATH, 'allowed');
        for (const key of [
            'SYSTEM_ACCESSTOKEN',
            'GITHUB_TOKEN',
            'VSCE_PAT',
            'NODE_OPTIONS',
            'PYTHONPATH',
            'VSC_PYTHON_SMOKE_TEST',
        ]) {
            assert.strictEqual(env[key], undefined, key);
        }
        assert.strictEqual(env.USERPROFILE, directory);
        assert.strictEqual(env.HOME, directory);
    });

    it('retains explicit infrastructure status instead of skipping a missing input', async () => {
        const file = path.join(directory, 'plan.json');
        fs.writeFileSync(file, JSON.stringify(plan()));
        const output = path.join(directory, 'evidence');
        const result = await run(file, output);
        assert.strictEqual(result.status, 'infrastructure-error');
        assert.match(result.error.message, /Required VSIX/);
        assert.strictEqual(JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8')).status, result.status);
    });

    it('never overwrites earlier evidence', async () => {
        const evidence = path.join(directory, 'report.json');
        fs.writeFileSync(evidence, 'previous evidence');
        await assert.rejects(run('missing-plan.json', directory), InfrastructureError);
        assert.strictEqual(fs.readFileSync(evidence, 'utf8'), 'previous evidence');
    });

    it('prepares one fixed partner set without resolving any latest artifact', async () => {
        const core = await fixtureVsix();
        const env = await fixtureVsix('ms-python.vscode-python-envs');
        const zip = new JSZip();
        zip.file('env.vsix', fs.readFileSync(env.path));
        zip.file(
            'inputs.json',
            JSON.stringify({
                schemaVersion: 1,
                vscodeVersion: '1.105.0',
                environments: { ...env, path: 'env.vsix', pet: 'bundled' },
            }),
        );
        const data = await zip.generateAsync({ type: 'nodebuffer' });
        const inputs = path.join(directory, 'inputs.zip');
        fs.writeFileSync(inputs, data);
        const output = path.join(directory, 'prepared');
        const result = await prepare([
            '--inputs',
            inputs,
            '--inputs-sha256',
            digest(data),
            '--candidate',
            core.path,
            '--candidate-sha256',
            core.sha256,
            '--candidate-version',
            core.version,
            '--python',
            process.execPath,
            '--output',
            output,
        ]);
        assert.strictEqual(result.status, 'inputs-prepared');
        const prepared = JSON.parse(fs.readFileSync(result.plan, 'utf8'));
        assert.strictEqual(prepared.core.sha256, core.sha256);
        assert.strictEqual(prepared.environments.sha256, env.sha256);
        assert.strictEqual(prepared.environments.path, path.join(output, 'inputs', 'env.vsix'));
    });

    it('retains a failed preparation report for bad pinned input provenance', async () => {
        const inputs = path.join(directory, 'inputs.zip');
        fs.writeFileSync(inputs, 'not the pinned archive');
        const output = path.join(directory, 'prepared');
        await assert.rejects(
            prepare([
                '--inputs',
                inputs,
                '--inputs-sha256',
                hash,
                '--candidate',
                path.join(directory, 'core.vsix'),
                '--candidate-sha256',
                hash,
                '--candidate-version',
                version,
                '--python',
                process.execPath,
                '--output',
                output,
            ]),
            CheckFailure,
        );
        const report = JSON.parse(fs.readFileSync(path.join(output, 'adapter-report.json'), 'utf8'));
        assert.strictEqual(report.status, 'failed');
        assert.match(report.error.message, /inputs ZIP changed/);
    });

    it('retains preparation failures for companion paths outside the checked input archive', async () => {
        const zip = new JSZip();
        zip.file(
            'inputs.json',
            JSON.stringify({
                schemaVersion: 1,
                vscodeVersion: '1.105.0',
                environments: { path: '../outside.vsix', version: '1.42.0', sha256: hash, pet: 'bundled' },
            }),
        );
        const data = await zip.generateAsync({ type: 'nodebuffer' });
        const inputs = path.join(directory, 'inputs.zip');
        fs.writeFileSync(inputs, data);
        const output = path.join(directory, 'prepared');
        await assert.rejects(
            prepare([
                '--inputs',
                inputs,
                '--inputs-sha256',
                digest(data),
                '--candidate',
                path.join(directory, 'core.vsix'),
                '--candidate-sha256',
                hash,
                '--candidate-version',
                version,
                '--python',
                process.execPath,
                '--output',
                output,
            ]),
            CheckFailure,
        );
        const report = JSON.parse(fs.readFileSync(path.join(output, 'adapter-report.json'), 'utf8'));
        assert.strictEqual(report.status, 'failed');
        assert.match(report.error.message, /escaped/);
    });

    it('packages a standalone root runner, controller and locked dependency tree', async function () {
        this.timeout(60000);
        const output = path.join(directory, 'harness.zip');
        const result = await pack(output);
        const data = fs.readFileSync(output);
        assert.strictEqual(result.sha256, digest(data));
        const zip = await JSZip.loadAsync(data);
        for (const file of [
            'run.js',
            'checks.js',
            'process.ps1',
            'controller/index.js',
            'controller/package.json',
            'node_modules/@vscode/test-electron/out/runTest.js',
            'node_modules/node-stream-zip/node_stream_zip.js',
            'node_modules/xml2js/lib/xml2js.js',
            'node_modules/jszip/node_modules/readable-stream/node_modules/string_decoder/package.json',
            'repository-package-lock.json',
        ]) {
            assert(zip.file(file), file);
        }
        const manifest = JSON.parse(await zip.file('harness-manifest.json').async('string'));
        assert.strictEqual(manifest.schemaVersion, 1);
        for (const file of manifest.files) {
            assert.strictEqual(digest(await zip.file(file.path).async('nodebuffer')), file.sha256, file.path);
        }
    });

    it('records process errors and bounds only its own child process', async function () {
        this.timeout(30000);
        const result = await runProcess(process.execPath, ['-e', 'process.stdout.write("result"); process.exit(3)'], {
            cwd: directory,
            env: process.env,
            timeout: process.platform === 'win32' ? 15000 : 3000,
        });
        assert.strictEqual(result.code, 3);
        assert.strictEqual(result.stdout, 'result');
        await assert.rejects(
            runProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
                cwd: directory,
                env: process.env,
                timeout: 100,
            }),
            InfrastructureError,
        );
    });

    it('contains grandchildren holding pipes after their direct parent exits', async function () {
        this.timeout(30000);
        const log = path.join(directory, 'grandchild.log');
        const started = Date.now();
        const command =
            process.platform === 'win32'
                ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
                : process.execPath;
        const args =
            process.platform === 'win32'
                ? [
                      '-NoProfile',
                      '-NonInteractive',
                      '-Command',
                      [
                          '$info = New-Object System.Diagnostics.ProcessStartInfo',
                          `$info.FileName = '${process.execPath.replace(/'/g, "''")}'`,
                          '$info.Arguments = \'-e "setInterval(() => {}, 1000)"\'',
                          '$info.UseShellExecute = $false',
                          '$info.CreateNoWindow = $true',
                          '$child = [System.Diagnostics.Process]::Start($info)',
                          'Write-Output "OWNED_$($child.Id)"',
                          'exit 0',
                      ].join('; '),
                  ]
                : [
                      '-e',
                      [
                          'const child = require("child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {stdio: "inherit"});',
                          'console.log("OWNED_" + child.pid);',
                          'child.unref();',
                          'setTimeout(() => process.exit(0), 50);',
                      ].join('\n'),
                  ];
        const timeout = process.platform === 'win32' ? 15000 : 3000;
        await assert.rejects(
            runProcess(command, args, { cwd: directory, env: process.env, timeout, log }),
            InfrastructureError,
        );
        assert(Date.now() - started < timeout + 6000, 'Cleanup must settle within its deadline');
        const match = /OWNED_(\d+)/.exec(fs.readFileSync(log, 'utf8'));
        assert(match, 'The test must actually start the grandchild before timing out');
        const pid = Number(match[1]);
        let alive = true;
        const deadline = Date.now() + 2000;
        while (alive && Date.now() < deadline) {
            try {
                process.kill(pid, 0);
                if (process.platform === 'linux') {
                    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
                    alive = !/\) Z /.test(stat);
                }
            } catch (error) {
                if (error.code !== 'ESRCH' && error.code !== 'ENOENT') throw error;
                alive = false;
            }
            if (alive) await new Promise((resolve) => setTimeout(resolve, 50));
        }
        assert(!alive, 'An owned grandchild must not remain running after timeout cleanup');
    });

    it('completes normal Linux shutdown before accepting a root with redirected-stdio descendants', async function () {
        if (process.platform !== 'linux') this.skip();
        this.timeout(10000);
        const result = await runProcess(
            process.execPath,
            [
                '-e',
                [
                    'const child = require("child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {stdio: "ignore"});',
                    'console.log(child.pid);',
                    'child.unref();',
                    'setTimeout(() => process.exit(0), 50);',
                ].join('\n'),
            ],
            { cwd: directory, env: process.env, timeout: 3000 },
        );
        assert.strictEqual(result.code, 0);
        assert.strictEqual(result.cleanup.forcedDescendantCleanup, true);
        const pid = Number(result.stdout.trim());
        assert(result.cleanup.members.includes(pid));
        try {
            const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
            assert(/\) [ZX] /.test(stat), 'Owned redirected-stdio descendant must not still run');
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
    });
});
