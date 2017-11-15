# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

"""
Starts running a block of code or a python file.
"""

try:
    import visualstudio_py_util as _vspu
except:
    import traceback
    traceback.print_exc()
    print('''
Internal error detected. Please copy the above traceback and report at
https://github.com/Microsoft/vscode-python/issues

Press Enter to close. . .''')
    try:
        raw_input()
    except NameError:
        input()
    import sys
    sys.exit(1)

def launch():
    import os
    import sys

    # Arguments are:
    # 1. Working directory.
    # 2. VS debugger port to connect to.
    # 3. GUID for the debug session (not used)
    # 4. Debug options (as integer - see enum PythonDebugOptions).
    # 5. '-m' or '-c' to override the default run-as mode. [optional]
    # 6. Startup script name.
    # 7. Script arguments.s

    # change to directory we expected to start from
    os.chdir(sys.argv[1])

    port_num = int(sys.argv[2])
    debug_options = parse_debug_options(sys.argv[4])
    wait_on_normal_exit = 'WaitOnNormalExit' in debug_options

    del sys.argv[0:5]

    # set run_as mode appropriately
    run_as = 'script'
    if sys.argv and sys.argv[0] == '-m':
        run_as = 'module'
        del sys.argv[0]
    if sys.argv and sys.argv[0] == '-c':
        run_as = 'code'
        del sys.argv[0]

    # preserve filename before we del sys.
    filename = sys.argv[0]

    # fix sys.path to be the script file dir.
    sys.path[0] = ''

    currentPid = os.getpid()

    # remove all state we imported.
    del sys, os

    run(filename, port_num, wait_on_normal_exit, currentPid, run_as)

def run(file, port_num, wait_on_normal_exit, currentPid, run_as = 'script'):
    attach_process(port_num, currentPid)

    # now execute main file
    globals_obj = {'__name__': '__main__'}

    if run_as == 'module':
        _vspu.exec_module(file, globals_obj)
    elif run_as == 'code':
        _vspu.exec_code(file, '<string>', globals_obj)
    else:
        _vspu.exec_file(file, globals_obj)

    if wait_on_normal_exit:
        do_wait()

    LAST = _vspu.to_bytes('LAST')
    _vspu.write_bytes(conn, LAST)
    # wait for message to be received by debugger.
    import time
    time.sleep(0.5)

def attach_process(port_num, currentPid):
    import socket
    try:
        xrange
    except:
        xrange = range

    global conn
    for i in xrange(50):
        try:
            conn = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            conn.connect(('127.0.0.1', port_num))
            _vspu.write_int(conn, currentPid)
            break
        except:
            import time
            time.sleep(50./1000)
    else:
        raise Exception('failed to attach')

def do_wait():
    import sys
    try:
        import msvcrt
    except ImportError:
        sys.__stdout__.write('Press Enter to continue . . . ')
        sys.__stdout__.flush()
        sys.__stdin__.read(1)
    else:
        sys.__stdout__.write('Press any key to continue . . . ')
        sys.__stdout__.flush()
        msvcrt.getch()

def parse_debug_options(s):
    return set([opt.strip() for opt in s.split(',')])

if __name__ == '__main__':
    launch()
