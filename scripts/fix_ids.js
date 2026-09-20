
import fs from 'fs';
const file = 'scripts/populate_showcases.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("id: 'c1_degradation'", "id: 'res_c1_degradation'");
content = content.replace("id: 'c1_residual_learning'", "id: 'res_c1_residual_learning'");
content = content.replace("id: 'c2_arch_table'", "id: 'res_c2_arch_table'");
content = content.replace("id: 'c2_gradient_flow'", "id: 'res_c2_gradient_flow'");
content = content.replace("id: 'c3_hero_stats',\n      outputId: out2.id", "id: 'res_c3_hero_stats',\n      outputId: out2.id");
content = content.replace("id: 'c3_hero_stats',\r\n      outputId: out2.id", "id: 'res_c3_hero_stats',\r\n      outputId: out2.id");
content = content.replace("id: 'c3_coco_detection'", "id: 'res_c3_coco_detection'");
content = content.replace("id: 'c3_legacy',\n      outputId: out2.id", "id: 'res_c3_legacy',\n      outputId: out2.id");
content = content.replace("id: 'c3_legacy',\r\n      outputId: out2.id", "id: 'res_c3_legacy',\r\n      outputId: out2.id");

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed card IDs for ws2');
