mod constants;
use hash32::{FnvHasher, Hasher};
use std::hash::Hash;
pub use visitors::{WorkletsOptions, ReanimatedWorkletsVisitor};
mod utils;
mod visitors;

use crate::constants::GLOBALS;
use swc_ecmascript::{
    ast::*,
    visit::VisitMut,
};

/// This hash does not returns identical to original plugin's hash64.
fn calculate_hash(value: &str) -> f64 {
    let mut fnv = FnvHasher::default();
    value.hash(&mut fnv);
    fnv.finish32() as f64
}

pub fn create_worklets_visitor<
    C: Clone + swc_common::comments::Comments,
    S: swc_common::SourceMapper + SourceMapperExt,
>(
    worklets_options: WorkletsOptions,
    source_map: std::sync::Arc<S>,
    comments: C,
) -> impl VisitMut {
    let mut globals_vec = GLOBALS.map(|v| v.to_string()).to_vec();

    // allows adding custom globals such as host-functions
    if let Some(custom_globals) = worklets_options.custom_globals {
        globals_vec.extend(custom_globals);
    };

    ReanimatedWorkletsVisitor::new(
        source_map,
        globals_vec,
        worklets_options.filename,
        worklets_options.relative_cwd,
        comments,
    )
}
