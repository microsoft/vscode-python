# @testing @ci @tree
# @/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing
# Feature: Testing (tree view)
#     Background: Set up tests
#         Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
#         Given the file "tests/test_discovery_delay" is updated with the value "0"
#         Given the file "tests/test_running_delay" is updated with the value "0"
#         Given the file "tests/data.json" is updated with the value "[1,2,3,4,5,6]"
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
#     Scenario: Successful tree nodes
#         When I select the command "Python: Run All Unit Tests"
#         Then wait for 1 second
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 5 seconds
#         Then there are 9 success test items

#     @scenario2
#     Scenario: Running single item
#         When I select the command "Python: Run All Unit Tests"
#         Then wait for 1 second
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 5 seconds
#         Given the file "tests/test_running_delay" is updated with the value "2"
#         When I select test tree node number 6 and press run
#         Then there are at least 1 running test items
#         Then there are 8 success test items
#         Then take a screenshot
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 5 seconds
#         Then there are 9 success test items
#         Then take a screenshot

#     @scenario3
#     Scenario: Running failed tests, run agian and then fix and run again
#         Given the file "tests/data.json" is updated with the value "[0,0,0,4,5,6]"
#         When I select the command "Python: Run All Unit Tests"
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 5 seconds
#         Then there are at least 6 error test items
#         Then there are 3 success test items
#         Then the toolbar button with the text "Run All Unit Tests" is visible
#         Then the toolbar button with the text "Run Failed Unit Tests" is visible
#         Then the toolbar button with the text "Debug All Unit Tests" is visible
#         Then the toolbar button with the text "Discover Unit Tests" is visible
#         Then the toolbar button with the text "Show Unit Test Output" is visible
#         Given the file "tests/test_running_delay" is updated with the value "2"
#         When I select the command "Python: Run Failed Unit Tests"
#         Then wait for 1 second
#         Then there are at least 6 running test items
#         Then there are 3 success test items
#         Then take a screenshot
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 5 seconds
#         Then there are at least 6 error test items
#         Then there are 3 success test items
#         Then take a screenshot
#         Given the file "tests/test_running_delay" is updated with the value "0"
#         Given the file "tests/data.json" is updated with the value "[1,2,3,4,5,6]"
#         When I select the command "Python: Run Failed Unit Tests"
#         Then wait for 1 second
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 5 seconds
#         Then there are 9 success test items
#         Then take a screenshot

#     @scenario4
#     Scenario: Opens test file
#         When I close all editors
#         When I select test tree node number 2
#         Then the file "test_one.py" will be opened
#         Then take a screenshot
#         When I close all editors
#         When I select test tree node number 3
#         Then the file "test_one.py" will be opened
#         Then take a screenshot
#         When I close all editors
#         When I select test tree node number 11
#         Then the file "test_two.py" will be opened
#         Then take a screenshot
#         When I close all editors
#         When I select test tree node number 12
#         Then the file "test_two.py" will be opened
#         Then take a screenshot

#     @scenario5
#     Scenario: Opens test file and sets focus
#         When I close all editors
#         When I select test tree node number 3
#         When I select test tree node number 3 and press open
#         Then line 20 of file "test_one.py" will be highlighted
#         Then take a screenshot
#         When I close all editors
#         When I select test tree node number 12
#         When I select test tree node number 12 and press open
#         Then the file "test_two.py" will be opened
#         Then line 10 of file "test_two.py" will be highlighted
#         Then take a screenshot

# # @debug
# # Scenario: Debug all tests and add breakpoints to two files
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     Given the file "tests/data.json" is updated with the value "[1,2,3,4,5,6]"
# #     Given the file ".vscode/launch.json" does not exist
# #     Given the file "test_one.py" is open
# #     Given the file is scrolled to the top
# #     When I close all editors
# #     Given the file "test_one.py" is open
# #     Then wait for 1 second
# #     When I add a breakpoint to line 22
# #     Given the file "test_two.py" is open
# #     Given the file is scrolled to the top
# #     When I close all editors
# #     Given the file "test_two.py" is open
# #     Then wait for 1 second
# #     When I add a breakpoint to line 12
# #     When I close all editors
# #     Then wait for 1 second
# #     When I select the command "Python: Debug All Unit Tests"
# #     Then debugger starts
# #     Then stack frame for file "test_one.py" and line 22 is displayed
# #     Then take a screenshot
# #     When I select the command "Debug: Continue"
# #     Then stack frame for file "test_two.py" and line 12 is displayed
# #     Then take a screenshot
# #     When I select the command "Debug: Continue"
# #     Then wait for 1 second
# #     # Continue again, as the debugger breaks into sys.exit.
# #     When I select the command "Debug: Continue"

# # @debug
# # Scenario: Debug file with breakpoint
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     Given the file "tests/data.json" is updated with the value "[1,2,3,4,5,6]"
# #     Given the file ".vscode/launch.json" does not exist
# #     Given the file "test_one.py" is open
# #     Given the file is scrolled to the top
# #     When I close all editors
# #     Given the file "test_one.py" is open
# #     Then wait for 1 second
# #     When I add a breakpoint to line 22
# #     When I close all editors
# #     When I select the command "Python: Discover Unit Tests"
# #     Then wait for 5 second
# #     When I select the command "View: Show Test"
# #     Then select first node
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "right"
# #     When I select test tree node number 2
# #     When I select test tree node number 2 and press debug
# #     Then debugger starts
# #     Then stack frame for file "test_one.py" and line 22 is displayed
# #     Then take a screenshot
# #     When I select the command "Debug: Continue"
# #     Then wait for 1 second
# #     # Continue again, as the debugger breaks into sys.exit.
# #     When I select the command "Debug: Continue"

# # @debug
# # Scenario: Debug suite with breakpoint
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     Given the file "tests/data.json" is updated with the value "[1,2,3,4,5,6]"
# #     Given the file ".vscode/launch.json" does not exist
# #     Given the file "test_one.py" is open
# #     Given the file is scrolled to the top
# #     When I close all editors
# #     Given the file "test_one.py" is open
# #     Then wait for 1 second
# #     When I add a breakpoint to line 22
# #     When I close all editors
# #     When I select the command "Python: Discover Unit Tests"
# #     Then wait for 5 second
# #     When I select the command "View: Show Test"
# #     Then select first node
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "right"
# #     When I select test tree node number 3
# #     When I select test tree node number 3 and press debug
# #     Then debugger starts
# #     Then stack frame for file "test_one.py" and line 22 is displayed
# #     Then take a screenshot
# #     When I select the command "Debug: Continue"
# #     Then wait for 1 second
# #     # Continue again, as the debugger breaks into sys.exit.
# #     When I select the command "Debug: Continue"

# # @debug
# # Scenario: Debug function with breakpoint
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     Given the file "tests/data.json" is updated with the value "[1,2,3,4,5,6]"
# #     Given the file ".vscode/launch.json" does not exist
# #     Given the file "test_one.py" is open
# #     Given the file is scrolled to the top
# #     When I close all editors
# #     Given the file "test_one.py" is open
# #     Then wait for 1 second
# #     When I add a breakpoint to line 22
# #     When I close all editors
# #     When I select the command "Python: Discover Unit Tests"
# #     Then wait for 5 second
# #     When I select the command "View: Show Test"
# #     Then select first node
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "right"
# #     When I select test tree node number 4
# #     When I select test tree node number 4 and press debug
# #     Then debugger starts
# #     Then stack frame for file "test_one.py" and line 22 is displayed
# #     Then take a screenshot
# #     When I select the command "Debug: Continue"
# #     Then wait for 1 second
# #     # Continue again, as the debugger breaks into sys.exit.
# #     When I select the command "Debug: Continue"

# # @codelens
# # Scenario: Code Lenses appear
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     When I select the command "Python: Discover Unit Tests"
# #     Then wait for 5 second
# #     Given the file "test_one.py" is open
# #     Given the file is scrolled to the top
# #     Then wait for 5 second
# #     Then code lens "Run Test" is visible
# #     Then code lens "Debug Test" is visible

# # @codelens
# # Scenario: Running test suite via Code Lenses will display progress indicator on tree
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "2"
# #     When I select the command "Python: Discover Unit Tests"
# #     Then wait for 5 second
# #     When I select the command "View: Show Test"
# #     Then select first node
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "right"
# #     Given the file "test_one.py" is open
# #     Given the file is scrolled to the top
# #     Then wait for 5 second
# #     When I click first code lens "Run Test"
# #     Then wait for 1 second
# #     Then there are at least 4 running test items
# #     Then the toolbar button with the text "Stop" is visible
# #     Then wait for 10 second
# #     Then the toolbar button with the text "Stop" is not visible

# # @codelens
# # Scenario: Running test function via Code Lenses will display progress indicator on tree
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "2"
# #     When I select the command "Python: Discover Unit Tests"
# #     Then wait for 5 second
# #     When I select the command "View: Show Test"
# #     Then select first node
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "right"
# #     Given the file "test_one.py" is open
# #     Given the file is scrolled to the top
# #     Then wait for 5 second
# #     When I click second code lens "Run Test"
# #     Then wait for 1 second
# #     Then there are 1 running test items
# #     Then the toolbar button with the text "Stop" is visible
# #     Then wait for 10 second
# #     Then the toolbar button with the text "Stop" is not visible

# # @codelens @debug
# # Scenario: Debugging test suite via Code Lenses
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     Given the file "test_one.py" is open
# #     Given the file is scrolled to the top
# #     When I close all editors
# #     Given the file "test_one.py" is open
# #     Then wait for 1 second
# #     When I add a breakpoint to line 22
# #     When I add a breakpoint to line 27
# #     When I add a breakpoint to line 32
# #     When I close all editors
# #     When I select the command "Python: Discover Unit Tests"
# #     Then wait for 5 second
# #     When I select the command "View: Show Test"
# #     Then select first node
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "right"
# #     Given the file "test_one.py" is open
# #     Given the file is scrolled to the top
# #     Then wait for 5 second
# #     When I click first code lens "Debug Test"
# #     Then wait for 1 second
# #     Then debugger starts
# #     Then stack frame for file "test_one.py" and line 22 is displayed
# #     Then take a screenshot
# #     When I select the command "Debug: Continue"
# #     Then stack frame for file "test_one.py" and line 32 is displayed
# #     Then take a screenshot
# #     When I select the command "Debug: Continue"
# #     Then stack frame for file "test_one.py" and line 27 is displayed
# #     Then take a screenshot
# #     When I select the command "Debug: Continue"
# #     Then wait for 1 second
# #     # Continue again, as the debugger breaks into sys.exit.
# #     When I select the command "Debug: Continue"

# # Scenario: Debugging test function via Code Lenses
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     Given the file "test_one.py" is open
# #     Given the file is scrolled to the top
# #     When I close all editors
# #     Given the file "test_one.py" is open
# #     Then wait for 1 second
# #     When I add a breakpoint to line 22
# #     When I add a breakpoint to line 27
# #     When I add a breakpoint to line 32
# #     When I close all editors
# #     When I select the command "Python: Discover Unit Tests"
# #     Then wait for 5 second
# #     When I select the command "View: Show Test"
# #     Then select first node
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "right"
# #     When I press "down"
# #     When I press "right"
# #     Given the file "test_one.py" is open
# #     Given the file is scrolled to the top
# #     Then wait for 5 second
# #     When I click second code lens "Debug Test"
# #     Then wait for 1 second
# #     Then debugger starts
# #     Then stack frame for file "test_one.py" and line 22 is displayed
# #     Then take a screenshot
# #     # Continue again, as the debugger breaks into sys.exit.
# #     When I select the command "Debug: Continue"
# #     When I select the command "Debug: Continue"
# #     Then debugger stops
