import { TestItem, env } from 'vscode';
import { traceLog } from '../logging';
import { parseVsId } from './testController/common/projectUtils';

export async function writeTestIdToClipboard(testItem: TestItem): Promise<void> {
    if (testItem && typeof testItem.id === 'string') {
        // Strip the project scope prefix (if any) so only the test id is copied.
        const [, testId] = parseVsId(testItem.id);
        if (testId.includes('\\') && testId.indexOf('::') === -1) {
            // Convert the id to a module.class.method format as this is a unittest
            const moduleClassMethod = idToModuleClassMethod(testId);
            if (moduleClassMethod) {
                await env.clipboard.writeText(moduleClassMethod);
                traceLog('Testing: Copied test id to clipboard, id: ' + moduleClassMethod);
                return;
            }
        }
        // Otherwise use the id as is for pytest
        await clipboardWriteText(testId);
        traceLog('Testing: Copied test id to clipboard, id: ' + testId);
    }
}

export function idToModuleClassMethod(id: string): string | undefined {
    // Split by backslash
    const parts = id.split('\\');
    if (parts.length === 1) {
        // Only one part, likely a parent folder or file
        return parts[0];
    }
    if (parts.length === 2) {
        // Two parts: filePath and className
        const [filePath, className] = parts.slice(-2);
        const fileName = filePath.split(/[\\/]/).pop();
        if (!fileName) {
            return undefined;
        }
        const module = fileName.replace(/\.py$/, '');
        return `${module}.${className}`;
    }
    // Three or more parts: filePath, className, methodName
    const [filePath, className, methodName] = parts.slice(-3);
    const fileName = filePath.split(/[\\/]/).pop();
    if (!fileName) {
        return undefined;
    }
    const module = fileName.replace(/\.py$/, '');
    return `${module}.${className}.${methodName}`;
}
export function clipboardWriteText(text: string): Thenable<void> {
    return env.clipboard.writeText(text);
}
