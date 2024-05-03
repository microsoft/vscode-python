// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use crate::messaging;
use crate::utils;
use std::env;
use std::path::Path;

fn get_env_path(path: &str) -> Option<String> {
    let path = Path::new(path);
    match path.parent() {
        Some(parent) => {
            if parent.file_name()? == "Scripts" {
                return Some(parent.parent()?.to_string_lossy().to_string());
            } else {
                return Some(parent.to_string_lossy().to_string());
            }
        }
        None => None,
    }
}

fn report_path_python(path: &str) {
    let version = utils::get_version(path);
    let env_path = get_env_path(path);
    messaging::send_message(messaging::PythonEnvironment::new(
        "Python".to_string(),
        vec![path.to_string()],
        "System".to_string(),
        version,
        None,
        env_path,
    ));
}

fn report_python_on_path() {
    let paths = env::var("PATH");
    let bin = if cfg!(windows) {
        "python.exe"
    } else {
        "python"
    };
    match paths {
        Ok(paths) => {
            let paths = env::split_paths(&paths);
            for path in paths {
                let full_path = path.join(bin);
                if full_path.exists() {
                    match full_path.to_str() {
                        Some(full_path) => report_path_python(full_path),
                        None => (),
                    }
                }
            }
        }
        Err(_) => (),
    }
}

pub fn find_and_report() {
    report_python_on_path();
}
