
import fs from 'fs';
const file = 'scripts/generate_showcase_assets.py';
let content = fs.readFileSync(file, 'utf8');
content = content.replace('plt.title("Residual Learning Building Block", fontsize=14, fontweight="bold", color="#0F172A", pad=12)', '# inner title omitted for clean poster presentation');
fs.writeFileSync(file, content, 'utf8');
