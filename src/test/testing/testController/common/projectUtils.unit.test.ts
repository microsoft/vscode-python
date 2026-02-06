// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { Uri } from 'vscode';
import {
    getProjectId,
    createProjectDisplayName,
    parseVsId,
    PROJECT_ID_SEPARATOR,
} from '../../../../client/testing/testController/common/projectUtils';

suite('Project Utils Tests', () => {
    suite('getProjectId', () => {
        test('should return URI string representation', () => {
            const uri = Uri.file('/workspace/project');

            const id = getProjectId(uri);

            expect(id).to.equal(uri.toString());
        });

        test('should be consistent for same URI', () => {
            const uri = Uri.file('/workspace/project');

            const id1 = getProjectId(uri);
            const id2 = getProjectId(uri);

            expect(id1).to.equal(id2);
        });

        test('should be different for different URIs', () => {
            const uri1 = Uri.file('/workspace/project1');
            const uri2 = Uri.file('/workspace/project2');

            const id1 = getProjectId(uri1);
            const id2 = getProjectId(uri2);

            expect(id1).to.not.equal(id2);
        });

        test('should handle Windows paths', () => {
            const uri = Uri.file('C:\\workspace\\project');

            const id = getProjectId(uri);

            expect(id).to.be.a('string');
            expect(id).to.have.length.greaterThan(0);
        });

        test('should handle nested project paths', () => {
            const parentUri = Uri.file('/workspace/parent');
            const childUri = Uri.file('/workspace/parent/child');

            const parentId = getProjectId(parentUri);
            const childId = getProjectId(childUri);

            expect(parentId).to.not.equal(childId);
        });

        test('should match Python Environments extension format', () => {
            const uri = Uri.file('/workspace/project');

            const id = getProjectId(uri);

            // Should match how Python Environments extension keys projects
            expect(id).to.equal(uri.toString());
            expect(typeof id).to.equal('string');
        });
    });

    suite('createProjectDisplayName', () => {
        test('should format name with major.minor version', () => {
            const result = createProjectDisplayName('MyProject', '3.11.2');

            expect(result).to.equal('MyProject (Python 3.11)');
        });

        test('should handle version with patch and pre-release', () => {
            const result = createProjectDisplayName('MyProject', '3.12.0rc1');

            expect(result).to.equal('MyProject (Python 3.12)');
        });

        test('should handle version with only major.minor', () => {
            const result = createProjectDisplayName('MyProject', '3.10');

            expect(result).to.equal('MyProject (Python 3.10)');
        });

        test('should handle invalid version format gracefully', () => {
            const result = createProjectDisplayName('MyProject', 'invalid-version');

            expect(result).to.equal('MyProject (Python invalid-version)');
        });

        test('should handle empty version string', () => {
            const result = createProjectDisplayName('MyProject', '');

            expect(result).to.equal('MyProject (Python )');
        });

        test('should handle version with single digit', () => {
            const result = createProjectDisplayName('MyProject', '3');

            expect(result).to.equal('MyProject (Python 3)');
        });

        test('should handle project name with special characters', () => {
            const result = createProjectDisplayName('My-Project_123', '3.11.5');

            expect(result).to.equal('My-Project_123 (Python 3.11)');
        });

        test('should handle empty project name', () => {
            const result = createProjectDisplayName('', '3.11.2');

            expect(result).to.equal(' (Python 3.11)');
        });
    });

    suite('parseVsId', () => {
        test('should parse project-scoped ID correctly', () => {
            const projectUri = Uri.file('/workspace/project');
            const projectId = getProjectId(projectUri);
            const vsId = `${projectId}${PROJECT_ID_SEPARATOR}test_file.py::test_name`;

            const [parsedProjectId, runId] = parseVsId(vsId);

            expect(parsedProjectId).to.equal(projectId);
            expect(runId).to.equal('test_file.py::test_name');
        });

        test('should handle legacy ID without project scope', () => {
            const vsId = 'test_file.py';

            const [projectId, runId] = parseVsId(vsId);

            expect(projectId).to.be.undefined;
            expect(runId).to.equal('test_file.py');
        });

        test('should handle runId containing separator', () => {
            const projectUri = Uri.file('/workspace/project');
            const projectId = getProjectId(projectUri);
            const vsId = `${projectId}${PROJECT_ID_SEPARATOR}test_file.py::test_class::test_method`;

            const [parsedProjectId, runId] = parseVsId(vsId);

            expect(parsedProjectId).to.equal(projectId);
            expect(runId).to.equal('test_file.py::test_class::test_method');
        });

        test('should handle empty project ID', () => {
            const vsId = `${PROJECT_ID_SEPARATOR}test_file.py::test_name`;

            const [projectId, runId] = parseVsId(vsId);

            expect(projectId).to.equal('');
            expect(runId).to.equal('test_file.py::test_name');
        });

        test('should handle empty runId', () => {
            const vsId = `project-abc123def456${PROJECT_ID_SEPARATOR}`;

            const [projectId, runId] = parseVsId(vsId);

            expect(projectId).to.equal('project-abc123def456');
            expect(runId).to.equal('');
        });

        test('should handle ID with file path', () => {
            const vsId = `project-abc123def456${PROJECT_ID_SEPARATOR}/workspace/tests/test_file.py`;

            const [projectId, runId] = parseVsId(vsId);

            expect(projectId).to.equal('project-abc123def456');
            expect(runId).to.equal('/workspace/tests/test_file.py');
        });

        test('should handle Windows file paths', () => {
            const projectUri = Uri.file('/workspace/project');
            const projectId = getProjectId(projectUri);
            const vsId = `${projectId}${PROJECT_ID_SEPARATOR}C:\\workspace\\tests\\test_file.py`;

            const [parsedProjectId, runId] = parseVsId(vsId);

            expect(parsedProjectId).to.equal(projectId);
            expect(runId).to.equal('C:\\workspace\\tests\\test_file.py');
        });
    });

    suite('Integration Tests', () => {
        test('should generate unique IDs for different URIs', () => {
            const uris = [
                Uri.file('/workspace/a'),
                Uri.file('/workspace/b'),
                Uri.file('/workspace/c'),
                Uri.file('/workspace/d'),
                Uri.file('/workspace/e'),
            ];

            const ids = uris.map((uri) => getProjectId(uri));
            const uniqueIds = new Set(ids);

            expect(uniqueIds.size).to.equal(uris.length, 'All IDs should be unique');
        });

        test('should handle nested project paths', () => {
            const parentUri = Uri.file('/workspace/parent');
            const childUri = Uri.file('/workspace/parent/child');

            const parentId = getProjectId(parentUri);
            const childId = getProjectId(childUri);

            expect(parentId).to.not.equal(childId);
        });

        test('should create complete vsId and parse it back', () => {
            const projectUri = Uri.file('/workspace/myproject');
            const projectId = getProjectId(projectUri);
            const runId = 'tests/test_module.py::TestClass::test_method';
            const vsId = `${projectId}${PROJECT_ID_SEPARATOR}${runId}`;

            const [parsedProjectId, parsedRunId] = parseVsId(vsId);

            expect(parsedProjectId).to.equal(projectId);
            expect(parsedRunId).to.equal(runId);
        });

        test('should match Python Environments extension URI format', () => {
            const uri = Uri.file('/workspace/project');

            const projectId = getProjectId(uri);

            // Should be string representation of URI
            expect(projectId).to.equal(uri.toString());
            expect(typeof projectId).to.equal('string');
        });
    });
});
