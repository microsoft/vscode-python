import os

import testresources
from testscenarios import generate_scenarios


print("made it to __init__")

def load_tests(loader, tests, pattern):
    this_dir = os.path.dirname(__file__)
    mytests = loader.discover(start_dir=this_dir, pattern=pattern)
    result = testresources.OptimisingTestSuite()
    result.addTests(generate_scenarios(mytests))
    result.addTests(generate_scenarios(tests))
    return result
