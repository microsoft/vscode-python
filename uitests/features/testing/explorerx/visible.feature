# @test
# @https://github.com/DonJayamanne/pyvscSmokeTesting.git
# Feature: Testing
#     Scenario Outline: Explorer will be displayed when tests are discovered (<package>)
#         Given the setting "python.testing.<setting_to_enable>" is enabled
#         And the package "<package>" is installed
#         When I reload VS Code
#         And the Python extension has been activated
#         And I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible

#         Examples:
#             | package  | setting_to_enable |
#             | unittest | unittestEnabled   |
#             | pytest   | pytestEnabled     |
#             | nose     | nosetestsEnabled  |
