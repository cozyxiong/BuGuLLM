// Anything with "null" requires a translation. Contribute to translation via a PR!
const TRANSLATIONS = {
  onboarding: {
    home: {
      getStarted: "开始",
      welcome: "欢迎",
    },
    llm: {
      title: "LLM 偏好",
      description:
        "AnythingLLM 可以与多家 LLM 提供商合作。这将是处理聊天的服务。",
    },
    userSetup: {
      title: "用户设置",
      description: "配置你的用户设置。",
      howManyUsers: "将有多少用户使用此实例？",
      justMe: "只有我",
      myTeam: "我的团队",
      instancePassword: "实例密码",
      setPassword: "你想要设置密码吗？",
      passwordReq: "密码必须至少包含 8 个字符。",
      passwordWarn: "保存此密码很重要，因为没有恢复方法。",
      adminUsername: "管理员账户用户名",
      adminPassword: "管理员账户密码",
      adminPasswordReq: "密码必须至少包含 8 个字符。",
      teamHint:
        "默认情况下，你将是唯一的管理员。完成初始设置后，你可以创建和邀请其他人成为用户或管理员。不要丢失你的密码，因为只有管理员可以重置密码。",
    },
    data: {
      title: "数据处理与隐私",
      description: "我们致力于在涉及你的个人数据时提供透明度和控制权。",
      settingsHint: "这些设置可以随时在设置中重新配置。",
    },
    survey: {
      title: "欢迎使用 AnythingLLM",
      description: "帮助我们为你的需求打造 AnythingLLM。可选。",
      email: "你的电子邮件是什么？",
      useCase: "你将如何使用 AnythingLLM？",
      useCaseWork: "用于工作",
      useCasePersonal: "用于个人使用",
      useCaseOther: "其他",
      comment: "你是如何听说 AnythingLLM 的？",
      commentPlaceholder:
        "Reddit，Twitter，GitHub，YouTube 等 - 让我们知道你是如何找到我们的！",
      skip: "跳过调查",
      thankYou: "感谢你的反馈！",
    },
  },
  common: {
    "workspaces-name": "工作区名称",
    selection: "模型选择",
    save: "保存更改",
    saving: "保存中...",
    previous: "上一页",
    next: "下一页",
    optional: "可选",
    yes: "是",
    no: "否",
    search: "搜索",
    username_requirements:
      "用户名必须为 2-64 个字符，以小写字母开头，只能包含小写字母、数字、下划线、连字符和句点。",
    on: "关于",
    none: "没有",
    stopped: "停止",
    loading: "正在加载…",
    refresh: "重新开始；更新",
  },
  settings: {
    title: "设置",
    invites: "邀请",
    users: "用户",
    workspaces: "工作区",
    "workspace-chats": "对话历史记录",
    customization: "外观",
    interface: "界面",
    branding: "品牌",
    chat: "对话",
    "api-keys": "开发者 API",
    llm: "语言模型",
    transcription: "语音转写",
    embedder: "嵌入模型",
    "text-splitting": "分块策略",
    "voice-speech": "语音",
    "vector-database": "向量数据库",
    embeds: "嵌入式对话",
    security: "系统安全",
    "event-logs": "事件日志",
    privacy: "隐私与数据",
    "ai-providers": "AI 服务",
    "agent-skills": "代理技能",
    admin: "管理",
    tools: "工具",
    "experimental-features": "实验功能",
    contact: "联系支持",
    "browser-extension": "浏览器扩展",
    "default-system-prompt": "默认系统提示",
    "system-prompt-variables": "系统提示变量",
    "mobile-app": "AnythingLLM 移动版",
    "community-hub": {
      title: "社区中心",
      trending: "探索热门",
      "your-account": "您的账户",
      "import-item": "进口商品",
    },
    channels: "频道",
    "available-channels": {
      telegram: "电报",
    },
    "scheduled-jobs": "计划任务",
    "model-router": "模型路由",
  },
  login: {
    "multi-user": {
      welcome: "欢迎！",
      "placeholder-username": "请输入用户名",
      "placeholder-password": "请输入密码",
      login: "登录",
      validating: "正在验证...",
      "forgot-pass": "忘记密码",
      reset: "重置",
    },
    "sign-in": "登录你的 {{appName}} 账户",
    "password-reset": {
      title: "重置密码",
      description: "请提供以下必要信息以重置你的密码。",
      "recovery-codes": "恢复代码",
      "back-to-login": "返回登录",
    },
  },
  "main-page": {
    quickActions: {
      createAgent: "创建代理",
      editWorkspace: "编辑工作区",
      uploadDocument: "上传文件",
    },
    greeting: "今天我能帮您什么？",
  },
  "new-workspace": {
    title: "新工作区",
    placeholder: "我的工作区",
  },
  "workspaces—settings": {
    general: "通用设置",
    chat: "聊天设置",
    vector: "向量数据库",
    members: "成员",
    agent: "代理设置",
  },
  general: {
    vector: {
      title: "向量数量",
      description: "当前工作区在向量数据库中已索引的片段总数。",
    },
    names: {
      description:
        "仅修改界面上的显示名称（最多 20 字），不会改动链接标识或本地数据路径。",
    },
    delete: {
      title: "删除工作区",
      description:
        "删除本工作区及其中的对话、索引等数据。本地原始文件不会被删除。",
      delete: "删除工作区",
      deleting: "正在删除…",
      "confirm-start": "即将删除工作区「",
      "confirm-end":
        "」。其中的对话记录和向量索引会被清除。\n\n知识库中的原始文件会保留。此操作不可恢复。",
    },
  },
  chat: {
    llm: {
      title: "本工作区使用的 LLM",
      description:
        "为本工作区单独指定模型服务商。未设置时，沿用系统默认的 LLM 配置。",
      search: "搜索模型服务商",
    },
    model: {
      title: "聊天模型",
      description: "本工作区实际调用的模型。留空则使用系统默认模型。",
    },
    mode: {
      title: "对话模式",
      query: {
        title: "问答",
        description:
          "严格依据知识库作答：先检索相关文档，无相关内容时拒绝回答。适合查笔记、考试与严谨引用。",
      },
      assistant: {
        title: "助手",
        description:
          "在工作区知识库中协作的内置 Agent：可读/写/搜索文件、执行 shell，并可选启用其它技能。不依赖 Claude Code 等外部 CLI。",
      },
      // 旧键保留以免其它语言包缺键时报错
      chat: {
        title: "问答",
        description: "已并入问答模式。",
      },
      automatic: {
        title: "助手",
        description: "已更名为助手模式。",
      },
    },
    history: {
      title: "上下文历史条数",
      "desc-start": "每次回复时，会带上最近若干轮对话作为短期记忆。",
      recommend: "建议设为 20。",
    },
    prompt: {
      title: "系统提示词",
      description:
        "约束本工作区 AI 的角色、语气与回答方式。写清楚期望，回答会更贴合你的需求。",
      history: {
        title: "提示词历史",
        clearAll: "全部清除",
        noHistory: "暂无历史记录",
        restore: "恢复",
        delete: "删除",
        deleteConfirm: "确定删除这条历史记录？",
        clearAllConfirm: "确定清空全部历史？此操作不可恢复。",
        expand: "展开",
        publish: "发布到社区",
      },
    },
    refusal: {
      title: "查询模式无结果提示",
      "desc-start": "在",
      query: "查询",
      "desc-end": "模式下，如果知识库里没有相关内容，将返回下面的固定回复。",
      "tooltip-title": "为什么会看到这条提示？",
      "tooltip-description":
        "当前是「查询」模式，只会依据知识库文档作答。若要更灵活的闲聊与综合回答，请切换到「聊天」模式。",
    },
    temperature: {
      title: "温度",
      "desc-end":
        "数值越高，回答越发散、更有创意；过低则更保守。部分模型设得过高可能不稳定。",
    },
  },
  "vector-workspace": {
    identifier: "向量数据库标识",
    snippets: {
      title: "最大上下文片段数",
      description: "每次对话最多从知识库取回多少段内容送给模型。",
      recommend: "建议：4",
    },
    doc: {
      title: "文档相似度阈值",
      description:
        "只有相似度达到该阈值的片段才会被采用。数值越高，匹配越严格，召回越少。",
      zero: "不限制",
      low: "低（≥ 0.25）",
      medium: "中（≥ 0.50）",
      high: "高（≥ 0.75）",
    },
    reset: {
      reset: "重置向量数据库",
      resetting: "正在清除…",
      confirm:
        "将清空本工作区的全部向量索引。\n\n知识库中的原始文件会保留，但需要重新嵌入后才能检索。此操作不可恢复。",
      success: "向量数据库已重置。",
      error: "重置向量数据库失败。",
    },
  },
  agent: {
    "performance-warning":
      "部分模型对工具调用支持有限。若回答异常或工具不可用，可换用明确支持工具调用的模型。",
    provider: {
      title: "代理使用的 LLM",
      description: "运行 @agent 时代理所使用的模型服务商与模型。",
    },
    mode: {
      chat: {
        title: "代理聊天模型",
        description: "@agent 会话中实际调用的聊天模型。",
      },
      title: "代理模型",
      description: "@agent 会话中实际调用的模型。",
      wait: "-- 加载模型中 --",
    },
    skill: {
      rag: {
        title: "语义检索",
        description:
          "开启后，助手在文件树/关键词仍找不到内容，或问题是同义转述时，可用向量检索作兜底；找到后仍应读取 vault 原文再改写。也可写入长期记忆（需用户明确要求）。",
      },
      view: {
        title: "查看与总结文档",
        description: "已移除：请使用文件系统读取后由模型总结。",
      },
      scrape: {
        title: "抓取网页",
        description: "允许代理打开网页并读取页面内容。",
      },
      generate: {
        title: "生成图表",
        description: "允许代理根据对话或数据生成各类图表。",
      },
      web: {
        title: "联网搜索",
        description: "接入搜索引擎后，代理可检索公开网页来辅助回答。",
      },
      sql: {
        title: "SQL 连接器",
        description: "连接数据库后，代理可用 SQL 查询数据并回答相关问题。",
      },
      default_skill:
        "默认已开启。若不希望代理使用该能力，可随时关闭。",
      filesystem: {
        title: "文件系统访问",
        description:
          "允许代理在指定目录中读写、搜索和管理文件，支持编辑与目录浏览。",
        learnMore: "查看该技能的使用说明",
        configuration: "配置",
        readActions: "读取操作",
        writeActions: "写入操作",
        warning:
          "开启文件系统权限有风险，代理可能修改或删除文件。启用前请先阅读<a>相关说明</a>。",
        skills: {
          "read-text-file": {
            title: "读取文件",
            description: "读取文件内容（包括文本、代码、PDF、图像等）",
          },
          "read-multiple-files": {
            title: "读取多个文件",
            description: "同时读取多个文件",
          },
          "list-directory": {
            title: "目录",
            description: "列出文件夹中的文件和目录",
          },
          "search-files": {
            title: "搜索文件",
            description: "按文件名或内容搜索文件",
          },
          "get-file-info": {
            title: "获取文件信息",
            description: "获取有关文件的详细元数据",
          },
          "edit-file": {
            title: "编辑文件",
            description: "对文本文件进行基于行的编辑。",
          },
          "create-directory": {
            title: "创建目录",
            description: "创建新的目录",
          },
          "move-file": {
            title: "移动/重命名文件",
            description: "移动或重命名文件和目录",
          },
          "copy-file": {
            title: "复制文件",
            description: "复制文件和目录",
          },
          "write-text-file": {
            title: "创建文本文件",
            description: "创建新的文本文件，或覆盖现有的文本文件。",
          },
        },
      },
      createFiles: {
        title: "文档创建",
        description:
          "允许您的代理创建二进制文档格式，例如PowerPoint演示文稿、Excel电子表格、Word文档和PDF文件。文件可以直接从聊天窗口下载。",
        configuration: "可用的文件类型",
        skills: {
          "create-text-file": {
            title: "文本文件",
            description:
              "创建包含任何内容和扩展名的文本文件（如 .txt、.md、.json、.csv 等）。",
          },
          "create-pptx": {
            title: "PowerPoint 演示文稿",
            description: "创建新的幻灯片演示文稿，包括幻灯片、标题和项目符号。",
          },
          "create-pdf": {
            title: "PDF 文档",
            description:
              "使用 Markdown 或纯文本，并进行基本的排版，创建 PDF 文档。",
          },
          "create-xlsx": {
            title: "Excel电子表格",
            description: "创建包含表格数据、工作表和样式的 Excel 文档。",
          },
          "create-docx": {
            title: "Word 文档",
            description: "创建包含基本样式和格式的 Word 文档",
          },
        },
      },
      gmail: {
        title: "Gmail 连接器",
        description:
          "让您的代理能够与Gmail互动：搜索邮件、阅读邮件线程、撰写草稿、发送邮件以及管理您的收件箱。请参考相关文档。",
        multiUserWarning:
          "为了安全原因，在多用户模式下无法使用 Gmail 集成功能。请先禁用多用户模式，然后才能使用此功能。",
        configuration: "Gmail 设置",
        deploymentId: "部署 ID",
        deploymentIdHelp: "您的 Google Apps Script 网页应用的部署 ID",
        apiKey: "API 密钥",
        apiKeyHelp: "您在 Google Apps Script 部署中配置的 API 密钥。",
        configurationRequired: "请配置部署 ID 和 API 密钥，以启用 Gmail 功能。",
        configured: "已配置",
        searchSkills: "搜索技巧...",
        noSkillsFound: "未找到与您的搜索条件匹配的技能。",
        categories: {
          search: {
            title: "搜索和阅读电子邮件",
            description: "搜索并阅读您 Gmail 收件箱中的邮件。",
          },
          drafts: {
            title: "草稿邮件",
            description: "创建、编辑和管理电子邮件草稿",
          },
          send: {
            title: "发送和回复电子邮件",
            description: "立即发送电子邮件并回复讨论串",
          },
          threads: {
            title: "管理电子邮件线程",
            description: "管理邮件线程 - 标记为已读/未读，归档，删除",
          },
          account: {
            title: "集成统计",
            description: "查看邮件收件箱统计数据和账户信息",
          },
        },
        skills: {
          search: {
            title: "搜索邮件",
            description: "使用 Gmail 的查询语法搜索电子邮件",
          },
          readThread: {
            title: "阅读此主题",
            description: "阅读由ID发起的完整邮件往来",
          },
          createDraft: {
            title: "创建草稿",
            description: "创建一个新的电子邮件草稿",
          },
          createDraftReply: {
            title: "创建草稿回复",
            description: "创建一个针对现有主题的回应草稿",
          },
          updateDraft: {
            title: "更新草稿",
            description: "更新已有的电子邮件草稿",
          },
          getDraft: {
            title: "获取草稿",
            description: "通过ID检索特定草稿",
          },
          listDrafts: {
            title: "草稿清单",
            description: "列出所有草稿邮件",
          },
          deleteDraft: {
            title: "删除草稿",
            description: "删除草稿邮件",
          },
          sendDraft: {
            title: "发送草稿",
            description: "发送已有的电子邮件草稿",
          },
          sendEmail: {
            title: "发送电子邮件",
            description: "立即发送一封电子邮件",
          },
          replyToThread: {
            title: "回复主题",
            description: "立即回复邮件线程",
          },
          markRead: {
            title: "马克·瑞德",
            description: "将某个主题标记为已阅读",
          },
          markUnread: {
            title: "标记为未读",
            description: "将某个主题标记为未读",
          },
          moveToTrash: {
            title: "移动到垃圾箱",
            description: "将某个主题归档到垃圾箱",
          },
          moveToArchive: {
            title: "存档",
            description: "存档该主题",
          },
          moveToInbox: {
            title: "移动到收件箱",
            description: "将某个主题移动到收件箱",
          },
          getMailboxStats: {
            title: "邮箱统计",
            description: "获取未读邮件数量和邮箱统计信息",
          },
          getInbox: {
            title: "查看收件箱",
            description: "一种便捷的方式，可以从 Gmail 中获取收件邮件。",
          },
        },
      },
      outlook: {
        title: "Outlook 连接器",
        description:
          "让您的代理通过 Microsoft Graph API 与 Microsoft Outlook 交互——搜索邮件、阅读邮件线程、撰写草稿、发送邮件以及管理您的收件箱。请查阅相关文档。",
        multiUserWarning:
          "由于安全原因，在多用户模式下无法使用 Outlook 集成功能。请先关闭多用户模式，然后再使用此功能。",
        configuration: "Outlook 设置",
        authType: "账户类型",
        authTypeHelp:
          '选择哪些类型的 Microsoft 账户可以进行身份验证。 "所有账户" 支持个人账户和工作/学校账户。 "仅限个人账户" 仅限于个人 Microsoft 账户。 "仅限工作/学校账户" 仅限于特定 Azure AD 租户的工作/学校账户。',
        authTypeCommon: "所有账户（包括个人账户和工作/学习账户）",
        authTypeConsumers: "仅限个人 Microsoft 账户",
        authTypeOrganization: "仅限组织账户 (需要租户 ID)",
        clientId: "申请人（客户）ID",
        clientIdHelp: "您 Azure AD 应用程序注册的应用程序 ID",
        tenantId: "租户 ID",
        tenantIdHelp:
          "您的 Azure AD 应用注册的“租户 ID”。仅在组织内部身份验证时需要。",
        clientSecret: "客户端密钥",
        clientSecretHelp: "您的 Azure AD 应用程序注册的客户端机密值",
        configurationRequired:
          "请配置客户端 ID 和客户端密钥，以便启用 Outlook 相关功能。",
        authRequired:
          "首先保存您的凭据，然后通过 Microsoft 进行身份验证以完成设置。",
        authenticateWithMicrosoft: "使用 Microsoft 身份验证",
        authenticated: "已成功与 Microsoft Outlook 认证。",
        revokeAccess: "撤销权限",
        configured: "已配置",
        searchSkills: "搜索技巧...",
        noSkillsFound: "未找到与您的搜索条件匹配的技能。",
        categories: {
          search: {
            title: "搜索和阅读电子邮件",
            description: "搜索并阅读您 Outlook 收件箱中的电子邮件。",
          },
          drafts: {
            title: "草稿邮件",
            description: "创建、编辑和管理电子邮件草稿",
          },
          send: {
            title: "发送电子邮件",
            description: "立即发送新邮件或回复消息",
          },
          account: {
            title: "集成统计",
            description: "查看邮件收件箱统计数据和账户信息",
          },
        },
        skills: {
          getInbox: {
            title: "查看收件箱",
            description: "从您的 Outlook 收件箱获取最近的邮件",
          },
          search: {
            title: "搜索邮件",
            description: "使用 Microsoft 搜索语法搜索电子邮件",
          },
          readThread: {
            title: "阅读对话",
            description: "阅读完整的电子邮件对话记录",
          },
          createDraft: {
            title: "创建草稿",
            description: "创建一个新的电子邮件草稿，或回复一个已存在的邮件。",
          },
          updateDraft: {
            title: "更新草稿",
            description: "更新已有的电子邮件草稿",
          },
          listDrafts: {
            title: "草稿清单",
            description: "列出所有草稿邮件",
          },
          deleteDraft: {
            title: "删除草稿",
            description: "删除草稿邮件",
          },
          sendDraft: {
            title: "发送草稿",
            description: "发送已有的邮件草稿",
          },
          sendEmail: {
            title: "发送电子邮件",
            description: "立即发送一封新的电子邮件，或回复已存在的消息。",
          },
          getMailboxStats: {
            title: "邮件收件统计",
            description: "获取文件夹数量和邮箱统计信息",
          },
        },
      },
      googleCalendar: {
        title: "Google 日历连接器",
        description:
          "让您的代理能够与 Google 日历互动：查看日历、获取活动、创建和更新活动，以及管理确认回复。请参考相关文档。",
        multiUserWarning:
          "由于安全原因，在多用户模式下无法使用 Google 日历集成功能。请先禁用多用户模式，然后再使用此功能。",
        configuration: "谷歌日历配置",
        deploymentId: "部署ID",
        deploymentIdHelp: "您的 Google Apps Script 网页应用的部署 ID",
        apiKey: "API 密钥",
        apiKeyHelp: "您在 Google Apps Script 部署中配置的 API 密钥。",
        configurationRequired:
          "请配置部署 ID 和 API 密钥，以启用 Google 日历功能。",
        configured: "已配置",
        searchSkills: "搜索技巧...",
        noSkillsFound: "未找到与您搜索条件匹配的技能。",
        categories: {
          calendars: {
            title: "日历",
            description: "查看和管理您的 Google 日历",
          },
          readEvents: {
            title: "查看活动",
            description: "查看和搜索日历活动",
          },
          writeEvents: {
            title: "创建和更新活动",
            description: "创建新的活动，并修改现有的活动。",
          },
          rsvp: {
            title: "请回复确认",
            description: "管理您对活动的响应状态",
          },
        },
        skills: {
          listCalendars: {
            title: "日历列表",
            description: "列出您拥有的或订阅的全部日历。",
          },
          getCalendar: {
            title: "获取日历详情",
            description: "获取有关特定日历的详细信息",
          },
          getEvent: {
            title: "获取活动",
            description: "获取有关特定活动的详细信息",
          },
          getEventsForDay: {
            title: "获取当日活动",
            description: "获取指定日期的所有活动",
          },
          getEvents: {
            title: "获取活动（日期范围）",
            description: "获取指定日期范围内的活动",
          },
          getUpcomingEvents: {
            title: "查看即将举办的活动",
            description: "使用简单的关键词，查找今天、本周或本月的活动",
          },
          quickAdd: {
            title: "快速添加活动",
            description: "从自然语言（例如“明天下午3点开会”）创建一个活动。",
          },
          createEvent: {
            title: "创建活动",
            description: "创建一个新的活动，并完全控制所有属性。",
          },
          updateEvent: {
            title: "活动更新",
            description: "更新现有的日历事件",
          },
          setMyStatus: {
            title: "设置回复状态",
            description: "接受、拒绝或表示初步接受某个活动",
          },
        },
      },
    },
    mcp: {
      title: "MCP 服务器",
      "loading-from-config": "从配置文件加载 MCP 服务器",
      "learn-more": "了解更多关于 MCP 服务器的信息。",
      "no-servers-found": "未找到任何 MCP 服务器",
      "tool-warning": "为了获得最佳性能，建议禁用不必要的工具，以节省上下文。",
      "stop-server": "停止 MCP 服务器",
      "start-server": "启动 MCP 服务器",
      "delete-server": "删除 MCP 服务器",
      "tool-count-warning":
        "这个 MCP 服务器启用了 <b> 工具，这些工具会在每次聊天中使用上下文信息。</b> 建议禁用不需要的工具，以节省上下文。<br />",
      "startup-command": "启动命令",
      command: "命令",
      arguments: "争论",
      "not-running-warning":
        "这个 MCP 服务器目前处于停止状态，可能是因为在启动时出现了错误或被手动停止。",
      "tool-call-arguments": "工具调用的参数",
      "tools-enabled": "工具已启用",
    },
    settings: {
      title: "代理技能设置",
      "max-tool-calls": {
        title: "每个回复的最大请求次数",
        description:
          "单个代理可以使用的最大工具数量，用于生成单个响应。 这样可以防止工具调用数量过多，从而避免无限循环。",
      },
      "intelligent-skill-selection": {
        title: "智能技能选择",
        description:
          "实现无限工具和按查询减少高达 80% 的 Token 使用量——AnythingLLM 能够自动选择最合适的技能，以应对每个提示。",
        "max-tools": {
          title: "麦克斯工具",
          description:
            "可以选取的工具的最大数量，用于每个查询。我们建议将此值设置为较高的值，以便在处理大型上下文模型时。",
        },
      },
      "clarifying-questions": {
        title: "允许代理人提出进一步的疑问",
        "beta-badge": "测试版",
        description:
          "启用后，代理可以暂停，并向您提出简短的澄清问题，以解决您的提示可能存在歧义的情况。",
        "max-per-turn": {
          title: "每回合可以提出的问题数量",
          description: "在一次调查中，销售代表可以提出多少澄清性问题？",
        },
      },
    },
  },
  recorded: {
    title: "对话记录",
    description: "各工作区的问答记录，按发送时间从新到旧排列。",
    export: "导出",
    clear: "清空记录",
    previous: "上一页",
    next: "下一页",
    table: {
      id: "编号",
      by: "发送者",
      workspace: "工作区",
      prompt: "提示词",
      response: "回复",
      at: "发送时间",
    },
  },
  customization: {
    interface: {
      title: "界面",
      description: "主题、语言等显示相关选项。",
    },
    branding: {
      title: "品牌",
      description: "自定义名称、标志和浏览器标签显示。",
    },
    chat: {
      title: "对话",
      description: "输入、朗读和显示相关的对话习惯。",
      auto_submit: {
        title: "语音输入后自动发送",
        description: "检测到停顿后，自动把语音识别结果发出去。",
      },
      auto_speak: {
        title: "自动朗读回复",
        description: "模型回复完成后自动读出来。",
      },
      spellcheck: {
        title: "拼写检查",
        description: "在输入框里开启或关闭浏览器拼写检查。",
      },
    },
    items: {
      theme: {
        title: "主题",
        description: "选择浅色或深色界面。",
      },
      "show-scrollbar": {
        title: "显示滚动条",
        description: "控制对话区域是否显示滚动条。",
      },
      "support-email": {
        title: "支持邮箱",
        description: "用户遇到问题时可以联系的邮箱。",
      },
      "app-name": {
        title: "应用名称",
        description: "登录页和界面上显示的名称。",
      },
      "display-language": {
        title: "界面语言",
        description: "选择界面显示所用的语言。",
      },
      logo: {
        title: "标志",
        description: "上传自定义标志，替换默认图标。",
        add: "上传标志",
        recommended: "建议尺寸：800 × 200",
        remove: "移除",
        replace: "更换",
      },
      "browser-appearance": {
        title: "浏览器标签",
        description: "自定义浏览器标签上的标题和图标。",
        tab: {
          title: "标签标题",
          description: "打开本应用时，浏览器标签上显示的文字。",
        },
        favicon: {
          title: "网站图标",
          description: "浏览器标签左侧的小图标。",
        },
      },
      "sidebar-footer": {
        title: "侧栏底部链接",
        description: "自定义侧栏底部显示的图标和跳转地址。",
        icon: "图标",
        link: "链接",
      },
      "render-html": {
        title: "在对话中渲染 HTML",
        description:
          "允许助手回复以 HTML 呈现。效果更好，但可能带来安全风险。",
      },
    },
  },
  api: {
    title: "API 密钥",
    description: "API 密钥允许持有者以编程方式访问和管理此 AnythingLLM 实例。",
    link: "阅读 API 文档",
    generate: "生成新的 API 密钥",
    empty: "未找到 API 密钥",
    actions: "操作",
    messages: {
      error: "错误：{{error}}",
    },
    modal: {
      title: "创建新的 API 密钥",
      cancel: "取消",
      close: "关闭",
      create: "创建 API 密钥",
      helper: "创建后，API 密钥可用于以编程方式访问并配置此 AnythingLLM 实例。",
      name: {
        label: "名称",
        placeholder: "生产环境集成",
        helper: "可选。使用一个易于识别的名称，以便之后识别此密钥。",
      },
    },
    row: {
      copy: "复制 API 密钥",
      copied: "已复制",
      unnamed: "--",
      deleteConfirm:
        "确定要停用此 API 密钥吗？\n停用后将无法再使用。\n\n此操作不可撤销。",
    },
    table: {
      name: "名称",
      key: "API 密钥",
      by: "创建者",
      created: "创建时间",
    },
  },
  llm: {
    title: "语言模型",
    description:
      "选择对话使用的模型服务，并填写对应的访问密钥。密钥过期或不正确会导致无法对话。",
    provider: "模型服务",
    providers: {
      azure_openai: {
        azure_service_endpoint: "Azure 服务端点",
        api_key: "API 密钥",
        chat_deployment_name: "聊天部署名称",
        chat_model_token_limit: "聊天模型令牌限制",
        model_type: "模型类型",
        default: "预设",
        reasoning: "推理",
        model_type_tooltip:
          "如果您的部署使用了推理模型（例如 o1、o1-mini、o3-mini 等），请将此选项设置为“推理”。否则，您的聊天请求可能会失败。",
      },
    },
  },
  transcription: {
    title: "语音转写",
    description: "把上传的音视频转成文字，再入库检索。",
    provider: "转写服务",
    "warn-start":
      "本机性能有限时，用本地 Whisper 处理较大文件可能卡顿甚至无响应。",
    "warn-recommend": "建议内存不少于 2GB，单次上传小于 10MB。",
    "warn-end": "内置模型会在第一次使用时自动下载，约 {{size}}。",
  },
  embedding: {
    title: "嵌入模型",
    "desc-start": "选择用于检索的嵌入模型，并填写对应密钥。",
    "desc-end": "更换后，已有文档需要重新嵌入。",
    provider: {
      title: "嵌入服务",
    },
  },
  text: {
    title: "分块策略",
    "desc-start":
      "文档写入向量数据库前，会按规则切成小段。这里可以改默认切法。",
    "desc-end": "不清楚切分原理时，建议保持默认，改错可能影响检索效果。",
    size: {
      title: "每段长度",
      description: "写入一条向量时，最多容纳多少个字符。",
      recommend: "当前嵌入模型支持的最大长度为",
    },
    overlap: {
      title: "段落重叠",
      description: "相邻两段之间重复保留的字符数，避免句子被拦腰截断。",
    },
  },
  vector: {
    title: "向量数据库",
    description:
      "选择向量数据存放在哪里。如果用的是云服务，请确认地址和密钥有效。",
    provider: {
      title: "向量数据库类型",
      description: "LanceDB 开箱即用，一般不用额外配置。",
    },
  },
  embeddable: {
    title: "嵌入式对话",
    description:
      "把某个工作区做成可嵌到网页里的公开聊天窗口。",
    create: "新建嵌入窗口",
    table: {
      workspace: "工作区",
      chats: "对话数",
      active: "允许的域名",
      created: "创建时间",
    },
  },
  "embed-chats": {
    title: "嵌入对话记录",
    export: "导出",
    description: "已发布的嵌入窗口里产生的问答记录。",
    table: {
      embed: "嵌入窗口",
      sender: "发送者",
      message: "消息",
      response: "回复",
      at: "发送时间",
    },
  },
  event: {
    title: "事件日志",
    description: "查看此实例上发生的所有操作和事件以进行监控。",
    clear: "清除事件日志",
    table: {
      type: "事件类型",
      user: "用户",
      occurred: "发生时间",
    },
  },
  privacy: {
    title: "隐私与数据",
    description:
      "第三方服务以及本系统会如何使用你的数据，可以在这里查看和调整。",
    anonymous: "允许匿名用量统计",
  },
  connectors: {
    "search-placeholder": "搜索数据连接器",
    "no-connectors": "未找到数据连接器。",
    github: {
      name: "GitHub 仓库",
      description: "一键导入整个公共或私有的 GitHub 仓库。",
      URL: "GitHub 仓库链接",
      URL_explained: "您希望收集的 GitHub 仓库链接。",
      token: "GitHub 访问令牌",
      optional: "可选",
      token_explained: "用于避免速率限制的访问令牌。",
      token_explained_start: "如果没有 ",
      token_explained_link1: "个人访问令牌",
      token_explained_middle:
        "，由于 GitHub API 的速率限制，可能无法收集所有文件。您可以 ",
      token_explained_link2: "创建临时访问令牌",
      token_explained_end: " 来避免此问题。",
      ignores: "文件忽略列表",
      git_ignore:
        ".gitignore 格式的列表，用于在收集过程中忽略特定文件。输入后按回车保存每一项。",
      task_explained: "完成后，所有文件将可用于在文档选择器中嵌入至工作区。",
      branch: "您希望收集文件的分支。",
      branch_loading: "-- 正在加载可用分支 --",
      branch_explained: "您希望收集文件的分支。",
      token_information:
        "如果未填写 <b>GitHub 访问令牌</b>，由于 GitHub 的公共 API 限制，此数据连接器将只能收集仓库的 <b>顶层</b> 文件。",
      token_personal: "在此处使用 GitHub 账户获取免费的个人访问令牌。",
    },
    gitlab: {
      name: "GitLab 仓库",
      description: "一键导入整个公共或私有的 GitLab 仓库。",
      URL: "GitLab 仓库链接",
      URL_explained: "您希望收集的 GitLab 仓库链接。",
      token: "GitLab 访问令牌",
      optional: "可选",
      token_description: "选择要从 GitLab API 获取的额外实体。",
      token_explained_start: "如果没有 ",
      token_explained_link1: "个人访问令牌",
      token_explained_middle:
        "，由于 GitLab API 的速率限制，可能无法收集所有文件。您可以 ",
      token_explained_link2: "创建临时访问令牌",
      token_explained_end: " 来避免此问题。",
      fetch_issues: "将问题作为文档获取",
      ignores: "文件忽略列表",
      git_ignore:
        ".gitignore 格式的列表，用于在收集过程中忽略特定文件。输入后按回车保存每一项。",
      task_explained: "完成后，所有文件将可用于在文档选择器中嵌入至工作区。",
      branch: "您希望收集文件的分支",
      branch_loading: "-- 正在加载可用分支 --",
      branch_explained: "您希望收集文件的分支。",
      token_information:
        "如果未填写 <b>GitLab 访问令牌</b>，由于 GitLab 的公共 API 限制，此数据连接器将只能收集仓库的 <b>顶层</b> 文件。",
      token_personal: "在此处使用 GitLab 账户获取免费的个人访问令牌。",
    },
    youtube: {
      name: "YouTube 字幕",
      description: "通过链接导入整个 YouTube 视频的转录内容。",
      URL: "YouTube 视频链接",
      URL_explained_start:
        "输入任何 YouTube 视频的链接以获取其转录内容。视频必须启用 ",
      URL_explained_link: "隐藏字幕",
      URL_explained_end: " 功能。",
      task_explained: "完成后，转录内容将可用于在文档选择器中嵌入至工作区。",
    },
    "website-depth": {
      name: "批量链接爬虫",
      description: "爬取一个网站及其指定深度的子链接。",
      URL: "网站链接",
      URL_explained: "您希望爬取的网站链接。",
      depth: "爬取深度",
      depth_explained: "这是爬虫从起始链接向下跟踪的子链接层级数量。",
      max_pages: "最大页面数",
      max_pages_explained: "要爬取的最大链接数。",
      task_explained:
        "完成后，所有抓取的内容将可用于在文档选择器中嵌入至工作区。",
    },
    confluence: {
      name: "Confluence",
      description: "一键导入整个 Confluence 页面。",
      deployment_type: "Confluence 部署类型",
      deployment_type_explained:
        "判断您的 Confluence 实例是部署在 Atlassian 云端还是自托管。",
      base_url: "Confluence 基础链接",
      base_url_explained: "这是您 Confluence 空间的基础链接。",
      space_key: "Confluence 空间标识",
      space_key_explained:
        "您将使用的 Confluence 实例空间标识，通常以 ~ 开头。",
      username: "Confluence 用户名",
      username_explained: "您的 Confluence 用户名",
      auth_type: "Confluence 认证方式",
      auth_type_explained: "选择您希望用于访问 Confluence 页面内容的认证方式。",
      auth_type_username: "用户名和访问令牌",
      auth_type_personal: "个人访问令牌",
      token: "Confluence 访问令牌",
      token_explained_start:
        "您需要提供访问令牌用于认证。您可以在此生成访问令牌",
      token_explained_link: "此处",
      token_desc: "用于认证的访问令牌",
      pat_token: "Confluence 个人访问令牌",
      pat_token_explained: "您的 Confluence 个人访问令牌。",
      task_explained: "完成后，页面内容将可用于在文档选择器中嵌入至工作区。",
      bypass_ssl: "绕过 SSL 证书验证",
      bypass_ssl_explained:
        "启用此选项以绕过对自托管 Confluence 实例的 SSL 证书验证，特别是使用自签名证书的情况。",
    },
    manage: {
      documents: "文档",
      "data-connectors": "数据连接器",
      "desktop-only":
        "这些设置只能在桌面设备上编辑。请使用桌面访问此页面以继续操作。",
      dismiss: "关闭",
      editing: "正在编辑",
    },
    directory: {
      "my-documents": "我的文档",
      "new-folder": "新建文件夹",
      "search-document": "搜索文档",
      "no-documents": "暂无文档",
      "move-workspace": "移动到工作区",
      "delete-confirmation":
        "您确定要删除这些文件和文件夹吗？\n这将从系统中移除这些文件，并自动将其从所有关联工作区中移除。\n此操作无法撤销。",
      "removing-message":
        "正在删除 {{count}} 个文档和 {{folderCount}} 个文件夹，请稍候。",
      "move-success": "成功移动了 {{count}} 个文档。",
      no_docs: "暂无文档",
      select_all: "全选",
      deselect_all: "取消全选",
      remove_selected: "移除所选",
      save_embed: "保存并嵌入",
      "total-documents_one": "{{count}} 文件",
      "total-documents_other": "{{count}} 类型的文件",
    },
    upload: {
      "processor-offline": "文档处理器不可用",
      "processor-offline-desc":
        "当前文档处理器离线，无法上传文件。请稍后再试。",
      "click-upload": "点击上传或拖放文件",
      "file-types": "支持文本文件、CSV、电子表格、音频文件等！",
      "or-submit-link": "或提交链接",
      "placeholder-link": "https://example.com",
      fetching: "正在获取...",
      "fetch-website": "获取网站",
      "privacy-notice":
        "这些文件将被上传到此 AnythingLLM 实例上的文档处理器。这些文件不会发送或共享给第三方。",
    },
    pinning: {
      what_pinning: "什么是文档固定？",
      pin_explained_block1:
        "当您在 AnythingLLM 中<b>固定</b>一个文档时，我们会将整个文档内容注入到您的提示窗口中，让 LLM 能够完全理解它。",
      pin_explained_block2:
        "这在 <b>大上下文模型</b> 或关键的小文件中效果最佳。",
      pin_explained_block3:
        "如果默认情况下无法从 AnythingLLM 获取满意的答案，固定文档是提高答案质量的好方法。",
      accept: "好的，知道了",
    },
    watching: {
      what_watching: "什么是监控文档？",
      watch_explained_block1:
        "当您在 AnythingLLM 中<b>监控</b>一个文档时，我们会<i>自动</i>按定期间隔从其原始来源同步文档内容。系统会自动更新在所有使用该文档的工作区中的内容。",
      watch_explained_block2:
        "此功能当前仅支持在线内容，不适用于手动上传的文档。",
      watch_explained_block3_start: "您可以在 ",
      watch_explained_block3_link: "文件管理器",
      watch_explained_block3_end: " 管理视图中管理被监控的文档。",
      accept: "好的，知道了",
    },
    obsidian: {
      vault_location: "仓库位置",
      vault_description:
        "选择你的 Obsidian 仓库文件夹，以导入所有文档及其关联。",
      selected_files: "找到 {{count}} 个 Markdown 文件",
      importing: "正在导入保险库…",
      import_vault: "导入保险库",
      processing_time: "根据你的仓库大小，这可能需要一些时间。",
      vault_warning: "为避免冲突，请确保你的 Obsidian 仓库当前未被打开。",
    },
  },
  chat_window: {
    send_message: "发送消息",
    attach_file: "向此对话附加文件",
    text_size: "更改文字大小。",
    microphone: "语音输入你的提示。",
    send: "将提示消息发送到工作区",
    attachments_processing: "附件正在处理，请稍候……",
    tts_speak_message: "TTS 播报消息",
    copy: "复制",
    regenerate: "重新",
    regenerate_response: "重新回应",
    good_response: "喜欢",
    more_actions: "更多操作",
    fork: "分叉",
    delete: "删除",
    cancel: "取消",
    edit_prompt: "修改",
    edit_response: "修改",
    preset_reset_description: "清除聊天纪录并开始新的聊天",
    add_new_preset: "新增预设",
    command: "指令",
    your_command: "你的指令",
    placeholder_prompt: "提示范例",
    description: "描述",
    placeholder_description: "描述范例",
    save: "保存",
    small: "小",
    normal: "一般",
    large: "大",
    workspace_llm_manager: {
      search: "搜索",
      loading_workspace_settings: "正在载入工作区设置",
      available_models: "可用模型",
      available_models_description: "可用模型说明",
      save: "保存",
      saving: "正在保存",
      missing_credentials: "缺少凭证",
      missing_credentials_description: "缺少凭证说明",
    },
    submit: "提交",
    edit_info_user: "保存后仅更新消息文字，不会重新生成回复。",
    edit_info_assistant: "您所做的修改将直接保存到此处。",
    see_less: "查看更多",
    see_more: "查看更多",
    tools: "工具",
    text_size_label: "字体大小",
    select_model: "选择型号",
    sources: "来源",
    document: "文件",
    similarity_match: "比赛",
    source_count_one: "{{count}} 参考",
    source_count_other: "{{count}} 相关资料",
    add_new: "添加新",
    edit: "编辑",
    publish: "出版",
    stop_generating: "停止生成回复",
    slash_commands: "快捷命令",
    agent_skills: "代理人技能",
    manage_agent_skills: "管理代理人技能",
    agent_skills_disabled_in_session:
      "在活动会话期间，无法修改技能。首先使用 /exit 命令结束会话。",
    start_agent_session: "开始代理会",
    use_agent_session_to_use_tools:
      "您可以通过在提示词的开头使用'@agent'来启动与代理的聊天，从而使用聊天工具。",
    agent_activity: {
      thinking: "思考中",
      thought_done: "已思考",
      thought_for: "思考了 {{time}}",
      loading: "正在生成",
      working: "处理中",
      used_tools: "执行了 {{count}} 个操作",
      expand: "展开",
      collapse: "收起",
    },
    agent_invocation: {
      model_wants_to_call: "模型请求调用",
      approve: "批准",
      reject: "拒绝",
      always_allow: "始终允许 {{skillName}}",
      tool_call_was_approved: "已批准工具调用",
      tool_call_was_rejected: "已拒绝工具调用",
      clarifying_skip: "由代理自行决定",
      clarifying_submit: "提交",
      clarifying_skipped: "已交由代理自行决定。",
      clarifying_timeout: "未在时限内提交回复。",
      clarifying_pagination: "{{current}} / {{total}}",
      clarifying_prev_aria: "上一题",
      clarifying_next_aria: "下一题",
      clarifying_close_aria: "关闭并跳过",
      clarifying_other: "其他",
      clarifying_other_placeholder: "请输入你的回答",
      batch_progress: "已回答 {{answered}} / {{total}}",
      batch_skip_this: "跳过",
      batch_submit_all: "全部提交",
      batch_next: "下一题",
      answer_skipped: "[用户已跳过]",
    },
    custom_skills: "定制技能",
    agent_flows: "代理人流动",
    no_tools_found: "未找到匹配的工具",
    loading_mcp_servers: "正在加载 MCP 服务器…",
    app_integrations: "应用程序集成",
    sub_skills: "基本技能",
    memories: {
      title: "回忆",
      empty:
        "目前还没有任何记忆。当您与聊天机器人进行更多互动时，记忆会逐渐填充。",
      empty_cta: "创建一个新的记忆",
      tab_workspace: "工作空间",
      tab_global: "全球",
      toggle: {
        label: "启用个性化设置",
        description:
          "让你的助手能够回忆起与你或这个工作场所相关的事实，并在对话中使用这些信息。",
      },
      auto_extraction: {
        label: "自动回忆",
        description: "让您的助手在后台自动创建回忆。",
      },
      menu: {
        edit: "编辑",
        delete: "删除",
        move_to_global: "拓展全球市场",
        move_to_workspace: "转移到工作空间",
      },
      modal: {
        create_title: "创造回忆",
        edit_title: "编辑内存",
        create_description:
          "记忆应该用简洁明了的语句表达。例如：“用户更喜欢使用 Python 而不是 JavaScript”。",
        edit_description: "更新此存储内容的资料。",
        label: "记忆",
        placeholder:
          "例如，用户的姓名是 Joe，用户在 AnythingLLM 上工作，等等。",
        create: "创造",
        save: "保存",
        cancel: "取消",
      },
    },
    stt_unsupported: "此浏览器不支持麦克风访问。",
    stt_mic_denied: "无法访问麦克风。请您先授予权限，然后重新尝试。",
    stt_transcription_failed: "转录失败：{{error}}",
    export: "导出聊天记录为…",
    exporting: "出口…",
  },
  profile_settings: {
    edit_account: "编辑帐户",
    profile_picture: "头像",
    remove_profile_picture: "移除头像",
    username: "用户名",
    new_password: "新密码",
    password_description: "密码长度必须至少为 8 个字符",
    cancel: "取消",
    update_account: "更新帐号",
    theme: "主题偏好",
    language: "语言偏好",
    failed_upload: "上传个人资料图片失败：{{error}}",
    upload_success: "个人资料图片已上传。",
    failed_remove: "移除个人资料图片失败：{{error}}",
    profile_updated: "个人资料已更新。",
    failed_update_user: "更新使用者失败：{{error}}",
    account: "帐户",
    support: "支援",
    signout: "登出",
  },
  "keyboard-shortcuts": {
    title: "键盘快捷键",
    shortcuts: {
      settings: "打开设置",
      workspaceSettings: "打开目前工作区设置",
      home: "前往首页",
      workspaces: "管理工作区",
      apiKeys: "API 密钥设定",
      llmPreferences: "LLM 偏好设置",
      chatSettings: "聊天设置",
      help: "显示键盘快捷键说明",
      showLLMSelector: "显示工作区 LLM 选择器",
    },
  },
  community_hub: {
    publish: {
      system_prompt: {
        success_title: "成功！",
        success_description: "您的系统提示已发布到社区中心！",
        success_thank_you: "感谢您分享到社群！",
        view_on_hub: "在社区中心查看",
        modal_title: "发布系统提示",
        name_label: "名称",
        name_description: "这是您系统提示的显示名称。",
        name_placeholder: "我的系统提示",
        description_label: "描述",
        description_description:
          "这是您系统提示的描述。用它来描述您系统提示的目的。",
        tags_label: "标签",
        tags_description:
          "标签用于标记您的系统提示，以便于搜索。您可以添加多个标签。最多 5 个标签。每个标签最多 20 个字符。",
        tags_placeholder: "输入并按 Enter 键添加标签",
        visibility_label: "可见性",
        public_description: "公共系统提示对所有人可见。",
        private_description: "私人系统提示仅对您可见。",
        publish_button: "发布到社区中心",
        submitting: "发布中...",
        prompt_label: "提示",
        prompt_description: "这是将用于引导 LLM 的实际系统提示。",
        prompt_placeholder: "在此输入您的系统提示...",
      },
      agent_flow: {
        success_title: "成功！",
        success_description: "您的代理流程已发布到社区中心！",
        success_thank_you: "感谢您分享到社群！",
        view_on_hub: "在社区中心查看",
        modal_title: "发布代理流程",
        name_label: "名称",
        name_description: "这是您代理流程的显示名称。",
        name_placeholder: "我的代理流程",
        description_label: "描述",
        description_description:
          "这是您代理流程的描述。用它来描述您代理流程的目的。",
        tags_label: "标签",
        tags_description:
          "标签用于标记您的代理流程，以便于搜索。您可以添加多个标签。最多 5 个标签。每个标签最多 20 个字符。",
        tags_placeholder: "输入并按 Enter 键添加标签",
        visibility_label: "可见性",
        submitting: "发布中...",
        submit: "发布到社区中心",
        privacy_note:
          "代理流程始终以上传为私有，以保护任何敏感资料。您可以在发布后在社区中心更改可见性。请在发布前验证您的流程不包含任何敏感或私人信息。",
      },
      generic: {
        unauthenticated: {
          title: "需要验证",
          description:
            "在发布项目之前，您需要通过 AnythingLLM 社区中心进行验证。",
          button: "连接到社区中心",
        },
      },
      slash_command: {
        success_title: "成功！",
        success_description: "您的斜线指令已发布到社区中心！",
        success_thank_you: "感谢您分享到社群！",
        view_on_hub: "在社区中心查看",
        modal_title: "发布斜线指令",
        name_label: "名称",
        name_description: "这是您斜线指令的显示名称。",
        name_placeholder: "我的斜线指令",
        description_label: "描述",
        description_description:
          "这是您斜线指令的描述。用它来描述您斜线指令的目的。",
        tags_label: "标签",
        tags_description:
          "标签用于标记您的斜线指令，以便于搜索。您可以添加多个标签。最多 5 个标签。每个标签最多 20 个字符。",
        tags_placeholder: "输入并按 Enter 键添加标签",
        visibility_label: "可见性",
        public_description: "公共斜线指令对所有人可见。",
        private_description: "私人斜线指令仅对您可见。",
        publish_button: "发布到社区中心",
        submitting: "发布中...",
        prompt_label: "提示",
        prompt_description: "这是触发斜线指令时将使用的提示。",
        prompt_placeholder: "在此输入您的提示...",
      },
    },
  },
  security: {
    title: "系统安全",
    password: {
      title: "访问密码",
      description:
        "为整个系统加一层登录密码。密码无法找回，请自行妥善保存。",
      "password-label": "系统密码",
    },
  },
  home: {
    welcome: "欢迎",
    chooseWorkspace: "选择一个工作区开始聊天！",
    notAssigned:
      "你目前还没有分配到任何工作区。\n请联系你的管理员请求访问一个工作区。",
    goToWorkspace: '前往 "{{workspace}}"',
  },
  telegram: {
    title: "Telegram 机器人",
    description:
      "将您的 AnythingLLM 实例与 Telegram 连接起来，这样您就可以从任何设备与您的工作空间进行聊天。",
    setup: {
      step1: {
        title: "第一步：创建您的 Telegram 机器人",
        description:
          "打开 Telegram 上的 @BotFather，发送 `/newbot` 到 <code>@BotFather</code>，按照提示操作，并复制 API 令牌。",
        "open-botfather": "启动 BotFather",
        "instruction-1": "1. 打开链接或扫描二维码",
        "instruction-2":
          "2. 将 <code>/newbot</code> 发送给 <code>@BotFather</code>",
        "instruction-3": "3. 为您的机器人选择一个名称和用户名",
        "instruction-4": "4. 复制您收到的 API 令牌",
      },
      step2: {
        title: "步骤 2：连接您的机器人",
        description:
          "将您从 @BotFather 获得的 API 令牌粘贴到指定位置，并选择一个默认的工作区，以便您的机器人可以进行对话。",
        "bot-token": "机器人代币",
        connecting: "正在连接...",
        "connect-bot": "连接机器人",
      },
      security: {
        title: "推荐的安全设置",
        description: "为了进一步增强安全性，请在 @BotFather 中配置这些设置。",
        "disable-groups": "— 阻止机器人加入群组",
        "disable-inline": "— 阻止机器人被用于内联搜索",
        "obscure-username":
          "使用一个不显眼的机器人用户名，以降低其被发现的可能性。",
      },
      "toast-enter-token": "请您输入一个机器人令牌。",
      "toast-connect-failed": "未能连接机器人。",
    },
    connected: {
      status: "连接",
      "status-disconnected": "未连接—— 令牌可能已过期或无效",
      "placeholder-token": "粘贴新的机器人令牌...",
      reconnect: "重新连接",
      workspace: "工作空间",
      "bot-link": "机器人链接",
      "voice-response": "语音响应",
      disconnecting: "断开连接...",
      disconnect: "断开",
      "voice-text-only": "仅提供文字",
      "voice-mirror": "回声（当用户发送语音时，会以语音形式回复）",
      "voice-always": "请务必在回复中添加语音（发送音频）。",
      "toast-disconnect-failed": "未能成功断开机器人。",
      "toast-reconnect-failed": "机器人连接失败。",
      "toast-voice-failed": "无法更新语音模式。",
      "toast-approve-failed": "未能批准用户。",
      "toast-deny-failed": "未能拒绝用户请求。",
      "toast-revoke-failed": "未能撤销用户权限。",
    },
    users: {
      "pending-description":
        "等待验证的用户。请将此处显示的配对代码与他们在 Telegram 聊天中显示的配对代码进行匹配。",
      unknown: "未知",
    },
  },
  scheduledJobs: {
    title: "计划任务",
    enableNotifications: "开启浏览器通知，任务跑完后会提醒你。",
    description:
      "按时间自动跑一段提示。可以带上代理工具，结果会存下来方便回看。",
    newJob: "新建任务",
    loading: "加载中…",
    emptyTitle: "还没有计划任务。",
    emptySubtitle: "先建一条，定时跑提示或整理资料。",
    table: {
      name: "名称",
      schedule: "计划",
      status: "状态",
      lastRun: "上次运行",
      nextRun: "下次运行",
      actions: "操作",
    },
    confirmDelete: "确定删除这条计划任务吗？",
    toast: {
      deleted: "已删除",
      triggered: "已开始运行",
      triggerFailed: "启动失败",
      triggerSkipped: "这条任务正在跑，请稍后再试。",
      killed: "已停止",
      killFailed: "停止失败",
    },
    row: {
      neverRun: "尚未运行",
      viewRuns: "查看记录",
      runNow: "立即运行",
      enable: "启用",
      disable: "停用",
      edit: "编辑",
      delete: "删除",
    },
    modal: {
      titleEdit: "编辑计划任务",
      titleNew: "新建任务",
      nameLabel: "名称",
      namePlaceholder: "例如：每日笔记摘要",
      promptLabel: "提示词",
      promptPlaceholder: "每次执行时要做的事…",
      scheduleLabel: "计划",
      modeBuilder: "图形设置",
      modeCustom: "自定义",
      cronPlaceholder: "Cron 表达式，例如 0 9 * * *",
      currentSchedule: "当前计划：",
      toolsLabel: "工具（可选）",
      toolsDescription:
        "选这个任务能用的代理工具。不选则只跑提示，不用工具。",
      toolsSearch: "搜索",
      toolsNoResults: "没有匹配的工具",
      required: "必填",
      requiredFieldsBanner: "还有必填项没填完。",
      cancel: "取消",
      saving: "保存中…",
      updateJob: "保存",
      createJob: "创建",
      jobUpdated: "已保存",
      jobCreated: "已创建",
    },
    builder: {
      fallbackWarning:
        "这条表达式没法用图形界面改。可以切到「自定义」保留，或在下面重设覆盖它。",
      run: "运行",
      frequency: {
        minute: "每分钟",
        hour: "每小时",
        day: "每天",
        week: "每周",
        month: "每月",
      },
      every: "每",
      minuteOne: "1 分钟",
      minuteOther: "{{count}} 分钟",
      atMinute: "在第几分",
      pastEveryHour: "每小时的第几分",
      at: "在",
      on: "在",
      onDay: "在每月",
      ofEveryMonth: "号",
      weekdays: {
        sun: "周日",
        mon: "周一",
        tue: "周二",
        wed: "周三",
        thu: "周四",
        fri: "周五",
        sat: "周六",
      },
    },
    runHistory: {
      back: "返回任务列表",
      title: "运行记录：{{name}}",
      schedule: "计划：",
      emptyTitle: "这条任务还没有跑过。",
      emptySubtitle: "可以先手动跑一次，看看结果。",
      runNow: "立即运行",
      table: {
        status: "状态",
        started: "开始时间",
        duration: "耗时",
        error: "错误",
      },
      stopJob: "停止任务",
    },
    runDetail: {
      loading: "正在加载运行详情…",
      notFound: "找不到这条记录。",
      back: "返回",
      unknownJob: "未知任务",
      runHeading: "{{name}} — 第 {{id}} 次",
      duration: "耗时：{{value}}",
      creating: "创建中…",
      threadFailed: "无法打开对话",
      sections: {
        prompt: "提示词",
        error: "错误",
        thinking: "思考（{{count}}）",
        toolCalls: "工具调用（{{count}}）",
        files: "文件（{{count}}）",
        response: "回复",
        metrics: "用量",
      },
      metrics: {
        promptTokens: "输入：",
        completionTokens: "输出：",
      },
      stopJob: "停止任务",
      killing: "正在停止…",
      continueInThread: "继续对话",
    },
    toolCall: {
      arguments: "参数：",
      showResult: "显示结果",
      hideResult: "收起结果",
    },
    file: {
      unknown: "未知文件",
      download: "下载",
      downloadFailed: "下载失败",
      types: {
        powerpoint: "幻灯片",
        pdf: "PDF",
        word: "文档",
        spreadsheet: "表格",
        generic: "文件",
      },
    },
    status: {
      completed: "已完成",
      failed: "失败",
      timed_out: "超时",
      running: "运行中",
      queued: "排队中",
    },
  },
  "model-router": {
    title: "模型路由",
    description:
      "问答和助手模式里，按用户这句话的内容自动换模型。先定规则，再选命中后用哪家模型。",
    table: {
      name: "名称",
      fallback: "回退模型",
      rules: "规则",
      workspaces: "工作区",
    },
    "no-routers": "还没有模型路由。",
    "empty-description": "先建一条路由，再在语言模型或工作区里选用它。",
    "new-router-button": "新建路由",
    "delete-confirm":
      '确定删除路由「{{name}}」吗？\n规则会一起删掉，正在用它的工作区也会断开。\n\n此操作不可撤销。',
    "toast-deleted": "已删除",
    "toast-delete-failed": "删除失败：{{error}}",
    "new-router": {
      title: "新建模型路由",
      name: "名称",
      "name-placeholder": "例如：按任务分流",
      description: "说明",
      "description-placeholder": "可选",
      "fallback-label": "回退模型",
      "fallback-description":
        "没有规则命中时用这个。意图规则的判断也会用它。",
      "cooldown-label": "粘滞时间（秒）",
      "cooldown-help":
        "命中后，同一段对话暂时继续用这个模型，避免来回跳。填 0 则每句都重新判断。",
      "name-required": "请填写名称。",
      "fallback-required": "请选择回退用的服务和模型。",
      cancel: "取消",
      create: "创建",
    },
    "edit-router": {
      "back-to-routers": "返回模型路由",
      title: "编辑路由：{{name}}",
      save: "保存更改",
      "toast-update-failed": "保存失败",
    },
    rules: {
      title: "路由规则",
      "title-with-name": "路由规则：{{name}}",
      description: "按优先级匹配用户输入，命中后走对应模型。",
      "add-rule": "添加规则",
      "delete-confirm": "删除规则「{{title}}」？",
      "toast-delete-failed": "删除规则失败",
      "toast-reorder-failed": "调整顺序失败",
      "no-rules": "还没有规则。",
      "empty-description": "加一条规则，指定什么情况下用哪家模型。",
      "new-rule-button": "新规则",
      "calculated-section-label": "条件规则（按顺序判断）",
      "llm-section-label": "意图规则（条件都不中时再判断）",
      "llm-rule-body": "若像「{{description}}」，则走 <route></route>",
      "calculated-no-conditions": "无条件，直接走 <route>{{route}}</route>",
      "calculated-single-condition":
        '若 <prop>{{property}}</prop> {{comparator}} <val>"{{value}}"</val>，则走 <route>{{route}}</route>',
      "calculated-multi-condition":
        "若满足 <cond></cond>，则走 <route></route>",
      "comparator-contains": "包含",
      "comparator-matches": "匹配",
      "comparator-between": "介于",
      "badge-llm": "意图",
      "badge-calculated": "条件",
      "aria-drag-to-reorder": "拖动排序",
      "aria-edit-rule": "编辑规则",
      "aria-delete-rule": "删除规则",
      "quantifier-any": "任一",
      "quantifier-all": "全部",
    },
    "rule-form": {
      "title-label": "规则名",
      "rule-type": "规则类型",
      "property-label": "判断项",
      "property-select": "请选择",
      "comparator-label": "比较",
      "comparator-select": "请选择",
      "value-label": "值",
      "add-condition": "添加条件",
      "remove-condition": "移除条件",
      "conditions-incomplete": "第 {{index}} 条条件不完整，请填判断项、比较和值。",
      "match-description-label": "何时命中",
      "match-description-placeholder":
        "例如：用户在问法律、合同或合规问题。",
      "match-description-help":
        "用白话写什么情况下该用这个模型，系统会拿用户这句话来判断。",
      "route-to-label": "命中后使用的模型",
      "route-to-description": "这条规则命中时，用下面这家服务和模型。",
      cancel: "取消",
      saving: "保存中…",
      "update-rule": "更新规则",
      "create-rule": "创建规则",
      "title-required": "请填写规则名",
      "toast-save-failed": "保存规则失败",
      "type-calculated-label": "条件规则",
      "type-calculated-description":
        "按内容关键词、对话长度、是否带图等直接判断。",
      "type-llm-label": "意图规则",
      "type-llm-description":
        "你写一段描述，用模型判断用户这句话像不像这种意图。",
      "prop-prompt-content": "用户输入",
      "prop-token-count": "对话长度（token）",
      "prop-message-count": "对话轮数",
      "prop-current-hour": "当前小时（0–23）",
      "prop-has-image": "是否带图",
      "cmp-contains": "包含",
      "cmp-matches-regex": "匹配（正则）",
      "cmp-equals": "等于",
      "cmp-not-equals": "不等于",
      "cmp-greater-than": "大于",
      "cmp-greater-than-or-equal": "大于或等于",
      "cmp-less-than": "小于",
      "cmp-less-than-or-equal": "小于或等于",
      "cmp-between": "介于",
      "placeholder-between-hour": "例如：9,17",
      "placeholder-between-numeric": "例如：10, 50",
      "placeholder-hour": "例如：18（0–23）",
      "placeholder-message-count": "例如：10",
      "placeholder-numeric": "例如：4000",
      "placeholder-contains": "例如：代码、Python、报错",
      "placeholder-matches": "例如：/\\bpython\\b/i",
      "placeholder-default": "例如：代码",
      "help-contains": "逗号分隔，输入里出现任一词即命中（不区分大小写）。",
      "help-matches":
        "正则。可用 /pattern/flags；默认不区分大小写。",
      "bool-true": "是",
      "bool-false": "否",
    },
    "provider-picker": {
      "select-provider": "选择服务",
      "setup-required": "（需先配置）",
      "loading-models": "正在加载模型…",
      "select-model": "选择模型",
      "enter-model": "填写模型名",
      "select-provider-first": "请先选择服务。",
      "configure-to-continue": "先配置 {{name}} 才能继续",
      "configure-provider": "配置 {{name}}",
      "setup-credentials": "填写密钥后，才能把 {{name}} 当作路由目标。",
      cancel: "取消",
      "save-settings": "保存",
      "toast-save-failed": "保存失败：{{error}}",
    },
    "router-selection": {
      "loading-routers": "正在加载路由…",
      "no-routers-prefix-settings": "还没有模型路由。",
      "no-routers-prefix-workspace": "还没有模型路由。",
      "no-routers-link": "去系统设置里新建",
      "model-router-label": "模型路由",
      "select-router": "选择一条路由",
      "select-description": "选中的工作区，问答和助手会按这条路由换模型。",
      "no-routers-chat":
        "还没有模型路由。请到系统设置 → 模型路由里新建。",
      "rule-count": "（{{count}} 条规则）",
    },
    metrics: {
      "model-router-default": "模型路由",
    },
    chat: {
      "select-router-error": "请选择一条路由",
      "invalid-model": "模型无效",
      "routed-to": "已转到 <route>{{model}}</route>",
      "routed-to-rule":
        "规则「{{ruleTitle}}」→ <route>{{model}}</route>",
    },
  },
};

export default TRANSLATIONS;
