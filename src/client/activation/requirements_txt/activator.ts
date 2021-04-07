import { IExtensionSingleActivationService } from '../types';
import {
  Hover,
  languages,
  TextDocument,
  Position.
  WorkspaceEdit,
} from 'vscode';

export class RequirementsTxtLinkActivator implements IExtensionSingleActivationService {

  public async activate(): Promise<void> {
    languages.registerHoverProvider({ pattern: '**/requirements.txt'}, {
      provideHover(
        document: TextDocument,
        position: Position,
      ) {
        
        const regex = '^(.*)==';

        const row = document.lineAt(position.line).text;
        const projectName = row.match(regex);
        
        if (projectName) {
          return new Hover("https://pypi.org/project/" + projectName[0].replace('==', '') + "/");
        } else {
          return null;
        }
      }
    });
  }
}