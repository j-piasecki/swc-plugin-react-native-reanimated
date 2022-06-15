use std::collections::{HashMap, VecDeque};
use swc_ecmascript::{ast::*, visit::{Visit, VisitWith}};
use swc_common::{DUMMY_SP};

#[derive(Debug)]
pub struct ClosureGeneratorVisitor {
    inside_member_expression: bool,
    inside_assign_expression: bool,
    inside_declarator: bool,
    current_ident: Option<IdentPath>,
    declared_identifiers: Vec<String>,
    trie: ClosureTrie,
}

impl ClosureGeneratorVisitor {
    pub fn new() -> Self {
        ClosureGeneratorVisitor {
            inside_assign_expression: false,
            inside_member_expression: false,
            inside_declarator: false,
            current_ident: None,
            declared_identifiers: Vec::new(),
            trie: ClosureTrie::new(None),
        }
    }

    pub fn build(&mut self) -> Expr {
        self.trie.remove_nodes(&self.declared_identifiers);
        let mut path = Vec::<Ident>::new();
        Expr::Object(ObjectLit {
            span: DUMMY_SP,
            props: self.trie.build(&mut path),
        })
    }

    pub fn print(&mut self) {
        println!("declared: {:#?}", self.declared_identifiers);
        println!("referenced: {:#?}", self.trie);
    }
}

impl Visit for ClosureGeneratorVisitor {
    fn visit_ident(&mut self, n: &Ident) {
        if self.inside_declarator {
            self.declared_identifiers.push(n.sym.to_string())
        } else if self.inside_member_expression {
            if let Some(ident_path) = &mut self.current_ident {
                ident_path.push(n.clone());
            } else {
                self.current_ident = Some(IdentPath::new(n.clone()));
            }
        } else {
            self.trie.add_path(IdentPath::new(n.clone()));
        }
    }

    fn visit_member_expr(&mut self, n: &MemberExpr) {
        let old = self.inside_member_expression;
        self.inside_member_expression = true;
        n.visit_children_with(self);
        self.inside_member_expression = old;

        if !self.inside_assign_expression && !self.inside_member_expression {
            if let Some(ident_path) = self.current_ident.take() {
                self.trie.add_path(ident_path);
            }
            self.current_ident = None;
        }
    }

    fn visit_assign_expr(&mut self, n: &AssignExpr) {
        let old = self.inside_assign_expression;
        self.inside_assign_expression = true;
        n.visit_children_with(self);
        self.inside_assign_expression = old;

        if let Some(mut ident_path) = self.current_ident.take() {
            ident_path.pop_latest();
            self.trie.add_path(ident_path);
            self.current_ident = None;
        }
    }

    fn visit_var_declarator(&mut self, n: &VarDeclarator) {
        let old = self.inside_declarator;
        self.inside_declarator = true;
        n.name.visit_with(self);
        self.inside_declarator = old;

        n.init.visit_with(self);
    }

    fn visit_fn_decl(&mut self, n: &FnDecl) {
        let old = self.inside_declarator;
        self.inside_declarator = true;
        n.ident.visit_with(self);
        self.inside_declarator = old;

        n.function.visit_children_with(self);
    }

    fn visit_key_value_prop(&mut self, n: &KeyValueProp) {
        n.value.visit_with(self);
    }

    // fn visit_expr(&mut self, n: &Expr) {
    //     println!("begin expression");
    //     n.visit_children_with(self);
    //     println!("after expression");
    // }
}

#[derive(Debug)]
struct IdentPath {
    pub path: VecDeque<IdentRef>,
}

impl IdentPath {
    pub fn new(ident: Ident) -> Self {
        IdentPath { path: VecDeque::from_iter([IdentRef { name: ident.sym.to_string(), ident: ident }]) }
    }

    pub fn push(&mut self, ident: Ident) {
        self.path.push_back(IdentRef { name: ident.sym.to_string(), ident: ident });
    }

    pub fn pop_latest(&mut self) -> Option<IdentRef> {
        self.path.pop_back()
    }

    pub fn pop_first(&mut self) -> Option<IdentRef> {
        self.path.pop_front()
    }

    pub fn depth(&self) -> usize {
        return self.path.len();
    }

    pub fn is_empty(&self) -> bool {
        return self.path.is_empty();
    }
}

#[derive(Debug)]
struct IdentRef {
    name: String,
    ident: Ident,
}

#[derive(Debug)]
struct ClosureTrie {
    nodes: HashMap<String, ClosureTrie>,
    ident: Option<IdentRef>,
    is_leaf: bool,
}

impl ClosureTrie {
    pub fn new(ident: Option<IdentRef>) -> Self {
        ClosureTrie { nodes: HashMap::new(), is_leaf: false, ident: ident }
    }

    pub fn remove_nodes(&mut self, nodes: &Vec<String>) {
        for key in nodes.iter() {
            self.nodes.remove(key);
        }
    }

    pub fn add_path(&mut self, mut path: IdentPath) {
        let current = if let Some(current) = path.pop_first() {
            current
        } else {
            self.is_leaf = true;
            return;
        };

        let parent = self.nodes.entry(current.name.clone()).or_insert(ClosureTrie::new(Some(current)));
        parent.add_path(path);
    }

    pub fn build(&mut self, path: &mut Vec<Ident>) -> Vec<PropOrSpread> {
        let mut result = Vec::new();

        for (name, trie) in self.nodes.iter_mut() {
            let ident = if let Some(ident) = &mut trie.ident {
                ident.ident.clone()
            } else {
                Ident::new(name.clone().into(), DUMMY_SP)
            };

            path.push(ident.clone());
            let value = if trie.is_leaf {
                ClosureTrie::path_to_expr(path.clone())
            } else {
                Expr::Object(ObjectLit {
                    span: DUMMY_SP,
                    props: trie.build(path),
                })
            };
            path.pop();

            result.push(PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                key: PropName::Ident(ident),
                value: Box::new(value),
            }))))
        }

        return result;
    }

    fn path_to_expr(mut path: Vec<Ident>) -> Expr {
        if path.len() == 1 {
            Expr::Ident(path.pop().unwrap())
        } else {
            let prop = path.pop().unwrap();
            Expr::Member(MemberExpr {
                span: DUMMY_SP,
                obj: Box::new(ClosureTrie::path_to_expr(path)),
                prop: MemberProp::Ident(prop),
            })
        }
    }
}