export interface PayloadChunk {
    payload: string[];
    data: string;
}

export function PAYLOAD_SINGLE_CHUNK(uuid: string): PayloadChunk {
    const val = `{"cwd": "/home/runner/work/vscode-python/vscode-python/path with spaces/src/testTestingRootWkspc/largeWorkspace", "status": "subtest-success", "result": {"test_parameterized_subtest.NumbersTest.test_even (i=0)": {"test": "test_parameterized_subtest.NumbersTest.test_even", "outcome": "subtest-success", "message": "None", "traceback": null, "subtest": "test_parameterized_subtest.NumbersTest.test_even (i=0)"}}}`;
    const payload = `Content-Length: 411
Content-Type: application/json
Request-uuid: ${uuid}

${val}`;
    return {
        payload: [payload],
        data: val,
    };
}

export function PAYLOAD_MULTI_CHUNK(uuid: string): PayloadChunk {
    const val = `{abc}`;
    return {
        payload: [
            `Content-Length: 5
Content-Type: application/json
Request-uuid: ${uuid}

${val}Content-Length: 5
Content-Type: application/json
Request-uuid: ${uuid}

${val}Content-Length: 5
Content-Type: application/json
Request-uuid: ${uuid}

${val}Content-Length: 5
Content-Type: application/json
Request-uuid: ${uuid}

${val}`,
        ],
        data: val + val + val + val,
    };
}

export function PAYLOAD_SPLIT_ACROSS_CHUNKS_ARRAY(uuid: string): Array<string> {
    return [
        `Content-Length: 411
Content-Type: application/json
Request-uuid: ${uuid}

{"cwd": "/home/runner/work/vsc`,
        `ode-python/vscode-python/path with spaces/src/testTestingRootWkspc/largeWorkspace", "status": "subtest-success", "result": {"test_parameterized_subtest.NumbersTest.te`,
        `st_even (i=0)": {"test": "test_parameterized_subtest.NumbersTest.test_even", "outcome": "subtest-success", "message": "None", "traceback": null, "subtest": "test_parameterized_subtest.NumbersTest.test_even (i=0)"}}}`,
    ];
}

export function PAYLOAD_SPLIT_MULTI_CHUNK_ARRAY(uuid: string): Array<string> {
    return [
        `Content-Length: 411
Content-Type: application/json
Request-uuid: ${uuid}

{"cwd": "/home/runner/work/vscode-python/vscode-python/path with spaces/src/testTestingRootWkspc/largeWorkspace", "status": "subtest-success", "result": {"test_parameterized_subtest.NumbersTest.test_even (i=0)": {"test": "test_parameterized_subtest.NumbersTest.test_even", "outcome": "subtest-success", "message": "None", "traceback": null, "subtest": "test_parameterized_subtest.NumbersTest.test_even (i=0)"}}}

Content-Length: 411
Content-Type: application/json
Request-uuid: ${uuid}

{"cwd": "/home/runner/work/vscode-python/vscode-python/path with spaces/src"

Content-Length: 959
Content-Type: application/json
Request-uuid: ${uuid}

{"cwd": "/home/runner/work/vscode-python/vscode-python/path with spaces/src/testTestingRootWkspc/largeWorkspace", "status": "subtest-failure", "result": {"test_parameterized_subtest.NumbersTest.test_even (i=1)": {"test": "test_parameterized_subtest.NumbersTest.test_even", "outcome": "subtest-failure", "message": "(<class 'AssertionError'>, AssertionError('1 != 0'), <traceback object at 0x7fd86fc47580>)", "traceback": "  File \"/opt/hostedtoolcache/Python/3.11.4/x64/lib/python3.11/unittest/case.py\", line 57, in testPartExecutor\n    yield\n  File \"/opt/hostedtoolcache/Python/3.11.4/x64/lib/python3.11/unittest/case.py\", line 538, in subTest\n    yield\n  File \"/home/runner/work/vscode-python/vscode-python/path with spaces/src/testTestingRootWkspc/largeWorkspace/test_parameterized_subtest.py\", line 16, in test_even\n    self.assertEqual(i % 2, 0)\nAssertionError: 1 != 0\n", "subtest": "test_parameterized_subtest.NumbersTest.test_even (i=1)"}}}
Content-Length: 411
Content-Type: application/json
Request-uuid: ${uuid}

{"cwd": "/home/ru`,
        `nner/work/vscode-python/vscode-python/path with spaces/src/testTestingRootWkspc/largeWorkspace", "status": "subtest-success", "result": {"test_parameterized_subtest.Numbers`,
        `Test.test_even (i=2)": {"test": "test_parameterized_subtest.NumbersTest.test_even", "outcome": "subtest-success", "message": "None", "traceback": null, "subtest": "test_parameterized_subtest.NumbersTest.test_even (i=2)"}}}`,
    ];
}

export function PAYLOAD_SPLIT_MULTI_CHUNK_RAN_ORDER_ARRAY(uuid: string): Array<string> {
    return [
        `Content-Length: 411
Content-Type: application/json
Request-uuid: ${uuid}

{"cwd": "/home/runner/work/vscode-python/vscode-python/path with spaces/src/testTestingRootWkspc/largeWorkspace", "status": "subtest-success", "result": {"test_parameterized_subtest.NumbersTest.test_even (i=0)": {"test": "test_parameterized_subtest.NumbersTest.test_even", "outcome": "subtest-success", "message": "None", "traceback": null, "subtest": "test_parameterized_subtest.NumbersTest.test_even (i=0)"}}}

Content-Length: 411
Content-Type: application/json
Request-uuid: 9${uuid}

{"cwd": "/home/runner/work/vscode-`,
        `python/vscode-python/path with`,
        ` spaces/src"

Content-Length: 959
Content-Type: application/json
Request-uuid: ${uuid}

{"cwd": "/home/runner/work/vscode-python/vscode-python/path with spaces/src/testTestingRootWkspc/largeWorkspace", "status": "subtest-failure", "result": {"test_parameterized_subtest.NumbersTest.test_even (i=1)": {"test": "test_parameterized_subtest.NumbersTest.test_even", "outcome": "subtest-failure", "message": "(<class 'AssertionError'>, AssertionError('1 != 0'), <traceback object at 0x7fd86fc47580>)", "traceback": "  File \"/opt/hostedtoolcache/Python/3.11.4/x64/lib/python3.11/unittest/case.py\", line 57, in testPartExecutor\n    yield\n  File \"/opt/hostedtoolcache/Python/3.11.4/x64/lib/python3.11/unittest/case.py\", line 538, in subTest\n    yield\n  File \"/home/runner/work/vscode-python/vscode-python/path with spaces/src/testTestingRootWkspc/largeWorkspace/test_parameterized_subtest.py\", line 16, in test_even\n    self.assertEqual(i % 2, 0)\nAssertionError: 1 != 0\n", "subtest": "test_parameterized_subtest.NumbersTest.test_even (i=1)"}}}
Content-Length: 411
Content-Type: application/json
Request-uuid: ${uuid}

{"cwd": "/home/runner/work/vscode-python/vscode-python/path with spaces/src/testTestingRootWkspc/largeWorkspace", "status": "subtest-success", "result": {"test_parameterized_subtest.NumbersTest.test_even (i=2)": {"test": "test_parameterized_subtest.NumbersTest.test_even", "outcome": "subtest-success", "message": "None", "traceback": null, "subtest": "test_parameterized_subtest.NumbersTest.test_even (i=2)"}}}`,
    ];
}
