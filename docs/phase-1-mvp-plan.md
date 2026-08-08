# BaGuLLM Phase 1 MVP Plan

## Scope Interpretation

The checked items in the product brief are Phase 1 acceptance criteria. They
are not treated as completed features in the current AnythingLLM source tree.
AnythingLLM remains the infrastructure base; BaGuLLM supplies the personal
knowledge and learning product layer.

## Product Model

| Product concept | Implementation boundary |
| --- | --- |
| Personal knowledge base | One AnythingLLM workspace used as an internal RAG namespace. |
| Local Vault | A local folder on the same machine as the server; it is the source of truth for user-authored notes and imported originals. |
| Indexed document | A parsed copy and vectorized chunks managed by the existing collector and `workspace_documents` pipeline. |
| Knowledge point | A tagged, addressable excerpt tied to a Vault file and optional indexed document/chunk. |
| Learning artifact | A generated mind map, flashcard, question, or review item, persisted independently of the chat history. |

### Local-First Constraint

The current product is a browser UI backed by a local Node.js server. A browser
can upload a selected directory but cannot safely retain unrestricted absolute
local paths. Phase 1 therefore uses a server-side Vault directory:

1. Default: `server/storage/vault`.
2. Advanced local setup: `BAGU_VAULT_DIR` points at an existing Obsidian
   Vault on the same machine.
3. Folder import copies selected files into the Vault before parsing and
   indexing them.

This provides editable, visible local files immediately. A native folder picker
and watch service can be added later with a desktop shell, without changing the
library or RAG data model.

## Capability Mapping

| Brief capability | Existing AnythingLLM base | BaGuLLM work |
| --- | --- | --- |
| File tree and preview/editing | Document storage and upload exist | Build Library pages, tree, file preview, Markdown editor, and Vault APIs. |
| Local folder import | Collector parses PDF, Word, PPT, spreadsheets, images, URLs, and YouTube | Copy files to Vault, create library records, then use the existing collector/indexing pipeline. |
| Feishu Docs | No product layer | Add a Feishu URL record, an embedded component when the document permits framing, and a fallback external editor link. |
| Classification and tags | None | Add file and knowledge-point tags, classification jobs, review UI, and manual override. |
| KB RAG and Deep Search | Workspace chat, vector search, citations | Use query mode as the default RAG path; add an explicit deep-search strategy later. |
| Forced citations | Chat responses already return source chunks | Return stable chunk IDs, surrounding text and answer ranges; render a source drawer with highlighted spans. |
| AI supplement / related points | None | Add a structured response contract with a collapsed standard-answer section and follow-up knowledge-point IDs. |
| Mind maps, cards, questions | None | Add generation records and learning-state models; retain source references for every artifact. |
| Trash and spaced repetition | None | Add soft-delete/trash state, review history, scheduling policy, and an opt-in system setting. |
| Video and web notes | Collector already supports web and YouTube inputs | Add an ingest-to-note workflow, note-style prompt, preview, and explicit save-to-Vault action. |

## Delivery Order

### 1. Vault and Library Foundation

- Prisma migration for `libraries`, `library_files`, `tags`, and `file_tags`.
- Server APIs for configured Vault, folder tree, file content, Markdown write,
  rename, move, and import.
- Frontend Library route with a folder-like tree, viewer, and Markdown editor.
- Import handoff from the Vault to the existing collector and workspace index.

### 2. Knowledge Metadata and RAG Evidence

- AI classification and tag suggestion jobs with manual approval/editing.
- Knowledge point records that reference file ranges and indexed chunk IDs.
- Citation payload extension: source chunk, surrounding context, and answer
  highlight offsets.
- Chat response sections for a collapsed interview-standard answer and related
  knowledge points.

### 3. Learning Loop

- Generation APIs/UI for mind maps, cards, and single/multiple-choice questions.
- `learning_items`, `review_events`, and trash-state persistence.
- Opt-in spaced-repetition scheduler with deterministic due dates and a
  user-visible review queue.

### 4. External Knowledge-to-Note Workflows

- Feishu URL/component records and live-view fallback behavior.
- Video URL transcript-to-note workflow using the existing YouTube collector
  path and a user-approved save action.
- Web/GitHub/technical-document URL-to-note workflow.

## First Development Slice

The first implementation slice is the Vault and Library Foundation. It proves
the core product promise before adding AI generation:

1. Create and configure the local Vault directory.
2. Create a personal knowledge base/workspace if one does not exist.
3. List folders and files from the Vault.
4. Read and write Markdown notes without leaving the app.
5. Import a file into the Vault, parse it with the collector, and index it for
   RAG.

## Acceptance Checks

- A user-created Markdown note appears in the file tree, remains on disk after
  restart, and can be edited in the app.
- An imported PDF/Word/PPT/spreadsheet/image is copied into the Vault and can
  be indexed without altering the original source file.
- A RAG answer cites the imported content and opens a relevant passage rather
  than only the whole document.
- Every generated learning artifact can be traced to its source knowledge
  point/file and can be moved to the trash without deleting its source note.
