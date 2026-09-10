const fs = require('fs');
let code = fs.readFileSync('src/components/MarketHeatmap.tsx', 'utf8');

code = code.replace(
  'const sectorNodes = svg.selectAll(\'g.sector\')\n      .data(root.children || [])',
  'const sectorNodes = svg.selectAll(\'g.sector\')\n      .data((root.children || []) as d3.HierarchyRectangularNode<any>[])'
);

code = code.replace(
  'const leaves = root.leaves();',
  'const leaves = root.leaves() as d3.HierarchyRectangularNode<any>[];'
);

fs.writeFileSync('src/components/MarketHeatmap.tsx', code);
