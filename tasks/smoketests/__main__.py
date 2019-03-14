# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


from behave import __main__

# Adding my wanted option to parser.
# configuration.parser.add_argument('-u', '--url', help='Address of your url')

# command that run behave.
__main__.main(["-f", "plain", "-T", "--no-capture", "tasks/smoketests"])
