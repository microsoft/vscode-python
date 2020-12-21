'use strict';

import { EOL } from 'os';
import {
    CancellationToken,
    ParameterInformation,
    Position,
    SignatureHelp,
    SignatureHelpProvider,
    SignatureInformation,
    TextDocument,
} from 'vscode';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { captureTelemetry } from '../telemetry';
import { EventName } from '../telemetry/constants';
import * as proxy from './jediProxy';
import { isPositionInsideStringOrComment } from './providerUtilities';

const DOCSTRING_PARAM_PATTERNS = [
    '\\s*:type\\s*PARAMNAME:\\s*([^\\n, ]+)', // Sphinx
    '\\s*:param\\s*(\\w?)\\s*PARAMNAME:[^\\n]+', // Sphinx param with type
    '\\s*@type\\s*PARAMNAME:\\s*([^\\n, ]+)', // Epydoc
];

/**
 * Extract the documentation for parameters from a given docstring.
 * @param {string} paramName Name of the parameter
 * @param {string} docString The docstring for the function
 * @returns {string} Docstring for the parameter
 */
function extractParamDocString(paramName: string, docString: string): string {
    let paramDocString = '';
    // In docstring the '*' is escaped with a backslash
    paramName = paramName.replace(new RegExp('\\*', 'g'), '\\\\\\*');

    DOCSTRING_PARAM_PATTERNS.forEach((pattern) => {
        if (paramDocString.length > 0) {
            return;
        }
        pattern = pattern.replace('PARAMNAME', paramName);
        const regExp = new RegExp(pattern);
        const matches = regExp.exec(docString);
        if (matches && matches.length > 0) {
            paramDocString = matches[0];
            if (paramDocString.indexOf(':') >= 0) {
                paramDocString = paramDocString.substring(paramDocString.indexOf(':') + 1);
            }
            if (paramDocString.indexOf(':') >= 0) {
                paramDocString = paramDocString.substring(paramDocString.indexOf(':') + 1);
            }
        }
    });

    return paramDocString.trim();
}
export class PythonSignatureProvider implements SignatureHelpProvider {
    public constructor(private jediFactory: JediFactory) {}
    private static parseData(data: proxy.IArgumentsResult): SignatureHelp {
        if (data && Array.isArray(data.definitions) && data.definitions.length > 0) {
            const signature = new SignatureHelp();
            signature.activeSignature = 0;

            data.definitions.forEach((def) => {
                signature.activeParameter = def.paramindex;
                // Don't display the documentation, as vs code doesn't format the documentation.
                // i.e. line feeds are not respected, long content is stripped.

                // Some functions do not come with parameter docs
                let label: string;
                let documentation: string;
                const validParamInfo =
                    def.params && def.params.length > 0 && def.docstring && def.docstring.startsWith(`${def.name}(`);

                if (validParamInfo) {
                    const docLines = def.docstring.splitLines();
                    label = docLines.shift()!.trim();
                    documentation = docLines.join(EOL).trim();
                } else {
                    if (def.params && def.params.length > 0) {
                        label = `${def.name}(${def.params.map((p) => p.name).join(', ')})`;
                        documentation = def.docstring;
                    } else {
                        label = def.description;
                        documentation = def.docstring;
                    }
                }

                // tslint:disable-next-line:no-object-literal-type-assertion
                const sig = <SignatureInformation>{
                    label,
                    documentation,
                    parameters: [],
                };

                if (def.params && def.params.length) {
                    sig.parameters = def.params.map((arg) => {
                        if (arg.docstring.length === 0) {
                            arg.docstring = extractParamDocString(arg.name, def.docstring);
                        }
                        // tslint:disable-next-line:no-object-literal-type-assertion
                        return <ParameterInformation>{
                            documentation: arg.docstring.length > 0 ? arg.docstring : arg.description,
                            label: arg.name.trim(),
                        };
                    });
                }
                signature.signatures.push(sig);
            });
            return signature;
        }

        return new SignatureHelp();
    }
    @captureTelemetry(EventName.SIGNATURE)
    public provideSignatureHelp(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
    ): Thenable<SignatureHelp> {
        // early exit if we're in a string or comment (or in an undefined position)
        if (position.character <= 0 || isPositionInsideStringOrComment(document, position)) {
            return Promise.resolve(new SignatureHelp());
        }

        const cmd: proxy.ICommand = {
            command: proxy.CommandType.Arguments,
            fileName: document.fileName,
            columnIndex: position.character,
            lineIndex: position.line,
            source: document.getText(),
        };
        return this.jediFactory
            .getJediProxyHandler<proxy.IArgumentsResult>(document.uri)
            .sendCommand(cmd, token)
            .then((data) => {
                return data ? PythonSignatureProvider.parseData(data) : new SignatureHelp();
            });
    }
}
