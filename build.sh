#!/bin/bash

# Moment-TabManager 构建脚本 (Linux/macOS)
# 用于生成Chrome Web Store发布包

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_success() {
    print_message $GREEN "$1"
}

print_error() {
    print_message $RED "$1"
}

print_warning() {
    print_message $YELLOW "$1"
}

print_info() {
    print_message $BLUE "$1"
}

# 设置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR"
BUILD_DIR="$SOURCE_DIR/dist"
TEMP_DIR="$SOURCE_DIR/temp_build"

# 必需文件列表
REQUIRED_FILES=(
    "manifest.json"
    "background.js"
    "sidepanel.html"
    "content-scripts/global-shortcuts.js"
    "content-scripts/text-drag-config.js"
    "content-scripts/link-preview.js"
    "css/link-preview.css"
    "css/sidepanel.css"
    "js/sidepanel.js"
    "js/tab-manager.js"
    "js/utils.js"
    "icons/icon16.png"
    "icons/icon32.png"
    "icons/icon48.png"
    "icons/icon128.png"
)

# 需要排除的文件模式
EXCLUDE_PATTERNS=(
    "build.js"
    "build.bat"
    "build.sh"
    "*.md"
    "test-*.html"
    "*.log"
    "*.tmp"
    "*.bak"
    "dist/"
    "temp_build/"
    "node_modules/"
    ".git/"
    ".gitignore"
    ".DS_Store"
    "Thumbs.db"
)

echo
print_info "🚀 开始构建 Moment-TabManager 扩展包..."
echo

# 1. 预构建检查
print_info "🔍 执行预构建检查..."

# 检查必需文件
for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$SOURCE_DIR/$file" ]]; then
        print_error "❌ 缺少必需文件: $file"
        exit 1
    fi
done

# 检查manifest.json并获取版本号
if [[ ! -f "$SOURCE_DIR/manifest.json" ]]; then
    print_error "❌ 找不到 manifest.json"
    exit 1
fi

# 检查jq是否可用
if command -v jq >/dev/null 2>&1; then
    VERSION=$(jq -r '.version' "$SOURCE_DIR/manifest.json")
    EXTENSION_NAME=$(jq -r '.name' "$SOURCE_DIR/manifest.json")
else
    # 如果没有jq，使用grep和sed提取版本号
    VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$SOURCE_DIR/manifest.json" | sed 's/.*"\([^"]*\)".*/\1/')
    EXTENSION_NAME=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$SOURCE_DIR/manifest.json" | sed 's/.*"\([^"]*\)".*/\1/')
fi

if [[ -z "$VERSION" ]]; then
    print_error "❌ 无法从manifest.json读取版本号"
    exit 1
fi

print_success "   ✅ 扩展名称: $EXTENSION_NAME"
print_success "   ✅ 扩展版本: $VERSION"
print_success "   ✅ 预构建检查通过"
echo

# 2. 清理构建目录
print_info "🧹 清理构建目录..."
if [[ -d "$BUILD_DIR" ]]; then
    rm -rf "$BUILD_DIR"
fi
mkdir -p "$BUILD_DIR"

if [[ -d "$TEMP_DIR" ]]; then
    rm -rf "$TEMP_DIR"
fi

print_success "   ✅ 构建目录已清理"
echo

# 3. 复制文件
print_info "📁 复制源文件..."

# 创建临时目录
mkdir -p "$TEMP_DIR"

# 复制所有文件到临时目录
cp -r "$SOURCE_DIR"/* "$TEMP_DIR/" 2>/dev/null || true

# 删除不需要的文件
cd "$TEMP_DIR"

# 删除匹配排除模式的文件
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    if [[ "$pattern" == *"/" ]]; then
        # 目录模式
        dir_name="${pattern%/}"
        if [[ -d "$dir_name" ]]; then
            rm -rf "$dir_name"
        fi
    elif [[ "$pattern" == *.* ]]; then
        # 文件扩展名模式
        find . -name "$pattern" -type f -delete 2>/dev/null || true
    else
        # 精确文件名
        if [[ -f "$pattern" ]]; then
            rm -f "$pattern"
        fi
    fi
done

# 移动清理后的文件到构建目录
mv "$TEMP_DIR"/* "$BUILD_DIR/" 2>/dev/null || true
rm -rf "$TEMP_DIR"

# 计算复制的文件数量
FILE_COUNT=$(find "$BUILD_DIR" -type f | wc -l)
print_success "   ✅ 已复制 $FILE_COUNT 个文件"
echo

# 4. 验证构建结果
print_info "🔍 验证构建结果..."

# 检查必需文件是否存在
for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$BUILD_DIR/$file" ]]; then
        print_error "❌ 构建后缺少文件: $file"
        exit 1
    fi
done

# 计算构建包大小
if command -v du >/dev/null 2>&1; then
    BUILD_SIZE=$(du -sh "$BUILD_DIR" | cut -f1)
    print_success "   ✅ 构建包大小: $BUILD_SIZE"
fi

# 检查是否有不应该存在的文件
UNWANTED_FILES=$(find "$BUILD_DIR" -name "*.md" -o -name "*.log" -o -name "*.tmp" -o -name "*.bak" 2>/dev/null || true)
if [[ -n "$UNWANTED_FILES" ]]; then
    print_warning "   ⚠️  发现可能不需要的文件:"
    echo "$UNWANTED_FILES"
fi

print_success "   ✅ 构建结果验证通过"
echo

# 5. 创建ZIP包
print_info "📦 创建发布包..."

ZIP_NAME="momenttabmanager-v${VERSION}.zip"
ZIP_PATH="$SOURCE_DIR/$ZIP_NAME"

# 删除旧的ZIP文件
if [[ -f "$ZIP_PATH" ]]; then
    rm -f "$ZIP_PATH"
fi

# 创建ZIP包
cd "$BUILD_DIR"
if command -v zip >/dev/null 2>&1; then
    zip -r "$ZIP_PATH" . >/dev/null 2>&1
elif command -v 7z >/dev/null 2>&1; then
    7z a "$ZIP_PATH" . >/dev/null 2>&1
else
    print_error "❌ 需要 zip 或 7z 命令来创建压缩包"
    print_error "   请安装: sudo apt-get install zip (Ubuntu/Debian)"
    print_error "   或者: brew install zip (macOS)"
    exit 1
fi

cd "$SOURCE_DIR"

if [[ ! -f "$ZIP_PATH" ]]; then
    print_error "❌ 创建ZIP包失败"
    exit 1
fi

# 获取ZIP文件大小
if command -v du >/dev/null 2>&1; then
    ZIP_SIZE=$(du -sh "$ZIP_PATH" | cut -f1)
    print_success "   ✅ 发布包已创建: $ZIP_NAME"
    print_success "   ✅ 包大小: $ZIP_SIZE"
else
    print_success "   ✅ 发布包已创建: $ZIP_NAME"
fi
echo

# 6. 构建完成
print_success "🎉 构建完成!"
echo
print_info "📋 下一步操作:"
echo "   1. 测试扩展包功能"
echo "   2. 上传到Chrome Web Store"
echo "   3. 发布新版本"
echo
print_info "📦 发布包位置: $ZIP_NAME"
print_info "📁 构建目录: dist/"
echo

# 询问是否打开文件夹
read -p "是否打开包含发布包的文件夹? (y/N): " open_folder
if [[ "$open_folder" =~ ^[Yy]$ ]]; then
    if command -v open >/dev/null 2>&1; then
        # macOS
        open "$SOURCE_DIR"
    elif command -v xdg-open >/dev/null 2>&1; then
        # Linux
        xdg-open "$SOURCE_DIR"
    else
        print_info "📁 发布包位置: $SOURCE_DIR"
    fi
fi

# 询问是否清理构建目录
read -p "是否清理构建目录? (y/N): " clean_build
if [[ "$clean_build" =~ ^[Yy]$ ]]; then
    if [[ -d "$BUILD_DIR" ]]; then
        rm -rf "$BUILD_DIR"
        print_success "   ✅ 构建目录已清理"
    fi
fi

echo
print_success "✨ 构建脚本执行完成!"
