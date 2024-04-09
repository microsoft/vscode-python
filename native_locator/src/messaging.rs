// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use serde::{Deserialize, Serialize};


#[derive(Serialize, Deserialize)]
pub struct EnvManager {
    executable_path: Vec<String>,
    version: Option<String>,
}

impl EnvManager {
    pub fn new(executable_path: Vec<String>, version: Option<String>) -> Self {
        Self {
            executable_path,
            version,
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct EnvManagerMessage {
    jsonrpc: String,
    method: String,
    params: EnvManager,
}

impl EnvManagerMessage {
    pub fn new(params: EnvManager) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: "envManager".to_string(),
            params,
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct PythonEnvironment {
    name: String,
    python_executable_path: Vec<String>,
    category: String,
    version: Option<String>,
    activated_run: Option<Vec<String>>,
}

impl PythonEnvironment {
    pub fn new(
        name: String,
        python_executable_path: Vec<String>,
        category: String,
        version: Option<String>,
        activated_run: Option<Vec<String>>,
    ) -> Self {
        Self {
            name,
            python_executable_path: python_executable_path,
            category,
            version,
            activated_run,
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct PythonEnvironmentMessage {
    jsonrpc: String,
    method: String,
    params: PythonEnvironment,
}

impl PythonEnvironmentMessage {
    pub fn new(params: PythonEnvironment) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: "pythonEnvironment".to_string(),
            params,
        }
    }
}

fn send_rpc_message(message: String) -> () {
    println!(
        "Content-Length: {}\r\nContent-Type: application/vscode-jsonrpc; charset=utf-8\r\n\r\n{}",
        message.len(),
        message
    );
}

pub fn send_message<T: serde::Serialize>(message: T) -> () {
    let message = serde_json::to_string(&message).unwrap();
    send_rpc_message(message);
}
