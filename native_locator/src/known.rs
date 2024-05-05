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
        PathBuf::from("/usr/bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/bin"),
        PathBuf::from("/home/bin"),
        PathBuf::from("/sbin"),
        PathBuf::from("/usr/sbin"),
        PathBuf::from("/usr/local/sbin"),
        PathBuf::from("/home/sbin"),
        PathBuf::from("/opt"),
        PathBuf::from("/opt/bin"),
        PathBuf::from("/opt/sbin"),
        PathBuf::from("/opt/homebrew/bin"),
    ]
}

pub fn get_user_home() -> Option<String> {
    let home = env::var("HOME").or_else(|_| env::var("USERPROFILE"));
    match home {
        Ok(home) => Some(home),
        Err(_) => None,
    }
}
