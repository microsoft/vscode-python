// generated from http://www.json2ts.com/ (with hand corrections)

export interface Metadata {
}

export interface Data { [mimetype: string]: string[] }

export interface Metadata2 {
}

export interface Output {
    data: Data;
    execution_count: number;
    metadata: Metadata2;
    output_type: string;
}

export interface Cell {
    cell_type: string;
    execution_count?: number;
    metadata: Metadata;
    outputs: Output[];
    source: string[];
}

export interface Kernelspec {
    display_name: string;
    language: string;
    name: string;
}

export interface CodemirrorMode {
    name: string;
    version: number;
}

export interface LanguageInfo {
    codemirror_mode: CodemirrorMode;
    file_extension: string;
    mimetype: string;
    name: string;
    nbconvert_exporter: string;
    pygments_lexer: string;
    version: string;
}

export interface Metadata3 {
    kernelspec: Kernelspec;
    language_info: LanguageInfo;
}

export interface JupyterNotebook {
    cells: Cell[];
    metadata: Metadata3;
    nbformat: number;
    nbformat_minor: number;
}


