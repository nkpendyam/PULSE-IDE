// File system watcher module
// Provides real-time file change notifications

use notify::{Watcher, RecursiveMode, watcher};
use std::sync::mpsc::channel;
use std::time::Duration;

pub struct FsWatcher {
    watcher: notify::RecommendedWatcher,
}

impl FsWatcher {
    pub fn new() -> Result<Self, notify::Error> {
        let (tx, _rx) = channel();
        let watcher = watcher(tx, Duration::from_millis(200))?;
        Ok(Self { watcher })
    }
    
    pub fn watch(&mut self, path: &str) -> Result<(), notify::Error> {
        self.watcher.watch(path, RecursiveMode::Recursive)
    }
    
    pub fn unwatch(&mut self, path: &str) -> Result<(), notify::Error> {
        self.watcher.unwatch(path)
    }
}
