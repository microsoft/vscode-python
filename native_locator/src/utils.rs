// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use regex::Regex;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

#[derive(Debug)]
pub struct PyEnvCfg {
    pub version: String,
}

pub fn parse_pyenv_cfg(path: &PathBuf) -> Option<PyEnvCfg> {
    let cfg = path.join("pyvenv.cfg");
    if !fs::metadata(&cfg).is_ok() {
        return None;
    }

    let contents = fs::read_to_string(cfg).ok()?;
    let version_regex = Regex::new(r"^version\s*=\s*(\d+\.\d+\.\d+)$").unwrap();
    let version_info_regex = Regex::new(r"^version_info\s*=\s*(\d+\.\d+\.\d+.*)$").unwrap();
    for line in contents.lines() {
        if !line.contains("version") {
            continue;
        }
        if let Some(captures) = version_regex.captures(line) {
            if let Some(value) = captures.get(1) {
                return Some(PyEnvCfg {
                    version: value.as_str().to_string(),
                });
            }
        }
        if let Some(captures) = version_info_regex.captures(line) {
            if let Some(value) = captures.get(1) {
                return Some(PyEnvCfg {
                    version: value.as_str().to_string(),
                });
            }
        }
    }
    None
}

pub fn get_version(path: &str) -> Option<String> {
    if let Some(parent_folder) = PathBuf::from(path).parent() {
        if let Some(pyenv_cfg) = parse_pyenv_cfg(&parent_folder.to_path_buf()) {
            return Some(pyenv_cfg.version);
        }
        if let Some(parent_folder) = parent_folder.parent() {
            if let Some(pyenv_cfg) = parse_pyenv_cfg(&parent_folder.to_path_buf()) {
                return Some(pyenv_cfg.version);
            }
        }
    }
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
