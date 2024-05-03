// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use crate::known;
use crate::messaging;
use crate::utils;
use std::path::Path;

fn report_path_python(path: &str) {
    let version = utils::get_version(path);
    messaging::send_message(messaging::PythonEnvironment::new(
        "Python".to_string(),
        vec![path.to_string()],
        "WindowsStore".to_string(),
        version,
        None,
        None,
    ));
}

fn report_windows_store_python() {
    let home = known::get_user_home();
    match home {
        Some(home) => {
            let apps_path = Path::new(&home)
                .join("AppData")
                .join("Local")
                .join("Microsoft")
                .join("WindowsApps");
            let files = std::fs::read_dir(apps_path);
            match files {
                Ok(files) => {
                    for file in files {
                        match file {
                            Ok(file) => {
                                let path = file.path();
                                match path.file_name() {
                                    Some(name) => {
                                        let name = name.to_string_lossy().to_lowercase();
                                        if name.starts_with("python3.") && name.ends_with(".exe") {
                                            report_path_python(&path.to_string_lossy());
                                        }
                                    }
                                    None => {}
                                }
                            }
                            Err(_) => {}
                        }
                    }
                }
                Err(_) => {}
            }
        }
        None => {}
    }
}

fn report_registry_pythons() {}

pub fn find_and_report() {
    report_windows_store_python();
    report_registry_pythons();
}
