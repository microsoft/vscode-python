# @test
# @https://github.com/DonJayamanne/pyvscSmokeTesting.git
# Feature: Test Explorer Discovering icons and stop discovery
#     Scenario: When debugging tests, the nodes will have the progress icon and clicking stop will stop the debugger (unitest)
#         Given the workspace setting "python.testing.pytestEnabled" is disabled
#         And the workspace setting "python.testing.unittestEnabled" is enabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         And a file named "tests/test_running_delay" is created with the following content
#             """
#             5
#             """
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         Then there are 14 nodes in the test explorer
#         And 14 nodes in the test explorer have a status of "Unknown"
#         When I debug the node "test_three_first_suite" from the test explorer
#         Then the debugger starts
#         When I select the command "Debug: Stop"
#         Then the debugger stops

#     Scenario: When debugging tests, the nodes will have the progress icon and clicking stop will stop the debugger (pytest)
#         Given the package "pytest" is installed
#         And the workspace setting "python.testing.pytestEnabled" is enabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         And a file named "tests/test_running_delay" is created with the following content
#             """
#             5
#             """
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         Then there are 15 nodes in the test explorer
#         And 15 nodes in the test explorer have a status of "Unknown"
#         When I debug the node "test_three_first_suite" from the test explorer
#         Then the debugger starts
#         When I select the command "Debug: Stop"
#         Then the debugger stops

#     Scenario: When debugging tests, the nodes will have the progress icon and clicking stop will stop the debugger (nose)
#         Given the package "nose" is installed
#         And the workspace setting "python.testing.pytestEnabled" is disabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is enabled
#         And a file named "tests/test_running_delay" is created with the following content
#             """
#             5
#             """
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         Then there are 14 nodes in the test explorer
#         And 14 nodes in the test explorer have a status of "Unknown"
#         When I debug the node "test_three_first_suite" from the test explorer
#         Then the debugger starts
#         When I select the command "Debug: Stop"
#         Then the debugger stops

#     Scenario: When debugging tests, only the specific function will be debugged (unitest)
#         Given the workspace setting "python.testing.pytestEnabled" is disabled
#         And the workspace setting "python.testing.unittestEnabled" is enabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         When I add a breakpoint to line 33 in "test_one.py"
#         And I add a breakpoint to line 23 in "test_one.py"
#         And I debug the node "test_three_first_suite" from the test explorer
#         Then the debugger starts
#         And the debugger pauses
#         And the current stack frame is at line 33 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger stops


#     Scenario: When debugging tests, only the specific function will be debugged (pytest)
#         Given the package "pytest" is installed
#         And the workspace setting "python.testing.pytestEnabled" is enabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         When I add a breakpoint to line 33 in "test_one.py"
#         And I add a breakpoint to line 23 in "test_one.py"
#         And I debug the node "test_three_first_suite" from the test explorer
#         Then the debugger starts
#         And the debugger pauses
#         And the current stack frame is at line 33 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger stops

#     Scenario: When debugging tests, only the specific function will be debugged (nose)
#         Given the package "nose" is installed
#         And the workspace setting "python.testing.pytestEnabled" is disabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is enabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         When I add a breakpoint to line 33 in "test_one.py"
#         And I add a breakpoint to line 23 in "test_one.py"
#         And I debug the node "test_three_first_suite" from the test explorer
#         Then the debugger starts
#         And the debugger pauses
#         And the current stack frame is at line 33 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger stops


#     Scenario: When debugging tests, only the specific suite will be debugged (unitest)
#         Given the workspace setting "python.testing.pytestEnabled" is disabled
#         And the workspace setting "python.testing.unittestEnabled" is enabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         When I add a breakpoint to line 33 in "test_one.py"
#         And I add a breakpoint to line 28 in "test_one.py"
#         And I add a breakpoint to line 23 in "test_one.py"
#         And I debug the node "TestFirstSuite" from the test explorer
#         Then the debugger starts
#         And the debugger pauses
#         And the current stack frame is at line 23 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger pauses
#         And the current stack frame is at line 33 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger pauses
#         And the current stack frame is at line 28 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger stops


#     Scenario: When debugging tests, only the specific suite will be debugged (pytest)
#         Given the package "pytest" is installed
#         And the workspace setting "python.testing.pytestEnabled" is enabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         When I add a breakpoint to line 33 in "test_one.py"
#         And I add a breakpoint to line 28 in "test_one.py"
#         And I add a breakpoint to line 23 in "test_one.py"
#         And I debug the node "TestFirstSuite" from the test explorer
#         Then the debugger starts
#         And the debugger pauses
#         And the current stack frame is at line 23 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger pauses
#         And the current stack frame is at line 33 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger pauses
#         And the current stack frame is at line 28 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger stops

#     Scenario: When debugging tests, only the specific suite will be debugged (nose)
#         Given the package "nose" is installed
#         And the workspace setting "python.testing.pytestEnabled" is disabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is enabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         When I add a breakpoint to line 33 in "test_one.py"
#         And I add a breakpoint to line 28 in "test_one.py"
#         And I add a breakpoint to line 23 in "test_one.py"
#         And I debug the node "TestFirstSuite" from the test explorer
#         Then the debugger starts
#         And the debugger pauses
#         And the current stack frame is at line 23 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger pauses
#         And the current stack frame is at line 33 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger pauses
#         And the current stack frame is at line 28 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger stops

#     Scenario: When debugging tests, everything will be debugged (unitest)
#         Given the workspace setting "python.testing.pytestEnabled" is disabled
#         And the workspace setting "python.testing.unittestEnabled" is enabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         When I add a breakpoint to line 23 in "test_one.py"
#         And I add a breakpoint to line 38 in "test_one.py"
#         And I add a breakpoint to line 23 in "test_two.py"
#         And I select the command "Python: Debug All Tests"
#         Then the debugger starts
#         And the debugger pauses
#         And the current stack frame is at line 23 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger pauses
#         And the current stack frame is at line 38 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger pauses
#         And the current stack frame is at line 23 in "test_two.py"
#         When I select the command "Debug: Continue"
#         Then the debugger stops


#     Scenario: When debugging tests, everything will be debugged (pytest)
#         Given the package "pytest" is installed
#         And the workspace setting "python.testing.pytestEnabled" is enabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         When I add a breakpoint to line 23 in "test_one.py"
#         And I add a breakpoint to line 38 in "test_one.py"
#         And I add a breakpoint to line 23 in "test_two.py"
#         And I select the command "Python: Debug All Tests"
#         Then the debugger starts
#         And the debugger pauses
#         And the current stack frame is at line 23 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger pauses
#         And the current stack frame is at line 38 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger pauses
#         And the current stack frame is at line 23 in "test_two.py"
#         When I select the command "Debug: Continue"
#         Then the debugger stops

#     Scenario: When debugging tests, everything will be debugged (nose)
#         Given the package "nose" is installed
#         And the workspace setting "python.testing.pytestEnabled" is disabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is enabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         When I add a breakpoint to line 23 in "test_one.py"
#         And I add a breakpoint to line 38 in "test_one.py"
#         And I add a breakpoint to line 23 in "test_two.py"
#         And I select the command "Python: Debug All Tests"
#         Then the debugger starts
#         And the debugger pauses
#         And the current stack frame is at line 23 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger pauses
#         And the current stack frame is at line 38 in "test_one.py"
#         When I select the command "Debug: Continue"
#         Then the debugger pauses
#         And the current stack frame is at line 23 in "test_two.py"
#         When I select the command "Debug: Continue"
#         Then the debugger stops
