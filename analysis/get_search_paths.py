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
__version__ = "3.2"

import sys

if 'site' in sys.modules:
    raise RuntimeError('script must be run with -S')

BEFORE_SITE = list(sys.path)
import site
try:
    site.main()
except:
    import traceback
    traceback.print_exc(file=sys.stderr)
AFTER_SITE = list(sys.path)

import os
def clean(path):
    if path:
        return os.path.normcase(os.path.abspath(path).rstrip('/\\'))
    return None

BEFORE_SITE = set(clean(p) for p in BEFORE_SITE)
AFTER_SITE = set(clean(p) for p in AFTER_SITE)

for prefix in [
    sys.prefix,
    sys.exec_prefix,
    getattr(sys, 'real_prefix', ''),
    getattr(sys, 'base_prefix', '')
]:
    if not prefix:
        continue

    BEFORE_SITE.add(clean(prefix))
    
    for subdir in ['DLLs', 'Lib', 'Scripts']:
        d = clean(os.path.join(prefix, subdir))
        BEFORE_SITE.add(d)

BEFORE_SITE.discard(None)
AFTER_SITE.discard(None)

for p in sorted(BEFORE_SITE):
    if os.path.isdir(p):
        print("%s|stdlib|" % p)

for p in sorted(AFTER_SITE - BEFORE_SITE):
    if os.path.isdir(p):
        print("%s||" % p)
