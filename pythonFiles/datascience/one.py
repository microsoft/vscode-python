import sys
import runpy
import traceback
print(sys.argv)
try:
    # sys.argv = ['', '--version']
    import pip
    # print(pip.__version__)
    pip = runpy.run_module('pip')
    print('__version__' in pip)
    print('version' in pip)
    print("hello Don")
except Exception:
    print('bye')
    traceback.print_last()
    pass


print("hello Don 1234")
