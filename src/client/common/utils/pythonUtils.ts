import { execFileSync } from 'child_process';

export function getSysPath(pythonCmd = 'python3'): string[] {
    try {
        const out = execFileSync(pythonCmd, ['-c', 'import sys, json; print(json.dumps(sys.path))'], {
            encoding: 'utf-8',
        });
        return JSON.parse(out);
    } catch (err) {
        console.warn('[CopyImportPath] getSysPath failed:', err);
        return [];
    }
}
