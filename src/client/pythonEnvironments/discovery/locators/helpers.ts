import * as fsapi from 'fs-extra';
import * as path from 'path';
import { Uri } from 'vscode';
import { traceError } from '../../../common/logger';
import { IS_WINDOWS } from '../../../common/platform/constants';
import { IFileSystem } from '../../../common/platform/types';
import { InterpreterType, PythonInterpreter } from '../../info';

const CheckPythonInterpreterRegEx = IS_WINDOWS ? /^python(\d+(.\d+)?)?\.exe$/ : /^python(\d+(.\d+)?)?$/;

// tslint:disable-next-line:no-suspicious-comment
// TODO: Switch back to using IFileSystem.
// https://github.com/microsoft/vscode-python/issues/11338
export async function lookForInterpretersInDirectory(pathToCheck: string, _: IFileSystem): Promise<string[]> {
    // Technically, we should be able to use fs.getFiles().  However,
    // that breaks some tests.  So we stick with the broader behavior.
    try {
        // tslint:disable-next-line: no-suspicious-comment
        // TODO https://github.com/microsoft/vscode-python/issues/11338
        const files = await fsapi.readdir(pathToCheck);
        return files
            .map((filename) => path.join(pathToCheck, filename))
            .filter((fileName) => CheckPythonInterpreterRegEx.test(path.basename(fileName)));
    } catch (err) {
        traceError('Python Extension (lookForInterpretersInDirectory.fs.listdir):', err);
        return [] as string[];
    }
}

/**
 * Update the given env info with extra information.
 *
 * @param interp - the env info to update
 * @param deps - functional dependencies
 * @prop deps.getPipEnvInfo - provides extra pip-specific env info, if applicable
 */
export async function updateEnvInfo(
    interp: PythonInterpreter,
    deps: {
        getPipEnvInfo(p: string): Promise<{ workspaceFolder: Uri; envName: string } | undefined>;
    }
) {
    // This stuff needs to be fast.
    const info = await deps.getPipEnvInfo(interp.path);
    if (info) {
        interp.type = InterpreterType.Pipenv;
        interp.pipEnvWorkspaceFolder = info.workspaceFolder.fsPath;
        if (info.envName) {
            interp.envName = info.envName;
        }
    }
}
