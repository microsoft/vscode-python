import * as path from 'path';
import * as fs from 'fs-extra';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';

export function getVersion(): string {
    if (process.env.VSC_PYTHON_CI_TEST_VSC_CHANNEL) {
        return process.env.VSC_PYTHON_CI_TEST_VSC_CHANNEL;
    }
    const packageJsonPath = path.join(EXTENSION_ROOT_DIR, 'package.json');
    if (fs.pathExistsSync(packageJsonPath)) {
        const packageJson = fs.readJSONSync(packageJsonPath);
        return packageJson.engines.vscode.replace('^', '');
    }
    return 'stable';
}
