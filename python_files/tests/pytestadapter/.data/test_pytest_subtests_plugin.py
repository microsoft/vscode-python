# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

def test_a(subtests):
    with subtests.test(msg="test_a"):
        assert 1 == 1
    with subtests.test(msg="Second subtest"):
        assert 2 == 1
