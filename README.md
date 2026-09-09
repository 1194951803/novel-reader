# 阅间 · Vue 待办与本地阅读器

当前版本是 `Vue 3 + Vite` 应用，包含：

- 待办新增、编辑、删除、完成和筛选
- 待办详情与 Markdown 编辑/预览
- TXT 小说导入、章节目录、渐进加载和阅读进度
- 浏览器本地存储，不需要业务后端

## 启动

```powershell
cd D:\WorkSpaces\Codex\novel-reader
npm install
npm run dev
```

然后打开终端显示的本地地址，通常是 `http://localhost:5173`。

Vue 使用 ES 模块，不能直接双击 `index.html` 运行，需要 Vite 提供静态模块服务。这和 Python 静态服务器一样只是运行载体，不是后端业务服务。

把 TXT 放入 `books/` 并在 `books/index.json` 中登记后，开发服务器启动时会自动加载；也可以使用顶部按钮导入文件或整个目录。

待办和阅读进度保存在浏览器本地存储中。外部 TXT 文件本身不会被浏览器永久保存，重新打开后需要再次导入同名文件，进度会自动恢复。
