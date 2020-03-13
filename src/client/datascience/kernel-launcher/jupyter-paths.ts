import { exec } from 'child_process';
import fs from 'fs';
import { homedir } from 'os';
import path from 'path';

let sysPrefixGuess: string | null | undefined;

interface IJupyterPaths {
    config: string[];
    runtime: string;
    data: string[];
}

function home(subDir?: string): string {
    const baseDir: string = homedir();
    return subDir ? path.join(baseDir, subDir) : baseDir;
}

function pushIfExists(paths: string[], pathToPush: string): void {
    if (fs.existsSync(pathToPush)) {
        paths.push(pathToPush);
    }
}

function accessCheck(d: fs.PathLike): boolean {
    // check if a directory exists and is listable (X_OK)
    if (!fs.existsSync(d)) {
        return false;
    }
    try {
        fs.accessSync(d, fs.constants.X_OK);
    } catch (e) {
        // [WSA]EACCES
        return false;
    }
    return true;
}

function guessSysPrefix(): string | null | undefined {
    // inexpensive guess for sysPrefix based on location of `which python`
    // based on shutil.which from Python 3.5

    // only run once:
    if (sysPrefixGuess !== undefined) {
        return sysPrefixGuess;
    }

    const PATH: string[] = (process.env.PATH || '').split(path.delimiter);
    if (PATH.length === 0) {
        sysPrefixGuess = null;
        return;
    }

    let pathext: string[] = [''];
    if (process.platform === 'win32') {
        pathext = (process.env.PATHEXT || '').split(path.delimiter);
    }

    PATH.some(bin => {
        bin = path.resolve(bin);
        const python: string = path.join(bin, 'python');

        return pathext.some((ext: string): boolean => {
            const exe: string = python + ext;
            if (accessCheck(exe)) {
                // PREFIX/bin/python exists, return PREFIX
                // following symlinks
                if (process.platform === 'win32') {
                    // Windows: Prefix\Python.exe
                    sysPrefixGuess = path.dirname(fs.realpathSync(exe));
                } else {
                    // Everywhere else: prefix/bin/python
                    sysPrefixGuess = path.dirname(path.dirname(fs.realpathSync(exe)));
                }
                return true;
            }
            return false;
        });
    });
    if (sysPrefixGuess === undefined) {
        // store null as nothing found, but don't run again
        sysPrefixGuess = null;
    }
    return sysPrefixGuess;
}

let askJupyterPromise: Promise<IJupyterPaths> | null = null;

function askJupyter(): Promise<IJupyterPaths> {
    // ask Jupyter where the paths are
    if (!askJupyterPromise) {
        askJupyterPromise = new Promise((resolve, reject) => {
            exec('python3 -m jupyter --paths --json', (err, stdout) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(JSON.parse(stdout.toString().trim()));
                }
            });
        });
    }
    return askJupyterPromise;
}

function systemConfigDirs(): string[] {
    const paths: string[] = [];
    // System wide for Windows and Unix
    if (process.platform === 'win32') {
        const defaultProgramDataPath: string = 'C:\\ProgramData';
        pushIfExists(paths, path.resolve(path.join(process.env.PROGRAMDATA || defaultProgramDataPath, 'jupyter')));
    } else {
        pushIfExists(paths, '/usr/local/etc/jupyter');
        pushIfExists(paths, '/etc/jupyter');
    }
    return paths;
}

async function configDirs(opts?: {
    withSysPrefix?: boolean;
    askJupyter?(): Promise<IJupyterPaths>;
}): Promise<string[]> {
    if (opts && opts.askJupyter) {
        try {
            const configPaths: IJupyterPaths = await askJupyter();
            return configPaths.config.filter(fs.existsSync);
        } catch {
            return configDirs();
        }
    }

    const paths: string[] = [];
    if (process.env.JUPYTER_CONFIG_DIR) {
        pushIfExists(paths, process.env.JUPYTER_CONFIG_DIR);
    }

    pushIfExists(paths, home('.jupyter'));
    const systemDirs: string[] = systemConfigDirs();

    if (opts && opts.withSysPrefix) {
        return new Promise<string[]>(resolve => {
            // deprecated: withSysPrefix expects a Promise
            // but no change in content
            resolve(configDirs());
        });
    }
    // inexpensive guess, based on location of `python` executable
    const sysPrefix: string = guessSysPrefix() || '/usr/local/';
    const sysPathed: string = path.join(sysPrefix, 'etc', 'jupyter');
    if (systemDirs.indexOf(sysPathed) === -1) {
        pushIfExists(paths, sysPathed);
    }
    return paths.concat(systemDirs);
}

function systemDataDirs(): string[] {
    const paths: string[] = [];
    // System wide for Windows and Unix
    if (process.platform === 'win32') {
        const defaultProgramDataPath: string = 'C:\\ProgramData';
        pushIfExists(paths, path.resolve(path.join(process.env.PROGRAMDATA || defaultProgramDataPath, 'jupyter')));
    } else {
        pushIfExists(paths, '/usr/local/share/jupyter');
        pushIfExists(paths, '/usr/share/jupyter');
    }
    return paths;
}

/**
 * where the userland data directory resides
 * includes things like the runtime files
 * @return directory for data
 */
function userDataDir(): string {
    // Userland specific
    if (process.platform === 'darwin') {
        return home('Library/Jupyter');
    } else if (process.platform === 'win32') {
        const defaultAppDataPath: string = home('AppData');
        return path.resolve(path.join(process.env.APPDATA || defaultAppDataPath, 'jupyter'));
    }
    return process.env.XDG_DATA_HOME || home('.local/share/jupyter');
}

/**
 * dataDirs returns all the expected static directories for this OS.
 * The user of this function should make sure to make sure the directories
 * exist.
 *
 * When withSysPrefix is set, this returns a promise of directories
 *
 * @param withSysPrefix include the sys.prefix paths
 * @return All the Jupyter Data Dirs
 */
async function dataDirs(opts?: { withSysPrefix?: boolean; askJupyter?(): Promise<IJupyterPaths> }): Promise<string[]> {
    if (opts && opts.askJupyter) {
        try {
            const dataPaths: IJupyterPaths = await askJupyter();
            return dataPaths.data.filter(fs.existsSync);
        } catch (error) {
            return dataDirs();
        }
    }

    const paths: string[] = [];
    if (process.env.JUPYTER_PATH) {
        pushIfExists(paths, process.env.JUPYTER_PATH);
    }

    pushIfExists(paths, userDataDir());

    const systemDirs: string[] = systemDataDirs();

    if (opts && opts.withSysPrefix) {
        // deprecated: withSysPrefix expects a Promise
        // but no change in content
        return (async () => dataDirs())();
    }
    // inexpensive guess, based on location of `python` executable
    const sysPrefix: string | null | undefined = guessSysPrefix();
    if (sysPrefix) {
        const sysPathed: string = path.join(sysPrefix, 'share', 'jupyter');
        if (systemDirs.indexOf(sysPathed) === -1) {
            pushIfExists(paths, sysPathed);
        }
    }
    return paths.concat(systemDirs);
}

async function runtimeDir(opts?: { askJupyter?(): Promise<IJupyterPaths> }): Promise<string> {
    if (opts && opts.askJupyter) {
        try {
            const paths: IJupyterPaths = await askJupyter();
            return paths.runtime;
        } catch (error) {
            return runtimeDir();
        }
    }

    if (process.env.JUPYTER_RUNTIME_DIR) {
        return process.env.JUPYTER_RUNTIME_DIR;
    }

    if (process.env.XDG_RUNTIME_DIR) {
        return path.join(process.env.XDG_RUNTIME_DIR, 'jupyter');
    }
    return path.join(userDataDir(), 'runtime');
}

// tslint:disable-next-line: no-default-export
export default { dataDirs, runtimeDir, configDirs, guessSysPrefix };
