# -*- coding: utf-8 -*-
# pylint: disable=E0401, W0512

import os


class Foo(object):
    '''说明'''

    @staticmethod
    def bar():
        """
        说明 - keep this line, it works
        delete following line, it works
        如果存在需要等待审批或正在执行的任务，将不刷新页面
        """
        return os.path.exists('c:/')

def showMessage():
    """
    Кюм ут жэмпэр пошжим льаборэж, коммюны янтэрэсщэт нам ед, декта игнота ныморэ жят эи. 
    Шэа декам экшырки эи, эи зыд эррэм докэндё, векж факэтэ пэрчыквюэрёж ку.
    """
    print('1234')

Foo.bar()
showMessage()