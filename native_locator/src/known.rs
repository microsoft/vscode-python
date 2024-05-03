// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
use std::{env, path::PathBuf};


#[cfg(windows)]
pub fn get_know_global_search_locations() -> Vec<PathBuf> {
    vec![]
}

#[cfg(unix)]
pub fn get_know_global_search_locations() -> Vec<PathBuf> {
    vec![
        Path::new("/usr/bin").to_path_buf(),
        Path::new("/usr/local/bin").to_path_buf(),
        Path::new("/bin").to_path_buf(),
        Path::new("/home/bin").to_path_buf(),
        Path::new("/sbin").to_path_buf(),
        Path::new("/usr/sbin").to_path_buf(),
        Path::new("/usr/local/sbin").to_path_buf(),
        Path::new("/home/sbin").to_path_buf(),
        Path::new("/opt").to_path_buf(),
        Path::new("/opt/bin").to_path_buf(),
        Path::new("/opt/sbin").to_path_buf(),
        Path::new("/opt/homebrew/bin").to_path_buf(),
    ]
}



pub fn get_user_home() -> Option<String> {
    let home = env::var("HOME").or_else(|_| env::var("USERPROFILE"));
    match home {
        Ok(home) => Some(home),
        Err(_) => None,
    }
}
