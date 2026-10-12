export const ALLOWED_COMPONENTS = new Set([
  'Heading', 'Paragraph', 'RichText', 'BulletList', 'NumberedList',
  'CalloutBox', 'GridContainer', 'ColumnStack', 'TableBlock', 'RubricTable',
  'MediaAssetBlock', 'Toc', 'CoverContainer', 'Divider', 'Spacer', 'PageBreak',
  'ObjectiveList', 'Glossary', 'QuestionItem', 'AnswerKey', 'CodeBlock',
]);

/**
 * Structural validation for a template definition. Returns an array of problem
 * strings (empty means valid). Hand-rolled to avoid an extra dependency.
 */
export function validateTemplate(template) {
  const problems = [];
  if (!template || typeof template !== 'object') {
    return ['Template must be an object.'];
  }
  if (!template.name || String(template.name).trim().length < 2) {
    problems.push('Template name is required (>= 2 chars).');
  }
  if (!Array.isArray(template.sections) || template.sections.length === 0) {
    problems.push('Template must have at least one section.');
    return problems;
  }

  const geometry = template.geometry || {};
  for (const key of ['widthMm', 'heightMm']) {
    if (geometry[key] !== undefined && !(Number(geometry[key]) > 0)) {
      problems.push(`geometry.${key} must be a positive number.`);
    }
  }

  template.sections.forEach((section, si) => {
    if (!section || typeof section !== 'object') {
      problems.push(`Section ${si} must be an object.`);
      return;
    }
    if (!Array.isArray(section.components)) {
      problems.push(`Section '${section.name || si}' must have a components array.`);
      return;
    }
    const walk = (nodes, path) => {
      nodes.forEach((node, ni) => {
        if (!node || typeof node !== 'object') {
          problems.push(`${path}[${ni}] must be an object.`);
          return;
        }
        if (!node.type || !ALLOWED_COMPONENTS.has(node.type)) {
          problems.push(`${path}[${ni}] has unknown component type '${node.type}'.`);
        }
        if (node.type === 'MediaAssetBlock' && !(node.props && (node.props.alt || node.props.src))) {
          problems.push(`${path}[${ni}] MediaAssetBlock requires alt text or src (accessibility).`);
        }
        if (Array.isArray(node.children)) walk(node.children, `${path}[${ni}].children`);
      });
    };
    walk(section.components, `sections[${si}].components`);
  });

  return problems;
}
