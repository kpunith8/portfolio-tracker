function isFunctionVariable(statement) {
  const declaration =
    statement.type === "ExportNamedDeclaration"
      ? statement.declaration
      : statement;

  return (
    declaration?.type === "VariableDeclaration" &&
    declaration.declarations.some(
      ({ init }) =>
        init?.type === "ArrowFunctionExpression" ||
        init?.type === "FunctionExpression",
    )
  );
}

const functionSpacing = {
  meta: {
    type: "layout",
    docs: {
      description:
        "Separate function-valued declarations from adjacent statements",
    },
    fixable: "whitespace",
    schema: [],
    messages: {
      missing: "Expected a blank line around a function declaration.",
    },
  },
  create(context) {
    const source = context.sourceCode;

    function checkBody(node) {
      for (let i = 1; i < node.body.length; i++) {
        const previous = node.body[i - 1];
        const current = node.body[i];

        if (!isFunctionVariable(previous) && !isFunctionVariable(current))
          continue;
        if (current.loc.start.line - previous.loc.end.line > 1) continue;

        context.report({
          node: current,
          messageId: "missing",
          fix(fixer) {
            const nextToken = source.getTokenAfter(previous, {
              includeComments: true,
            });
            const end =
              nextToken?.loc.start.line === previous.loc.end.line &&
              (nextToken.type === "Line" || nextToken.type === "Block")
                ? nextToken.range[1]
                : previous.range[1];

            return fixer.insertTextAfterRange([end, end], "\n");
          },
        });
      }
    }

    return { Program: checkBody, BlockStatement: checkBody };
  },
};

export default functionSpacing;
