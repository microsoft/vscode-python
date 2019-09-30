# @testing @ci @toolbar
# @/Users/donjayamanne/Desktop/Development/vscode/smokeTests/testing
# Feature: Testing (toolbar)
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
#     Scenario: Icons with no failures
#         When I select the command "Python: Run All Unit Tests"
#         Then wait for 1 second
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 5 seconds
#         Then the toolbar button with the text "Run All Unit Tests" is visible
#         Then the toolbar button with the text "Debug All Unit Tests" is visible
#         Then the toolbar button with the text "Discover Unit Tests" is visible
#         Then the toolbar button with the text "Show Unit Test Output" is visible
#         Then the toolbar button with the text "Run Failed Unit Tests" is not visible
#         Then the toolbar button with the text "Stop" is not visible

#     @scenario2
#     Scenario: Icons with failures and then no failures
#         Given the file "tests/data.json" is updated with the value "[0,2,3,4,5,6]"
#         When I select the command "Python: Run All Unit Tests"
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 5 seconds
#         Then the toolbar button with the text "Run All Unit Tests" is visible
#         Then the toolbar button with the text "Debug All Unit Tests" is visible
#         Then the toolbar button with the text "Discover Unit Tests" is visible
#         Then the toolbar button with the text "Show Unit Test Output" is visible
#         Then the toolbar button with the text "Run Failed Unit Tests" is visible
#         Then the toolbar button with the text "Stop" is not visible
#         Given the file "tests/data.json" is updated with the value "[1,2,3,4,5,6]"
#         When I select the command "Python: Run All Unit Tests"
#         Then wait for 1 second
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 5 seconds
#         Then the toolbar button with the text "Run All Unit Tests" is visible
#         Then the toolbar button with the text "Debug All Unit Tests" is visible
#         Then the toolbar button with the text "Discover Unit Tests" is visible
#         Then the toolbar button with the text "Show Unit Test Output" is visible
#         Then the toolbar button with the text "Run Failed Unit Tests" is not visible
#         Then the toolbar button with the text "Stop" is not visible

#     @scenario3
#     Scenario: Icons while discovering
#         When I update file "tests/test_discovery_delay" with value "3"
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
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 10 seconds
#         Then the toolbar button with the text "Stop" is not visible

#     @scenario4
#     Scenario: Icons while running
#         When I update file "tests/test_running_delay" with value "3"
#         When I select the command "Python: Run All Unit Tests"
#         Then wait for 1 second
#         Then the toolbar button with the text "Run All Unit Tests" is not visible
#         Then the toolbar button with the text "Debug All Unit Tests" is not visible
#         Then the toolbar button with the text "Discover Unit Tests" is not visible
#         Then the toolbar button with the text "Show Unit Test Output" is visible
#         Then the toolbar button with the text "Run Failed Unit Tests" is not visible
#         Then the toolbar button with the text "Stop" is visible
#         Then take a screenshot
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 10 seconds
#         Then the toolbar button with the text "Stop" is not visible

#     @scenario5
#     Scenario: Stop discovering slow tests
#         When I update file "tests/test_discovery_delay" with value "10"
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
#         When I stop the tests
#         Then wait for 2 second
#         Then the toolbar button with the text "Run All Unit Tests" is visible
#         Then the toolbar button with the text "Debug All Unit Tests" is visible
#         Then the toolbar button with the text "Discover Unit Tests" is visible
#         Then the toolbar button with the text "Show Unit Test Output" is visible
#         Then the toolbar button with the text "Run Failed Unit Tests" is not visible
#         Then the toolbar button with the text "Stop" is not visible
#         Then take a screenshot

#     @scenario6
#     Scenario: Stop slow running tests
#         Given the file "tests/test_running_delay" is updated with the value "10"
#         Given the file "tests/data.json" is updated with the value "[1,2,1,4,5,6]"
#         When I select the command "Python: Run All Unit Tests"
#         Then wait for 1 second
#         Then the toolbar button with the text "Run All Unit Tests" is not visible
#         Then the toolbar button with the text "Debug All Unit Tests" is not visible
#         Then the toolbar button with the text "Discover Unit Tests" is not visible
#         Then the toolbar button with the text "Show Unit Test Output" is visible
#         Then the toolbar button with the text "Run Failed Unit Tests" is not visible
#         Then the toolbar button with the text "Stop" is visible
#         Then take a screenshot
#         When I stop the tests
#         Then wait for 2 second
#         Then the toolbar button with the text "Run All Unit Tests" is visible
#         Then the toolbar button with the text "Debug All Unit Tests" is visible
#         Then the toolbar button with the text "Discover Unit Tests" is visible
#         Then the toolbar button with the text "Show Unit Test Output" is visible
#         Then the toolbar button with the text "Run Failed Unit Tests" is not visible
#         Then the toolbar button with the text "Stop" is not visible
#         Then take a screenshot

#     @scenario7
#     Scenario: Failed and success icons
#         Given the file "tests/data.json" is updated with the value "[1,2,1,1,1,6]"
#         When I select the command "Python: Run All Unit Tests"
#         Then wait for 1 second
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 5 seconds
#         Then there are at least 4 error test items
#         Then there are 5 success test items
#         Then take a screenshot
#         Given the file "tests/data.json" is updated with the value "[1,2,3,4,5,6]"
#         When I select the command "Python: Run All Unit Tests"
#         Then wait for 1 second
#         Then wait for the toolbar button with the text "Run All Unit Tests" to appear within 5 seconds
#         Then there are 9 success test items
#         Then take a screenshot
