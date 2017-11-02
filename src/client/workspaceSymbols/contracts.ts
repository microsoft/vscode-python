import { Position, SymbolKind } from 'vscode';

export interface Tag {
    fileName: string;
    symbolName: string;
    symbolKind: SymbolKind;
    position: Position;
    code: string;
}
