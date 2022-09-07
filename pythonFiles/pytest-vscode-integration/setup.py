#!/usr/bin/env python
# -*- coding: utf-8 -*-

import codecs
import os

from setuptools import setup


def read(fname):
    file_path = os.path.join(os.path.dirname(__file__), fname)
    return codecs.open(file_path, encoding='utf-8').read()


setup(
    name='pytest-vscode-integration',
    version='0.1.0',
    author='Eleanor Boyd',
    author_email='eleanorboyd@microsoft.com',
    maintainer='Eleanor Boyd',
    maintainer_email='eleanorboyd@microsoft.com',
    license='MIT',
    url='https://github.com/eleanorboyd/pytest-vscode-integration',
    description='used to surface pytest functionality to ports for vscode integration',
    long_description=read('README.rst'),
    py_modules=['pytest_vscode_integration'],
    python_requires='>=3.5',
    install_requires=['pytest>=3.5.0'],
    classifiers=[
        'Development Status :: 4 - Beta',
        'Framework :: Pytest',
        'Intended Audience :: Developers',
        'Topic :: Software Development :: Testing',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.5',
        'Programming Language :: Python :: 3.6',
        'Programming Language :: Python :: 3.7',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3 :: Only',
        'Programming Language :: Python :: Implementation :: CPython',
        'Programming Language :: Python :: Implementation :: PyPy',
        'Operating System :: OS Independent',
        'License :: OSI Approved :: MIT License',
    ],
    entry_points={
        'pytest11': [
            'vscode-integration = pytest_vscode_integration',
        ],
    },
)
