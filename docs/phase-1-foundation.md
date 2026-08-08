# BaGuLLM Phase 1 Foundation

## Product Boundary

BaGuLLM is a local-first, single-user interview learning assistant built on
AnythingLLM. The existing model configuration, document processing, vector
retrieval, workspace chat, and source-citation pipelines are retained.

The first product surface is not a general-purpose AI agent platform. Its core
flows are:

1. Import and organize a personal knowledge base stored in a local folder.
2. Read, edit, tag, and classify knowledge files in a file-oriented interface.
3. Answer questions from the knowledge base with inspectable source passages.
4. Turn selected knowledge into mind maps, cards, and practice questions.

## Source Inventory

| Area | Keep for Phase 1 | Reason |
| --- | --- | --- |
| `frontend` | Yes | Existing chat and model settings are the UI foundation. |
| `server` | Yes | Owns workspaces, document metadata, chat, vector retrieval, and citations. |
| `collector` | Yes | Parses PDF, Word, PowerPoint, spreadsheets, images, web pages, and YouTube transcripts. |
| `docker` | Yes | Provides the reproducible local runtime. |
| `cloud-deployments` | Do not build or expose | Not part of the local-first MVP. Root generation scripts have been removed. |
| `browser-extension` | Defer | Web capture is not needed before the web-note flow is implemented. |
| `embed` | Defer | Public chat widgets are unrelated to a personal knowledge base. |
| Community hub, mobile, Telegram, enterprise administration | Defer | These are outside the Phase 1 learning loop. |

AnythingLLM's open-source tree contains no first-party payment, subscription,
or Stripe implementation to remove. The paid/commercial surface visible in this
snapshot is primarily cloud deployment documentation and outbound product links.

## Architecture Decision

Use the existing workspace as the RAG index boundary, but present it in the UI
as a personal knowledge library. A workspace is therefore an implementation
detail, not a user-facing collaboration concept.

```
Local knowledge folder
  -> library file metadata and tags
  -> collector parsing and chunking
  -> vector index in the existing workspace
  -> RAG answer with passage-level citations
  -> cards, questions, mind maps, and review queue
```

Raw user files will remain in a user-selected local directory. The current
AnythingLLM document storage is retained only for processed copies and vector
index artifacts. Library metadata, derived notes, cards, questions, and review
state will be added to the server database in later migrations.

## Delivery Sequence

1. Add a single-user BaGuLLM product mode and hide unrelated navigation/routes. Done in the frontend; server modules remain intact until their replacements exist.
2. Build the library shell: local-folder registration, file tree, preview, and
   Markdown editing.
3. Add library metadata: source path, type, tags, AI classification, and sync
   state; then connect imports to the existing collector and workspace index.
4. Extend citations to return a stable chunk identifier, surrounding passage,
   and answer-span offsets for highlighting.
5. Add learning artifacts and review scheduling: mind maps, cards, questions,
   trash state, and optional spaced repetition.
6. Add Feishu Docs URL/embed support, then web and video note generation.

## Safety Constraints

The workspace is currently an extracted source snapshot with no Git metadata.
Deletion must therefore be explicit and individually verifiable. Bulk removal
of coupled code or directories is deferred until the replacement route/API has
passed build and runtime checks.

The detailed MVP scope, technical constraints, and implementation order are in
`docs/phase-1-mvp-plan.md`.
