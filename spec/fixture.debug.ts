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
  /*
    ['plugin', (code: string) => {
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
      }

      const { transformSync } = require('@swc/core');
      return transformSync(code, opt)
    }],*/
  [
    "custom transform",
    (code: string) => {
      const { transformSync } = require("../index");
      return transformSync(code, true, Buffer.from(JSON.stringify(options)));
    },
  ],
];

describe.each(transformPresets)("fixture with %s", (_, executeTransform) => {
  it("doesn't transform standard callback functions", () => {
    const input = `
      const foo = Something.Tap().onEnd((_event, _success) => {
        console.log('onEnd');
      });
    `;

    const { code } = executeTransform(input);
    expect(code).toMatchInlineSnapshot(`
      "\\"use strict\\";
      const foo = Something.Tap().onEnd((_event, _success)=>{
          console.log('onEnd');
      });
      "
    `);
  });
});
