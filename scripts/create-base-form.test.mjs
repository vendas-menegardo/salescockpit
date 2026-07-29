import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import ts from "typescript";

const formPath = path.resolve(
  "src/features/bases/components/create-base-form.tsx"
);
const sourceText = fs.readFileSync(formPath, "utf8");
const sourceFile = ts.createSourceFile(
  formPath,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

function descendants(node, predicate) {
  const matches = [];

  function visit(current) {
    if (predicate(current)) {
      matches.push(current);
    }

    ts.forEachChild(current, visit);
  }

  visit(node);

  return matches;
}

function jsxTagName(node) {
  return node.tagName.getText(sourceFile);
}

function jsxAttribute(openingElement, name) {
  return openingElement.attributes.properties.find(
    (property) =>
      ts.isJsxAttribute(property) &&
      property.name.getText(sourceFile) === name
  );
}

function jsxStringValue(attribute) {
  assert.ok(attribute && ts.isStringLiteral(attribute.initializer));

  return attribute.initializer.text;
}

function jsxExpressionText(attribute) {
  assert.ok(attribute && ts.isJsxExpression(attribute.initializer));
  assert.ok(attribute.initializer.expression);

  return attribute.initializer.expression.getText(sourceFile);
}

const forms = descendants(
  sourceFile,
  (node) => ts.isJsxElement(node) && jsxTagName(node.openingElement) === "form"
);

assert.equal(forms.length, 1, "O componente deve conter um único formulário.");

const form = forms[0];
const submitButtons = descendants(
  form,
  (node) =>
    ts.isJsxElement(node) && jsxTagName(node.openingElement) === "Button"
);

assert.equal(
  submitButtons.length,
  1,
  "O formulário deve conter um único Button."
);

const submitButton = submitButtons[0].openingElement;
const handleSubmitFunctions = descendants(
  sourceFile,
  (node) =>
    ts.isFunctionDeclaration(node) &&
    node.name?.text === "handleSubmit"
);

assert.equal(handleSubmitFunctions.length, 1);

const handleSubmit = handleSubmitFunctions[0];
const createBaseCalls = descendants(
  handleSubmit,
  (node) =>
    ts.isCallExpression(node) &&
    node.expression.getText(sourceFile) === "createBase"
);
const setLoadingCalls = descendants(
  handleSubmit,
  (node) =>
    ts.isCallExpression(node) &&
    node.expression.getText(sourceFile) === "setLoading"
);
const tryStatements = descendants(handleSubmit, ts.isTryStatement);

test("clique em Criar Base usa o envio nativo do formulário", () => {
  assert.equal(
    jsxStringValue(jsxAttribute(submitButton, "type")),
    "submit"
  );
  assert.equal(
    jsxExpressionText(jsxAttribute(form.openingElement, "onSubmit")),
    "handleSubmit"
  );
});

test("Enter em um campo mantém o mesmo caminho nativo de submit", () => {
  assert.equal(
    jsxStringValue(jsxAttribute(submitButton, "type")),
    "submit"
  );
  assert.equal(
    jsxExpressionText(jsxAttribute(form.openingElement, "onSubmit")),
    "handleSubmit"
  );
});

test("o envio chama createBase exatamente uma vez e aguarda o resultado", () => {
  assert.equal(createBaseCalls.length, 1);
  assert.ok(ts.isAwaitExpression(createBaseCalls[0].parent));
});

test("loading bloqueia envio duplicado e volta ao estado normal", () => {
  assert.equal(
    jsxExpressionText(jsxAttribute(submitButton, "disabled")),
    "loading"
  );
  assert.equal(
    setLoadingCalls.filter(
      (call) => call.arguments[0]?.kind === ts.SyntaxKind.TrueKeyword
    ).length,
    1
  );
  assert.equal(
    setLoadingCalls.filter(
      (call) => call.arguments[0]?.kind === ts.SyntaxKind.FalseKeyword
    ).length,
    1
  );
  assert.equal(tryStatements.length, 1);
  assert.ok(tryStatements[0].finallyBlock);
  assert.ok(
    descendants(
      tryStatements[0].finallyBlock,
      (node) =>
        ts.isCallExpression(node) &&
        node.expression.getText(sourceFile) === "setLoading" &&
        node.arguments[0]?.kind === ts.SyntaxKind.FalseKeyword
    ).length === 1
  );
});

test("erros da ação continuam propagados após reativar o formulário", () => {
  assert.equal(tryStatements.length, 1);
  assert.equal(tryStatements[0].catchClause, undefined);
  assert.ok(tryStatements[0].finallyBlock);
});
