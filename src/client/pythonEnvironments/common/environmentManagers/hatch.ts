import { isTestExecution } from '../../../common/constants';
import { exec, getPythonSetting, pathExists } from '../externalDependencies';
import { traceError, traceVerbose } from '../../../logging';
import { cache } from '../../../common/utils/decorators';

/** Wraps the "Hatch" utility, and exposes its functionality.
 */
export class Hatch {
    /**
     * Locating Hatch binary can be expensive, since it potentially involves spawning or
     * trying to spawn processes; so we only do it once per session.
     */
    private static hatchPromise: Map<string, Promise<Hatch | undefined>> = new Map<
        string,
        Promise<Hatch | undefined>
    >();

    /**
     * Creates a Hatch service corresponding to the corresponding "hatch" command.
     *
     * @param command - Command used to run hatch. This has the same meaning as the
     * first argument of spawn() - i.e. it can be a full path, or just a binary name.
     * @param cwd - The working directory to use as cwd when running hatch.
     */
    constructor(public readonly command: string, private cwd: string) {}

    /**
     * Returns a Hatch instance corresponding to the binary which can be used to run commands for the cwd.
     *
     * Every directory is a valid Hatch project, so this should always return a Hatch instance.
     */
    public static async getHatch(cwd: string): Promise<Hatch | undefined> {
        if (Hatch.hatchPromise.get(cwd) === undefined || isTestExecution()) {
            Hatch.hatchPromise.set(cwd, Hatch.locate(cwd));
        }
        return Hatch.hatchPromise.get(cwd);
    }

    private static async locate(cwd: string): Promise<Hatch | undefined> {
        // First thing this method awaits on should be hatch command execution,
        // hence perform all operations before that synchronously.

        traceVerbose(`Getting hatch for cwd ${cwd}`);
        // Produce a list of candidate binaries to be probed by exec'ing them.
        function* getCandidates() {
            try {
                const customHatchPath = getPythonSetting<string>('hatchPath');
                if (customHatchPath && customHatchPath !== 'hatch') {
                    // If user has specified a custom Hatch path, use it first.
                    yield customHatchPath;
                }
            } catch (ex) {
                traceError(`Failed to get Hatch setting`, ex);
            }
            // Check unqualified filename, in case it's on PATH.
            yield 'hatch';
        }

        // Probe the candidates, and pick the first one that exists and does what we need.
        for (const hatchPath of getCandidates()) {
            traceVerbose(`Probing Hatch binary for ${cwd}: ${hatchPath}`);
            const hatch = new Hatch(hatchPath, cwd);
            const virtualenvs = await hatch.getEnvList();
            if (virtualenvs !== undefined) {
                traceVerbose(`Found hatch via filesystem probing for ${cwd}: ${hatchPath}`);
                return hatch;
            }
            traceVerbose(`Failed to find Hatch for ${cwd}: ${hatchPath}`);
        }

        // Didn't find anything.
        traceVerbose(`No Hatch binary found for ${cwd}`);
        return undefined;
    }

    /**
     * Retrieves list of Python environments known to Hatch for this working directory.
     * Returns `undefined` if we failed to spawn in some way.
     *
     * Corresponds to "hatch env show --json". Swallows errors if any.
     */
    public async getEnvList(): Promise<string[] | undefined> {
        return this.getEnvListCached(this.cwd);
    }

    /**
     * Method created to facilitate caching. The caching decorator uses function arguments as cache key,
     * so pass in cwd on which we need to cache.
     */
    @cache(30_000, true, 10_000)
    private async getEnvListCached(_cwd: string): Promise<string[] | undefined> {
        const envInfoOutput = await exec(this.command, ['env', 'show', '--json'], {
            cwd: this.cwd,
            throwOnStdErr: true,
        }).catch(traceVerbose);
        if (!envInfoOutput) {
            return undefined;
        }
        const envPaths = await Promise.all(
            Object.keys(JSON.parse(envInfoOutput.stdout)).map(async (name) => {
                const envPathOutput = await exec(this.command, ['env', 'find', name], {
                    cwd: this.cwd,
                    throwOnStdErr: true,
                }).catch(traceVerbose);
                if (!envPathOutput) return undefined;
                const dir = envPathOutput.stdout.trim();
                return (await pathExists(dir)) ? dir : undefined;
            }),
        );
        return envPaths.flatMap((r) => (r ? [r] : []));
    }
}
