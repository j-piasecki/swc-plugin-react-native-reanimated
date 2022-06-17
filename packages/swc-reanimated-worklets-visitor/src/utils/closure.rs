use std::collections::{HashMap, VecDeque};

use swc_ecmascript::ast::Ident;

#[derive(Debug)]
pub struct IdentRef {
    name: String,
    ident: Ident,
}

#[derive(Debug)]
pub struct IdentPath {
    pub path: VecDeque<IdentRef>,
}

impl IdentPath {
    pub fn new(base: Ident) -> Self {
        IdentPath { path: VecDeque::from_iter([IdentRef { name: base.sym.to_string(), ident: base }]) }
    }

    pub fn add(&mut self, ident: Ident) {
        self.path.push_front(IdentRef { name: ident.sym.to_string(), ident: ident });
    }

    pub fn pop_latest(&mut self) -> Option<IdentRef> {
        self.path.pop_front()
    }

    pub fn pop_first(&mut self) -> Option<IdentRef> {
        self.path.pop_back()
    }
}