const fs = require('fs');
const path = require('path');

const nodeModulesDir = path.resolve(__dirname, '../node_modules');

function patchMetroPackage(pkgName) {
  const pkgPath = path.join(nodeModulesDir, pkgName, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (!pkg.exports) {
        pkg.exports = {
          '.': './src/index.js',
          './package.json': './package.json',
          './private/*': './src/*.js',
        };
      }
      // Add multi-depth patterns so subpath requires resolve cleanly
      for (let depth = 1; depth <= 6; depth++) {
        const stars = Array(depth).fill('*').join('/');
        pkg.exports['./src/' + stars] = './src/' + stars + '.js';
        pkg.exports['./src/' + stars + '.js'] = './src/' + stars + '.js';
        pkg.exports['./' + stars] = './' + stars + '.js';
        pkg.exports['./' + stars + '.js'] = './' + stars + '.js';
      }
      // Preserve private/* mapping
      pkg.exports['./private/*'] = './src/*.js';
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
      console.log(`Patched ${pkgName}`);
    } catch (e) {
      console.warn(`Could not patch ${pkgName}:`, e.message);
    }
  }
}

if (fs.existsSync(nodeModulesDir)) {
  const dirs = fs.readdirSync(nodeModulesDir).filter((d) => d.startsWith('metro'));
  for (const dir of dirs) {
    patchMetroPackage(dir);
  }
}
