import { MarkedString } from 'vscode';

export function normalizeMarkedString(content: MarkedString): string {
    return typeof content === 'string' ? content : content.value;
}
