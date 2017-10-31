import { CancellationToken, OutputChannel, window, workspace } from 'vscode';
import { IS_WINDOWS, PATH_VARIABLE_NAME } from '../../common/utils';
import { execPythonFile } from './../../common/utils';

export async function run(file: string, args: string[], cwd: string, token?: CancellationToken, outChannel?: OutputChannel): Promise<string> {
    return execPythonFile(cwd, file, args, cwd, true, (data: string) => outChannel.append(data), token);
}
