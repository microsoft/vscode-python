# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import pathlib

TEST_DATA_PATH = pathlib.Path(__file__).parent / ".data"


def is_same_tree(tree1, tree2) -> bool:
    """Helper function to test if two test trees are the same.

    `is_same_tree` starts by comparing the root attributes, and then checks if all children are the same.
    """
    # Compare the root.
    if any(tree1[key] != tree2[key] for key in ["path", "name", "type_"]):
        return False

    # Compare child test nodes if they exist, otherwise compare test items.
    if "children" in tree1 and "children" in tree2:
        children1 = tree1["children"]
        children2 = tree2["children"]

        # Compare test nodes.
        if len(children1) != len(children2):
            return False
        else:
            return all(is_same_tree(*pair) for pair in zip(children1, children2))
    elif "id_" in tree1 and "id_" in tree2:
        # Compare test items.
        return all(tree1[key] == tree2[key] for key in ["id_", "lineno"])

    return False
