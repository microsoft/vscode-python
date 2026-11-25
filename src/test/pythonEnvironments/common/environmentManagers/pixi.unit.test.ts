import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { ExecutionResult, ShellOptions } from '../../../../client/common/process/types';
import * as platformApis from '../../../../client/common/utils/platform';
import * as workspaceApis from '../../../../client/common/vscodeApis/workspaceApis';
import * as externalDependencies from '../../../../client/pythonEnvironments/common/externalDependencies';
import { TEST_LAYOUT_ROOT } from '../commonTestConstants';
import {
    getPixi,
    getPixiActivationCommands,
    getPixiEnvironmentFromInterpreter,
    getRunPixiPythonCommand,
    Pixi,
    PixiInfo,
} from '../../../../client/pythonEnvironments/common/environmentManagers/pixi';

export type PixiCommand = { cmd: 'info --json' } | { cmd: '--version' } | { cmd: null };

const textPixiDir = path.join(TEST_LAYOUT_ROOT, 'pixi');
export const projectDirs = {
    windows: {
        path: path.join(textPixiDir, 'windows'),
        info: {
            environments_info: [
                {
                    prefix: path.join(textPixiDir, 'windows', '.pixi', 'envs', 'default'),
                },
            ],
        },
    },
    nonWindows: {
        path: path.join(textPixiDir, 'non-windows'),
        info: {
            environments_info: [
                {
                    prefix: path.join(textPixiDir, 'non-windows', '.pixi', 'envs', 'default'),
                },
            ],
        },
    },
    multiEnv: {
        path: path.join(textPixiDir, 'multi-env'),
        info: {
            environments_info: [
                {
                    prefix: path.join(textPixiDir, 'multi-env', '.pixi', 'envs', 'default'),
                },
                {
                    prefix: path.join(textPixiDir, 'multi-env', '.pixi', 'envs', 'py310'),
                },
                {
                    prefix: path.join(textPixiDir, 'multi-env', '.pixi', 'envs', 'py311'),
                },
            ],
        },
    },
};

/**
 * Convert the command line arguments into a typed command.
 */
export function pixiCommand(args: string[]): PixiCommand {
    if (args[0] === '--version') {
        return { cmd: '--version' };
    }

    if (args.length < 2) {
        return { cmd: null };
    }
    if (args[0] === 'info' && args[1] === '--json') {
        return { cmd: 'info --json' };
    }
    return { cmd: null };
}
interface VerifyOptions {
    pixiPath?: string;
    cwd?: string;
}

export function makeExecHandler(verify: VerifyOptions = {}) {
    return async (file: string, args: string[], options: ShellOptions): Promise<ExecutionResult<string>> => {
        /// Verify that the executable path is indeed the one we expect it to be
        if (verify.pixiPath && file !== verify.pixiPath) {
            throw new Error('Command failed: not the correct pixi path');
        }

        const cmd = pixiCommand(args);
        if (cmd.cmd === '--version') {
            return { stdout: 'pixi 0.24.1' };
        }

        /// Verify that the working directory is the expected one
        const cwd = typeof options.cwd === 'string' ? options.cwd : options.cwd?.toString();
        if (verify.cwd) {
            if (!cwd || !externalDependencies.arePathsSame(cwd, verify.cwd)) {
                throw new Error(`Command failed: not the correct path, expected: ${verify.cwd}, got: ${cwd}`);
            }
        }

        /// Convert the command into a single string
        if (cmd.cmd === 'info --json') {
            const project = Object.values(projectDirs).find((p) => cwd?.startsWith(p.path));
            if (!project) {
                throw new Error('Command failed: could not find project');
            }
            return { stdout: JSON.stringify(project.info) };
        }

        throw new Error(`Command failed: unknown command ${args}`);
    };
}

suite('Pixi binary is located correctly', async () => {
    let exec: sinon.SinonStub;
    let getPythonSetting: sinon.SinonStub;
    let pathExists: sinon.SinonStub;

    setup(() => {
        getPythonSetting = sinon.stub(externalDependencies, 'getPythonSetting');
        exec = sinon.stub(externalDependencies, 'exec');
        pathExists = sinon.stub(externalDependencies, 'pathExists');
    });

    teardown(() => {
        sinon.restore();
    });

    const testPath = async (pixiPath: string, verify = true) => {
        getPythonSetting.returns(pixiPath);
        pathExists.returns(pixiPath !== 'pixi');
        // If `verify` is false, don’t verify that the command has been called with that path
        exec.callsFake(makeExecHandler(verify ? { pixiPath } : undefined));
        const pixi = await getPixi();

        if (pixiPath === 'pixi') {
            expect(pixi).to.equal(undefined);
        } else {
            expect(pixi?.command).to.equal(pixiPath);
        }
    };

    test('Return a Pixi instance in an empty directory', () => testPath('pixiPath', false));
    test('When user has specified a valid Pixi path, use it', () => testPath('path/to/pixi/binary'));
    // 'pixi' is the default value
    test('When user hasn’t specified a path, use Pixi on PATH if available', () => testPath('pixi'));

    test('Return undefined if Pixi cannot be found', async () => {
        getPythonSetting.returns('pixi');
        exec.callsFake((_file: string, _args: string[], _options: ShellOptions) =>
            Promise.reject(new Error('Command failed')),
        );
        const pixi = await getPixi();
        expect(pixi?.command).to.equal(undefined);
    });
});

suite('Pixi interpreter resolution', () => {
    const projectPath = path.join(textPixiDir, 'project with spaces');
    const manifestPath = path.join(projectPath, 'pixi.toml');
    const pixiPath = path.join(textPixiDir, 'pixi tools', 'pixi.exe');
    let info: PixiInfo;
    let metadata: sinon.SinonStub;
    let exec: sinon.SinonStub;

    setup(() => {
        info = {
            platform: 'win-64',
            virtual_packages: [],
            version: '0.24.1',
            cache_dir: '',
            auth_dir: '',
            project_info: {
                manifest_path: manifestPath,
                last_updated: '',
                version: '1.0.0',
            },
            environments_info: ['default', 'analysis'].map((name) => ({
                name,
                prefix: path.join(projectPath, '.pixi', 'envs', name),
                features: [],
                solve_group: name,
                environment_size: 0,
                dependencies: [],
                tasks: [],
                channels: [],
            })),
        };
        sinon.stub(externalDependencies, 'getPythonSetting').returns(pixiPath);
        sinon.stub(externalDependencies, 'pathExists').callsFake(async (candidate) => candidate === pixiPath);
        sinon.stub(workspaceApis, 'getWorkspaceFolderPaths').returns([projectPath]);
        metadata = sinon.stub(Pixi.prototype, 'getPixiEnvironmentMetadata').resolves(undefined);
        exec = sinon.stub(externalDependencies, 'exec').callsFake(async () => ({ stdout: JSON.stringify(info) }));
    });

    teardown(() => {
        sinon.restore();
    });

    for (const envName of ['default', 'analysis']) {
        for (const executable of ['python.exe', path.join('bin', 'python')]) {
            test(`Resolves a reported ${envName} prefix with ${executable} and no metadata`, async () => {
                const prefix = path.join(projectPath, '.pixi', 'envs', envName);
                const interpreterPath = path.join(prefix, executable);

                expect(await getPixiEnvironmentFromInterpreter(interpreterPath)).to.deep.include({
                    interpreterPath,
                    manifestPath,
                    pixiVersion: info.version,
                    envName,
                });
                sinon.assert.calledOnceWithExactly(metadata, prefix);
                sinon.assert.calledOnceWithExactly(exec, pixiPath, ['info', '--json'], {
                    cwd: projectPath,
                    throwOnStdErr: false,
                });
                expect(await getRunPixiPythonCommand(interpreterPath)).to.deep.equal([
                    pixiPath.toCommandArgumentForPythonExt(),
                    'run',
                    '--manifest-path',
                    manifestPath.toCommandArgumentForPythonExt(),
                    ...(envName === 'default' ? [] : ['--environment', envName]),
                    'python',
                ]);
            });
        }
    }

    test('Uses the reported environment name rather than the prefix directory name', async () => {
        const environment = info.environments_info[1];
        environment.prefix = path.join(projectPath, '.pixi', 'envs', 'custom-prefix');

        const result = await getPixiEnvironmentFromInterpreter(path.join(environment.prefix, 'python.exe'));

        expect(result?.envName).to.equal('analysis');
    });

    for (const prefix of [
        path.join(projectPath, 'tools', 'python', 'default'),
        path.join(projectPath, '.pixi', 'envs', 'default-other'),
    ]) {
        test(`Rejects an unreported prefix: ${path.relative(projectPath, prefix)}`, async () => {
            const interpreterPath = path.join(prefix, 'python.exe');

            expect(await getPixiEnvironmentFromInterpreter(interpreterPath)).to.equal(undefined);
            expect(await getRunPixiPythonCommand(interpreterPath)).to.equal(undefined);
            expect(await getPixiActivationCommands(interpreterPath)).to.equal(undefined);
        });
    }

    test('Rejects a project that reports no environments', async () => {
        const interpreterPath = path.join(info.environments_info[0].prefix, 'python.exe');
        info.environments_info = [];

        expect(await getPixiEnvironmentFromInterpreter(interpreterPath)).to.equal(undefined);
    });

    test('Does not use a Pixi workspace for an unrelated system interpreter', async () => {
        const interpreterPath = path.join(TEST_LAYOUT_ROOT, 'system-python', 'python.exe');

        expect(await getPixiEnvironmentFromInterpreter(interpreterPath)).to.equal(undefined);
        sinon.assert.notCalled(exec);
    });

    test('Normalizes reported prefixes before comparing them', async () => {
        const environment = info.environments_info[0];
        const interpreterPath = path.join(environment.prefix, 'python.exe');
        environment.prefix = `${environment.prefix}${path.sep}unused${path.sep}..`;

        expect((await getPixiEnvironmentFromInterpreter(interpreterPath))?.envName).to.equal('default');
    });

    for (const osType of [platformApis.OSType.Windows, platformApis.OSType.Linux, platformApis.OSType.OSX]) {
        test(`Respects prefix case sensitivity on ${osType}`, async () => {
            sinon.stub(platformApis, 'getOSType').returns(osType);
            const environment = info.environments_info[0];
            const interpreterPath = path.join(environment.prefix, 'python.exe');
            environment.prefix = environment.prefix.toUpperCase();

            const result = await getPixiEnvironmentFromInterpreter(interpreterPath);

            expect(result?.envName).to.equal(osType === platformApis.OSType.Windows ? 'default' : undefined);
        });
    }

    test('Preserves metadata-based resolution outside the workspace', async () => {
        const prefix = path.join(TEST_LAYOUT_ROOT, 'external-prefix');
        const interpreterPath = path.join(prefix, 'python.exe');
        metadata.resolves({
            manifest_path: manifestPath,
            pixi_version: info.version,
            environment_name: 'analysis',
        });

        expect(await getPixiEnvironmentFromInterpreter(interpreterPath)).to.deep.include({
            interpreterPath,
            manifestPath,
            pixiVersion: info.version,
            envName: 'analysis',
        });
        sinon.assert.calledOnceWithExactly(metadata, prefix);
        sinon.assert.notCalled(exec);
    });
});
