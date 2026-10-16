# PaperCompare

Compare paper experiments with traceable PDF evidence, inside Zotero.

[简体中文](README.zh-CN.md) · Preview **0.1.0** · MIT · No API key

PaperCompare lets you build a comparison table, add papers selected in your Zotero library, and record multiple experiments per paper. Each cell can hold your summary and several saved PDF highlights. Open a quote to return to the original annotation.

![PaperCompare with synthetic demo data](docs/assets/preview.png)

## Features

- General and AI Infra templates, or custom columns.
- Experiment rows with editable values, linked quotes and source page labels.
- Quotes remain as snapshots if the source is removed; navigation reports the missing source.
- Markdown and CSV export; JSON backup and import as new comparisons.
- Local atomic JSON saves and a previous-valid-state backup.
- Chinese/English interface, dark mode, keyboard controls and scrollable tables.

## Install and use

Download **[papercompare-0.1.0.xpi](https://github.com/luxun-spec/zotero-papercompare/releases/download/v0.1.0/papercompare-0.1.0.xpi)** from [Releases](https://github.com/luxun-spec/zotero-papercompare/releases/latest).
In Zotero choose **Tools → Plugins → gear menu → Install Plugin From File**, selecting the downloaded `.xpi` file. You can also build it from source below.

1. Open **Tools → PaperCompare** and create a comparison.
2. Select papers in the main Zotero library; return to PaperCompare and click **Add selected papers**.
3. Use the **+** in an experiment row to record another experiment from that paper.
4. Save text highlights using Zotero's native PDF reader.
5. Select a table cell, enter your summary, and click **Save** or **Add PDF highlights**.
6. Link highlights; click **Open source** to navigate to one. Export from the toolbar.

Empty cells mean **not recorded**, not that the paper omitted the information. Values and units are manual text; the plugin does not decide whether results are comparable. CSV contains values; Markdown also contains evidence. JSON is the full-fidelity backup.

## Compatibility and limits

Actually integration-tested on **Windows / Zotero 10.0.6**, manifest restricted to `10.0.*`. macOS/Linux GUI and earlier Zotero versions are not verified. CI checks core logic and packaging, not Zotero GUI compatibility.

- No AI extraction, OCR, translation, synchronization or remote account.
- Source navigation requires original local Zotero items. JSON imports do not import PDFs or annotations or remap library/item keys across libraries or machines.
- Markdown source links are generated for the personal library; group-library evidence remains readable as text without a generated deep link.
- The plugin update feed is hosted in GitHub Releases and includes a SHA-256 checksum. Users of the earlier local preview should install the public XPI once to replace its development update address; automatic updates can be enabled in Zotero's plugin manager.
- Unsaved edits can be exported as a draft. If plugin shutdown forces the window to close, a recovery draft is attempted at `papercompare-recovery-draft.json` in the Zotero data directory. Recover it using JSON import after resolving the underlying error.

## Data and recovery

Data is stored in `papercompare.json` in Zotero's data directory. Before replacement, the previous valid state is kept in `papercompare.json.bak`. The plugin never writes directly to Zotero's database or edits native annotations. JSON backups reference your Zotero items rather than copying their attachments.

If the state cannot be read, editing is disabled; use **Restore backup** to recover a valid backup explicitly. Keep periodic exported JSON backups: the `.bak` file retains only the previous successful save.

## Build and verify

Node.js **24** and npm:

```sh
npm ci
npm test
npm run typecheck
npm run build
```

The resulting XPI is `dist/papercompare-0.1.0.xpi`. Dependencies are build/test-only; no npm runtime is needed in Zotero.

For isolated Windows integration testing, close an existing test instance and run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/launch-test.ps1 -Build
```

This creates a separate profile/data directory under `work/`, generates a synthetic PDF and papers, and executes `scripts/seed-test.js` using a **development-only build hook**. The production build removes that hook. The result is recorded in `work/test-data/integration-result.json`. Re-run after closing to verify persistence. Do not use the test profile for personal documents.

Architecture: [design](docs/superpowers/specs/2026-10-16-papercompare-design.md), [implementation plan](docs/superpowers/plans/2026-10-16-papercompare.md), [verification](docs/verification.md).

## Development references

Independently implemented using [Zotero developer documentation](https://www.zotero.org/support/dev/zotero_7_for_developers) and local API inspection. No third-party plugin template code is bundled. Build dependencies retain their own licenses.
