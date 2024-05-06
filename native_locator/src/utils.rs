// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use std::process::Command;

fn get_version_impl(path: &str) -> Option<String> {
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

#[cfg(not(feature = "test"))]
pub fn get_version(path: &str) -> Option<String> {
    get_version_impl(path)
}

// Tests

#[cfg(feature = "test")]
pub fn get_version(path: &str) -> Option<String> {
    use std::path::PathBuf;
    let version_file = PathBuf::from(path.to_owned() + ".version");
    if version_file.exists() {
        let version = std::fs::read_to_string(version_file).ok()?;
        return Some(version.trim().to_string());
    }
    get_version_impl(path)
}
