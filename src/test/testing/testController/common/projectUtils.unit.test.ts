// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { Uri } from 'vscode';
import {
    generateProjectId,
    createProjectDisplayName,
    parseVsId,
    PROJECT_ID_SEPARATOR,
} from '../../../../client/testing/testController/common/projectUtils';
import { PythonProject } from '../../../../client/envExt/types';

suite('Project Utils Tests', () => {
    suite('generateProjectId', () => {
        test('should generate consistent IDs for same project', () => {
            const project: PythonProject = {
                name: 'test-project',
                uri: Uri.file('/workspace/project'),
            };

            const id1 = generateProjectId(project);
            const id2 = generateProjectId(project);

            expect(id1).to.equal(id2);
        });

        test('should generate different IDs for different URIs', () => {
            const project1: PythonProject = {
                name: 'test-project',
                uri: Uri.file('/workspace/project1'),
            };

            const project2: PythonProject = {
                name: 'test-project',
                uri: Uri.file('/workspace/project2'),
            };

            const id1 = generateProjectId(project1);
            const id2 = generateProjectId(project2);

            expect(id1).to.not.equal(id2);
        });

        test('should generate different IDs for different names with same URI', () => {
            const uri = Uri.file('/workspace/project');

            const project1: PythonProject = {
                name: 'project-a',
                uri,
            };

            const project2: PythonProject = {
                name: 'project-b',
                uri,
            };

            const id1 = generateProjectId(project1);
            const id2 = generateProjectId(project2);

            expect(id1).to.not.equal(id2);
        });

        test('should generate ID with correct format', () => {
            const project: PythonProject = {
                name: 'test-project',
                uri: Uri.file('/workspace/project'),
            };

            const id = generateProjectId(project);

            expect(id).to.match(/^project-[a-f0-9]{16}$/);
        });

        test('should use 16 character hash for collision resistance', () => {
            const project: PythonProject = {
                name: 'test-project',
                uri: Uri.file('/workspace/project'),
            };

            const id = generateProjectId(project);
            const hashPart = id.substring('project-'.length);

            expect(hashPart).to.have.lengthOf(16);
        });

        test('should handle Windows paths correctly', () => {
            const project: PythonProject = {
                name: 'test-project',
                uri: Uri.file('C:\\workspace\\project'),
            };

            const id = generateProjectId(project);

            expect(id).to.match(/^project-[a-f0-9]{16}$/);
        });

        test('should handle project names with special characters', () => {
            const project: PythonProject = {
                name: 'test-project!@#$%^&*()',
                uri: Uri.file('/workspace/project'),
            };

            const id = generateProjectId(project);

            expect(id).to.match(/^project-[a-f0-9]{16}$/);
        });

        test('should handle empty project name', () => {
            const project: PythonProject = {
                name: '',
                uri: Uri.file('/workspace/project'),
            };

            const id = generateProjectId(project);

            expect(id).to.match(/^project-[a-f0-9]{16}$/);
        });

        test('should generate stable IDs across multiple calls', () => {
            const project: PythonProject = {
                name: 'test-project',
                uri: Uri.file('/workspace/project'),
            };

            const ids = new Set<string>();
            for (let i = 0; i < 100; i++) {
                ids.add(generateProjectId(project));
            }

            expect(ids.size).to.equal(1, 'Should generate same ID consistently');
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
            const vsId = `project-abc123def456${PROJECT_ID_SEPARATOR}test_file.py::test_name`;

            const [projectId, runId] = parseVsId(vsId);

            expect(projectId).to.equal('project-abc123def456');
            expect(runId).to.equal('test_file.py::test_name');
        });

        test('should handle legacy ID without project scope', () => {
            const vsId = 'test_file.py';

            const [projectId, runId] = parseVsId(vsId);

            expect(projectId).to.be.undefined;
            expect(runId).to.equal('test_file.py');
        });

        test('should handle runId containing separator', () => {
            const vsId = `project-abc123def456${PROJECT_ID_SEPARATOR}test_file.py::test_class::test_method`;

            const [projectId, runId] = parseVsId(vsId);

            expect(projectId).to.equal('project-abc123def456');
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
            const vsId = `project-abc123def456${PROJECT_ID_SEPARATOR}C:\\workspace\\tests\\test_file.py`;

            const [projectId, runId] = parseVsId(vsId);

            expect(projectId).to.equal('project-abc123def456');
            expect(runId).to.equal('C:\\workspace\\tests\\test_file.py');
        });

        test('should roundtrip with generateProjectId', () => {
            const project: PythonProject = {
                name: 'test-project',
                uri: Uri.file('/workspace/project'),
            };
            const runId = 'test_file.py::test_name';

            const projectId = generateProjectId(project);
            const vsId = `${projectId}${PROJECT_ID_SEPARATOR}${runId}`;
            const [parsedProjectId, parsedRunId] = parseVsId(vsId);

            expect(parsedProjectId).to.equal(projectId);
            expect(parsedRunId).to.equal(runId);
        });
    });

    suite('Integration Tests', () => {
        test('should generate unique IDs for multiple projects', () => {
            const projects: PythonProject[] = [
                { name: 'project-a', uri: Uri.file('/workspace/a') },
                { name: 'project-b', uri: Uri.file('/workspace/b') },
                { name: 'project-c', uri: Uri.file('/workspace/c') },
                { name: 'project-d', uri: Uri.file('/workspace/d') },
                { name: 'project-e', uri: Uri.file('/workspace/e') },
            ];

            const ids = projects.map((p) => generateProjectId(p));
            const uniqueIds = new Set(ids);

            expect(uniqueIds.size).to.equal(projects.length, 'All IDs should be unique');
        });

        test('should handle nested project paths', () => {
            const parentProject: PythonProject = {
                name: 'parent',
                uri: Uri.file('/workspace/parent'),
            };

            const childProject: PythonProject = {
                name: 'child',
                uri: Uri.file('/workspace/parent/child'),
            };

            const parentId = generateProjectId(parentProject);
            const childId = generateProjectId(childProject);

            expect(parentId).to.not.equal(childId);
        });

        test('should create complete vsId and parse it back', () => {
            const project: PythonProject = {
                name: 'MyProject',
                uri: Uri.file('/workspace/myproject'),
            };

            const projectId = generateProjectId(project);
            const runId = 'tests/test_module.py::TestClass::test_method';
            const vsId = `${projectId}${PROJECT_ID_SEPARATOR}${runId}`;

            const [parsedProjectId, parsedRunId] = parseVsId(vsId);

            expect(parsedProjectId).to.equal(projectId);
            expect(parsedRunId).to.equal(runId);
        });

        test('should handle collision probability with many projects', () => {
            // Generate 1000 projects and ensure no collisions
            const projects: PythonProject[] = [];
            for (let i = 0; i < 1000; i++) {
                projects.push({
                    name: `project-${i}`,
                    uri: Uri.file(`/workspace/project-${i}`),
                });
            }

            const ids = projects.map((p) => generateProjectId(p));
            const uniqueIds = new Set(ids);

            expect(uniqueIds.size).to.equal(projects.length, 'Should have no collisions even with 1000 projects');
        });
    });
});
