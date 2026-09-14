# ClipBridge

ClipBridge 是一个面向 Edge InPrivate / Chrome 无痕窗口的 Tampermonkey（油猴）用户脚本。它拦截文本复制，并通过 Tampermonkey 的扩展权限重新写入 Windows 剪贴板，让 `Win+V` 剪贴板历史和常见的剪贴板监听工具能够捕获这次复制。

## 为什么无痕窗口的复制不会进入历史

这通常不是网页禁止复制。Chromium 会把无痕页面发起的剪贴板写入标记为：

- 不允许保存到本地剪贴板历史；
- 不允许上传到云剪贴板。

所以经常出现“立即按 `Ctrl+V` 可以粘贴，但 `Win+V` 里没有，剪贴板监听工具也没有收到”的现象。

ClipBridge 在 `document-start` 阶段捕获 `Ctrl+C`、`Ctrl+Insert` 和右键菜单产生的 `copy` 事件，读取当前纯文本选区，取消 Chromium 的原生复制，再调用 Tampermonkey 的 `GM_setClipboard`。脚本不会写入 `event.clipboardData`，避免浏览器再次附加无痕隐私标记。

相关依据：

- [Chromium 的无痕复制会调用 `MarkAsOffTheRecord`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/renderer_host/clipboard_host_impl.cc)
- [Windows 下 Chromium 会写入 `CanIncludeInClipboardHistory=0`](https://chromium.googlesource.com/chromium/src/+/master/ui/base/clipboard/clipboard_win.cc)
- [Tampermonkey `GM_setClipboard` 文档](https://www.tampermonkey.net/documentation.php?locale=en&q=GM_setClipboard)

## 安装

1. 在普通浏览窗口中安装 Tampermonkey 5.3 或更高版本。
2. 打开 `edge://extensions`（Chrome 使用 `chrome://extensions`），进入 Tampermonkey 的“详细信息”。
3. 开启“允许 InPrivate”或“在无痕模式下启用”。这是必须的，否则无痕页面不会注入任何油猴脚本。
4. 开启“允许用户脚本”。如果浏览器没有这个开关，则在扩展管理页开启“开发人员模式”。Tampermonkey 5.3+ 在 Chromium 浏览器中需要其中一项。
5. 将 Tampermonkey 的站点访问权限设为“在所有网站上”，或者只授权你需要使用的网站。
6. 在 Tampermonkey 管理面板选择“添加新脚本”，删除示例内容，粘贴 [`ClipBridge.user.js`](./ClipBridge.user.js) 的全部内容并保存。
7. 关闭并重新打开无痕窗口，或至少刷新已经打开的目标页面。

脚本头中的 `@run-in incognito-tabs` 使它只在无痕/InPrivate 标签页运行。若也希望普通窗口使用，可删除这一行。

## 验证

1. 在无痕/InPrivate 窗口打开一个普通网页，选择一段容易辨认的文本并按 `Ctrl+C`。
2. 在记事本按 `Ctrl+V`，确认当前剪贴板内容正确。
3. 按 `Win+V`，确认刚复制的文本出现在 Windows 剪贴板历史中。
4. 如果使用第三方剪贴板监听程序，再检查它是否收到新条目。

若第 2 步成功而第 3 步失败，说明系统或浏览器仍给该次写入保留了隐私标记；请确认 Tampermonkey 确实在该无痕页面运行，而不是网页完成了原生复制。可将脚本中的 `DEBUG` 改为 `true`，然后在开发者工具 Console 中查找 `[ClipBridge] Copied ...`。

## 支持范围

- 普通页面文本选区；
- `input`、`textarea` 中的选区；
- `contenteditable` 富文本编辑区中的纯文本；
- Tampermonkey 能够注入的 iframe；
- `Ctrl+C`、`Ctrl+Insert` 和右键菜单“复制”。

## 边界与隐私提醒

- 只桥接纯文本，不保留 HTML 样式、图片、文件等富剪贴板格式。
- `edge://`、`chrome://`、扩展商店、浏览器内置 PDF 阅读器等受保护页面通常不允许用户脚本注入。
- Canvas 内没有真实 DOM 选区的文字无法由通用脚本可靠提取。
- 密码输入框不会被读取或复制。
- 跨域或带严格 sandbox 的 iframe 可能无法注入。
- 该脚本的目的就是绕过无痕模式“不进入本地/云剪贴板历史”的保护。复制的敏感内容可能长期留在 `Win+V`，并可能被 Windows 云剪贴板同步；请只在你明确接受这一点的环境中启用。
- 脚本不读取已有剪贴板、不联网，也不保存复制内容；真正保存历史的是 Windows 或你安装的剪贴板工具。

## 排查

如果完全没有效果，依次确认：

1. Tampermonkey 扩展已获准在无痕/InPrivate 中运行。
2. 已开启“允许用户脚本”或浏览器“开发人员模式”。
3. Tampermonkey 图标显示当前页面有 ClipBridge 正在运行。
4. 当前网址没有被 Tampermonkey 的用户排除规则或站点访问权限拦截。
5. 修改/安装脚本之后已经刷新目标页面。
6. 测试页面不是浏览器保护页面或内置 PDF 阅读器。

官方说明：[Edge 允许扩展在 InPrivate 中运行](https://learn.microsoft.com/en-us/troubleshoot/microsoft-edge/manageability/enable-extension-inprivate-policy)、[Chrome 允许扩展在无痕模式中运行](https://support.google.com/chrome/answer/2664769)、[Tampermonkey 用户脚本执行权限](https://www.tampermonkey.net/faq.php?locale=zh_CN%2F&q=Q209)。
