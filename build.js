#!/usr/bin/env node

/**
 * Moment-TabManager 构建脚本
 * 用于生成Chrome Web Store发布包
 * 替代手动维护的Release目录
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 构建配置
const BUILD_CONFIG = {
    // 源目录（当前目录）
    sourceDir: __dirname,
    
    // 构建输出目录
    buildDir: path.join(__dirname, 'dist'),
    
    // 需要排除的开发文件和目录
    excludePatterns: [
        'build.js',           // 构建脚本本身
        'build.bat',          // Windows构建脚本
        'build.sh',           // Linux/macOS构建脚本
        'BUILD_GUIDE.md',     // 构建指南
        'dist/',              // 构建输出目录
        'node_modules/',      // Node.js依赖
        '.git/',              // Git版本控制
        '.gitignore',         // Git忽略文件
        '*.md',               // Markdown文档文件
        'test-*.html',        // 测试页面
        '*.log',              // 日志文件
        '.DS_Store',          // macOS系统文件
        'Thumbs.db',          // Windows系统文件
        '*.tmp',              // 临时文件
        '*.bak',              // 备份文件
        '*.zip'               // 之前生成的ZIP包
    ],
    
    // 必需的文件检查
    requiredFiles: [
        'manifest.json',
        'background.js',
        'sidepanel.html',
        'content-scripts/global-shortcuts.js',
        'content-scripts/text-drag-config.js',
        'content-scripts/link-preview.js',
        'css/link-preview.css',
        'css/sidepanel.css',
        'js/sidepanel.js',
        'js/tab-manager.js',
        'js/utils.js',
        'icons/icon16.png',
        'icons/icon32.png',
        'icons/icon48.png',
        'icons/icon128.png'
    ]
};

class ExtensionBuilder {
    constructor(config) {
        this.config = config;
        this.startTime = Date.now();
    }

    // 主构建流程
    async build() {
        console.log('🚀 开始构建 Moment-TabManager 扩展包...\n');

        try {
            // 1. 预构建检查
            await this.preCheck();
            
            // 2. 清理构建目录
            await this.cleanBuildDir();
            
            // 3. 复制文件
            await this.copyFiles();
            
            // 4. 验证构建结果
            await this.validateBuild();
            
            // 5. 创建ZIP包
            await this.createZipPackage();
            
            // 6. 构建完成
            this.buildComplete();
            
        } catch (error) {
            console.error('❌ 构建失败:', error.message);
            process.exit(1);
        }
    }

    // 预构建检查
    async preCheck() {
        console.log('🔍 执行预构建检查...');
        
        // 检查必需文件
        for (const file of this.config.requiredFiles) {
            const filePath = path.join(this.config.sourceDir, file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`缺少必需文件: ${file}`);
            }
        }
        
        // 检查manifest.json格式
        const manifestPath = path.join(this.config.sourceDir, 'manifest.json');
        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            if (!manifest.version || !manifest.name) {
                throw new Error('manifest.json缺少必需字段');
            }
            console.log(`   ✅ 扩展名称: ${manifest.name}`);
            console.log(`   ✅ 扩展版本: ${manifest.version}`);
        } catch (error) {
            throw new Error(`manifest.json格式错误: ${error.message}`);
        }
        
        console.log('   ✅ 预构建检查通过\n');
    }

    // 清理构建目录
    async cleanBuildDir() {
        console.log('🧹 清理构建目录...');
        
        if (fs.existsSync(this.config.buildDir)) {
            fs.rmSync(this.config.buildDir, { recursive: true, force: true });
        }
        fs.mkdirSync(this.config.buildDir, { recursive: true });
        
        console.log('   ✅ 构建目录已清理\n');
    }

    // 复制文件
    async copyFiles() {
        console.log('📁 复制源文件...');
        
        const copyCount = this.copyDirectory(this.config.sourceDir, this.config.buildDir);
        
        console.log(`   ✅ 已复制 ${copyCount} 个文件\n`);
    }

    // 递归复制目录
    copyDirectory(src, dest) {
        let fileCount = 0;
        
        const items = fs.readdirSync(src);
        
        for (const item of items) {
            const srcPath = path.join(src, item);
            const destPath = path.join(dest, item);
            
            // 检查是否应该排除
            if (this.shouldExclude(item, srcPath)) {
                continue;
            }
            
            const stat = fs.statSync(srcPath);
            
            if (stat.isDirectory()) {
                fs.mkdirSync(destPath, { recursive: true });
                fileCount += this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
                fileCount++;
            }
        }
        
        return fileCount;
    }

    // 检查文件是否应该排除
    shouldExclude(fileName, filePath) {
        // 获取相对路径用于匹配
        const relativePath = path.relative(this.config.sourceDir, filePath);

        for (const pattern of this.config.excludePatterns) {
            if (pattern.endsWith('/')) {
                // 目录模式
                const dirName = pattern.slice(0, -1);
                if (fileName === dirName || relativePath.startsWith(dirName + path.sep)) {
                    return true;
                }
            } else if (pattern.includes('*')) {
                // 通配符模式
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                if (regex.test(fileName) || regex.test(relativePath)) {
                    return true;
                }
            } else {
                // 精确匹配
                if (fileName === pattern || relativePath === pattern) {
                    return true;
                }
            }
        }
        return false;
    }

    // 验证构建结果
    async validateBuild() {
        console.log('🔍 验证构建结果...');
        
        // 检查必需文件是否存在
        for (const file of this.config.requiredFiles) {
            const filePath = path.join(this.config.buildDir, file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`构建后缺少文件: ${file}`);
            }
        }
        
        // 计算构建包大小
        const buildSize = this.calculateDirectorySize(this.config.buildDir);
        console.log(`   ✅ 构建包大小: ${this.formatBytes(buildSize)}`);
        
        // 检查是否有不应该存在的文件
        const unwantedFiles = this.findUnwantedFiles(this.config.buildDir);
        if (unwantedFiles.length > 0) {
            console.warn('   ⚠️  发现可能不需要的文件:', unwantedFiles);
        }
        
        console.log('   ✅ 构建结果验证通过\n');
    }

    // 计算目录大小
    calculateDirectorySize(dir) {
        let size = 0;
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                size += this.calculateDirectorySize(itemPath);
            } else {
                size += stat.size;
            }
        }
        
        return size;
    }

    // 查找不需要的文件
    findUnwantedFiles(dir) {
        const unwanted = [];
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                unwanted.push(...this.findUnwantedFiles(itemPath));
            } else {
                // 检查文件扩展名
                const ext = path.extname(item).toLowerCase();
                if (['.md', '.txt', '.log', '.tmp', '.bak'].includes(ext)) {
                    unwanted.push(path.relative(this.config.buildDir, itemPath));
                }
            }
        }
        
        return unwanted;
    }

    // 创建ZIP包
    async createZipPackage() {
        console.log('📦 创建发布包...');
        
        try {
            // 读取版本号
            const manifestPath = path.join(this.config.buildDir, 'manifest.json');
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const version = manifest.version;
            
            // 生成ZIP文件名
            const zipFileName = `momenttabmanager-v${version}.zip`;
            const zipFilePath = path.join(this.config.sourceDir, zipFileName);
            
            // 删除旧的ZIP文件
            if (fs.existsSync(zipFilePath)) {
                fs.unlinkSync(zipFilePath);
            }
            
            // 创建ZIP包
            const command = process.platform === 'win32' 
                ? `powershell Compress-Archive -Path "${this.config.buildDir}\\*" -DestinationPath "${zipFilePath}"`
                : `cd "${this.config.buildDir}" && zip -r "${zipFilePath}" .`;
            
            execSync(command, { stdio: 'pipe' });
            
            // 验证ZIP文件
            const zipSize = fs.statSync(zipFilePath).size;
            console.log(`   ✅ 发布包已创建: ${zipFileName}`);
            console.log(`   ✅ 包大小: ${this.formatBytes(zipSize)}\n`);
            
            return zipFilePath;
            
        } catch (error) {
            throw new Error(`创建ZIP包失败: ${error.message}`);
        }
    }

    // 构建完成
    buildComplete() {
        const duration = Date.now() - this.startTime;
        console.log('🎉 构建完成!');
        console.log(`⏱️  总耗时: ${duration}ms`);
        console.log('\n📋 下一步操作:');
        console.log('   1. 测试扩展包功能');
        console.log('   2. 上传到Chrome Web Store');
        console.log('   3. 发布新版本\n');
    }

    // 格式化字节大小
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 主函数
async function main() {
    const builder = new ExtensionBuilder(BUILD_CONFIG);
    await builder.build();
}

// 运行构建
if (require.main === module) {
    main().catch(error => {
        console.error('❌ 构建过程中发生错误:', error);
        process.exit(1);
    });
}

module.exports = ExtensionBuilder;
