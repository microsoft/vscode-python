import importlib
import textwrap

import normalizeSelection


def test_part_dictionary():
    importlib.reload(normalizeSelection)
    src = 'import textwrap\nimport ast\n\nprint("Audi")\nprint("Genesis")\n\n\nprint("Audi");print("BMW");print("Mercedes")\n\nmy_dict = {\n    "key1": "value1",\n    "key2": "value2"\n}\n\n\nsrc = """\nmy_dict = {\n"key1": "value1",\n"key2": "value2"\n}\n"""\n\ntop_level_nodes = []\n\nparsed_file_content = ast.parse(src)\nprint(ast.dump(parsed_file_content))\n\nparsed_dict_content2 = ast.parse(str(my_dict))\nprint(ast.dump(parsed_dict_content2))\n\n\nfor node in ast.iter_child_nodes(parsed_file_content):\n        top_level_nodes.append(node)\n        line_start = node.lineno\n        line_end = node.end_lineno\n        code_of_node = ast.get_source_segment(wholeFileContent, node)\n        ast.get_source_segment(wholeFileContent, node) # This is way to get original code of the selected node\n\n################################################################################\n# New test case(s):\n# what should happen when shift enter at line 5? \n# follow ast says ----- TODO \n\n# execute individually line 5 bc two statements ---- TODO \n#################################################################################'  # noqa: E501

    expected = 'my_dict = {\n    "key1": "value1",\n    "key2": "value2"\n}\n'
    # parsed_file_content = ast.parse(src)
    # top_level_nodes = []
    # for node in ast.iter_child_nodes(parsed_file_content):
    #     print(node.__dir__())
    result = normalizeSelection.traverse_file(src, 10, 11, False)
    assert result == expected


def test_smart_shift_enter_multiple_statements():
    importlib.reload(normalizeSelection)
    src = textwrap.dedent(
        """\
        import textwrap
        import ast

        print("Porsche")
        print("Genesis")


        print("Audi");print("BMW");print("Mercedes")

        print("dont print me")

        """
    )
    # Expected to printing statement line by line
    expected = textwrap.dedent(
        """\
        print("Audi")
        print("BMW")
        print("Mercedes")
        """
    )
    result = normalizeSelection.traverse_file(src, 8, 8, False)
    # print(result)
    assert result == expected


def test_two_layer_dictionary():
    importlib.reload(normalizeSelection)
    src = textwrap.dedent(
        """\
        print("dont print me")

        two_layered_dictionary = {
            'inner_dict_one': {
                'Audi': 'Germany',
                'BMW': 'Germnay',
                'Genesis': 'Korea',
            },
            'inner_dict_two': {
                'Mercedes': 'Germany',
                'Porsche': 'Germany',
                'Lamborghini': 'Italy',
                'Ferrari': 'Italy',
                'Maserati': 'Italy'
            }
        }
        """
    )
    expected = textwrap.dedent(
        """\
        two_layered_dictionary = {
            'inner_dict_one': {
                'Audi': 'Germany',
                'BMW': 'Germnay',
                'Genesis': 'Korea',
            },
            'inner_dict_two': {
                'Mercedes': 'Germany',
                'Porsche': 'Germany',
                'Lamborghini': 'Italy',
                'Ferrari': 'Italy',
                'Maserati': 'Italy'
            }
        }
        """
    )
    result = normalizeSelection.traverse_file(src, 6, 7, False)

    assert result == expected


def test_run_whole_func():
    importlib.reload(normalizeSelection)
    src = textwrap.dedent(
        """\
        def my_dogs():
            print("Corgi")
            print("Husky")
            print("Corgi2")
            print("Husky2")
            print("no dogs")
        """
    )
    # Expected to printing statement line by line
    expected = textwrap.dedent(
        """\
        def my_dogs():
            print("Corgi")
            print("Husky")
            print("Corgi2")
            print("Husky2")
            print("no dogs")

        """
    )
    result = normalizeSelection.traverse_file(src, 1, 1, False)

    assert result == expected

def test_small_forloop():
    importlib.reload(normalizeSelection)
    src = textwrap.dedent(
        """\
        for i in range(1, 6):
            print(i)
            print("Please also send this print statement")
        """
    )
    expected = textwrap.dedent(
        """\
        for i in range(1, 6):
            print(i)
            print("Please also send this print statement")

        """
    )

    # Cover the whole for loop block with multiple inner statements
    result = normalizeSelection.traverse_file(src,1,1,False)

    assert result == expected
