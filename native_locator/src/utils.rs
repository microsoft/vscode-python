// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use std::process::Command;

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
