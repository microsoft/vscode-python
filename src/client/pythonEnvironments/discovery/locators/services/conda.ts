import * as fsapi from 'fs-extra';
import * as path from 'path';
import { traceVerbose } from '../../../../common/logger';
import {
    getEnvironmentVariable, getOSType, getUserHomeDir, OSType,
} from '../../../../common/utils/platform';
import { exec } from '../../../common/externalDependencies';
import { getRegistryInterpreters } from '../../../common/windowsUtils';
import { EnvironmentType, PythonEnvironment } from '../../../info';

// tslint:disable-next-line:variable-name
export const AnacondaCompanyNames = ['Anaconda, Inc.', 'Continuum Analytics, Inc.'];
// tslint:disable-next-line:variable-name
export const AnacondaCompanyName = 'Anaconda, Inc.';
// tslint:disable-next-line:variable-name
export const AnacondaDisplayName = 'Anaconda';
// tslint:disable-next-line:variable-name
export const AnacondaIdentifiers = ['Anaconda', 'Conda', 'Continuum'];

export type CondaEnvironmentInfo = {
    name: string;
    path: string;
};

export type CondaInfo = {
    envs?: string[];
    envs_dirs?: string[];
    'sys.version'?: string;
    'sys.prefix'?: string;
    python_version?: string;
    default_prefix?: string;
    root_prefix?: string;
    conda_version?: string;
};

export type CondaEnvInfo = {
    prefix: string,
    name?: string,
};

/**
 * Return the list of conda env interpreters.
 */
export async function parseCondaInfo(
    info: CondaInfo,
    getPythonPath: (condaEnv: string) => string,
    fileExists: (filename: string) => Promise<boolean>,
    getPythonInfo: (python: string) => Promise<Partial<PythonEnvironment> | undefined>,
) {
    // The root of the conda environment is itself a Python interpreter
    // envs reported as e.g.: /Users/bob/miniconda3/envs/someEnv.
    const envs = Array.isArray(info.envs) ? info.envs : [];
    if (info.default_prefix && info.default_prefix.length > 0) {
        envs.push(info.default_prefix);
    }

    const promises = envs.map(async (envPath) => {
        const pythonPath = getPythonPath(envPath);

        if (!(await fileExists(pythonPath))) {
            return undefined;
        }
        const details = await getPythonInfo(pythonPath);
        if (!details) {
            return undefined;
        }

        return {
            ...(details as PythonEnvironment),
            path: pythonPath,
            companyDisplayName: AnacondaCompanyName,
            envType: EnvironmentType.Conda,
            envPath,
        };
    });

    return (
        Promise.all(promises)
            .then((interpreters) => interpreters.filter(
                (interpreter) => interpreter !== null && interpreter !== undefined,
            ))
            // tslint:disable-next-line:no-non-null-assertion
            .then((interpreters) => interpreters.map((interpreter) => interpreter!))
    );
}

/** Wraps the "conda" utility, and exposes its functionality.
 */
export class Conda {
    /**
     * Creates a Conda service corresponding to the corresponding "conda" command.
     *
     * @param command - Command used to spawn conda. This has the same meaning as the
     * first argument of spawn() - i.e. it can be a full path, or just a binary name.
     */
    constructor(readonly command: string) {
    }

    /**
     * Locates the preferred "conda" utility on this system by considering user settings,
     * binaries on PATH, Python interpreters in the registry, and known install locations.
     *
     * @return A Conda instance corresponding to the binary, if successful; otherwise, undefined.
     */
    public static async locate(): Promise<Conda | undefined> {
        const home = getUserHomeDir();
        const suffix = getOSType() === OSType.Windows ? 'Scripts\\conda.exe' : 'bin/conda';

        // Produce a list of candidate binaries to be probed by exec'ing them.
        async function* getCandidates() {
            // Check unqualified filename first, in case it's on PATH.
            yield 'conda';
            if (getOSType() === OSType.Windows) {
                yield* getCandidatesFromRegistry();
            }
            yield* getCandidatesFromKnownPaths();
            yield* getCandidatesFromEnvironmentsTxt();
        }

        async function* getCandidatesFromRegistry() {
            const interps = await getRegistryInterpreters();
            const candidates = interps
                .filter((interp) => interp.interpreterPath && interp.distroOrgName === 'ContinuumAnalytics')
                .map((interp) => path.join(path.win32.dirname(interp.interpreterPath), suffix));
            yield* candidates;
        }

        async function* getCandidatesFromKnownPaths() {
            // Check common locations. We want to look up "<prefix>/*conda*/<suffix>", where prefix and suffix
            // depend on the platform, to account for both Anaconda and Miniconda, and all possible variations.
            // The check cannot use globs, because on Windows, prefixes are absolute paths with a drive letter,
            // and the glob module doesn't understand globs with drive letters in them, producing wrong results
            // for "C:/*" etc.
            const prefixes: string[] = [];
            if (getOSType() === OSType.Windows) {
                const programData = getEnvironmentVariable('PROGRAMDATA') || 'C:\\ProgramData';
                prefixes.push(programData);
                if (home) {
                    const localAppData = getEnvironmentVariable('LOCALAPPDATA') || path.join(home, 'AppData', 'Local');
                    prefixes.push(home, path.join(localAppData, 'Continuum'));
                }
            } else {
                prefixes.push('/usr/share', '/usr/local/share', '/opt');
                if (home) {
                    prefixes.push(home, path.join(home, 'opt'));
                }
            }

            for (const prefix of prefixes) {
                let items;
                try {
                    items = await fsapi.readdir(prefix);
                } catch (ex) {
                    // Directory doesn't exist or is not readable - not an error.
                    continue;
                }
                yield* items
                    .filter((fileName) => fileName.toLowerCase().includes('conda'))
                    .map((fileName) => path.join(prefix, fileName, suffix));
            }
        }

        async function* getCandidatesFromEnvironmentsTxt() {
            if (!home) {
                return;
            }

            let contents: string;
            try {
                contents = await fsapi.readFile(path.join(home, '.conda', 'environments.txt'), 'utf8');
            } catch (ex) {
                // File doesn't exist or is not readable - not an error.
                contents = '';
            }

            // Match conda behavior; see conda.gateways.disk.read.yield_lines().
            // Note that this precludes otherwise legal paths with trailing spaces.
            yield* contents
                .split(/\r?\n/g)
                .map((line) => line.trim())
                .filter((line) => line !== '' && !line.startsWith('#'))
                .map((line) => path.join(line, suffix));
        }

        // Probe the candidates, and pick the first one that exists and does what we need.
        for await (const condaPath of getCandidates()) {
            traceVerbose(`Probing conda binary: ${condaPath}`);
            const conda = new Conda(condaPath);
            try {
                await conda.getInfo();
                traceVerbose(`Found conda via filesystem probing: ${condaPath}`);
                return conda;
            } catch (ex) {
                // Failed to spawn because the binary doesn't exist or isn't on PATH, or the current
                // user doesn't have execute permissions for it, or this conda couldn't handle command
                // line arguments that we passed (indicating an old version that we do not support).
            }
        }

        // Didn't find anything.
        return undefined;
    }

    /**
     * Retrieves global information about this conda.
     * Corresponds to "conda info --json".
     */
    public async getInfo(): Promise<CondaInfo> {
        const result = await exec(this.command, ['info', '--json']);
        return JSON.parse(result.stdout);
    }

    /**
     * Retrieves list of Python environments known to this conda.
     * Corresponds to "conda env list --json", but also computes environment names.
     */
    public async getEnvList(): Promise<CondaEnvInfo[]> {
        const info = await this.getInfo();
        const envs = info.envs;
        if (envs === undefined) {
            return [];
        }

        function getName(prefix: string) {
            if (prefix === info.root_prefix) {
                return 'base';
            }

            const parentDir = path.dirname(prefix);
            if (info.envs_dirs !== undefined) {
                for (const envsDir of info.envs_dirs) {
                    if (parentDir === envsDir) {
                        return path.basename(prefix);
                    }
                }
            }

            return undefined;
        }

        return envs.map(prefix => ({
            prefix,
            name: getName(prefix)
        }));
    }
}
