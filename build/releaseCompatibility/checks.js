// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class CheckFailure extends Error {
    constructor(message) {
        super(message);
        this.name = 'CheckFailure';
        this.status = 'failed';
    }
}

class InfrastructureError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InfrastructureError';
        this.status = 'infrastructure-error';
    }
}

function check(condition, message) {
    if (!condition) {
        throw new CheckFailure(message);
    }
}

function object(value, label) {
    check(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function keys(value, allowed, label) {
    object(value, label);
    check(
        Object.keys(value).every((key) => allowed.includes(key)),
        `${label} contains an unknown field`,
    );
}

function digest(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

async function hashFile(file) {
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(file)) {
        hash.update(chunk);
    }
    return hash.digest('hex');
}

function validateHash(value, label) {
    check(typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value), `${label} must be an exact SHA-256`);
    return value.toLowerCase();
}

function normalizedPath(value, platform = process.platform) {
    const paths = platform === 'win32' ? path.win32 : path.posix;
    check(typeof value === 'string' && paths.isAbsolute(value), `Expected an absolute path, got ${value}`);
    const result = paths.normalize(value);
    return platform === 'win32' ? result.toLowerCase() : result;
}

function samePath(first, second, platform = process.platform) {
    return normalizedPath(first, platform) === normalizedPath(second, platform);
}

function within(parent, child) {
    const relative = path.relative(parent, child);
    return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function validateArtifact(value, name, directory) {
    keys(value, ['path', 'sha256', 'version', 'pet', 'provenance'], name);
    check(
        typeof value.path === 'string' && value.path.length > 0 && !value.path.includes('\0'),
        `${name}.path is required`,
    );
    check(/\.vsix$/i.test(value.path), `${name}.path must identify a VSIX`);
    check(
        typeof value.version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value.version),
        `${name}.version must be an exact extension version`,
    );
    if (value.provenance !== undefined) {
        object(value.provenance, `${name}.provenance`);
        const repository = name === 'core' ? 'microsoft/vscode-python' : 'microsoft/vscode-python-environments';
        check(
            value.provenance.repository === undefined ||
                value.provenance.repository === null ||
                value.provenance.repository === repository,
            `${name} has unexpected repository provenance`,
        );
    }
    return {
        ...value,
        path: path.resolve(directory, value.path),
        sha256: validateHash(value.sha256, `${name}.sha256`),
        provenance: value.provenance ?? null,
    };
}

function validatePlan(value, directory) {
    keys(
        value,
        [
            'schemaVersion',
            'candidate',
            'vscodeVersion',
            'pythonExecutable',
            'core',
            'environments',
            'upgradeFromEnvironments',
        ],
        'plan',
    );
    check(value.schemaVersion === 1, 'Unsupported plan schemaVersion');
    check(value.candidate === 'core' || value.candidate === 'environments', 'candidate must be core or environments');
    check(
        typeof value.vscodeVersion === 'string' && /^\d+\.\d+\.\d+$/.test(value.vscodeVersion),
        'vscodeVersion must pin one stable VS Code version, not latest or stable',
    );
    check(
        typeof value.pythonExecutable === 'string' && path.isAbsolute(value.pythonExecutable),
        'pythonExecutable must be an absolute executable path',
    );
    const core = validateArtifact(value.core, 'core', directory);
    const environments = validateArtifact(value.environments, 'environments', directory);
    check(core.pet === undefined || core.pet === 'bundled', 'Core must supply its packaged PET');
    check(
        environments.pet === 'bundled' || environments.pet === 'omitted',
        'environments.pet must be bundled or omitted',
    );
    let upgradeFromEnvironments;
    if (value.upgradeFromEnvironments !== undefined) {
        upgradeFromEnvironments = validateArtifact(value.upgradeFromEnvironments, 'upgradeFromEnvironments', directory);
        check(upgradeFromEnvironments.pet === 'bundled', 'The upgrade baseline must contain its own PET');
        check(environments.pet === 'omitted', 'The cutover upgrade must end with the PET-omitting package');
        check(
            upgradeFromEnvironments.sha256 !== environments.sha256,
            'The upgrade baseline and candidate must be different artifacts',
        );
    }
    return { ...value, core, environments, upgradeFromEnvironments };
}

function archivePath(name) {
    const parts = typeof name === 'string' ? name.replace(/\/$/, '').split('/') : [];
    check(
        typeof name === 'string' &&
            name.length > 0 &&
            !name.includes('\\') &&
            !name.includes(':') &&
            !name.includes('\0') &&
            !name.startsWith('/') &&
            parts.every(
                (part) =>
                    part.length > 0 &&
                    part !== '..' &&
                    part !== '.' &&
                    !/[<>:"|?*\x00-\x1f]/.test(part) &&
                    !/[. ]$/.test(part) &&
                    !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(part),
            ),
        `Unsafe archive entry: ${name}`,
    );
    return name;
}

async function readArchive(file, visit) {
    const StreamZip = require('node-stream-zip');
    const zip = new StreamZip.async({ file });
    try {
        const entries = Object.values(await zip.entries());
        check(entries.length === (await zip.entriesCount), 'Archive contains duplicate central-directory entries');
        check(entries.length <= 100000, 'Archive contains too many entries');
        const names = new Set();
        let size = 0;
        let expanded = 0;
        for (const entry of entries) {
            archivePath(entry.name);
            const name = entry.name.toLowerCase();
            check(!names.has(name), `Duplicate archive entry: ${entry.name}`);
            names.add(name);
            check((entry.flags & 1) === 0, `Encrypted archive entry is not supported: ${entry.name}`);
            check(entry.method === 0 || entry.method === 8, `Unsupported archive compression: ${entry.name}`);
            check(((entry.attr >>> 16) & 0o170000) !== 0o120000, `Archive symlinks are not supported: ${entry.name}`);
            size += entry.size;
            check(entry.size <= 256 * 1024 * 1024 && size <= 1024 * 1024 * 1024, 'Archive exceeds extraction bounds');
            if (!entry.isDirectory) {
                const stream = await zip.stream(entry.name);
                const chunks = [];
                let length = 0;
                try {
                    for await (const chunk of stream) {
                        length += chunk.length;
                        expanded += chunk.length;
                        check(
                            length <= entry.size && length <= 256 * 1024 * 1024 && expanded <= 1024 * 1024 * 1024,
                            'Expanded archive exceeds declared size or extraction bounds',
                        );
                        chunks.push(chunk);
                    }
                    check(length === entry.size, `Archive entry size differs from expanded bytes: ${entry.name}`);
                    await visit(entry, Buffer.concat(chunks, length));
                } finally {
                    stream.destroy();
                }
            }
        }
    } finally {
        await zip.close();
    }
}

async function inspectVsix(artifact, id, platform = process.platform) {
    if (!fs.existsSync(artifact.path)) {
        throw new InfrastructureError(`Required VSIX does not exist: ${artifact.path}`);
    }
    check((await hashFile(artifact.path)) === artifact.sha256, `VSIX SHA-256 mismatch: ${artifact.path}`);
    const files = Object.create(null);
    let manifest;
    let vsixManifest;
    await readArchive(artifact.path, (entry, data) => {
        if (entry.name === 'extension/package.json') {
            manifest = JSON.parse(data.toString('utf8'));
        }
        if (entry.name === 'extension.vsixmanifest') {
            vsixManifest = data.toString('utf8');
        }
        if (entry.name.startsWith('extension/')) {
            files[entry.name.slice('extension/'.length)] = {
                sha256: digest(data),
                size: data.length,
                mode: (entry.attr >>> 16) & 0o777,
            };
        }
    });
    check(manifest && `${manifest.publisher}.${manifest.name}` === id, `Wrong extension identity in ${artifact.path}`);
    check(manifest.version === artifact.version, `Wrong extension version in ${artifact.path}`);
    check(vsixManifest, `VSIX manifest is missing: ${artifact.path}`);
    const { parseStringPromise } = require('xml2js');
    const xml = await parseStringPromise(vsixManifest, { explicitArray: false });
    const identity = xml.PackageManifest?.Metadata?.Identity?.$;
    check(
        identity?.Id === manifest.name &&
            identity?.Publisher === manifest.publisher &&
            identity?.Version === manifest.version,
        `VSIX and package manifests disagree: ${artifact.path}`,
    );
    check(identity.TargetPlatform === `${platform}-x64`, `VSIX does not target ${platform}-x64: ${artifact.path}`);
    const petPath = `python-env-tools/bin/${platform === 'win32' ? 'pet.exe' : 'pet'}`;
    const bundled = files[petPath] !== undefined;
    check(bundled === (artifact.pet !== 'omitted'), `Unexpected PET package contents in ${artifact.path}`);
    return {
        ...artifact,
        id,
        manifest: {
            publisher: manifest.publisher,
            name: manifest.name,
            version: manifest.version,
            engines: manifest.engines,
            targetPlatform: identity.TargetPlatform,
        },
        files,
        pet: bundled ? { relativePath: petPath, sha256: files[petPath].sha256 } : null,
    };
}

async function extractArchive(file, directory, prefix = '') {
    check(!fs.existsSync(directory), `Extraction directory already exists: ${directory}`);
    await fs.promises.mkdir(directory, { recursive: true });
    await readArchive(file, async (entry, data) => {
        if (entry.name.startsWith(prefix)) {
            const relative = entry.name.slice(prefix.length);
            const destination = path.resolve(directory, ...relative.split('/'));
            check(within(directory, destination), `Entry escapes extraction directory: ${entry.name}`);
            await fs.promises.mkdir(path.dirname(destination), { recursive: true });
            const mode = (entry.attr >>> 16) & 0o777;
            await fs.promises.writeFile(destination, data, { flag: 'wx', mode: mode || 0o644 });
        }
    });
}

async function installVsix(artifact, directory) {
    check((await hashFile(artifact.path)) === artifact.sha256, 'VSIX changed after inspection');
    await extractArchive(artifact.path, directory, 'extension/');
    if (artifact.pet && process.platform !== 'win32') {
        await fs.promises.chmod(path.join(directory, ...artifact.pet.relativePath.split('/')), 0o755);
    }
    await verifyInstalledFiles(artifact, directory);
}

async function verifyInstalledFiles(artifact, directory) {
    for (const [relative, expected] of Object.entries(artifact.files)) {
        const file = path.join(directory, ...relative.split('/'));
        check(fs.existsSync(file), `Installed package file is missing: ${file}`);
        check((await hashFile(file)) === expected.sha256, `Installed package file changed: ${file}`);
    }
}

function verifyMode(requested, effective, explicit) {
    check(typeof requested === 'boolean', 'Requested mode must be a boolean');
    check(effective === requested && explicit === requested, 'Requested, effective, and explicit global modes differ');
}

function verifyInstalledExtension(expected, actual, developmentRoot) {
    check(actual, `Required installed extension is missing: ${expected.id}`);
    check(actual.id === expected.id, `Unexpected loaded extension identity: ${actual.id}`);
    check(samePath(actual.extensionPath, expected.location), `${expected.id} loaded from an unexpected directory`);
    check(
        !samePath(developmentRoot, actual.extensionPath) && !within(developmentRoot, actual.extensionPath),
        `${expected.id} is under the controller development path`,
    );
    check(actual.packageJSON?.version === expected.version, `${expected.id} loaded the wrong version`);
}

function verifyPythonResult(expected, actual, nonce, platform = process.platform) {
    object(actual, 'Python execution result');
    check(actual.nonce === nonce, 'Execution result is stale or belongs to another run');
    check(samePath(expected.executable, actual.executable, platform), 'Core executed the wrong Python executable');
    check(samePath(expected.prefix, actual.prefix, platform), 'Core executed Python with the wrong sys.prefix');
}

function locatorStarts(text, logFile) {
    const result = [];
    for (const line of text.split(/\r?\n/)) {
        const match = /(?:\[pet\]\s*)?Starting Python Locator (.+) server\s*$/.exec(line);
        if (match) {
            result.push({ path: match[1], component: line.includes('[pet]') ? 'environments' : 'core', logFile, line });
        }
    }
    return result;
}

function legacyDiscoveryLines(text, logFile) {
    if (!logFile.replace(/\\/g, '/').endsWith('/ms-python.python/Python.log')) return [];
    return text
        .split(/\r?\n/)
        .filter((line) =>
            /Searching for (interpreters in .+ locator|pyenv environments|conda environments|global virtual environments|custom virtual environments)/i.test(
                line,
            ),
        )
        .map((line) => ({ logFile, line }));
}

function locatorBackend(mode, starts, legacy) {
    if (!mode) {
        check(
            !starts.some((item) => item.component === 'environments'),
            'Environments started PET despite explicit opt-out',
        );
    }
    const component = mode ? 'environments' : 'core';
    const selected = starts.filter((item) => item.component === component);
    if (selected.length > 0) return { kind: 'pet', starts: selected };
    check(!mode && legacy.length > 0, `No positive runtime ${component} discovery-backend evidence was captured`);
    return { kind: 'legacy-javascript', evidence: legacy };
}

function fixtureLayout(workspace) {
    const names = ['.venv-one', '.venv-two'];
    return { prefixes: names.map((name) => path.join(workspace, name)), searchPaths: names.map((name) => `./${name}`) };
}

function profileSettings(mode, layout) {
    return {
        user: {
            'python.useEnvironmentsExtension': mode,
            'python.languageServer': 'None',
            'python.terminal.executeInFileDir': true,
            'python.terminal.focusAfterLaunch': false,
            'extensions.autoUpdate': false,
            'extensions.autoCheckUpdates': false,
            'update.mode': 'none',
            'telemetry.telemetryLevel': 'off',
            'terminal.integrated.enablePersistentSessions': false,
        },
        workspace: {
            'python.useEnvironmentsExtension': mode,
            'python-envs.workspaceSearchPaths': layout.searchPaths,
        },
    };
}

function verifyPetIdentity(expected, actual, platform = process.platform) {
    check(samePath(expected.path, actual.path, platform), 'Runtime PET came from an unexpected supplier or location');
    check(expected.sha256 === actual.sha256, 'Runtime PET differs from the final VSIX binary');
}

function observeMethod(api, name) {
    const own = Object.getOwnPropertyDescriptor(api, name);
    let owner = api;
    let descriptor;
    while (owner && !descriptor) {
        descriptor = Object.getOwnPropertyDescriptor(owner, name);
        owner = Object.getPrototypeOf(owner);
    }
    if (
        !descriptor ||
        typeof descriptor.value !== 'function' ||
        !descriptor.writable ||
        (!own && !Object.isExtensible(api))
    ) {
        throw new InfrastructureError(`Cannot observe the supported API method ${name} without changing its contract`);
    }
    const calls = [];
    Object.defineProperty(api, name, {
        ...(own ?? { writable: true, configurable: true, enumerable: descriptor.enumerable }),
        value: function (...args) {
            calls.push(args);
            return Reflect.apply(descriptor.value, this, args);
        },
    });
    return {
        calls,
        restore: () => {
            if (own) Object.defineProperty(api, name, own);
            else if (!Reflect.deleteProperty(api, name)) {
                throw new InfrastructureError(`Cannot restore the observed API method ${name}`);
            }
        },
    };
}

function childEnvironment(parent, home) {
    const result = {};
    for (const key of [
        'PATH',
        'Path',
        'SystemRoot',
        'SYSTEMROOT',
        'WINDIR',
        'windir',
        'ComSpec',
        'COMSPEC',
        'PATHEXT',
        'LANG',
        'LC_ALL',
        'DISPLAY',
        'XAUTHORITY',
        'WAYLAND_DISPLAY',
        'XDG_RUNTIME_DIR',
    ]) {
        if (parent[key] !== undefined) {
            result[key] = parent[key];
        }
    }
    Object.assign(result, {
        HOME: home,
        USERPROFILE: home,
        APPDATA: path.join(home, 'AppData', 'Roaming'),
        LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
        XDG_CONFIG_HOME: path.join(home, '.config'),
        XDG_CACHE_HOME: path.join(home, '.cache'),
        XDG_DATA_HOME: path.join(home, '.local', 'share'),
        TEMP: path.join(home, 'tmp'),
        TMP: path.join(home, 'tmp'),
        TMPDIR: path.join(home, 'tmp'),
        PYTHONNOUSERSITE: '1',
        PYTHONDONTWRITEBYTECODE: '1',
    });
    if (process.platform === 'win32') {
        result.HOMEDRIVE = path.parse(home).root.slice(0, 2);
        result.HOMEPATH = home.slice(2);
    }
    return result;
}

module.exports = {
    CheckFailure,
    InfrastructureError,
    check,
    digest,
    hashFile,
    validateHash,
    normalizedPath,
    samePath,
    within,
    validatePlan,
    archivePath,
    readArchive,
    inspectVsix,
    extractArchive,
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
};
