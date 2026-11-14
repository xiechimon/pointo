# Pointo

## Routing

**Capture**:
One recording, compiled into a `.pointo` bundle.

**Destination**:
Where a capture is delivered: a project folder, any directory and usually a git root. Whatever coding agent works in that folder (Claude Code, Codex, Cursor, Gemini CLI, Qwen Code, OpenCode…) reads the capture from `<project>/.pointo/captures/`. The clipboard always gets the capture as well, so "no destination" means clipboard only.
_Avoid_: target (that's what was recorded), session

**Project folder**:
The directory a destination names. The copy of a capture in it holds what an agent reads (contact sheet, keyframes, manifest, summary); the recording and audio stay in the original bundle.

**Pinned project**:
The folder the user chose in Settings (`"project"`), which every capture goes to until cleared.

**Recent projects**:
The folders captures were delivered to, most recent first, at most five (`"recentProjects"`). The pill offers them as chips.

**Choice**:
A project the user picked for this capture (`pointo send --project`, a chip on the pill).

**Recorded destination**:
The folder a bundle carries in `pointo.json`, written when an earlier delivery chose it.

**Clue**:
An observed fact about a capture's surroundings that points at a project folder: a page's registration (`data-directory`), the folder of the process serving the tab, a terminal's folder.

**Via**:
Which clue chose the folder: `pinned`, `page`, `port`, `terminal`, or `chosen` (picked by hand).

**Ladder**:
The order clues are tried in, first hit wins: pinned, page, port, terminal. The home folder and `/` never count. Nothing found means clipboard only.

**Undo window**:
The few seconds after a delivery is decided and before it leaves the Mac, when ✕ or Paste cancels it and the chip for the most recent other project delivers there instead.
