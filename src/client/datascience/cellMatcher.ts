// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import { IDataScienceSettings } from '../common/types';
import { noop } from '../common/utils/misc';
import { RegExpValues } from './constants';

export class CellMatcher {
    private codeMatchRegEx: RegExp;
    private markdownMatchRegEx: RegExp;
    private codeExecRegEx: RegExp;
    private markdownExecRegEx: RegExp;
    private defaultCellMarker: string;
    private defaultCellMarkerExec: RegExp;

    constructor(settings?: IDataScienceSettings) {
        this.codeMatchRegEx = this.createRegExp(
            settings ? settings.codeRegularExpression : undefined,
            RegExpValues.PythonCellMarker
        );
        this.markdownMatchRegEx = this.createRegExp(
            settings ? settings.markdownRegularExpression : undefined,
            RegExpValues.PythonMarkdownCellMarker
        );
        this.codeExecRegEx = new RegExp(`${this.codeMatchRegEx.source}(.*)`);
        this.markdownExecRegEx = new RegExp(`${this.markdownMatchRegEx.source}(.*)`);
        this.defaultCellMarker = settings?.defaultCellMarker ? settings.defaultCellMarker : '# %%';
        this.defaultCellMarkerExec = this.createRegExp(`${this.defaultCellMarker}(.*)`, /# %%(.*)/);
    }

    public isCell(code: string): boolean {
        return this.isCode(code) || this.isMarkdown(code);
    }

    public isMarkdown(code: string): boolean {
        return this.markdownMatchRegEx.test(code);
    }

    public isCode(code: string): boolean {
        return this.codeMatchRegEx.test(code) || code.trim() === this.defaultCellMarker;
    }

    public getCellType(code: string): string {
        return this.isMarkdown(code) ? 'markdown' : 'code';
    }

    public stripFirstMarker(code: string): string {
        const lines = code.splitLines({ trim: false, removeEmptyEntries: false });

        // Only strip this off the first line. Otherwise we want the markers in the code.
        if (lines.length > 0 && (this.isCode(lines[0]) || this.isMarkdown(lines[0]))) {
            return lines.slice(1).join('\n');
        }
        return code;
    }

    public exec(code: string): string | undefined {
        let result: RegExpExecArray | null = null;
        if (this.defaultCellMarkerExec.test(code)) {
            this.defaultCellMarkerExec.lastIndex = -1;
            result = this.defaultCellMarkerExec.exec(code);
        } else if (this.codeMatchRegEx.test(code)) {
            this.codeExecRegEx.lastIndex = -1;
            result = this.codeExecRegEx.exec(code);
        } else if (this.markdownMatchRegEx.test(code)) {
            this.markdownExecRegEx.lastIndex = -1;
            result = this.markdownExecRegEx.exec(code);
        }
        if (result) {
            return result.length > 1 ? result[result.length - 1].trim() : '';
        }
        return undefined;
    }

    private createRegExp(potential: string | undefined, backup: RegExp): RegExp {
        try {
            if (potential) {
                return new RegExp(potential);
            }
        } catch {
            noop();
        }

        return backup;
    }
}
