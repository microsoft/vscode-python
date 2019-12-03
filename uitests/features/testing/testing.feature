# @testing
# Feature: Testing
#     Scenario: Start
#         Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
#         Given the file "tests/test_discovery_delay" is updated with the value "0"
#         Given the file "tests/test_running_delay" is updated with the value "0"
#         Given the file "tests/data.json" is updated with the value "[1,2,3,4,5,6]"

#     @continue
#     Scenario: Discovery completed
#         When I select the command "Python: Discover Unit Tests"
#         Then wait for 5 seconds
#         When I select the command "View: Show Test"
#         Then the toolbar button with the text "Run All Unit Tests" is visible
#         Then the toolbar button with the text "Debug All Unit Tests" is visible
#         Then the toolbar button with the text "Discover Unit Tests" is visible
#         Then the toolbar button with the text "Show Unit Test Output" is visible
#         Then the toolbar button with the text "Run Failed Unit Tests" is not visible
#         Then the toolbar button with the text "Stop" is not visible
#         Then take a screenshot

#     @continue
#     Scenario: Discovering icons
#         When I update file "tests/test_discovery_delay" with value "5"
#         When I select the command "Python: Discover Unit Tests"
#         Then wait for 1 second
#         Then the toolbar button with the text "Run All Unit Tests" is not visible
#         Then the toolbar button with the text "Debug All Unit Tests" is not visible
#         # The `Discover Unit Tests` is still visible with a progress icon.
#         # Probably, we should change the tooltip at this point to `Discovering Tests`
#         Then the toolbar button with the text "Discover Unit Tests" is visible
#         Then the toolbar button with the text "Show Unit Test Output" is visible
#         Then the toolbar button with the text "Run Failed Unit Tests" is not visible
#         Then the toolbar button with the text "Stop" is visible
#         Then take a screenshot

#     @continue
#     Scenario: Stop discovering
#         When I stop the tests
#         Then wait for 1 second
#         Then the toolbar button with the text "Run All Unit Tests" is visible
#         Then the toolbar button with the text "Debug All Unit Tests" is visible
#         Then the toolbar button with the text "Discover Unit Tests" is visible
#         Then the toolbar button with the text "Show Unit Test Output" is visible
#         Then the toolbar button with the text "Run Failed Unit Tests" is not visible
#         Then the toolbar button with the text "Stop" is not visible
#         Then select the command "Notifications: Clear All Notifications"
#         Then take a screenshot

#     @continue
#     Scenario: Running icons
#         When I update file "tests/test_discovery_delay" with value "0"
#         When I update file "tests/test_running_delay" with value "5"
#         When I select the command "Python: Run All Unit Tests"
#         Then wait for 1 second
#         Then the toolbar button with the text "Run All Unit Tests" is not visible
#         Then the toolbar button with the text "Debug All Unit Tests" is not visible
#         Then the toolbar button with the text "Discover Unit Tests" is not visible
#         Then the toolbar button with the text "Show Unit Test Output" is visible
#         Then the toolbar button with the text "Run Failed Unit Tests" is not visible
#         Then the toolbar button with the text "Stop" is visible
#         Then take a screenshot

#     @continue
#     Scenario: Stop running
#         When I stop the tests
#         Then wait for 1 second
#         Then the toolbar button with the text "Run All Unit Tests" is visible
#         Then the toolbar button with the text "Debug All Unit Tests" is visible
#         Then the toolbar button with the text "Discover Unit Tests" is visible
#         Then the toolbar button with the text "Show Unit Test Output" is visible
#         Then the toolbar button with the text "Run Failed Unit Tests" is not visible
#         Then the toolbar button with the text "Stop" is not visible
#         Then select the command "Notifications: Clear All Notifications"
#         Then take a screenshot

#     @continue
#     Scenario: Run without errors
#         When I update file "tests/test_discovery_delay" with value "0"
#         When I update file "tests/test_running_delay" with value "0"
#         When I select the command "Python: Run All Unit Tests"
#         Then wait for 1 second
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 5 seconds
#         Then take a screenshot

#     @continue
#     Scenario: Expand test explorer
#         Then select first node
#         When I press "down"
#         When I press "right"
#         When I press "down"
#         When I press "right"
#         When I press "down"
#         When I press "down"
#         When I press "down"
#         When I press "down"
#         When I press "right"
#         When I press "down"
#         When I press "down"
#         When I press "down"
#         When I press "down"
#         When I press "right"
#         When I press "down"
#         When I press "right"

#     @continue
#     Scenario: Expand check icons in test explorer
#         Then the toolbar button with the text "Run All Unit Tests" is visible
#         Then the toolbar button with the text "Debug All Unit Tests" is visible
#         Then the toolbar button with the text "Discover Unit Tests" is visible
#         Then the toolbar button with the text "Show Unit Test Output" is visible
#         Then the toolbar button with the text "Run Failed Unit Tests" is not visible
#         Then the toolbar button with the text "Stop" is not visible
#         Then there are 9 success test items
#         Then take a screenshot

#     @continue
#     Scenario: Run with errors
#         Given the file "tests/data.json" is updated with the value "[1,2,1,1,1,6]"
#         When I select the command "Python: Run All Unit Tests"
#         Then wait for 1 second
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 5 seconds
#         Then the toolbar button with the text "Run All Unit Tests" is visible
#         Then the toolbar button with the text "Debug All Unit Tests" is visible
#         Then the toolbar button with the text "Discover Unit Tests" is visible
#         Then the toolbar button with the text "Show Unit Test Output" is visible
#         Then the toolbar button with the text "Run Failed Unit Tests" is visible
#         Then the toolbar button with the text "Stop" is not visible
#         Then take a screenshot

#     @continue
#     Scenario: Failed and succcess icon
#         Then there are at least 4 error test items
#         Then there are 5 success test items
#         Then take a screenshot

#     @continue
#     Scenario: Running single item
#         Given the file "tests/data.json" is updated with the value "[1,2,3,4,5,6]"
#         When I select the command "Python: Run All Unit Tests"
#         Then wait for 1 second
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 5 seconds
#         Then select first node
#         When I press "right"
#         When I press "down"
#         When I press "down"
#         When I press "down"
#         When I press "down"
#         When I press "down"
#         Given the file "tests/test_running_delay" is updated with the value "2"
#         When I select test tree node number 6 and press run
#         Then take a screenshot
#         Then there are at least 1 running test items
#         Then there are 8 success test items
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 10 seconds
#         Then there are 9 success test items
#         Then take a screenshot

#     @continue
#     Scenario: Running failed tests and still fail
#         Given the file "tests/test_running_delay" is updated with the value "0"
#         Given the file "tests/data.json" is updated with the value "[0,0,0,4,5,6]"
#         When I select the command "Python: Run All Unit Tests"
#         Then wait for 1 second
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 5 seconds
#         Then there are at least 6 error test items
#         Then there are 3 success test items
#         Then take a screenshot
#         Given the file "tests/test_running_delay" is updated with the value "2"
#         When I select the command "Python: Run Failed Unit Tests"
#         Then wait for 1 second
#         Then there are at least 6 running test items
#         Then there are 3 success test items
#         Then take a screenshot
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 10 seconds
#         Then there are at least 6 error test items
#         Then there are 3 success test items
#         Then take a screenshot

#     @continue
#     Scenario: Running failed tests and all are fixed
#         Given the file "tests/test_running_delay" is updated with the value "0"
#         Given the file "tests/data.json" is updated with the value "[1,2,3,4,5,6]"
#         When I select the command "Python: Run Failed Unit Tests"
#         Then wait for 1 second
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 5 seconds
#         Then there are 9 success test items
#         Then take a screenshot

#     @continue
#     Scenario: Opens test file
#         Then I select the command "View: Close All Editors"
#         When I select test tree node number 2
#         Then the file "test_one.py" will be opened
#         Then take a screenshot
#         Then I select the command "View: Close All Editors"
#         When I select test tree node number 3
#         Then the file "test_one.py" will be opened
#         Then take a screenshot
#         Then I select the command "View: Close All Editors"
#         When I select test tree node number 11
#         Then the file "test_two.py" will be opened
#         Then take a screenshot
#         Then I select the command "View: Close All Editors"
#         When I select test tree node number 12
#         Then the file "test_two.py" will be opened
#         Then take a screenshot

#     @continue
#     Scenario: Opens test file and sets focus
#         When I select the command "View: Show Test"
#         When I select test tree node number 3
#         When I select test tree node number 3 and press open
#         Then line 20 of file "test_one.py" will be highlighted
#         Then take a screenshot
#         Then I select the command "View: Close All Editors"
#         When I select test tree node number 12
#         When I select test tree node number 12 and press open
#         Then the file "test_two.py" will be opened
#         Then line 10 of file "test_two.py" will be highlighted
#         Then take a screenshot

#     @continue
#     Scenario: Debug all tests and add breakpoints to two files
#         When I select the command "View: Show Test"
#         Given the file ".vscode/launch.json" does not exist
#         Given the file "test_one.py" is open
#         Given the file is scrolled to the top
#         Then I select the command "View: Close All Editors"
#         Given the file "test_one.py" is open
#         When I add a breakpoint to line 22
#         Given the file "test_two.py" is open
#         Given the file is scrolled to the top
#         Then take a screenshot
#         Then I select the command "View: Close All Editors"
#         Given the file "test_two.py" is open
#         When I add a breakpoint to line 12
#         Then take a screenshot
#         Then I select the command "View: Close All Editors"
#         When I select the command "Python: Debug All Unit Tests"
#         Then debugger starts
#         Then stack frame for file "test_one.py" and line 22 is displayed
#         Then take a screenshot
#         When I select the command "Debug: Continue"
#         Then stack frame for file "test_two.py" and line 12 is displayed
#         Then take a screenshot
#         When I select the command "Debug: Stop"
#         Then I select the command "Debug: Remove All Breakpoints"
#         Then I select the command "View: Close Panel"
#         Then I select the command "View: Close All Editors"

#     @continue
#     Scenario: Debug file with breakpoint
#         Given the file ".vscode/launch.json" does not exist
#         Given the file "test_one.py" is open
#         Given the file is scrolled to the top
#         Then I select the command "View: Close All Editors"
#         Given the file "test_one.py" is open
#         When I add a breakpoint to line 22
#         Then I select the command "View: Close All Editors"
#         When I select the command "View: Show Test"
#         When I select test tree node number 2
#         When I select test tree node number 2 and press debug
#         Then debugger starts
#         Then stack frame for file "test_one.py" and line 22 is displayed
#         Then take a screenshot
#         When I select the command "Debug: Stop"
#         Then I select the command "Debug: Remove All Breakpoints"
#         Then I select the command "View: Close Panel"
#         Then I select the command "View: Close All Editors"

#     @continue
#     Scenario: Debug suite with breakpoint
#         Given the file ".vscode/launch.json" does not exist
#         Given the file "test_one.py" is open
#         Given the file is scrolled to the top
#         Then I select the command "View: Close All Editors"
#         Given the file "test_one.py" is open
#         When I add a breakpoint to line 22
#         Then I select the command "View: Close All Editors"
#         When I select the command "View: Show Test"
#         When I select test tree node number 3
#         When I select test tree node number 3 and press debug
#         Then debugger starts
#         Then stack frame for file "test_one.py" and line 22 is displayed
#         Then take a screenshot
#         When I select the command "Debug: Stop"
#         Then I select the command "Debug: Remove All Breakpoints"
#         Then I select the command "View: Close Panel"
#         Then I select the command "View: Close All Editors"

#     @continue
#     Scenario: Debug function with breakpoint
#         Given the file "test_one.py" is open
#         Given the file is scrolled to the top
#         When I close all editors
#         Given the file "test_one.py" is open
#         When I add a breakpoint to line 22
#         Then I select the command "View: Close All Editors"
#         When I select the command "View: Show Test"
#         When I select test tree node number 4
#         When I select test tree node number 4 and press debug
#         Then debugger starts
#         Then stack frame for file "test_one.py" and line 22 is displayed
#         Then take a screenshot
#         When I select the command "Debug: Stop"
#         Then I select the command "Debug: Remove All Breakpoints"
#         Then I select the command "View: Close Panel"
#         Then I select the command "View: Close All Editors"

#     @continue
#     Scenario: Code Lenses appear
#         Given the file "test_one.py" is open
#         Given the file is scrolled to the top
#         Then code lens "Run Test" is visible in 5 seconds
#         Then code lens "Debug Test" is visible
#         Then take a screenshot

#     @continue
#     Scenario: Running test suite via Code Lenses will display progress indicator on tree
#         Given the file "tests/test_running_delay" is updated with the value "5"
#         When I click first code lens "Run Test"
#         When I select the command "View: Show Test"
#         Then wait for 1 second
#         Then there are at least 4 running test items
#         Then the toolbar button with the text "Stop" is visible
#         Then stop the tests

#     @continue
#     Scenario: Running test function via Code Lenses will display progress indicator on tree
#         When I click second code lens "Run Test"
#         Then wait for 1 second
#         Then there are 1 running test items
#         Then the toolbar button with the text "Stop" is visible
#         Then take a screenshot
#         Then stop the tests

#     @continue
#     Scenario: Debugging test suite via Code Lenses
#         Given the file "tests/test_running_delay" is updated with the value "0"
#         Given the file "test_one.py" is open
#         Given the file is scrolled to the top
#         When I add a breakpoint to line 22
#         When I select the command "View: Show Test"
#         When I click first code lens "Debug Test"
#         Then wait for 1 second
#         Then debugger starts
#         Then stack frame for file "test_one.py" and line 22 is displayed
#         Then take a screenshot
#         When I select the command "Debug: Stop"
#         Then I select the command "View: Close Panel"
#         Then I select the command "View: Close All Editors"

#     @continue
#     Scenario: Debugging test function via Code Lenses
#         Given the file "test_one.py" is open
#         Given the file is scrolled to the top
#         Then code lens "Run Test" is visible in 5 seconds
#         When I click second code lens "Debug Test"
#         Then wait for 1 second
#         Then debugger starts
#         Then stack frame for file "test_one.py" and line 22 is displayed
#         Then take a screenshot
#         When I select the command "Debug: Stop"
#         Then I select the command "Debug: Remove All Breakpoints"
#         Then I select the command "View: Close Panel"
#         Then I select the command "View: Close All Editors"

# # Scenario: Icons with no failures
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     Given the file "tests/data.json" is updated with the value "[1,2,3,4,5,6]"
# #     Then wait for 1 second
# #     When I select the command "Python: Run All Unit Tests"
# #     Then wait for 5 second
# #     When I select the command "View: Show Test"
# #     Then take a screenshot
# #     Then the toolbar button with the text "Run All Unit Tests" is visible
# #     Then the toolbar button with the text "Debug All Unit Tests" is visible
# #     Then the toolbar button with the text "Discover Unit Tests" is visible
# #     Then the toolbar button with the text "Show Unit Test Output" is visible
# #     Then the toolbar button with the text "Run Failed Unit Tests" is not visible
# #     Then the toolbar button with the text "Stop" is not visible

# # Scenario: Icons with failures
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     Given the file "tests/data.json" is updated with the value "[0,2,3,4,5,6]"
# #     Then wait for 1 second
# #     When I select the command "Python: Run All Unit Tests"
# #     Then wait for 5 second
# #     When I select the command "View: Show Test"
# #     Then take a screenshot
# #     Then the toolbar button with the text "Run All Unit Tests" is visible
# #     Then the toolbar button with the text "Debug All Unit Tests" is visible
# #     Then the toolbar button with the text "Discover Unit Tests" is visible
# #     Then the toolbar button with the text "Show Unit Test Output" is visible
# #     Then the toolbar button with the text "Run Failed Unit Tests" is visible
# #     Then the toolbar button with the text "Stop" is not visible

# # Scenario: Icons while discovering
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     Then wait for 1 second
# #     When I select the command "Python: Discover Unit Tests"
# #     Then wait for 5 second
# #     When I select the command "View: Show Test"
# #     When I update file "tests/test_discovery_delay" with value "3"
# #     Then wait for 1 second
# #     When I select the command "Python: Discover Unit Tests"
# #     Then wait for 1 second
# #     Then take a screenshot
# #     Then the toolbar button with the text "Run All Unit Tests" is not visible
# #     Then the toolbar button with the text "Debug All Unit Tests" is not visible
# #     # The `Discover Unit Tests` is still visible with a progress icon.
# #     # Probably, we should change the tooltip at this point to `Discovering Tests`
# #     Then the toolbar button with the text "Discover Unit Tests" is visible
# #     Then the toolbar button with the text "Show Unit Test Output" is visible
# #     Then the toolbar button with the text "Run Failed Unit Tests" is not visible
# #     Then the toolbar button with the text "Stop" is visible
# #     Then wait for 5 second
# #     Then the toolbar button with the text "Stop" is not visible

# # Scenario: Icons while running
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     Then wait for 1 second
# #     When I select the command "Python: Discover Unit Tests"
# #     Then wait for 5 second
# #     When I select the command "View: Show Test"
# #     When I update file "tests/test_running_delay" with value "3"
# #     Then wait for 1 second
# #     When I select the command "Python: Run All Unit Tests"
# #     Then wait for 1 second
# #     Then take a screenshot
# #     Then the toolbar button with the text "Run All Unit Tests" is not visible
# #     Then the toolbar button with the text "Debug All Unit Tests" is not visible
# #     Then the toolbar button with the text "Discover Unit Tests" is not visible
# #     Then the toolbar button with the text "Show Unit Test Output" is visible
# #     Then the toolbar button with the text "Run Failed Unit Tests" is not visible
# #     Then the toolbar button with the text "Stop" is visible
# #     Then wait for 10 second
# #     Then the toolbar button with the text "Stop" is not visible

# # Scenario: Stop discovering slow tests
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     Given the file "tests/data.json" is updated with the value "[1,2,1,4,5,6]"
# #     Then wait for 1 second
# #     When I select the command "Python: Discover Unit Tests"
# #     Then wait for 5 second
# #     When I select the command "View: Show Test"
# #     When I update file "tests/test_discovery_delay" with value "10"
# #     Then wait for 1 second
# #     When I select the command "Python: Discover Unit Tests"
# #     Then wait for 1 second
# #     Then take a screenshot
# #     Then the toolbar button with the text "Run All Unit Tests" is not visible
# #     Then the toolbar button with the text "Debug All Unit Tests" is not visible
# #     # The `Discover Unit Tests` is still visible with a progress icon.
# #     # Probably, we should change the tooltip at this point to `Discovering Tests`
# #     Then the toolbar button with the text "Discover Unit Tests" is visible
# #     Then the toolbar button with the text "Show Unit Test Output" is visible
# #     Then the toolbar button with the text "Run Failed Unit Tests" is not visible
# #     Then the toolbar button with the text "Stop" is visible
# #     Then take a screenshot
# #     Then wait for 5 second
# #     When I stop the tests
# #     Then wait for 5 second
# #     Then the toolbar button with the text "Run All Unit Tests" is visible
# #     Then the toolbar button with the text "Debug All Unit Tests" is visible
# #     Then the toolbar button with the text "Discover Unit Tests" is visible
# #     Then the toolbar button with the text "Show Unit Test Output" is visible
# #     Then the toolbar button with the text "Run Failed Unit Tests" is not visible
# #     Then the toolbar button with the text "Stop" is not visible
# #     Then take a screenshot

# # Scenario: Stop slow running tests
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "10"
# #     Given the file "tests/data.json" is updated with the value "[1,2,1,4,5,6]"
# #     Then wait for 1 second
# #     When I select the command "Python: Discover Unit Tests"
# #     Then wait for 5 second
# #     When I select the command "View: Show Test"
# #     Then wait for 1 second
# #     When I select the command "Python: Run All Unit Tests"
# #     Then wait for 1 second
# #     Then take a screenshot
# #     Then the toolbar button with the text "Run All Unit Tests" is not visible
# #     Then the toolbar button with the text "Debug All Unit Tests" is not visible
# #     Then the toolbar button with the text "Discover Unit Tests" is not visible
# #     Then the toolbar button with the text "Show Unit Test Output" is visible
# #     Then the toolbar button with the text "Run Failed Unit Tests" is not visible
# #     Then the toolbar button with the text "Stop" is visible
# #     Then take a screenshot
# #     Then wait for 5 second
# #     When I stop the tests
# #     Then wait for 5 second
# #     Then the toolbar button with the text "Run All Unit Tests" is visible
# #     Then the toolbar button with the text "Debug All Unit Tests" is visible
# #     Then the toolbar button with the text "Discover Unit Tests" is visible
# #     Then the toolbar button with the text "Show Unit Test Output" is visible
# #     Then the toolbar button with the text "Run Failed Unit Tests" is not visible
# #     Then the toolbar button with the text "Stop" is not visible
# #     Then take a screenshot

# # Scenario: Failed and success icons
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     Given the file "tests/data.json" is updated with the value "[1,2,1,1,1,6]"
# #     Then wait for 1 second
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
# #     When I select the command "Python: Run All Unit Tests"
# #     Then wait for 5 second
# #     Then there are at least 4 error test items
# #     Then there are 5 success test items
# #     Then take a screenshot
# #     Given the file "tests/data.json" is updated with the value "[1,2,3,4,5,6]"
# #     When I select the command "Python: Run All Unit Tests"
# #     Then wait for 5 second
# #     Then there are 9 success test items
# #     Then take a screenshot

# # Scenario: Running single item
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     Given the file "tests/data.json" is updated with the value "[1,2,3,4,5,6]"
# #     Then wait for 1 second
# #     When I select the command "Python: Run All Unit Tests"
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
# #     Then there are 9 success test items
# #     Then select first node
# #     When I press "right"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     When I press "down"
# #     Given the file "tests/test_running_delay" is updated with the value "2"
# #     Then wait for 1 second
# #     When I select test tree node number 6 and press run
# #     Then there are at least 1 running test items
# #     Then there are 8 success test items
# #     Then take a screenshot
# #     Then wait for 5 second
# #     Then there are 9 success test items
# #     Then take a screenshot

# # Scenario: Running failed tests
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     Given the file "tests/data.json" is updated with the value "[0,0,0,4,5,6]"
# #     Then wait for 1 second
# #     When I select the command "Python: Run All Unit Tests"
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
# #     Then there are at least 6 error test items
# #     Then there are 3 success test items
# #     Then the toolbar button with the text "Run All Unit Tests" is visible
# #     Then the toolbar button with the text "Run Failed Unit Tests" is visible
# #     Then the toolbar button with the text "Debug All Unit Tests" is visible
# #     Then the toolbar button with the text "Discover Unit Tests" is visible
# #     Then the toolbar button with the text "Show Unit Test Output" is visible
# #     Given the file "tests/test_running_delay" is updated with the value "2"
# #     Then wait for 1 second
# #     When I select the command "Python: Run Failed Unit Tests"
# #     Then wait for 1 second
# #     Then there are at least 6 running test items
# #     Then there are 3 success test items
# #     Then take a screenshot
# #     Then wait for 10 second
# #     Then there are at least 6 error test items
# #     Then there are 3 success test items
# #     Then take a screenshot
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     Given the file "tests/data.json" is updated with the value "[1,2,3,4,5,6]"
# #     Then wait for 1 second
# #     When I select the command "Python: Run Failed Unit Tests"
# #     Then wait for 5 second
# #     Then there are 9 success test items
# #     Then take a screenshot

# # Scenario: Opens test file
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     Given the file "tests/data.json" is updated with the value "[1,2,1,1,1,6]"
# #     Then wait for 1 second
# #     When I select the command "Python: Run All Unit Tests"
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
# #     When I close all editors
# #     When I select test tree node number 2
# #     Then the file "test_one.py" will be opened
# #     Then take a screenshot
# #     When I close all editors
# #     When I select test tree node number 3
# #     Then the file "test_one.py" will be opened
# #     Then take a screenshot
# #     When I close all editors
# #     When I select test tree node number 11
# #     Then the file "test_two.py" will be opened
# #     Then take a screenshot
# #     When I close all editors
# #     When I select test tree node number 12
# #     Then the file "test_two.py" will be opened
# #     Then take a screenshot

# # Scenario: Opens test file and sets focus
# #     Given the workspace is based on "/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing"
# #     Given the file "tests/test_discovery_delay" is updated with the value "0"
# #     Given the file "tests/test_running_delay" is updated with the value "0"
# #     Given the file "tests/data.json" is updated with the value "[1,2,1,1,1,6]"
# #     Then wait for 1 second
# #     When I select the command "Python: Run All Unit Tests"
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
# #     When I close all editors
# #     When I select test tree node number 3
# #     When I select test tree node number 3 and press open
# #     Then line 20 of file "test_one.py" will be highlighted
# #     Then take a screenshot
# #     When I close all editors
# #     When I select test tree node number 12
# #     When I select test tree node number 12 and press open
# #     Then the file "test_two.py" will be opened
# #     Then line 10 of file "test_two.py" will be highlighted
# #     Then take a screenshot

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
