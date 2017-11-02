import { IS_WINDOWS } from '../../../common/utils';

// where to find the Python binary within a conda env.
export const CONDA_RELATIVE_PY_PATH = IS_WINDOWS ? ['python.exe'] : ['bin', 'python'];
// tslint:disable-next-line:variable-name
export const AnacondaCompanyNames = ['Anaconda, Inc.', 'Continuum Analytics, Inc.'];
// tslint:disable-next-line:variable-name
export const AnacondaCompanyName = 'Anaconda, Inc.';
// tslint:disable-next-line:variable-name
export const AnacondaDisplayName = 'Anaconda';
// tslint:disable-next-line:variable-name
export const AnacondaIdentfiers = ['Anaconda', 'Conda', 'Continuum'];

export type CondaInfo = {
    envs?: string[];
    'sys.version'?: string;
    'python_version'?: string;
    default_prefix?: string;
};
