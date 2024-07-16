// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { readJSON } from 'fs-extra';
import { OSType, getOSType, getUserHomeDir } from '../../../common/utils/platform';
import { exec, getPythonSetting, onDidChangePythonSetting, pathExists, pathExistsSync } from '../externalDependencies';
import { cache } from '../../../common/utils/decorators';
import { isTestExecution } from '../../../common/constants';
import { traceError, traceVerbose, traceWarn } from '../../../logging';
import { OUTPUT_MARKER_SCRIPT } from '../../../common/process/internal/scripts';

export const PIXITOOLPATH_SETTING_KEY = 'pixiToolPath';

// This type corresponds to the output of 'pixi info --json', and property
// names must be spelled exactly as they are in order to match the schema.
export type PixiInfo = {
    platform: string;
    virtual_packages: string[]; // eslint-disable-line camelcase
    version: string;
    cache_dir: string; // eslint-disable-line camelcase
    cache_size?: number; // eslint-disable-line camelcase
    auth_dir: string; // eslint-disable-line camelcase

    project_info?: PixiProjectInfo /* eslint-disable-line camelcase */;

    environments_info: /* eslint-disable-line camelcase */ {
        name: string;
        features: string[];
        solve_group: string; // eslint-disable-line camelcase
        environment_size: number; // eslint-disable-line camelcase
        dependencies: string[];
        tasks: string[];
        channels: string[];
        prefix: string;
    }[];
};

export type PixiProjectInfo = {
    manifest_path: string; // eslint-disable-line camelcase
    last_updated: string; // eslint-disable-line camelcase
    pixi_folder_size?: number; // eslint-disable-line camelcase
    version: string;
};

export type PixiEnvMetadata = {
    manifest_path: string; // eslint-disable-line camelcase
    pixi_version: string; // eslint-disable-line camelcase
    environment_name: string; // eslint-disable-line camelcase
};

export async function isPixiEnvironment(interpreterPath: string): Promise<boolean> {
    const prefix = getPrefixFromInterpreterPath(interpreterPath);
    return (
        pathExists(path.join(prefix, 'conda-meta/pixi')) || pathExists(path.join(prefix, 'conda-meta/pixi_env_prefix'))
    );
}

/**
 * Returns the path to the environment directory based on the interpreter path.
 */
export function getPrefixFromInterpreterPath(interpreterPath: string): string {
    const interpreterDir = path.dirname(interpreterPath);
    if (getOSType() === OSType.Windows) {
        return interpreterDir;
    }
    return path.dirname(interpreterDir);
}

/** Wraps the "pixi" utility, and exposes its functionality.
 */
export class Pixi {
    /**
     * Locating pixi binary can be expensive, since it potentially involves spawning or
     * trying to spawn processes; so we only do it once per session.
     */
    private static pixiPromise: Promise<Pixi | undefined> | undefined;

    /**
     * Creates a Pixi service corresponding to the corresponding "pixi" command.
     *
     * @param command - Command used to run pixi. This has the same meaning as the
     * first argument of spawn() - i.e. it can be a full path, or just a binary name.
     */
    constructor(public readonly command: string) {
        onDidChangePythonSetting(PIXITOOLPATH_SETTING_KEY, () => {
            Pixi.pixiPromise = undefined;
        });
    }

    /**
     * Returns a Pixi instance corresponding to the binary which can be used to run commands for the cwd.
     *
     * Pixi commands can be slow and so can be bottleneck to overall discovery time. So trigger command
     * execution as soon as possible. To do that we need to ensure the operations before the command are
     * performed synchronously.
     */
    public static async getPixi(): Promise<Pixi | undefined> {
        if (Pixi.pixiPromise === undefined || isTestExecution()) {
            Pixi.pixiPromise = Pixi.locate();
        }
        return Pixi.pixiPromise;
    }

    private static async locate(): Promise<Pixi | undefined> {
        // First thing this method awaits on should be pixi command execution, hence perform all operations
        // before that synchronously.

        traceVerbose(`Getting pixi`);
        // Produce a list of candidate binaries to be probed by exec'ing them.
        function* getCandidates() {
            // Read the pixi location from the settings.
            try {
                const customPixiToolPath = getPythonSetting<string>(PIXITOOLPATH_SETTING_KEY);
                if (customPixiToolPath && customPixiToolPath !== 'pixi') {
                    // If user has specified a custom pixi path, use it first.
                    yield customPixiToolPath;
                }
            } catch (ex) {
                traceError(`Failed to get pixi setting`, ex);
            }

            // Check unqualified filename, in case it's on PATH.
            yield 'pixi';

            // Check the default installation location
            const home = getUserHomeDir();
            if (home) {
                const defaultpixiToolPath = path.join(home, '.pixi', 'bin', 'pixi');
                if (pathExistsSync(defaultpixiToolPath)) {
                    yield defaultpixiToolPath;
                }
            }
        }

        // Probe the candidates, and pick the first one that exists and does what we need.
        for (const pixiToolPath of getCandidates()) {
            traceVerbose(`Probing pixi binary: ${pixiToolPath}`);
            const pixi = new Pixi(pixiToolPath);
            const pixiVersion = await pixi.getVersion();
            if (pixiVersion !== undefined) {
                traceVerbose(`Found pixi ${pixiVersion} via filesystem probing: ${pixiToolPath}`);
                return pixi;
            }
            traceVerbose(`Failed to find pixi: ${pixiToolPath}`);
        }

        // Didn't find anything.
        traceVerbose(`No pixi binary found`);
        return undefined;
    }

    /**
     * Retrieves list of Python environments known to this pixi for the specified directory.
     *
     * Corresponds to "pixi info --json" and extracting the environments. Swallows errors if any.
     */
    public async getEnvList(cwd: string): Promise<string[] | undefined> {
        const pixiInfo = await this.getPixiInfo(cwd);
        // eslint-disable-next-line camelcase
        return pixiInfo?.environments_info.map((env) => env.prefix);
    }

    /**
     * Method that runs `pixi info` and returns the result. The value is cached for "only" 1 second
     * because the output changes if the project manifest is modified.
     */
    @cache(1_000, true, 1_000)
    public async getPixiInfo(cwd: string): Promise<PixiInfo | undefined> {
        const infoOutput = await exec(this.command, ['info', '--json'], {
            cwd,
            throwOnStdErr: false,
        }).catch(traceError);
        if (!infoOutput) {
            return undefined;
        }

        const pixiInfo: PixiInfo = JSON.parse(infoOutput.stdout);
        return pixiInfo;
    }

    /**
     * Runs `pixi --version` and returns the version part of the output.
     */
    @cache(30_000, true, 10_000)
    public async getVersion(): Promise<string | undefined> {
        const versionOutput = await exec(this.command, ['--version'], {
            throwOnStdErr: false,
        }).catch(traceError);
        if (!versionOutput) {
            return undefined;
        }

        return versionOutput.stdout.split(' ')[1].trim();
    }

    /**
     * Returns the command line arguments to run `python` within a specific pixi environment.
     * @param manifestPath The path to the manifest file used by pixi.
     * @param envName The name of the environment in the pixi project
     * @param isolatedFlag Whether to add `-I` to the python invocation.
     * @returns A list of arguments that can be passed to exec.
     */
    public getRunPythonArgs(manifestPath: string, envName?: string, isolatedFlag = false): string[] {
        let python = [this.command, 'run', '--manifest-path', manifestPath];
        if (isNonDefaultPixiEnvironmentName(envName)) {
            python = python.concat(['--environment', envName]);
        }

        python.push('python');
        if (isolatedFlag) {
            python.push('-I');
        }
        return [...python, OUTPUT_MARKER_SCRIPT];
    }

    /**
     * Starting from Pixi 0.24.0, each environment has a special file that records some information
     * about which manifest created the environment.
     *
     * @param envDir The root directory (or prefix) of a conda environment
     */
    @cache(5_000, true, 10_000)
    // eslint-disable-next-line class-methods-use-this
    async getPixiEnvironmentMetadata(envDir: string): Promise<PixiEnvMetadata | undefined> {
        const pixiPath = path.join(envDir, 'conda-meta/pixi');
        const result: PixiEnvMetadata | undefined = await readJSON(pixiPath).catch(traceVerbose);
        return result;
    }
}

export type PixiEnvironmentInfo = {
    interpreterPath: string;
    pixi: Pixi;
    pixiVersion: string;
    manifestPath: string;
    envName?: string;
};

/**
 * Given the location of an interpreter, try to deduce information about the environment in which it
 * resides.
 * @param interpreterPath The full path to the interpreter.
 * @param pixi Optionally a pixi instance. If this is not specified it will be located.
 * @returns Information about the pixi environment.
 */
export async function getPixiEnvironmentFromInterpreter(
    interpreterPath: string,
    pixi?: Pixi,
): Promise<PixiEnvironmentInfo | undefined> {
    if (!interpreterPath) {
        return undefined;
    }

    const prefix = getPrefixFromInterpreterPath(interpreterPath);

    // Find the pixi executable for the project
    pixi = pixi || (await Pixi.getPixi());
    if (!pixi) {
        traceWarn(`could not find a pixi interpreter for the interpreter at ${interpreterPath}`);
        return undefined;
    }

    // Check if the environment has pixi metadata that we can source.
    const metadata = await pixi.getPixiEnvironmentMetadata(prefix);
    if (metadata !== undefined) {
        return {
            interpreterPath,
            pixi,
            pixiVersion: metadata.pixi_version,
            manifestPath: metadata.manifest_path,
            envName: metadata.environment_name,
        };
    }

    // Otherwise, we'll have to try to deduce this information.

    // Usually the pixi environments are stored under `<projectDir>/.pixi/envs/<environment>/`. So,
    // we walk backwards to determine the project directory.
    const envName = path.basename(prefix);
    const envsDir = path.dirname(prefix);
    const dotPixiDir = path.dirname(envsDir);
    const pixiProjectDir = path.dirname(dotPixiDir);

    // Invoke pixi to get information about the pixi project
    const pixiInfo = await pixi.getPixiInfo(pixiProjectDir);
    if (!pixiInfo || !pixiInfo.project_info) {
        traceWarn(`failed to determine pixi project information for the interpreter at ${interpreterPath}`);
        return undefined;
    }

    return {
        interpreterPath,
        pixi,
        pixiVersion: pixiInfo.version,
        manifestPath: pixiInfo.project_info.manifest_path,
        envName,
    };
}

/**
 * Returns true if the given environment name is *not* the default environment.
 */
export function isNonDefaultPixiEnvironmentName(envName?: string): envName is string {
    return envName !== undefined && envName !== 'default';
}
