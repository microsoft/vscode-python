import { Position, SymbolKind } from 'vscode';

export interface ITag {
    fileName: string;
    symbolName: string;
    symbolKind: SymbolKind;
    position: Position;
    code: string;
}
