export interface DataWithPayloadChunks {
    payloadArray: string[];
    data: string;
}

const EOT_PAYLOAD = `Content-Length: 42
Content-Type: application/json
Request-uuid: fake-u-u-i-d

{"command_type": "execution", "eot": true}`;

const SINGLE_UNITTEST_SUBTEST = {
    cwd: '/home/runner/work/vscode-python/vscode-python/path with spaces/src/testTestingRootWkspc/largeWorkspace',
    status: 'success',
    result: {
        'test_parameterized_subtest.NumbersTest.test_even (i=0)': {
            test: 'test_parameterized_subtest.NumbersTest.test_even',
            outcome: 'success',
            message: 'None',
            traceback: null,
            subtest: 'test_parameterized_subtest.NumbersTest.test_even (i=0)',
        },
    },
};

const SINGLE_PYTEST_PAYLOAD = {
    cwd: 'path/to',
    status: 'success',
    result: {
        'path/to/file.py::test_funct': {
            test: 'path/to/file.py::test_funct',
            outcome: 'success',
            message: 'None',
            traceback: null,
            subtest: 'path/to/file.py::test_funct',
        },
    },
};

const SINGLE_PYTEST_PAYLOAD_TWO = {
    cwd: 'path/to/second',
    status: 'success',
    result: {
        'path/to/workspace/parametrize_tests.py::test_adding[3+5-8]': {
            test: 'path/to/workspace/parametrize_tests.py::test_adding[3+5-8]',
            outcome: 'success',
            message: 'None',
            traceback: null,
        },
    },
};

export function createPayload(uuid: string, data: unknown): string {
    return `Content-Length: ${JSON.stringify(data).length}
Content-Type: application/json
Request-uuid: ${uuid}

${JSON.stringify(data)}`;
}

export function PAYLOAD_SINGLE_CHUNK(uuid: string): DataWithPayloadChunks {
    const payload = createPayload(uuid, SINGLE_UNITTEST_SUBTEST);

    return {
        payloadArray: [payload, EOT_PAYLOAD],
        data: JSON.stringify(SINGLE_UNITTEST_SUBTEST.result),
    };
}

// more than one payload (item with header) per chunk sent
// payload has 3 SINGLE_UNITTEST_SUBTEST
export function PAYLOAD_MULTI_CHUNK(uuid: string): DataWithPayloadChunks {
    let payload = '';
    let result = '';
    for (let i = 0; i < 3; i = i + 1) {
        payload += createPayload(uuid, SINGLE_UNITTEST_SUBTEST);
        result += JSON.stringify(SINGLE_UNITTEST_SUBTEST.result);
    }
    return {
        payloadArray: [payload, EOT_PAYLOAD],
        data: result,
    };
}

// more than one payload, split so the first one is only 'Content-Length' to confirm headers
// with null values are ignored
export function PAYLOAD_ONLY_HEADER_MULTI_CHUNK(uuid: string): DataWithPayloadChunks {
    const payloadArray: string[] = [];
    const result = JSON.stringify(SINGLE_UNITTEST_SUBTEST.result);

    const val = createPayload(uuid, SINGLE_UNITTEST_SUBTEST);
    const firstSpaceIndex = val.indexOf(' ');
    const payload1 = val.substring(0, firstSpaceIndex);
    const payload2 = val.substring(firstSpaceIndex);
    payloadArray.push(payload1);
    payloadArray.push(payload2);
    payloadArray.push(EOT_PAYLOAD);
    return {
        payloadArray,
        data: result,
    };
}

// single payload divided by an arbitrary character and split across payloads
export function PAYLOAD_SPLIT_ACROSS_CHUNKS_ARRAY(uuid: string): DataWithPayloadChunks {
    const payload = createPayload(uuid, SINGLE_PYTEST_PAYLOAD);
    // payload length is know to be >200
    const splitPayload: Array<string> = [
        payload.substring(0, 50),
        payload.substring(50, 100),
        payload.substring(100, 150),
        payload.substring(150),
    ];
    const finalResult = JSON.stringify(SINGLE_PYTEST_PAYLOAD.result);
    splitPayload.push(EOT_PAYLOAD);
    return {
        payloadArray: splitPayload,
        data: finalResult,
    };
}

// here a payload is split across the buffer chunks and there are multiple payloads in a single buffer chunk
export function PAYLOAD_SPLIT_MULTI_CHUNK_ARRAY(uuid: string): DataWithPayloadChunks {
    // payload1 length is know to be >200
    const payload1 = createPayload(uuid, SINGLE_PYTEST_PAYLOAD);
    const payload2 = createPayload(uuid, SINGLE_PYTEST_PAYLOAD_TWO);

    // chunk 1 is 50 char of payload1, chunk 2 is 50-end of payload1 and all of payload2
    const splitPayload: Array<string> = [payload1.substring(0, 100), payload1.substring(100).concat(payload2)];
    const finalResult = JSON.stringify(SINGLE_PYTEST_PAYLOAD.result).concat(
        JSON.stringify(SINGLE_PYTEST_PAYLOAD_TWO.result),
    );

    splitPayload.push(EOT_PAYLOAD);
    return {
        payloadArray: splitPayload,
        data: finalResult,
    };
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
