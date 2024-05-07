// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use std::{
    path::{Path, PathBuf},
    process::Command,
};

pub fn get_version(path: &str) -> Option<String> {
    let output = Command::new(path)
        .arg("-c")
        .arg("import sys; print(sys.version)")
        .output()
        .ok()?;
    let output = String::from_utf8(output.stdout).ok()?;
    let output = output.trim();
    let output = output.split_whitespace().next().unwrap_or(output);
    Some(output.to_string())
}

pub fn find_python_binary_path(env_path: &Path) -> Option<PathBuf> {
    let python_bin_name = if cfg!(windows) {
        "python.exe"
    } else {
        "python"
    };
    let path_1 = env_path.join("bin").join(python_bin_name);
    let path_2 = env_path.join("Scripts").join(python_bin_name);
    let path_3 = env_path.join(python_bin_name);
    let paths = vec![path_1, path_2, path_3];
    paths.into_iter().find(|path| path.exists())
}
