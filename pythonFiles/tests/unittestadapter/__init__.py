# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

from pathlib import Path

TEST_DATA_PATH = Path(Path(__file__).parent, ".data")

# Helper function to test if two test trees are the same.
def is_same_tree(tree1, tree2) -> bool:
    # Compare the root
    if (
        tree1["path"] != tree2["path"]
        or tree1["name"] != tree2["name"]
        or tree1["type_"] != tree2["type_"]
    ):
        return False

    # Compare child test nodes if they exist, otherwise compare test items.
    if "children" in tree1 and "children" in tree2:
        children1 = tree1["children"]
        children2 = tree2["children"]

        # Compare test nodes
        if len(children1) != len(children2):
            return False
        else:
            result = True
            index = 0
            while index < len(children1) and result == True:
                result = result and is_same_tree(children1[index], children2[index])
                index = index + 1
            return result
    elif "id_" in tree1 and "id_" in tree2:
        # Compare test items
        return tree1["id_"] == tree2["id_"] and tree1["lineno"] == tree2["lineno"]

    return False
