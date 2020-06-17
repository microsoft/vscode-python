import { InterpreterType, PythonInterpreter } from '../../../info';

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
    'sys.version'?: string;
    'sys.prefix'?: string;
    python_version?: string;
    default_prefix?: string;
    conda_version?: string;
};

/**
 * Return the list of conda env interpreters.
 */
export async function parseCondaInfo(
    info: CondaInfo,
    getPythonPath: (condaEnv: string) => string,
    fileExists: (filename: string) => Promise<boolean>,
    getPythonInfo: (python: string) => Promise<Partial<PythonInterpreter> | undefined>
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
            return;
        }
        const details = await getPythonInfo(pythonPath);
        if (!details) {
            return;
        }

        return {
            ...(details as PythonInterpreter),
            path: pythonPath,
            companyDisplayName: AnacondaCompanyName,
            type: InterpreterType.Conda,
            envPath
        };
    });

    return (
        Promise.all(promises)
            .then((interpreters) =>
                interpreters.filter((interpreter) => interpreter !== null && interpreter !== undefined)
            )
            // tslint:disable-next-line:no-non-null-assertion
            .then((interpreters) => interpreters.map((interpreter) => interpreter!))
    );
}
