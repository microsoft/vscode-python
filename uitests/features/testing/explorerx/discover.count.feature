# @test
# @https://github.com/DonJayamanne/pyvscSmokeTesting.git
# Feature: Test Explorer

#     Scenario: Explorer will be displayed when tests are discovered (unitest)
#         Given the workspace setting "python.testing.pytestEnabled" is disabled
#         And the workspace setting "python.testing.unittestEnabled" is enabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         Then there are 14 nodes in the test explorer

#     Scenario: Explorer will be displayed when tests are discovered (pytest)
#         Given the package "pytest" is installed
#         And the workspace setting "python.testing.pytestEnabled" is enabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         Then there are 15 nodes in the test explorer

#     Scenario: Explorer will be displayed when tests are discovered (nose)
#         Given the package "nose" is installed
#         And the workspace setting "python.testing.pytestEnabled" is disabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is enabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         Then there are 14 nodes in the test explorer
