// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { EOL } from 'os';
// tslint:disable-next-line:import-name
import Char from 'typescript-char';
import { isWhiteSpace } from '../../language/characters';

export class RestTextConverter {
  private inPreBlock = false;
  private inCodeBlock = false;
  private md: string[] = [];

  // tslint:disable-next-line:cyclomatic-complexity
  public toMarkdown(docstring: string, force?: boolean): string {
    // Translates reStructruredText (Python doc syntax) to markdown.
    // It only translates as much as needed to display tooltips
    // and documentation in the completion list.
    // See https://en.wikipedia.org/wiki/ReStructuredText

    if (!force && !this.shouldConvert(docstring)) {
      return this.escapeMarkdown(docstring);
    }

    const result = this.transformLines(docstring);
    this.inPreBlock = this.inPreBlock = false;
    this.md = [];

    return result;
  }

  public escapeMarkdown(text: string): string {
    // Not complete escape list so it does not interfere
    // with subsequent code highlighting (see above).
    return text
      .replace(/\#/g, '\\#')
      .replace(/\*/g, '\\*')
      .replace(/\_/g, '\\_')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\+/g, '\\+')
      .replace(/\-/g, '\\+');
  }

  private shouldConvert(docstring: string): boolean {
    // Heuristics that determe if string should be converted
    // to markdown or just escaped.

    // :: at the end of a string
    const doubleColon = docstring.indexOf('::');
    if (doubleColon >= 0 && doubleColon < docstring.length - 2) {
      const ch = docstring.charCodeAt(doubleColon + 2);
      if (ch === Char.LineFeed || ch === Char.CarriageReturn) {
        return true;
      }
    }
    // Section headers or lists
    if (docstring.indexOf('===') >= 0 || docstring.indexOf('---') >= 0 || docstring.indexOf('.. ') >= 0) {
      return true;
    }
    return false;
  }

  // tslint:disable-next-line:cyclomatic-complexity
  private transformLines(docstring: string): string {
    const lines = docstring.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      let line = lines[i];

      // Avoid leading empty lines
      if (this.md.length === 0 && line.length === 0) {
        continue;
      }

      if (!this.inPreBlock) {
        // Anything indented is considered to be preformatted.
        if (line.length > 0 && isWhiteSpace(line.charCodeAt(0))) {
          this.startPreformattedBlock(line);
        }
      }

      if (this.handleCodeBlock(line)) {
        continue;
      }

      if (this.inPreBlock) {
        // Preformatted block terminates by a line without leading
        // whitespace or any special line like ..ABC::.
        if (line.length > 0 && !isWhiteSpace(line.charCodeAt(0))) {
          this.endPreformattedBlock();
        }
      }

      if (this.handleSectionHeader(lines, i)) {
        i += 1; // Eat line with === or ---
        continue;
      }

      if (line.indexOf('generated/') >= 0) {
        continue; // ignore generated content.
      }
      if (line.startsWith('===') || line.startsWith('---')) {
        continue; // Eat standalone === or --- lines.
      }

      if (this.handleDoubleColon(line)) {
        continue;
      }
      if (line.startsWith('..') && line.indexOf('::') > 0) {
        // Ignore lines likes .. sectionauthor:: John Doe.
        continue;
      }

      line = this.convertEmphasis(line);
      line = line.replace(/``/g, '`'); // Convert double backticks to single.

      if (line.length > 0 && isWhiteSpace(line.charCodeAt(0))) {
        // Keep hard line breaks for the pre-indented content.
        line = `  ${line}  `;
      }

      const prevLine = this.md.length > 0 ? this.md[this.md.length - 1] : undefined;
      if (line.length === 0 && prevLine && (prevLine.length === 0 || prevLine.startsWith('```'))) {
        continue; // Avoid more than one empty line in a row.
      }

      this.addLine(line);
    }

    this.tryEndCodePreBlocks();
    return this.md.join(EOL).trim();
  }

  private addLine(line: string): void {
    // Since we use HTML blocks as preformatted text
    // make sure we drop angle brackets since otherwise
    // they will render as tags and attributes
    if (this.inPreBlock) {
      line = line.replace(/</g, '').replace(/>/g, '');
    }
    this.md.push(line);
  }

  private handleCodeBlock(line: string): boolean {
    if (!line.startsWith('```')) {
      return false;
    }
    if (this.inCodeBlock) {
      this.endCodeBlock();
    } else {
      this.startCodeBlock();
    }
    return true;
  }

  private handleSectionHeader(lines: string[], i: number): boolean {
    const line = lines[i];
    if (i < lines.length - 1 && (lines[i + 1].startsWith('==='))) {
      // Section title -> heading level 3.
      this.md.push(`### ${this.convertEmphasis(line)}`);
      return true;
    }
    if (i < lines.length - 1 && (lines[i + 1].startsWith('---'))) {
      // Subsection title -> heading level 4.
      this.md.push(`#### ${this.convertEmphasis(line)}`);
      return true;
    }
    return false;
  }

  private handleDoubleColon(line: string): boolean {
    if (!line.endsWith('::')) {
      return false;
    }
    // Literal blocks begin with `::`. Such as sequence like
    // '... as shown below::' that is followed by a preformatted text.
    if (line.length > 2 && !line.startsWith('..')) {
      // Ignore lines likes .. autosummary:: John Doe.
      // Trim trailing : so :: turns into :.
      this.md.push(line.substring(0, line.length - 1));
    }

    this.startPreformattedBlock(line);
    return true;
  }

  private tryEndCodePreBlocks(): void {
    if (this.inCodeBlock) {
      this.endCodeBlock();
    }
    if (this.inPreBlock) {
      this.endPreformattedBlock();
    }
  }

  private startPreformattedBlock(line: string): void {
    // Remove previous empty line so we avoid double empties.
    this.tryRemovePrecedingEmptyLine();
    // Lie about the language since we don't want preformatted text
    // to be colorized as Python. HTML is more 'appropriate' as it does
    // not colorize -- or + or keywords like 'from'.
    if (line.indexOf('# ') >= 0) {
      this.md.push('```python');
    } else {
      this.md.push('```html');
    }
    this.inPreBlock = true;
  }

  private endPreformattedBlock(): void {
    if (this.inPreBlock) {
      this.md.push('```');
      this.inPreBlock = false;
    }
  }

  private startCodeBlock(): void {
    // Remove previous empty line so we avoid double empties.
    this.tryRemovePrecedingEmptyLine();
    this.md.push('```python');
    this.inCodeBlock = true;
  }

  private endCodeBlock(): void {
    if (this.inCodeBlock) {
      this.md.push('```');
      this.inCodeBlock = false;
    }
  }

  private tryRemovePrecedingEmptyLine(): void {
    if (this.md.length > 0 && this.md[this.md.length - 1].length === 0) {
      this.md.pop();
    }
  }

  private convertEmphasis(line: string): string {
    return line.replace(/\:([\w\W]+)\:/g, '**$1**'); // Convert :word: to **word**.
  }
}
