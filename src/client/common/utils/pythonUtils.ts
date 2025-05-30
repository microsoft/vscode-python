import { execFileSync } from 'child_process';
import { traceWarn } from '../../logging';

export function getSysPath(pythonCmd = 'python3'): string[] {
    // cleanSysPathCommand removes the working directory from sys.path.
    // The -c flag adds it automatically, which can allow some stdlib
    // modules (like json) to be overridden by other files (like json.py).
    const cleanSysPathCommand = [
        'import os, os.path, sys',
        'normalize = lambda p: os.path.normcase(os.path.normpath(p))',
        'cwd = normalize(os.getcwd())',
        'orig_sys_path = [p for p in sys.path if p != ""]',
        'sys.path[:] = [p for p in sys.path if p != "" and normalize(p) != cwd]',
        'import sys, json',
        'print(json.dumps(sys.path))',
    ].join('; ');
    try {
        const out = execFileSync(pythonCmd, ['-c', cleanSysPathCommand], {
            encoding: 'utf-8',
        });
        return JSON.parse(out);
    } catch (err) {
        traceWarn('[CopyImportPath] getSysPath failed:', err);
        return [];
    }
}
