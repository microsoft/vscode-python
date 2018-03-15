# Python Tools for Visual Studio
# Copyright(c) Microsoft Corporation
# All rights reserved.
# 
# Licensed under the Apache License, Version 2.0 (the License); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
# 
# THIS CODE IS PROVIDED ON AN  *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS
# OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY
# IMPLIED WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
# MERCHANTABLITY OR NON-INFRINGEMENT.
# 
# See the Apache Version 2.0 License for specific language governing
# permissions and limitations under the License.

__author__ = "Microsoft Corporation <ptvshelp@microsoft.com>"
__version__ = "3.0.0.0"

import sys
import PythonScraper

try:
    # disable error reporting in our process, bad extension modules can crash us, and we don't
    # want a bunch of Watson boxes popping up...
    import ctypes 
    ctypes.windll.kernel32.SetErrorMode(3)  # SEM_FAILCRITICALERRORS /  SEM_NOGPFAULTERRORBOX
except:
    pass

# Scrapes the file and saves the analysis to the specified filename, exits w/ nonzero exit code if anything goes wrong.
# Usage: ExtensionScraper.py scrape [mod_name or '-'] [mod_path or '-'] [output_path]

if len(sys.argv) != 5 or sys.argv[1].lower() != 'scrape':
    raise ValueError('Expects "ExtensionScraper.py scrape [mod_name|'-'] [mod_path|'-'] [output_path]"')

mod_name, mod_path, output_path = sys.argv[2:]
module = None

if mod_name and mod_name != '-':
    remove_sys_path_0 = False
    try:
        if mod_path and mod_path != '-':
            import os.path
            if os.path.exists(mod_path):
                sys.path.insert(0, mod_path)
                remove_sys_path_0 = True
        __import__(mod_name)
        module = sys.modules[mod_name]
    finally:
        if remove_sys_path_0:
            del sys.path[0]

        if not module:
            print('__import__("' + mod_name + '")')
            PythonScraper.write_analysis(output_path, {"members": {}, "doc": "Could not import compiled module"})
elif mod_path and mod_path != '-':
    try:
        import os.path
        mod_name = os.path.split(mod_path)[1].partition('.')[0]
        try:
            import importlib
            module = importlib.import_module(mod_name)
        except ImportError:
            # Don't really care which import failed - we'll try imp
            pass
        if not module:
            import imp
            module = imp.load_dynamic(mod_name, mod_path)
    finally:
        if not module:
            print('imp.load_dynamic("' + mod_name + '", "' + mod_path + '")')
            PythonScraper.write_analysis(output_path, {"members": {}, "doc": "Could not import compiled module", "filename": mod_path})
else:
    raise ValueError('No module name or path provided')

if module:
    analysis = PythonScraper.generate_module(module)
    PythonScraper.write_analysis(output_path, analysis)
