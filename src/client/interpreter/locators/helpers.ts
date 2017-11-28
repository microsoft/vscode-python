import * as path from 'path';
import { getArchitectureDislayName } from '../../common/platform/registry';
import { fsReaddirAsync, IS_WINDOWS } from '../../common/utils';
import { PythonInterpreter } from '../contracts';

const CheckPythonInterpreterRegEx = IS_WINDOWS ? /^python(\d+(.\d+)?)?\.exe$/ : /^python(\d+(.\d+)?)?$/;

export function lookForInterpretersInDirectory(pathToCheck: string): Promise<string[]> {
    return fsReaddirAsync(pathToCheck)
        .then(subDirs => subDirs.filter(fileName => CheckPythonInterpreterRegEx.test(path.basename(fileName))))
        .catch(err => {
            console.error('Python Extension (lookForInterpretersInDirectory.fsReaddirAsync):', err);
            return [] as string[];
        });
}

export function fixInterpreterDisplayName(item: PythonInterpreter) {
    if (!item.displayName) {
        const arch = getArchitectureDislayName(item.architecture);
        const version = typeof item.version === 'string' ? item.version : '';
        item.displayName = ['Python', version, arch].filter(namePart => namePart.length > 0).join(' ').trim();
    }
    return item;
}
