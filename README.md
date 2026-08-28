# BuGuLLM

Local-first knowledge vault and learning studio, based on [AnythingLLM](https://github.com/mintplex-labs/anything-llm) (MIT).

BuGuLLM 是面向个人知识库的学习助手：把本地文件夹当成知识库，用已有笔记对话，再生成思维导图、卡片和测试。对话、文档解析、向量检索和模型接入继承自 AnythingLLM。

> This project is **not** an official Mintplex Labs product. It is an independent downstream of AnythingLLM.

## Features

- **Knowledge vault** — bind a local folder to a workspace, browse/edit Markdown, tag files, import Feishu docs and video notes
- **RAG chat** — ask questions against your notes with passage-level citations
- **Learning studio** — generate mind maps, flashcards, and quizzes from selected notes
- **Practice & review** — session history, result summary, trash for missed items, and a small decompress interaction after clearing recovered questions
- **Model-aware generation** — token budget follows the current model window; truncated JSON still keeps complete items

## Quick start

Requires Node.js 18+ and [Yarn](https://yarnpkg.com/).

```bash
git clone https://github.com/cozyxiong/BuGuLLM.git
cd BuGuLLM
yarn setup
```

Then run these in three terminals (or `yarn dev` once):

```bash
yarn dev:server
yarn dev:collector
yarn dev:frontend
```

Copy the example env files if `yarn setup` did not (Windows may need a manual copy):

- `server/.env.example` → `server/.env.development`
- `frontend/.env.example` → `frontend/.env`
- `collector/.env.example` → `collector/.env`

Docker instructions live in [`docker/HOW_TO_USE_DOCKER.md`](./docker/HOW_TO_USE_DOCKER.md). Bare-metal notes: [`BARE_METAL.md`](./BARE_METAL.md).

## Layout

| Path | Role |
| --- | --- |
| `frontend/` | Vite UI: chat, library, learning studios |
| `server/` | API, Prisma/SQLite, RAG, generation |
| `collector/` | Document parsing and ingestion |
| `docs/` | Phase-1 product boundary |

Local notes, SQLite, vectors, API keys, and `server/storage/vault/` are gitignored and must not be committed.

## License

MIT. See [LICENSE](./LICENSE).

- Copyright (c) Mintplex Labs Inc. — AnythingLLM
- Copyright (c) 2026 Cozy Xiong — BuGuLLM modifications

Please keep both notices when you redistribute.
