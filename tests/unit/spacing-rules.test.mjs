import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";

const eslint = new ESLint({ fix: true });

async function format(source) {
  const [result] = await eslint.lintText(source, {
    filePath: "src/spacing-fixture.tsx",
  });

  return result.output ?? source;
}

test("separates types, function declarations, arrow functions and returns", async () => {
  const result = await format(`type A = string;
type B = number;
const helper = () => 1;
const other = () => 2;
export function Component() {
  const [first] = useState(1);
  const [second] = useState(2);
  return <div>{first + second}</div>;
}
`);

  assert.match(result, /type A = string;\n\ntype B = number;/);
  assert.match(result, /type B = number;\n\nconst helper/);
  assert.match(result, /const helper = \(\) => 1;\n\nconst other/);
  assert.match(result, /const other = \(\) => 2;\n\nexport function/);
  assert.match(
    result,
    /const \[first\] = useState\(1\);\n  const \[second\] = useState\(2\);\n\n  return/,
  );
});

test("keeps trailing comments attached when inserting blank lines", async () => {
  const result = await format(`const value = 1; // Keep this comment
const helper = () => value;
`);

  assert.match(
    result,
    /const value = 1; \/\/ Keep this comment\n\nconst helper/,
  );
});
