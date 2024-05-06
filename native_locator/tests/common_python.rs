// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use python_finder::{common_python, messaging};
use std::{env, path::PathBuf};

#[test]
#[cfg(unix)]
fn find_python_in_path() {
    let unix_python = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/unix/known");
    env::set_var("PATH_TEST", unix_python.to_str().unwrap());
    messaging::clear_rpc_messages();

    common_python::find_and_report();

    assert_eq!(messaging::get_rpc_messages().len(), 1);
    let env: messaging::PythonEnvironment =
        serde_json::from_str(&messaging::get_rpc_messages()[0]).unwrap();
    assert_eq!(env.name, "Python");
    assert_eq!(env.version.unwrap(), "12.0.0");
    assert_eq!(env.python_executable_path, unix_python.join("python").to_str().unwrap());
}
