import * as path from "path";

const options = {
  filename: path.join(path.resolve(__dirname, ".."), "jest tests fixture"),
  jsc: {
    parser: {
      syntax: "ecmascript",
      jsx: true,
    },
    target: "es2022",
    preserveAllComments: true,
    experimental: {},
  },
  isModule: true,
  module: {
    type: "commonjs",
  },
};

const transformPresets: Array<
  [
    string,
    (code: string) => ReturnType<typeof import("@swc/core").transformSync>
  ]
> = [
    [
      "plugin",
      (code: string) => {
        const opt = { ...options };
        opt.jsc.experimental = {
          plugins: [
            [
              path.resolve(
                __dirname,
                "../target/wasm32-wasi/debug/swc_plugin_reanimated.wasm"
              ),
              {},
            ],
          ],
        };

        const { transformSync } = require("@swc/core");
        return transformSync(code, opt);
      },
    ],
    [
      "custom transform",
      (code: string) => {
        const { transformSync } = require("../index");
        return transformSync(code, true, Buffer.from(JSON.stringify(options)));
      },
    ]
    ,
  ];

describe.each(transformPresets)("fixture with %s", (_, executeTransform) => {
  it.skip("transforms", () => {
    const input = `
    import Animated, {
      useAnimatedStyle,
      useSharedValue,
    } from 'react-native-reanimated';

    function Box() {
      const offset = useSharedValue(0);

      const animatedStyles = useAnimatedStyle(() => {
        return {
          transform: [{ translateX: offset.value * 255 }],
        };
      });

      return (
        <>
          <Animated.View style={[styles.box, animatedStyles]} />
          <Button onPress={() => (offset.value = Math.random())} title="Move" />
        </>
      );
    }
  `;

    const { code } = executeTransform(input);
    expect(code).toMatchInlineSnapshot();
  });

  it.skip("supports default ES6 style imports", () => {
    const input = `
      import * as Reanimated from 'react-native-reanimated';

      function Box() {
        const offset = Reanimated.useSharedValue(0);

        const animatedStyles = Reanimated.useAnimatedStyle(() => {
          return {
            transform: [{ translateX: offset.value * 255 }],
          };
        });

        return (
          <>
            <Animated.View style={[styles.box, animatedStyles]} />
            <Button onPress={() => (offset.value = Math.random())} title="Move" />
          </>
        );
      }
    `;

    const { code } = executeTransform(input);
    expect(code).toContain("_closure");
  });

  it.skip("doesn't transform functions without 'worklet' directive", () => {
    const input = `
      function f(x) {
        return x + 2;
      }
    `;

    const { code } = executeTransform(input);
    expect(code).not.toContain("_f.__workletHash");
  });

  it.skip("removes comments from worklets", () => {
    const input = `
      const f = () => {
        'worklet';
        // some comment
        /*
        * other comment
        */
        return true;
      };
    `;

    const { code } = executeTransform(input);
    expect(code).not.toContain("some comment");
    expect(code).not.toContain("other comment");
  });

  it.skip('removes "worklet"; directive from worklets', () => {
    const input = `
      function foo(x) {
        "worklet"; // prettier-ignore
        return x + 2;
      }
    `;

    const { code } = executeTransform(input);
    expect(code).not.toContain('\\"worklet\\";');
  });

  it.skip("removes 'worklet'; directive from worklets", () => {
    const input = `
      function foo(x) {
        'worklet'; // prettier-ignore
        return x + 2;
      }
    `;

    const { code } = executeTransform(input);
    expect(code).not.toContain("'worklet';");
  });

  it.skip("doesn't transform string literals", () => {
    const input = `
      function foo(x) {
        'worklet';
        const bar = 'worklet'; // prettier-ignore
        const baz = "worklet"; // prettier-ignore
      }
    `;

    const { code } = executeTransform(input);
    expect(code).toMatchInlineSnapshot();
  });

  it.skip("captures worklets environment", () => {
    const input = `
      const x = 5;

      const objX = { x };

      function f() {
        'worklet';
        return { res: x + objX.x };
      }
    `;

    const { code } = executeTransform(input);
    expect(code).toMatchInlineSnapshot();
  });

  /*
  it.skip("doesn't capture globals", () => {
    const input = `
      function f() {
        'worklet';
        console.log('test');
      }
    `;

    const { code, ast } = executeTransform(input, { ast: true });
    let closureBindings;
    traverse(ast, {
      enter(path) {
        if (
          path.isAssignmentExpression() &&
          path.node.left.property.name === '_closure'
        ) {
          closureBindings = path.node.right.properties;
        }
      },
    });
    expect(closureBindings).toEqual([]);
    expect(code).toMatchInlineSnapshot();
  });*/

  // functions

  it.skip("workletizes FunctionDeclaration", () => {
    const input = `
      function foo(x) {
        'worklet';
        return x + 2;
      }
    `;

    const { code } = executeTransform(input);
    expect(code).toContain("_f.__workletHash");
    expect(code).not.toContain('\\"worklet\\";');
    expect(code).toMatchInlineSnapshot();
  });

  it.skip("workletizes ArrowFunctionExpression", () => {
    const input = `
      const foo = (x) => {
        'worklet';
        return x + 2;
      };
    `;

    const { code } = executeTransform(input);
    expect(code).toContain("_f.__workletHash");
    expect(code).not.toContain('\\"worklet\\";');
    expect(code).toMatchInlineSnapshot();
  });

  it.skip("workletizes unnamed FunctionExpression", () => {
    const input = `
      const foo = function (x) {
        'worklet';
        return x + 2;
      };
    `;

    const { code } = executeTransform(input);
    expect(code).toContain("_f.__workletHash");
    expect(code).not.toContain('\\"worklet\\";');
    expect(code).toMatchInlineSnapshot();
  });

  it.skip("workletizes named FunctionExpression", () => {
    const input = `
      const foo = function foo(x) {
        'worklet';
        return x + 2;
      };
    `;

    const { code } = executeTransform(input);
    expect(code).toContain("_f.__workletHash");
    expect(code).not.toContain('\\"worklet\\";');
    expect(code).toMatchInlineSnapshot();
  });

  // class methods

  it.skip("workletizes instance method", () => {
    const input = `
      class Foo {
        bar(x) {
          'worklet';
          return x + 2;
        }
      }
    `;

    const { code } = executeTransform(input);
    expect(code).toContain("_f.__workletHash");
    expect(code).not.toContain('\\"worklet\\";');
    expect(code).toMatchInlineSnapshot();
  });

  it.skip("workletizes static method", () => {
    const input = `
      class Foo {
        static bar(x) {
          'worklet';
          return x + 2;
        }
      }
    `;

    const { code } = executeTransform(input);
    expect(code).toContain("_f.__workletHash");
    expect(code).not.toContain('\\"worklet\\";');
    expect(code).toMatchInlineSnapshot();
  });

  it.skip("workletizes getter", () => {
    const input = `
      class Foo {
        get bar() {
          'worklet';
          return x + 2;
        }
      }
    `;

    const { code } = executeTransform(input);
    expect(code).toContain("_f.__workletHash");
    expect(code).not.toContain('\\"worklet\\";');
    expect(code).toMatchInlineSnapshot();
  });

  // function hooks

  it.skip("workletizes hook wrapped ArrowFunctionExpression automatically", () => {
    const input = `
      const animatedStyle = useAnimatedStyle(() => ({
        width: 50,
      }));
    `;

    const { code } = executeTransform(input);
    expect(code).toContain("_f.__workletHash");
    expect(code).toMatchInlineSnapshot();
  });

  it.skip("workletizes hook wrapped unnamed FunctionExpression automatically", () => {
    const input = `
      const animatedStyle = useAnimatedStyle(function () {
        return {
          width: 50,
        };
      });
    `;

    const { code } = executeTransform(input);
    expect(code).toContain("_f.__workletHash");
    expect(code).toMatchInlineSnapshot();
  });

  it.skip("workletizes hook wrapped named FunctionExpression automatically", () => {
    const input = `
      const animatedStyle = useAnimatedStyle(function foo() {
        return {
          width: 50,
        };
      });
    `;

    const { code } = executeTransform(input);
    expect(code).toContain("_f.__workletHash");
    expect(code).toMatchInlineSnapshot();
  });

  // object hooks

  it("workletizes object hook wrapped ArrowFunctionExpression automatically", () => {
    const input = `
      useAnimatedGestureHandler({
        onStart: (event) => {
          console.log(event);
        },
      });
    `;

    const { code } = executeTransform(input);
    expect(code).toContain("_f.__workletHash");
    expect(code).toMatchInlineSnapshot(`
    "\\"use strict\\";
    useAnimatedGestureHandler({
        onStart: function() {
            const _f = function _f(event) {
                console.log(event);
            };
            _f._closure = {};
            _f.asString = \\"function _f(event){console.log(event);}\\";
            _f.__workletHash = 2164830539996;
            _f.__location = \\"${process.cwd()}/jest tests fixture (3:17)\\";
            return _f;
        }()
    });
    "
  `);
  });

  it("workletizes object hook wrapped unnamed FunctionExpression automatically", () => {
    const input = `
      useAnimatedGestureHandler({
        onStart: function (event) {
          console.log(event);
        },
      });
    `;

    const { code } = executeTransform(input);
    expect(code).toContain("_f.__workletHash");
    expect(code).toMatchInlineSnapshot(`
      "\\"use strict\\";
      useAnimatedGestureHandler({
          onStart: function() {
              const _f = function _f(event) {
                  console.log(event);
              };
              _f._closure = {};
              _f.asString = \\"function _f(event){console.log(event);}\\";
              _f.__workletHash = 2164830539996;
              _f.__location = \\"${process.cwd()}/jest tests fixture (3:17)\\";
              return _f;
          }()
      });
      "
    `);
  });

  it.skip("workletizes object hook wrapped named FunctionExpression automatically", () => {
    const input = `
      useAnimatedGestureHandler({
        onStart: function onStart(event) {
          console.log(event);
        },
      });
    `;

    const { code } = executeTransform(input);
    expect(code).toContain("_f.__workletHash");
    expect(code).toMatchInlineSnapshot();
  });

  it.skip("workletizes object hook wrapped ObjectMethod automatically", () => {
    const input = `
      useAnimatedGestureHandler({
        onStart(event) {
          console.log(event);
        },
      });
    `;

    const { code } = executeTransform(input);
    expect(code).toContain("_f.__workletHash");
    expect(code).toMatchInlineSnapshot();
  });

  it("supports empty object in hooks", () => {
    const input = `
      useAnimatedGestureHandler({});
    `;

    executeTransform(input);
  });

  it.skip("transforms each object property in hooks", () => {
    const input = `
      useAnimatedGestureHandler({
        onStart: () => {},
        onUpdate: () => {},
        onEnd: () => {},
      });
    `;

    const { code } = executeTransform(input);
    expect(code).toMatch(/^(.*)(_f\.__workletHash(.*)){3}$/s);
  });

  // React Native Gesture Handler

  it.skip("workletizes possibly chained gesture object callback functions automatically", () => {
    const input = `
      import { Gesture } from 'react-native-gesture-handler';

      const foo = Gesture.Tap()
        .numberOfTaps(2)
        .onBegin(() => {
          console.log('onBegin');
        })
        .onStart((_event) => {
          console.log('onStart');
        })
        .onEnd((_event, _success) => {
          console.log('onEnd');
        });
    `;

    const { code } = executeTransform(input);
    expect(code).toMatchInlineSnapshot();
  });

  it.skip("doesn't transform standard callback functions", () => {
    const input = `
      const foo = Something.Tap().onEnd((_event, _success) => {
        console.log('onEnd');
      });
    `;

    const { code } = executeTransform(input);
    expect(code).toMatchInlineSnapshot();
  });

  it.skip("transforms spread operator in worklets for arrays", () => {
    const input = `
      function foo() {
        'worklet';
        const bar = [4, 5];
        const baz = [1, ...[2, 3], ...bar];
      }
    `;

    const { code } = executeTransform(input);
    expect(code).toMatchInlineSnapshot();
  });

  it.skip("transforms spread operator in worklets for objects", () => {
    const input = `
      function foo() {
        'worklet';
        const bar = {d: 4, e: 5};
        const baz = { a: 1, ...{ b: 2, c: 3 }, ...bar };
      }
    `;

    const { code } = executeTransform(input);
    expect(code).toMatchInlineSnapshot();
  });

  it.skip("transforms spread operator in worklets for function arguments", () => {
    const input = `
      function foo(...args) {
        'worklet';
        console.log(args);
      }
    `;

    const { code } = executeTransform(input);
    expect(code).toMatchInlineSnapshot();
  });

  it.skip("transforms spread operator in worklets for function calls", () => {
    const input = `
      function foo(arg) {
        'worklet';
        console.log(...arg);
      }
    `;

    const { code } = executeTransform(input);
    expect(code).toMatchInlineSnapshot();
  });
});
