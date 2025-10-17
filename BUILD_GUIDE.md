# 🛠️ Moment-TabManager 构建指南

本指南说明如何使用构建脚本生成Chrome Web Store发布包，替代手动维护Release目录。

## 📦 构建脚本说明

项目提供了三种构建方式：

### 1. Node.js 构建脚本 (推荐)
- **文件**: `build.js`
- **优势**: 功能最完整，错误处理最好
- **要求**: 需要安装 Node.js

### 2. Windows 批处理脚本
- **文件**: `build.bat`
- **优势**: Windows原生支持，无需额外依赖
- **要求**: Windows系统 + PowerShell

### 3. Linux/macOS Shell脚本
- **文件**: `build.sh`
- **优势**: 跨平台支持，功能完整
- **要求**: bash + zip命令

## 🚀 使用方法

### Windows用户

#### 方法1: 使用Node.js脚本
```bash
# 确保已安装Node.js
node build.js
```

#### 方法2: 使用批处理脚本
```bash
# 双击运行或在命令行执行
build.bat
```

### Linux/macOS用户

#### 方法1: 使用Node.js脚本
```bash
# 确保已安装Node.js
node build.js
```

#### 方法2: 使用Shell脚本
```bash
# 给脚本执行权限（首次运行）
chmod +x build.sh

# 运行构建脚本
./build.sh
```

## 📋 构建流程

所有构建脚本都执行相同的流程：

### 1. 预构建检查 🔍
- 验证必需文件是否存在
- 检查 `manifest.json` 格式
- 读取扩展名称和版本号

### 2. 清理构建目录 🧹
- 删除旧的 `dist/` 目录
- 创建新的构建目录

### 3. 复制源文件 📁
- 复制所有源文件到构建目录
- 自动排除开发文件和目录

### 4. 验证构建结果 🔍
- 检查必需文件是否完整
- 计算构建包大小
- 查找可能的多余文件

### 5. 创建ZIP包 📦
- 生成带版本号的ZIP文件
- 验证ZIP包创建成功

## 📂 自动排除的文件

构建脚本会自动排除以下开发文件：

### 文件类型
- `*.md` - Markdown文档
- `*.log` - 日志文件
- `*.tmp` - 临时文件
- `*.bak` - 备份文件
- `test-*.html` - 测试页面

### 目录
- `dist/` - 构建输出目录
- `node_modules/` - Node.js依赖
- `.git/` - Git版本控制
- `temp_build/` - 临时构建目录

### 构建脚本
- `build.js`
- `build.bat`
- `build.sh`
- `BUILD_GUIDE.md`

## 📦 输出结果

构建完成后会生成：

### 1. 构建目录
- **位置**: `dist/`
- **内容**: 清理后的扩展文件
- **用途**: 本地测试和验证

### 2. 发布包
- **文件名**: `moment-tabmanager-v{版本号}.zip`
- **位置**: 项目根目录
- **用途**: 上传到Chrome Web Store

## 🔧 自定义配置

### 修改排除规则

编辑构建脚本中的排除模式：

```javascript
// build.js 中的配置
excludePatterns: [
    'build.js',
    'dist/',
    '*.md',
    'test-*.html',
    // 添加自定义排除规则
]
```

### 修改必需文件检查

```javascript
// build.js 中的配置
requiredFiles: [
    'manifest.json',
    'background.js',
    // 添加必需文件
]
```

## 🐛 常见问题

### Q: 构建失败，提示缺少文件
**A**: 检查项目结构是否完整，确保所有必需文件存在

### Q: ZIP包创建失败
**A**: 
- Windows: 确保PowerShell可用
- Linux/macOS: 安装zip命令 (`sudo apt-get install zip`)

### Q: 版本号读取失败
**A**: 检查 `manifest.json` 格式是否正确

### Q: 构建包过大
**A**: 检查是否有多余文件未被排除，修改排除规则

## 📈 版本管理

### 更新版本号
1. 修改 `manifest.json` 中的 `version` 字段
2. 运行构建脚本
3. 新的ZIP包会自动使用新版本号

### 版本号格式
遵循语义化版本控制：
- `1.0.0` - 主版本.次版本.修订版本
- `1.0.1` - 修复版本
- `1.1.0` - 功能版本
- `2.0.0` - 重大更新版本

## 🚀 发布流程

1. **本地测试**
   ```bash
   # 构建扩展包
   node build.js
   
   # 在Chrome中加载dist/目录测试
   ```

2. **创建发布包**
   ```bash
   # 确认版本号正确
   # 运行构建脚本
   node build.js
   ```

3. **上传到Chrome Web Store**
   - 登录 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
   - 上传生成的ZIP文件
   - 填写更新说明
   - 提交审核

## 💡 最佳实践

### 构建前检查清单
- [ ] 代码功能测试完成
- [ ] 更新 `manifest.json` 版本号
- [ ] 清理临时文件和测试代码
- [ ] 确认所有必需文件存在

### 发布前验证
- [ ] 在Chrome中加载构建包测试
- [ ] 检查所有功能正常工作
- [ ] 验证权限设置正确
- [ ] 确认图标和描述信息

## 🔄 迁移说明

### 从Release目录迁移
如果之前使用 `Moment-TabManager-Release` 目录：

1. **备份重要修改**（如果有）
2. **删除Release目录**
   ```bash
   rm -rf Moment-TabManager-Release/
   ```
3. **使用构建脚本**
   ```bash
   node build.js
   ```

### 优势对比
| 方面 | Release目录 | 构建脚本 |
|------|-------------|----------|
| 维护成本 | 高（手动同步） | 低（自动化） |
| 出错风险 | 高（人为错误） | 低（自动检查） |
| 版本一致性 | 难保证 | 自动保证 |
| 构建速度 | 慢（手动操作） | 快（自动化） |
| 可定制性 | 低 | 高 |

---

**推荐**: 使用 `build.js` Node.js脚本，功能最完整且跨平台兼容。
