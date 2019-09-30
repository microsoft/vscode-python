# @testing @ci @debug @run
# @/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing
# Feature: Testing (run, debug, code lenses)
#     Background: Set up tests
#            Given the problems panel is open
#         Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
#         Given the file "tests/test_discovery_delay" is updated with the value "0"
#         Given the file "tests/test_running_delay" is updated with the value "0"
#         Given the file "tests/data.json" is updated with the value "[1,2,3,4,5,6]"
#         Given the file ".vscode/launch.json" does not exist
#         When I select the command "Python: Discover Unit Tests"
#         Then wait for 1 second
#         Then wait for the test icon to appear within 5 seconds
#         When I select the command "View: Show Test"
#         Then take a screenshot
#         Then the toolbar button with the text "Run All Unit Tests" is visible
#         Then the toolbar button with the text "Debug All Unit Tests" is visible
#         Then the toolbar button with the text "Discover Unit Tests" is visible
#         Then the toolbar button with the text "Show Unit Test Output" is visible
#         Then the toolbar button with the text "Run Failed Unit Tests" is not visible
#         Then the toolbar button with the text "Stop" is not visible
#         Then expand test explorer tree

#     @scenario1
#     Scenario: Debug all tests and add breakpoints to two files
#         Given the file "test_one.py" is open
#         Given the file is scrolled to the top
#         When I close all editors
#         Given the file "test_one.py" is open
#         When I add a breakpoint to line 22
#         Given the file "test_two.py" is open
#         Given the file is scrolled to the top
#         When I close all editors
#         Given the file "test_two.py" is open
#         When I add a breakpoint to line 12
#         When I close all editors
#         When I select the command "Python: Debug All Unit Tests"
#         Then debugger starts
#         Then stack frame for file "test_one.py" and line 22 is displayed
#         Then take a screenshot
#         When I select the command "Debug: Continue"
#         Then stack frame for file "test_two.py" and line 12 is displayed

#     @scenario2
#     Scenario: Debug file by clicking a node with breakpoint
#         Given the file "test_one.py" is open
#         Given the file is scrolled to the top
#         When I close all editors
#         Given the file "test_one.py" is open
#         When I add a breakpoint to line 22
#         When I close all editors
#         When I select test tree node number 2 and press debug
#         Then debugger starts
#         Then stack frame for file "test_one.py" and line 22 is displayed

#     @scenario3
#     Scenario: Debug suite with breakpoint
#         Given the file "test_one.py" is open
#         Given the file is scrolled to the top
#         When I close all editors
#         Given the file "test_one.py" is open
#         When I add a breakpoint to line 22
#         When I close all editors
#         When I select test tree node number 3 and press debug
#         Then debugger starts
#         Then stack frame for file "test_one.py" and line 22 is displayed

#     @scenario3
#     Scenario: Debug function with breakpoint
#         Given the file "test_one.py" is open
#         Given the file is scrolled to the top
#         When I close all editors
#         Given the file "test_one.py" is open
#         When I add a breakpoint to line 22
#         When I close all editors
#         When I select test tree node number 4 and press debug
#         Then debugger starts
#         Then stack frame for file "test_one.py" and line 22 is displayed

#     @scenario4
#     Scenario: Code Lenses appear
#         Given the file "test_one.py" is open
#         Given the file is scrolled to the top
#         When I close all editors
#         Given the file "test_one.py" is open
#         Then code lens "Run Test" is visible in 5 seconds
#         Then code lens "Debug Test" is visible

#     @scenario5
#     Scenario: Running test suite via Code Lenses will display progress indicator on tree
#         Given the file "tests/test_running_delay" is updated with the value "5"
#         Given the file "test_one.py" is open
#         Given the file is scrolled to the top
#         When I close all editors
#         Given the file "test_one.py" is open
#         Then code lens "Run Test" is visible in 5 seconds
#         When I click first code lens "Run Test"
#         When I select the command "View: Show Test"
#         Then wait for 1 second
#         Then there are at least 4 running test items
#         Then the toolbar button with the text "Stop" is visible
#         Then stop the tests

#     @scenario6
#     Scenario: Running test function via Code Lenses will display progress indicator on tree
#         Given the file "tests/test_running_delay" is updated with the value "5"
#         Given the file "test_one.py" is open
#         Given the file is scrolled to the top
#         When I close all editors
#         Given the file "test_one.py" is open
#         Then code lens "Run Test" is visible in 5 seconds
#         When I click second code lens "Run Test"
#         Then wait for 1 second
#         Then there are 1 running test items
#         Then the toolbar button with the text "Stop" is visible
#         Then take a screenshot
#         Then stop the tests

#     @scenario7
#     Scenario: Debugging test suite via Code Lenses
#         Given the file "test_one.py" is open
#         Given the file is scrolled to the top
#         When I close all editors
#         Given the file "test_one.py" is open
#         When I add a breakpoint to line 22
#         When I select the command "View: Show Test"
#         When I click first code lens "Debug Test"
#         Then wait for 1 second
#         Then debugger starts
#         Then stack frame for file "test_one.py" and line 22 is displayed

#     @scenario8
#     Scenario: Debugging test function via Code Lenses
#         Given the file "test_one.py" is open
#         Given the file is scrolled to the top
#         When I close all editors
#         Given the file "test_one.py" is open
#         When I add a breakpoint to line 22
#         Then code lens "Run Test" is visible in 5 seconds
#         When I click second code lens "Debug Test"
#         Then wait for 1 second
#         Then debugger starts
#         Then stack frame for file "test_one.py" and line 22 is displayed
