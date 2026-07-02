---
name: memory-dream
description: agents-share の記憶階層（MEMORY.md / auto-memory / notes / projects）を再編し、重複・矛盾・陳腐化を除去する consolidation を実行する。ユーザーが「記憶の整理」「dream」と指示したとき、大規模リファクタ（リネーム多数・フレームワーク移行・API 構造変更）の直後、またはセッションが 20〜30 回蓄積してノートがノイズ化してきたときに使う。
---

# memory dream（記憶の整理／consolidation）

Anthropic Managed Agents の **Dreams**（別名 auto-dream）を、本環境（手動・git ベース）で再現する手順。セッションごとの増分追記で溜まった重複・矛盾・陳腐化エントリ（相対日付の意味喪失、削除済みファイルを指す古い手順など）を除去し、ノートを「思い出す助け」に戻す。

原則は本家 API と同じ **入力非破壊・レビュー後採用**。本環境では「論理単位ごとの commit ＋ ユーザーレビュー」で代替し、push はユーザーの明示指示まで保留する。consolidation は記憶の再編であって fine-tune ではない（モデルは変えない）。

## 対象階層（毎セッション自動ロードされる順）

作業場所は git レポジトリ `agents-share`（`{agent_global_home}` 配下）。

1. `AGENTS.md` — 世界のルール（最上位・home-manager 管理・更新禁止）。**編集対象外**。ただしルールの定義元として参照する。
2. `MEMORY.md` — チーム共通知識
3. `auto-memory/MEMORY.md`（索引）＋ `auto-memory/*.md`（関連時に想起）
4. session-start で読む notes（`notes/ghq.md`, `notes/specs.md`）
5. `projects/{project_dir_canonical}.md` — プロジェクト固有
6. `notes/*.md`（on-demand）

`specs/`（設計文書）はプロジェクト固有でルール重複の対象外。dream では原則触らない。

## 手順

### 0. 準備

```bash
cd {agent_global_home}
git status --short    # 作業ツリーが clean であることを確認。dirty なら先に退避か commit
date +%F              # 今日の絶対日付を確定（相対日付の変換基準）
find . -name '*.md' -not -path './.git/*' | sort    # 対象ファイルの全量を把握
```

### 1. Mine（採掘）

直近セッションから記憶に昇格させる素材を抽出する。

- ソース: 現在の会話履歴、`git log --since='2 weeks ago' --oneline`（agents-share 自身と作業対象プロジェクトの双方）、直近に触った projects/notes。
- 拾う: 繰り返し出た指摘（2 回以上）、確定した方針、新事実（環境・API・構造の変化）。
- 拾わない: 一回限りのデバッグメモ、未確定の試行錯誤。
- 抽出物は scratchpad に一時メモする。この時点では成果ファイルへ書かない。

### 2. Consolidate（統合）

抽出物を既存記憶へマージしながら、既存記述を現行化する。

- 相対日付（「昨日」「先週」等）は step 0 で確定した日付を基準に**絶対日付へ変換**する。
- 矛盾は最新の値で解決し、古い記述を置換する。どちらが最新か判断できない矛盾は**ユーザーへ確認**する（勝手に選ばない）。
- ファイル・関数・フラグへの参照は現存確認し、消えていれば記述ごと除去するか現状に合わせて更新する:

  ```bash
  test -e <path>                  # ファイルの現存確認
  git grep -n '<symbol>' -- .    # シンボルの現存確認（対象プロジェクト側で実行）
  ```

### 3. Dedup & Resolve（重複排除）

階層をまたいだ重複を除去する。判定ルール:

- 重複は常に「下位 → 上位」方向で発生する。**修正は下位レイヤ側**で行い、AGENTS.md（最上位・自己整合）は触らない。
- 各情報の定義箇所は一つに保つ。上位が定めるルール（ディレクトリ構造・コミット運用・記憶貢献ルールなどの「世界のルール」は AGENTS.md が定める）は下位から黙って消す。必要なら所在だけを 1 句で指す（例: 「PR 本文は `notes/playbook/github-pr.md` に従う」）。
- 下位レイヤに残すのは、そのレイヤ固有の知見だけ（書き方は後述「成果ファイルの書き方」に従う）。

### 4. Prune & Index（剪定・索引化）

- `MEMORY.md` 系の索引は lean に保つ: `MEMORY.md` は目安 200 行未満、`auto-memory/MEMORY.md` は 1 ファイル 1 行フック。
- 冗長な節・完了済みで価値の無い記述を削除する。
- notes の追加・移動・削除をしたら、`MEMORY.md` の「notes 一覧」コードブロックを以下の出力で丸ごと置換する（notes は階層化され on-demand では発見されにくいため、常時ロードされる MEMORY.md に全パスを置く）:

  ```bash
  cd {agent_global_home} && find notes -type f -name '*.md' | sort
  ```

### 5. Commit & Review（レビュー後採用）

- 変更を**論理単位ごとに commit** する（例: 「相対日付の絶対化」と「MEMORY.md と notes の重複解消」は別 commit）。気に入らない単位だけ revert できる状態を保つ。
- コミットメッセージは、何をどう再編したかが分かる 1 行＋必要なら本文。
- ユーザーへレビューを提示する:

  ```bash
  git log --oneline <dream開始前のcommit>..HEAD
  git diff --stat <dream開始前のcommit>..HEAD
  ```

- dream 出力は hallucination 混入の懸念があるため鵜呑みにせず、**採用前レビュー必須**。push はユーザーの明示指示があるまで実行しない。

## 成果ファイルの書き方

判断のメタと経緯はこの skill 側に置き、**成果ファイル（MEMORY.md / projects / notes）には書かない**。具体的に成果ファイルから除くもの:

- 重複回避の注記（「これは X が定める、ここでは重複させない／再掲しない」等のメタ説明）。重複は黙って消すだけでよい。
- 経緯・履歴（**Why:**、失敗談、「同じ指摘を N 回受けた」、学習日・セッション ID、`feature による` 等）。
- 結果として残すのは、現行で正しい知見・ルール・再現手順だけ。理由が行動を変える技術的因果（「A だと B が壊れるので C する」）は知見の一部として残してよいが、誰がいつ何を指摘したかは残さない。

## 完了チェックリスト

- [ ] 相対日付をすべて絶対日付へ変換した
- [ ] 上位が定めるルールを下位から削り、重複回避の注記も残していない
- [ ] 成果ファイルに経緯・履歴（Why / 失敗談 / 再発回数 / 学習日 / セッション ID）が残っていない
- [ ] 矛盾を最新値で解決した（曖昧なものはユーザー確認済み）
- [ ] 存在しないファイル/シンボルへの参照が無い
- [ ] 索引が lean で、`MEMORY.md` の「notes 一覧」が `find notes -type f -name '*.md' | sort` の出力と一致する
- [ ] 論理単位ごとの commit になっており、push していない

## 参考

- [Dreams — Claude API Docs](https://platform.claude.com/docs/en/managed-agents/dreams)（公式。`managed-agents-2026-04-01` + `dreaming-2026-04-21` beta header、Opus 4.7 / Sonnet 4.6、最大 100 セッション、`instructions` 4096 文字）
- [What Is Claude Dreaming? (MindStudio)](https://mindstudio.ai/blog/what-is-claude-dreaming-anthropic-managed-agents)
- [Claude Code Dreams: Auto Dream guide (Supalaunch)](https://supalaunch.com/blog/claude-code-dreams-auto-dream-memory-consolidation-guide)
- [Auto-dream mechanics (claudefa.st)](https://claudefa.st/blog/guide/mechanics/auto-dream)
- [grandamenium/dream-skill（4 フェーズ consolidation の OSS 再現）](https://github.com/grandamenium/dream-skill)
