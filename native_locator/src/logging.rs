// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, PartialEq, Debug, Eq, Clone)]
pub enum LogLevel {
    #[serde(rename = "debug")]
    Debug,
    #[serde(rename = "info")]
    Info,
    #[serde(rename = "warning")]
    Warning,
    #[serde(rename = "error")]
    Error,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Log {
    pub message: String,
    pub level: LogLevel,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogMessage {
    pub jsonrpc: String,
    pub method: String,
    pub params: Log,
}

impl LogMessage {
    pub fn new(message: String, level: LogLevel) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: "log".to_string(),
            params: Log { message, level },
        }
    }
}
