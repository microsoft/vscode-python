// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use std::{collections::HashSet, fs::DirEntry, io::Error, path::PathBuf};

use crate::{known::Environment, messaging::MessageDispatcher};
use regex::Regex;

fn is_symlinked_python_executable(path: Result<DirEntry, Error>) -> Option<PathBuf> {
    let path = path.ok()?.path();
    let name = path.file_name()?.to_string_lossy();
    if !name.starts_with("python") || name.ends_with("-config") {
        return None;
    }
    let metadata = std::fs::symlink_metadata(&path).ok()?;
    if metadata.is_file() || !metadata.file_type().is_symlink() {
        return None;
    }
    Some(std::fs::canonicalize(path).ok()?)
}

pub fn find_and_report(
    dispatcher: &mut impl MessageDispatcher,
    environment: &impl Environment,
) -> Option<()> {
    // https://docs.brew.sh/Homebrew-and-Python#brewed-python-modules
    // Executable Python scripts will be in $(brew --prefix)/bin.
    // They are always symlinks, hence we will only look for symlinks.

    let homebrew_prefix = environment.get_env_var("HOMEBREW_PREFIX".to_string())?;
    let homebrew_prefix_bin = PathBuf::from(homebrew_prefix).join("bin");
    let mut reported: HashSet<String> = HashSet::new();
    let python_regex = Regex::new(r"/(\d+\.\d+\.\d+)/").unwrap();
    for file in std::fs::read_dir(homebrew_prefix_bin).ok()? {
        if let Some(exe) = is_symlinked_python_executable(file) {
            let python_version = exe.to_string_lossy().to_string();
            let version = match python_regex.captures(&python_version) {
                Some(captures) => match captures.get(1) {
                    Some(version) => Some(version.as_str().to_string()),
                    None => None,
                },
                None => None,
            };
            if reported.contains(&exe.to_string_lossy().to_string()) {
                continue;
            }
            reported.insert(exe.to_string_lossy().to_string());

            let env = crate::messaging::PythonEnvironment::new(
                "Python".to_string(),
                vec![exe.to_string_lossy().to_string()],
                crate::messaging::PythonEnvironmentCategory::Homebrew,
                version,
                None,
                None,
                None,
            );
            dispatcher.report_environment(env);
        }
    }

    None
}
