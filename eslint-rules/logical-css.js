/**
 * Local ESLint plugin: enforce logical (writing-mode-aware) CSS only.
 *
 * The audited prototype's RTL support failed because it used physical
 * directional properties (padding-left, margin-right, left/right, text-align:left)
 * and only toggled `body.style.direction`. Here, physical directional styling is a
 * hard ERROR so the layout can never regress on RTL again.
 *
 * It flags, as errors:
 *   - Physical directional Tailwind utilities in `className` (and in
 *     cn()/clsx()/classNames()/twMerge() calls): pl-/pr-, ml-/mr-, left-/right-,
 *     text-left/right, float-left/right, clear-left/right, border-l/r,
 *     rounded-l/r/tl/tr/bl/br, scroll-pl/pr, scroll-ml/mr, divide-x.
 *     Use logical equivalents: ps-/pe-, ms-/me-, start-/end-, text-start/end,
 *     border-s/e, rounded-s/e, etc.
 *   - Physical directional properties in inline `style={{}}` (CSS-in-JS):
 *     paddingLeft/Right, marginLeft/Right, left/right, borderLeft/Right(*),
 *     text-align 'left'/'right', float/clear 'left'/'right'.
 *
 * Raw `.css` files are guarded separately by stylelint (see .stylelintrc.json).
 */

const CLASSNAME_HELPERS = new Set(['cn', 'clsx', 'classNames', 'classnames', 'twMerge', 'cva']);

// Each entry: [regExp on the *base* utility (variants + leading '-' stripped), suggestion]
const PHYSICAL_CLASS_RULES = [
  [/^p[lr]-/, 'use ps-/pe- (padding-inline)'],
  [/^m[lr]-/, 'use ms-/me- (margin-inline)'],
  [/^(?:left|right)-/, 'use start-/end- (inset-inline)'],
  [/^text-(?:left|right)$/, 'use text-start/text-end'],
  [/^float-(?:left|right)$/, 'use float-start/float-end'],
  [/^clear-(?:left|right)$/, 'use clear-start/clear-end'],
  [/^border-[lr](?:-|$)/, 'use border-s/border-e'],
  [/^rounded-(?:l|r|tl|tr|bl|br)(?:-|$)/, 'use rounded-s/rounded-e/rounded-ss/…'],
  [/^scroll-p[lr]-/, 'use scroll-ps/scroll-pe'],
  [/^scroll-m[lr]-/, 'use scroll-ms/scroll-me'],
  [/^divide-x(?:-|$)/, 'use flex gap-* (divide-x is not RTL-aware)'],
];

// Inline style (camelCase) physical props -> suggestion
const PHYSICAL_STYLE_PROPS = {
  paddingLeft: 'paddingInlineStart',
  paddingRight: 'paddingInlineEnd',
  marginLeft: 'marginInlineStart',
  marginRight: 'marginInlineEnd',
  left: 'insetInlineStart',
  right: 'insetInlineEnd',
  borderLeft: 'borderInlineStart',
  borderRight: 'borderInlineEnd',
  borderLeftWidth: 'borderInlineStartWidth',
  borderRightWidth: 'borderInlineEndWidth',
  borderLeftColor: 'borderInlineStartColor',
  borderRightColor: 'borderInlineEndColor',
  borderTopLeftRadius: 'borderStartStartRadius',
  borderTopRightRadius: 'borderStartEndRadius',
  borderBottomLeftRadius: 'borderEndStartRadius',
  borderBottomRightRadius: 'borderEndEndRadius',
};

function classifyToken(rawToken) {
  // strip Tailwind variant prefixes (hover:, md:, rtl:, group-hover:, etc.)
  let base = rawToken.includes(':') ? rawToken.slice(rawToken.lastIndexOf(':') + 1) : rawToken;
  // strip a single leading '-' for negative utilities (-ml-2)
  if (base.startsWith('-')) base = base.slice(1);
  if (!base) return null;
  for (const [re, suggestion] of PHYSICAL_CLASS_RULES) {
    if (re.test(base)) return suggestion;
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
const noPhysicalProperties = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow physical directional CSS; require logical properties (RTL-safe).',
    },
    schema: [],
    messages: {
      physicalClass:
        'Physical directional Tailwind class "{{token}}" is forbidden (breaks RTL). {{suggestion}}.',
      physicalStyle:
        'Physical CSS property "{{prop}}" in inline style is forbidden (breaks RTL). Use "{{suggestion}}".',
      physicalTextAlign: 'text-align: "{{value}}" is forbidden (breaks RTL). Use "start" or "end".',
      physicalFloatClear:
        '{{prop}}: "{{value}}" is forbidden (breaks RTL). Use "inline-start"/"inline-end".',
    },
  },
  create(context) {
    function checkClassString(node, value) {
      if (typeof value !== 'string') return;
      for (const token of value.split(/\s+/)) {
        if (!token) continue;
        const suggestion = classifyToken(token);
        if (suggestion) {
          context.report({ node, messageId: 'physicalClass', data: { token, suggestion } });
        }
      }
    }

    // Walk an expression that resolves to class names (Literal, TemplateLiteral,
    // conditional, logical, or cn()/clsx() calls) and check every string piece.
    function scanClassExpression(expr) {
      if (!expr) return;
      switch (expr.type) {
        case 'Literal':
          checkClassString(expr, expr.value);
          break;
        case 'TemplateLiteral':
          for (const quasi of expr.quasis)
            checkClassString(quasi, quasi.value.cooked ?? quasi.value.raw);
          for (const sub of expr.expressions) scanClassExpression(sub);
          break;
        case 'ConditionalExpression':
          scanClassExpression(expr.consequent);
          scanClassExpression(expr.alternate);
          break;
        case 'LogicalExpression':
          scanClassExpression(expr.left);
          scanClassExpression(expr.right);
          break;
        case 'BinaryExpression':
          if (expr.operator === '+') {
            scanClassExpression(expr.left);
            scanClassExpression(expr.right);
          }
          break;
        case 'ArrayExpression':
          for (const el of expr.elements) scanClassExpression(el);
          break;
        case 'CallExpression':
          if (expr.callee.type === 'Identifier' && CLASSNAME_HELPERS.has(expr.callee.name)) {
            for (const arg of expr.arguments) scanClassExpression(arg);
          }
          break;
        default:
          break;
      }
    }

    return {
      JSXAttribute(node) {
        const name = node.name && node.name.name;
        if (name === 'className') {
          if (!node.value) return;
          if (node.value.type === 'Literal') checkClassString(node.value, node.value.value);
          else if (node.value.type === 'JSXExpressionContainer')
            scanClassExpression(node.value.expression);
          return;
        }
        if (name === 'style' && node.value && node.value.type === 'JSXExpressionContainer') {
          const expr = node.value.expression;
          if (expr.type !== 'ObjectExpression') return;
          for (const prop of expr.properties) {
            if (prop.type !== 'Property' || prop.computed) continue;
            const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value;
            if (typeof key !== 'string') continue;
            if (PHYSICAL_STYLE_PROPS[key]) {
              context.report({
                node: prop,
                messageId: 'physicalStyle',
                data: { prop: key, suggestion: PHYSICAL_STYLE_PROPS[key] },
              });
            }
            if (
              key === 'textAlign' &&
              prop.value.type === 'Literal' &&
              /^(left|right)$/.test(String(prop.value.value))
            ) {
              context.report({
                node: prop,
                messageId: 'physicalTextAlign',
                data: { value: prop.value.value },
              });
            }
            if (
              (key === 'float' || key === 'clear') &&
              prop.value.type === 'Literal' &&
              /^(left|right)$/.test(String(prop.value.value))
            ) {
              context.report({
                node: prop,
                messageId: 'physicalFloatClear',
                data: { prop: key, value: prop.value.value },
              });
            }
          }
        }
      },
      // Top-level cn()/clsx() calls not attached to className (e.g. cva definitions).
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && CLASSNAME_HELPERS.has(node.callee.name)) {
          for (const arg of node.arguments) scanClassExpression(arg);
        }
      },
    };
  },
};

export default {
  rules: {
    'no-physical-properties': noPhysicalProperties,
  },
};
