/**
 * らくらく店舗ダッシュボード連携 Google Apps Script
 *
 * このファイル 1 つをスプレッドシートに貼るだけで、
 * 必要なシートの自動生成・順位/平均の自動計算・ダッシュボードへの同期がすべて行えます。
 *
 * ■ セットアップ手順
 * 1. スプレッドシートの「拡張機能 > Apps Script」を開き、このファイルの内容を貼り付けて保存
 * 2. スプレッドシートを再読み込みすると「ダッシュボード連携」メニューが表示される
 * 3. メニュー「① 初期セットアップ」→ 必要なシートが生成される
 *    (旧「データ入力」シートがある場合は、値を新しいシートに自動で移行します)
 * 4. 「設定」シートにエンドポイント URL を入力、「店舗マスタ」を実店舗に書き換える
 * 5. メニュー「② API シークレットを設定」→ アプリ側の GAS_SYNC_SECRET と同じ値を入力
 * 6. 「店舗マスタ」の「初期パスワード」を入力し、メニュー「⑤ 店舗をアプリに登録」を実行
 * 7. 「KPI」「原価率」「人件費率」「QSCアンケート」の各シートに数値を入れて「③ 今すぐ同期」
 * 8. メニュー「④ 毎日の自動同期を設定」で毎日自動送信(時刻は「設定」シートで変更可)
 *
 * ■ 各シートの役割
 * - 店舗マスタ:        店舗コード・店舗名・ブランド・初期パスワード(全シートの店舗一覧の元)
 * - KPI:               各店舗の KPI 点数(C 列だけ入力。店舗コード・店舗名は自動)
 * - 原価率:            各店舗の原価率%(同上)
 * - 人件費率:          各店舗の人件費率%(同上)
 * - QSCアンケート:     各店舗の QSC 点数(同上・未実施の店舗は空欄で可)
 * - 設定:              エンドポイント URL・目標値・同期時刻
 * - ダッシュボード連携: 同期時に自動生成される計算結果(順位・平均)。手で編集しない
 *
 * ※ 衛生チェックの提出枚数は衛生管理アプリから自動取得されるため、入力不要です。
 *
 * 順位・全店平均は同期のたびに GAS が自動計算します:
 * - KPI順位:   KPI点数の高い順
 * - 原価率順位: 原価率の低い順 / 人件費率順位: 人件費率の低い順 / QSC順位: QSC点数の高い順
 * - 総合順位:   上記 4 つの順位の平均が小さい順(同率は KPI点数の高い方が上位)
 * - QSC前回順位: 前回同期時の QSC順位を自動で引き継ぎ
 */

var SHEET_MASTER = "店舗マスタ";
var SHEET_OUTPUT = "ダッシュボード連携";
var SHEET_SETTINGS = "設定";
var SHEET_INPUT_LEGACY = "データ入力"; // 旧バージョンの入力シート(①で自動移行)

// 指標ごとの入力シート
var METRIC_SHEETS = [
	{ key: "kpi", name: "KPI", header: "KPI点数", percent: false },
	{ key: "cost", name: "原価率", header: "原価率(%)", percent: true },
	{ key: "labor", name: "人件費率", header: "人件費率(%)", percent: true },
	{ key: "qsc", name: "QSCアンケート", header: "QSC点数", percent: false },
];

var OUTPUT_HEADERS = [
	"店舗コード",
	"店舗名",
	"KPI点数",
	"KPI順位",
	"総合順位",
	"原価率(%)",
	"原価率順位",
	"人件費率(%)",
	"人件費率順位",
	"QSC点数",
	"QSC順位",
	"QSC前回順位",
	"同期日時",
];

/* ===================== メニュー ===================== */

function onOpen() {
	SpreadsheetApp.getUi()
		.createMenu("ダッシュボード連携")
		.addItem("① 初期セットアップ(シート作成)", "initSpreadsheet")
		.addItem("② API シークレットを設定", "setApiSecret")
		.addItem("③ 今すぐ同期", "syncToDashboard")
		.addItem("④ 毎日の自動同期を設定", "setupDailyTrigger")
		.addItem("⑤ 店舗をアプリに登録", "registerStores")
		.addItem("⑥ 元シートから数値を取り込み(テスト)", "importFromSourcesMenu")
		.addToUi();
}

/* ===================== ① 初期セットアップ ===================== */

function initSpreadsheet() {
	var ss = SpreadsheetApp.getActiveSpreadsheet();

	// --- 設定 ---
	var settings = getOrCreateSheet(ss, SHEET_SETTINGS);
	if (settings.getLastRow() === 0) {
		settings
			.getRange(1, 1, 5, 2)
			.setValues([
				["項目", "値"],
				["エンドポイントURL", "https://your-app.example.com/api/gas/kpi"],
				["原価率目標(%)", 30],
				["人件費率目標(%)", 25],
				["同期時刻(0〜23時)", 22],
			]);
		settings.getRange("A1:B1").setFontWeight("bold").setBackground("#f6e4dc");
		settings.setColumnWidth(1, 180);
		settings.setColumnWidth(2, 360);
		settings
			.getRange("B2")
			.setNote("デプロイしたらくらく店舗ダッシュボードの URL + /api/gas/kpi を入力してください");
	}
	// 元シート取り込み用の設定行(無ければ追記)
	ensureSettingRow(settings, "PLシートのURL", "", "KPI点数・材料費率・人件費率を管理しているスプレッドシートの URL");
	ensureSettingRow(settings, "PLシートのタブ名", "", "上記スプレッドシートの中の、対象シート(タブ)の名前");
	ensureSettingRow(settings, "QSCシートのURL", "", "QSC アンケート集計スプレッドシートの URL");
	ensureSettingRow(settings, "QSCシートのタブ名", "", "上記スプレッドシートの中の、対象シート(タブ)の名前");

	// --- 店舗マスタ ---
	var master = getOrCreateSheet(ss, SHEET_MASTER);
	if (master.getLastRow() === 0) {
		master
			.getRange(1, 1, 6, 5)
			.setValues([
				["店舗コード", "店舗名", "ブランド", "初期パスワード", "QSC詳細URL"],
				["101", "福島栄町店", "鶏ヤロー", "", ""],
				["102", "郡山駅前店", "鶏ヤロー", "", ""],
				["103", "大宮一番街店", "まる助", "", ""],
				["104", "川越クレアモール店", "イザカラ", "", ""],
				["105", "上野御徒町店", "すし鳥酒場", "", ""],
			]);
		master.getRange("A1:E1").setFontWeight("bold").setBackground("#f6e4dc");
		master.getRange("A:A").setNumberFormat("@"); // 店舗コードは文字列扱い
		master.setColumnWidth(2, 160);
		master.setFrozenRows(1);
	}
	// 旧バージョンで作成したシートに不足列を追加
	if (String(master.getRange("D1").getValue()).trim() === "") {
		master.getRange("D1").setValue("初期パスワード").setFontWeight("bold").setBackground("#f6e4dc");
	}
	if (String(master.getRange("E1").getValue()).trim() === "") {
		master.getRange("E1").setValue("QSC詳細URL").setFontWeight("bold").setBackground("#f6e4dc");
		master
			.getRange("E1")
			.setNote(
				"andy のこの店舗のアンケート詳細ページ URL(任意)。\n" +
					"入力して⑤を実行すると、ダッシュボードの QSC カードをタップしたときにこのページが開きます。\n" +
					"空欄の店舗はアンケート一覧ページが開きます。",
			);
	}
	master
		.getRange("A1")
		.setNote(
			"メニュー「⑤ 店舗をアプリに登録」でこの一覧がそのままアプリに登録されます。\n" +
				"新しい店舗は「初期パスワード」を入れてから⑤を実行してください(登録後は空欄に戻してOK)。\n" +
				"既存店舗のパスワードを変えたいときも、入力して⑤を実行すれば更新されます。",
		);

	// --- 指標ごとの入力シート ---
	var created = [];
	METRIC_SHEETS.forEach(function (m) {
		var sheet = ss.getSheetByName(m.name);
		if (!sheet) {
			sheet = ss.insertSheet(m.name);
			created.push(m.name);
		}
		if (sheet.getLastRow() === 0) {
			sheet.getRange(1, 1, 1, 3).setValues([["店舗コード", "店舗名", m.header]]);
			sheet.getRange("A1:C1").setFontWeight("bold").setBackground("#f6e4dc");
			// 店舗コード・店舗名は店舗マスタから自動反映
			sheet
				.getRange("A2")
				.setFormula(
					"=ARRAYFORMULA(IF('" + SHEET_MASTER + "'!A2:A200=\"\",\"\",'" + SHEET_MASTER + "'!A2:A200))",
				);
			sheet
				.getRange("B2")
				.setFormula(
					"=ARRAYFORMULA(IF('" + SHEET_MASTER + "'!A2:A200=\"\",\"\",'" + SHEET_MASTER + "'!B2:B200))",
				);
			sheet.setColumnWidth(2, 180);
			sheet.setFrozenRows(1);
			sheet
				.getRange("C1")
				.setNote(
					"C 列だけ入力してください。店舗コード・店舗名は店舗マスタから自動反映されます。" +
						(m.percent ? "\n28.7 のように % の数値で入力(0.287 でも自動判別)" : ""),
				);
		}
	});

	// --- 人件費予算(表示用シート) ---
	var laborBudget = getOrCreateSheet(ss, "人件費予算");
	if (laborBudget.getLastRow() === 0) {
		laborBudget
			.getRange(1, 1, 1, 7)
			.setValues([
				[
					"店舗コード",
					"店舗名",
					"過不足額(円)",
					"過不足時間(h)",
					"人件費予算(円)",
					"現在の人件費(円)",
					"売上実績(円)",
				],
			]);
		laborBudget.getRange("A1:G1").setFontWeight("bold").setBackground("#f6e4dc");
		laborBudget.getRange("A:A").setNumberFormat("@");
		laborBudget
			.getRange("A2")
			.setFormula(
				"=ARRAYFORMULA(IF('" + SHEET_MASTER + "'!A2:A200=\"\",\"\",'" + SHEET_MASTER + "'!A2:A200))",
			);
		laborBudget
			.getRange("B2")
			.setFormula(
				"=ARRAYFORMULA(IF('" + SHEET_MASTER + "'!A2:A200=\"\",\"\",'" + SHEET_MASTER + "'!B2:B200))",
			);
		laborBudget.setColumnWidth(2, 180);
		laborBudget.setFrozenRows(1);
		laborBudget
			.getRange("C1")
			.setNote(
				"別のシートで計算した値を、数式(IMPORTRANGE 等)や貼り付けで入れてください。\n" +
					"C列: プラス = 予算オーバー / マイナス = 予算内(余裕)。\n" +
					"C列が空欄の店舗はダッシュボードにバナーが表示されません。\n" +
					"E〜G列は任意(入れるとバナーの内訳に表示されます)。",
			);
	}

	// --- 旧「データ入力」シートからの移行 ---
	var migrated = migrateLegacyInput(ss, created);

	// --- ダッシュボード連携(出力先) ---
	var output = getOrCreateSheet(ss, SHEET_OUTPUT);
	if (output.getLastRow() === 0) {
		output.getRange(1, 1, 1, OUTPUT_HEADERS.length).setValues([OUTPUT_HEADERS]);
		output
			.getRange(1, 1, 1, OUTPUT_HEADERS.length)
			.setFontWeight("bold")
			.setBackground("#f6e4dc");
		output.getRange("A:A").setNumberFormat("@");
		output.setFrozenRows(1);
		output
			.getRange("A1")
			.setNote("このシートは「今すぐ同期」実行時に自動生成されます。手で編集しないでください");
	}

	var msg = "シートを準備しました。";
	if (migrated > 0) {
		msg += "旧「データ入力」から " + migrated + " 店舗分の値を移行しました(旧シートは削除して構いません)。";
	}
	SpreadsheetApp.getActiveSpreadsheet().toast(msg, "初期セットアップ完了", 8);
}

/** 旧「データ入力」シート(店舗コード/店舗名/KPI/原価率/人件費率/QSC/日次/週次)から値を移行 */
function migrateLegacyInput(ss, createdSheets) {
	var legacy = ss.getSheetByName(SHEET_INPUT_LEGACY);
	if (!legacy || legacy.getLastRow() < 2 || createdSheets.length === 0) return 0;

	SpreadsheetApp.flush(); // ARRAYFORMULA を評価させてから行位置を特定する

	var values = legacy.getRange(2, 1, legacy.getLastRow() - 1, 6).getValues();
	var legacyByCode = {};
	values.forEach(function (row) {
		var code = String(row[0]).trim();
		if (!code) return;
		legacyByCode[code] = { kpi: row[2], cost: row[3], labor: row[4], qsc: row[5] };
	});

	var migrated = 0;
	METRIC_SHEETS.forEach(function (m) {
		if (createdSheets.indexOf(m.name) < 0) return; // 新規作成したシートにだけ移行
		var sheet = ss.getSheetByName(m.name);
		var lastRow = sheet.getLastRow();
		if (lastRow < 2) return;
		var codes = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
		codes.forEach(function (row, i) {
			var code = String(row[0]).trim();
			var legacyRow = legacyByCode[code];
			if (!code || !legacyRow) return;
			var v = legacyRow[m.key];
			if (v !== "" && v !== null && v !== undefined) {
				sheet.getRange(i + 2, 3).setValue(v);
				if (m.key === "kpi") migrated++;
			}
		});
	});

	legacy.setName(SHEET_INPUT_LEGACY + "(旧・削除可)");
	return migrated;
}

function getOrCreateSheet(ss, name) {
	return ss.getSheetByName(name) || ss.insertSheet(name);
}

/** 設定シートに指定の行が無ければ末尾に追加する */
function ensureSettingRow(settings, key, defaultValue, note) {
	var lastRow = Math.max(settings.getLastRow(), 1);
	var keys = settings
		.getRange(1, 1, lastRow, 1)
		.getValues()
		.map(function (r) {
			return String(r[0]).trim();
		});
	if (keys.indexOf(key) >= 0) return;
	settings.getRange(lastRow + 1, 1, 1, 2).setValues([[key, defaultValue]]);
	if (note) settings.getRange(lastRow + 1, 2).setNote(note);
}

/* ===================== ② API シークレット ===================== */

function setApiSecret() {
	var ui = SpreadsheetApp.getUi();
	var res = ui.prompt(
		"API シークレットの設定",
		"アプリ側の環境変数 GAS_SYNC_SECRET と同じ値を入力してください。",
		ui.ButtonSet.OK_CANCEL,
	);
	if (res.getSelectedButton() !== ui.Button.OK) return;
	var value = res.getResponseText().trim();
	if (!value) {
		ui.alert("空のため設定しませんでした。");
		return;
	}
	PropertiesService.getScriptProperties().setProperty("GAS_SYNC_SECRET", value);
	ui.alert("シークレットを保存しました。");
}

/* ===================== ⑥ 元シートからの自動取り込み ===================== */
//
// 「設定」シートに PL シート / QSC シートの URL とタブ名を入れておくと、
// 同期のたびに元シートから数値を自動で取り込んで各指標シートに書き込む。
// 店舗名は表記ゆれ(ブランド名の接頭辞付きなど)を吸収して自動マッチングする。
// PL シート: 列見出し「KPI点数」「材料費率」「人件費率」を自動検出(材料費率=原価率)
// QSC シート: 列見出し「店舗名」「総合点」を自動検出

function readSourceConfig(ss) {
	var sheet = ss.getSheetByName(SHEET_SETTINGS);
	if (!sheet) return { plUrl: "", plTab: "", qscUrl: "", qscTab: "" };
	var values = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues();
	var map = {};
	values.forEach(function (row) {
		map[String(row[0]).trim()] = String(row[1]).trim();
	});
	return {
		plUrl: map["PLシートのURL"] || "",
		plTab: map["PLシートのタブ名"] || "",
		qscUrl: map["QSCシートのURL"] || "",
		qscTab: map["QSCシートのタブ名"] || "",
	};
}

function importFromSourcesMenu() {
	var summary = importFromSources();
	SpreadsheetApp.getUi().alert("取り込み結果", summary, SpreadsheetApp.getUi().ButtonSet.OK);
}

/** 元シートから取り込み、結果サマリー文字列を返す(トリガーからも呼べるよう UI は使わない) */
function importFromSources() {
	var ss = SpreadsheetApp.getActiveSpreadsheet();
	var cfg = readSourceConfig(ss);
	if (!cfg.plUrl && !cfg.qscUrl) {
		throw new Error(
			"「設定」シートの「PLシートのURL」「QSCシートのURL」を入力してください(タブ名も)",
		);
	}
	var master = ss.getSheetByName(SHEET_MASTER);
	if (!master || master.getLastRow() < 2) {
		throw new Error("「" + SHEET_MASTER + "」に店舗を入力してください");
	}
	var masterNames = master
		.getRange(2, 2, master.getLastRow() - 1, 1)
		.getValues()
		.map(function (r) {
			return String(r[0]).trim();
		});

	var lines = [];
	var allUnmatched = [];

	if (cfg.plUrl) {
		var pl = openSourceSheet(cfg.plUrl, cfg.plTab, "PLシート");
		var values = pl.getDataRange().getValues();
		var kpiCol = findHeaderColumn(values, "KPI点数");
		var costCol = findHeaderColumn(values, "材料費率");
		var laborCol = findHeaderColumn(values, "人件費率");
		if (kpiCol < 0 || costCol < 0 || laborCol < 0) {
			throw new Error(
				"PLシートで列見出しが見つかりません(KPI点数: " +
					(kpiCol >= 0) + " / 材料費率: " + (costCol >= 0) + " / 人件費率: " + (laborCol >= 0) + ")",
			);
		}
		var plRows = {};
		values.forEach(function (row) {
			var name = String(row[0]).trim();
			if (!name) return;
			var kpi = toNumber(row[kpiCol]);
			var cost = toPercent(row[costCol]);
			var labor = toPercent(row[laborCol]);
			if (kpi === null && cost === null && labor === null) return; // 見出し行・空行
			plRows[name] = { kpi: kpi, cost: cost, labor: labor };
		});
		var plMatch = matchSourceNames(masterNames, Object.keys(plRows));
		writeMetricColumn(ss, "KPI", masterNames, plMatch, plRows, "kpi");
		writeMetricColumn(ss, "原価率", masterNames, plMatch, plRows, "cost");
		writeMetricColumn(ss, "人件費率", masterNames, plMatch, plRows, "labor");
		var plMatched = masterNames.filter(function (n) {
			return plMatch[n];
		}).length;
		lines.push("PLシート: " + plMatched + " / " + masterNames.length + " 店舗を取り込み");
		masterNames.forEach(function (n) {
			if (!plMatch[n]) allUnmatched.push(n + "(PL)");
		});
	}

	if (cfg.qscUrl) {
		var qsc = openSourceSheet(cfg.qscUrl, cfg.qscTab, "QSCシート");
		var qValues = qsc.getDataRange().getValues();
		var nameCol = findHeaderColumn(qValues, "店舗名");
		var scoreCol = findHeaderColumn(qValues, "総合点");
		if (nameCol < 0 || scoreCol < 0) {
			throw new Error("QSCシートで列見出し(店舗名 / 総合点)が見つかりません");
		}
		var ansCol = findHeaderColumn(qValues, "回答数");
		var qCols = findQuestionColumns(qValues);
		var qscRows = {};
		qValues.forEach(function (row) {
			var name = String(row[nameCol]).trim();
			if (!name || name === "店舗名") return;
			var score = toNumber(row[scoreCol]);
			if (score === null) return; // 「-」(回答なし)は取り込まない
			qscRows[name] = {
				qsc: score,
				answers: ansCol >= 0 ? toNumber(row[ansCol]) : null,
				q: qCols.map(function (c) {
					return toNumber(row[c.col]);
				}),
			};
		});
		var qscMatch = matchSourceNames(masterNames, Object.keys(qscRows));
		writeMetricColumn(ss, "QSCアンケート", masterNames, qscMatch, qscRows, "qsc");
		writeQscDetailColumns(ss, masterNames, qscMatch, qscRows, qCols);
		var qscMatched = masterNames.filter(function (n) {
			return qscMatch[n];
		}).length;
		lines.push("QSCシート: " + qscMatched + " / " + masterNames.length + " 店舗を取り込み(回答なしの店舗は空欄)");
	}

	if (allUnmatched.length > 0) {
		lines.push(
			"店舗名が一致しなかった店舗: " +
				allUnmatched.join(", ") +
				"\n(店舗マスタの店舗名が元シートの店舗名の末尾と一致するようにしてください)",
		);
	}
	return lines.join("\n");
}

function openSourceSheet(url, tab, label) {
	var source;
	try {
		source = SpreadsheetApp.openByUrl(url);
	} catch (e) {
		throw new Error(label + "の URL を開けません。URL とアクセス権を確認してください: " + e.message);
	}
	if (!tab) {
		return source.getSheets()[0];
	}
	var sheet = source.getSheetByName(tab);
	if (!sheet) {
		throw new Error(
			label + "にタブ「" + tab + "」がありません。タブ名: " +
				source.getSheets().map(function (s) { return s.getName(); }).join(" / "),
		);
	}
	return sheet;
}

/** シート全体から指定の見出しセルを探して列番号(0始まり)を返す */
function findHeaderColumn(values, header) {
	for (var r = 0; r < Math.min(values.length, 100); r++) {
		for (var c = 0; c < values[r].length; c++) {
			if (String(values[r][c]).trim() === header) return c;
		}
	}
	return -1;
}

/** 見出し行から「Q1.」「Q2.」… の設問列(点数列)を探す */
function findQuestionColumns(values) {
	var found = {};
	for (var r = 0; r < Math.min(values.length, 10); r++) {
		for (var c = 0; c < values[r].length; c++) {
			var cell = String(values[r][c]).trim();
			var match = cell.match(/^Q(\d+)[.\s]/);
			if (match && !found[match[1]]) {
				found[match[1]] = { no: Number(match[1]), col: c, label: cell };
			}
		}
	}
	return Object.keys(found)
		.map(function (k) {
			return found[k];
		})
		.sort(function (a, b) {
			return a.no - b.no;
		});
}

/** QSCアンケートシートの D 列以降に回答数・設問別点数を書き込む */
function writeQscDetailColumns(ss, masterNames, match, rows, qCols) {
	var sheet = ss.getSheetByName("QSCアンケート");
	if (!sheet) return;
	var headers = ["回答数"].concat(
		qCols.map(function (c) {
			return c.label;
		}),
	);
	sheet
		.getRange(1, 4, 1, headers.length)
		.setValues([headers])
		.setFontWeight("bold")
		.setBackground("#f6e4dc");
	var data = masterNames.map(function (m) {
		var src = match[m];
		var r = src ? rows[src] : null;
		if (!r) {
			return headers.map(function () {
				return "";
			});
		}
		return [r.answers === null ? "" : r.answers].concat(
			r.q.map(function (v) {
				return v === null ? "" : v;
			}),
		);
	});
	if (data.length > 0) {
		sheet.getRange(2, 4, data.length, headers.length).setValues(data);
	}
}

/**
 * 「人件費予算」シート(表示用)から店舗コード → 過不足の値を読む。
 * C: 過不足額(円・必須。プラス=オーバー) / D: 過不足時間 /
 * E: 人件費予算 / F: 現在の人件費 / G: 売上実績(E〜G は任意)
 */
function readLaborBudgetSheet(ss) {
	var sheet = ss.getSheetByName("人件費予算");
	var map = {};
	if (!sheet || sheet.getLastRow() < 2) return map;
	sheet
		.getRange(2, 1, sheet.getLastRow() - 1, 7)
		.getValues()
		.forEach(function (row) {
			var code = String(row[0]).trim();
			var diff = toNumber(row[2]);
			if (!code || diff === null) return; // 過不足額が空欄の店舗は対象外
			map[code] = {
				diff: diff,
				diffHours: toNumber(row[3]),
				budget: toNumber(row[4]),
				laborCost: toNumber(row[5]),
				sales: toNumber(row[6]),
			};
		});
	return map;
}

/** QSCアンケートシートの D 列以降から、店舗コード → 回答数・設問別点数 を読む */
function readQscDetail(ss) {
	var sheet = ss.getSheetByName("QSCアンケート");
	var map = {};
	if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 4) return map;
	var lastCol = sheet.getLastColumn();
	var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
	if (String(header[3]).trim() !== "回答数") return map;
	sheet
		.getRange(2, 1, sheet.getLastRow() - 1, lastCol)
		.getValues()
		.forEach(function (row) {
			var code = String(row[0]).trim();
			if (!code) return;
			var questions = [];
			for (var c = 4; c < lastCol; c++) {
				var label = String(header[c]).trim();
				if (!label) continue;
				questions.push({ label: label, score: toNumber(row[c]) });
			}
			var answers = toNumber(row[3]);
			if (answers !== null || questions.length > 0) {
				map[code] = { answers: answers, questions: questions };
			}
		});
	return map;
}

/** 店舗名の表記ゆれを吸収した正規化 */
function normName(s) {
	return String(s)
		.normalize("NFKC")
		.replace(/\s+/g, "")
		.replace(/[!!]/g, "")
		.trim();
}

/**
 * 店舗マスタの店舗名 → 元シートの店舗名 の対応表を作る。
 * 1パス目: 完全一致、または末尾一致の候補が 1 つだけの店舗を確定。
 * 2パス目: 候補が複数あった店舗は、他の店舗に取られていない候補が 1 つなら確定。
 * (例: マスタ「柏店」の候補が「鶏ヤロー柏店」「魚と鶏ヤロー柏店」の 2 つでも、
 *  後者がマスタ「魚と鶏ヤロー柏店」に確定済みなら前者に決まる)
 */
function matchSourceNames(masterNames, sourceNames) {
	var result = {};
	var claimed = {};
	var candidatesByMaster = {};

	masterNames.forEach(function (m) {
		var target = normName(m);
		if (!target) return;
		var exact = sourceNames.filter(function (s) {
			return normName(s) === target;
		});
		if (exact.length === 1) {
			result[m] = exact[0];
			claimed[exact[0]] = true;
			return;
		}
		var suffix = sourceNames.filter(function (s) {
			return normName(s).slice(-target.length) === target;
		});
		if (suffix.length === 1) {
			result[m] = suffix[0];
			claimed[suffix[0]] = true;
		} else if (suffix.length > 1) {
			candidatesByMaster[m] = suffix;
		}
	});

	Object.keys(candidatesByMaster).forEach(function (m) {
		var rest = candidatesByMaster[m].filter(function (s) {
			return !claimed[s];
		});
		if (rest.length === 1) {
			result[m] = rest[0];
			claimed[rest[0]] = true;
		}
	});

	return result;
}

/** 指標シートの C 列を、店舗マスタの並び順で書き込む(未一致は空欄) */
function writeMetricColumn(ss, sheetName, masterNames, match, sourceRows, key) {
	var sheet = ss.getSheetByName(sheetName);
	if (!sheet) {
		throw new Error("「" + sheetName + "」シートがありません。①初期セットアップを実行してください");
	}
	var column = masterNames.map(function (m) {
		var src = match[m];
		var v = src && sourceRows[src] ? sourceRows[src][key] : null;
		return [v === null || v === undefined ? "" : v];
	});
	if (column.length > 0) {
		sheet.getRange(2, 3, column.length, 1).setValues(column);
	}
}

/* ===================== ③ 同期 ===================== */

function syncToDashboard() {
	var ss = SpreadsheetApp.getActiveSpreadsheet();
	var settings = readSettings(ss);
	var secret = PropertiesService.getScriptProperties().getProperty("GAS_SYNC_SECRET");
	if (!secret) {
		throw new Error("メニュー「② API シークレットを設定」を先に実行してください");
	}

	// 元シートが設定されていれば、最新の数値を先に取り込む
	var cfg = readSourceConfig(ss);
	var importSummary = "";
	if (cfg.plUrl || cfg.qscUrl) {
		importSummary = importFromSources();
		SpreadsheetApp.flush();
	}

	var computed = computeStores(ss, settings);
	var stores = computed.stores;
	if (stores.length === 0) {
		throw new Error(
			"同期できる店舗がありません。「KPI」「原価率」「人件費率」の各シートに数値を入力してください" +
				(computed.incomplete.length > 0
					? "(入力が足りない店舗: " + computed.incomplete.join(", ") + ")"
					: ""),
		);
	}

	writeOutputSheet(ss, stores);

	var payload = {
		date: Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd"),
		total_stores: stores.length,
		stores: stores.map(function (s) {
			var row = {
				code: s.code,
				kpi_score: s.kpi,
				kpi_avg: s.kpiAvg,
				kpi_rank: s.kpiRank,
				overall_rank: s.overallRank,
				cost_rate: s.cost,
				cost_rate_rank: s.costRank,
				cost_rate_target: settings.costTarget,
				cost_rate_avg: s.costAvg,
				labor_rate: s.labor,
				labor_rate_rank: s.laborRank,
				labor_rate_target: settings.laborTarget,
				labor_rate_avg: s.laborAvg,
			};
			// 人件費予算(「人件費予算」シートの値をそのまま表示)
			if (s.laborBudget) {
				row.labor_budget = {
					diff: s.laborBudget.diff,
					diff_hours: s.laborBudget.diffHours,
					budget: s.laborBudget.budget,
					labor_cost: s.laborBudget.laborCost,
					sales: s.laborBudget.sales,
				};
			}
			if (s.qsc !== null) {
				row.qsc_score = s.qsc;
				row.qsc_rank = s.qscRank;
				if (s.qscPrevRank !== null) row.qsc_prev_rank = s.qscPrevRank;
				if (s.qscDetail) {
					if (s.qscDetail.answers !== null) row.qsc_answers = s.qscDetail.answers;
					if (s.qscDetail.questions.length > 0) row.qsc_questions = s.qscDetail.questions;
				}
			}
			return row;
		}),
	};

	var res = UrlFetchApp.fetch(settings.endpoint, {
		method: "post",
		contentType: "application/json",
		headers: { "x-api-key": secret },
		payload: JSON.stringify(payload),
		muteHttpExceptions: true,
	});

	var status = res.getResponseCode();
	Logger.log("HTTP " + status + ": " + res.getContentText());
	if (status !== 200) {
		throw new Error("同期に失敗しました: HTTP " + status + " " + res.getContentText());
	}

	var body = JSON.parse(res.getContentText());
	var msg = stores.length + " 店舗を同期しました";
	if (computed.incomplete.length > 0) {
		msg += "(入力不足でスキップ: " + computed.incomplete.join(", ") + ")";
	}
	if (body.unknownCodes && body.unknownCodes.length > 0) {
		msg += "(アプリ未登録の店舗コード: " + body.unknownCodes.join(", ") + ")";
	}
	ss.toast(msg, "同期完了", 10);
}

function readSettings(ss) {
	var sheet = ss.getSheetByName(SHEET_SETTINGS);
	if (!sheet) {
		throw new Error("メニュー「① 初期セットアップ」を先に実行してください");
	}
	var values = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues();
	var map = {};
	values.forEach(function (row) {
		map[String(row[0]).trim()] = row[1];
	});
	var endpoint = String(map["エンドポイントURL"] || "").trim();
	if (!endpoint || endpoint.indexOf("your-app.example.com") >= 0) {
		throw new Error("「設定」シートのエンドポイントURLをデプロイ先の URL に変更してください");
	}
	return {
		endpoint: endpoint,
		costTarget: toNumber(map["原価率目標(%)"]),
		laborTarget: toNumber(map["人件費率目標(%)"]),
		syncHour: toNumber(map["同期時刻(0〜23時)"]),
	};
}

/** 指標シート(A: 店舗コード, C: 値)を code → 値 のマップとして読む */
function readMetricSheet(ss, name) {
	var sheet = ss.getSheetByName(name);
	var map = {};
	if (!sheet || sheet.getLastRow() < 2) return map;
	sheet
		.getRange(2, 1, sheet.getLastRow() - 1, 3)
		.getValues()
		.forEach(function (row) {
			var code = String(row[0]).trim();
			if (code) map[code] = row[2];
		});
	return map;
}

function computeStores(ss, settings) {
	var master = ss.getSheetByName(SHEET_MASTER);
	if (!master) {
		throw new Error("メニュー「① 初期セットアップ」を先に実行してください");
	}

	var kpiMap = readMetricSheet(ss, "KPI");
	var costMap = readMetricSheet(ss, "原価率");
	var laborMap = readMetricSheet(ss, "人件費率");
	var qscMap = readMetricSheet(ss, "QSCアンケート");
	var qscDetailMap = readQscDetail(ss);
	var laborBudgetMap = readLaborBudgetSheet(ss);

	// 前回の QSC 順位(出力シートから引き継ぎ)
	var qscPrevByCode = readPreviousQscRanks(ss);

	var stores = [];
	var incomplete = [];
	master
		.getRange(2, 1, Math.max(master.getLastRow() - 1, 1), 2)
		.getValues()
		.forEach(function (row) {
			var code = String(row[0]).trim();
			var name = String(row[1]).trim();
			if (!code || !name) return;

			var kpi = toNumber(kpiMap[code]);
			var cost = toPercent(costMap[code]);
			var labor = toPercent(laborMap[code]);
			var qsc = toNumber(qscMap[code]);

			// 全て未入力の店舗は対象外(新店など)
			if (kpi === null && cost === null && labor === null && qsc === null) return;
			// KPI・原価率・人件費率は必須(どれか欠けたら今回はスキップ)
			if (kpi === null || cost === null || labor === null) {
				incomplete.push(name);
				return;
			}

			stores.push({
				code: code,
				name: name,
				kpi: kpi,
				cost: cost,
				labor: labor,
				qsc: qsc,
				qscPrevRank: qscPrevByCode[code] !== undefined ? qscPrevByCode[code] : null,
				qscDetail: qscDetailMap[code] || null,
				laborBudget: laborBudgetMap[code] || null,
			});
		});
	if (stores.length === 0) return { stores: stores, incomplete: incomplete };

	// 順位(同値は同順位)と全店平均
	assignRanks(stores, "kpi", "kpiRank", false);
	assignRanks(stores, "cost", "costRank", true);
	assignRanks(stores, "labor", "laborRank", true);
	assignRanks(stores, "qsc", "qscRank", false);

	var kpiAvg = average(stores, "kpi");
	var costAvg = average(stores, "cost");
	var laborAvg = average(stores, "labor");
	stores.forEach(function (s) {
		s.kpiAvg = kpiAvg;
		s.costAvg = costAvg;
		s.laborAvg = laborAvg;
	});

	// 総合順位 = 4 指標の順位の平均が小さい順(同率は KPI 点数の高い方が上位)
	stores.forEach(function (s) {
		var ranks = [s.kpiRank, s.costRank, s.laborRank, s.qscRank].filter(function (r) {
			return r !== null;
		});
		s._rankScore =
			ranks.length > 0
				? ranks.reduce(function (a, b) {
						return a + b;
					}, 0) / ranks.length
				: Number.MAX_VALUE;
	});
	var sorted = stores.slice().sort(function (a, b) {
		return a._rankScore - b._rankScore || b.kpi - a.kpi;
	});
	sorted.forEach(function (s, i) {
		s.overallRank =
			i > 0 && s._rankScore === sorted[i - 1]._rankScore && s.kpi === sorted[i - 1].kpi
				? sorted[i - 1].overallRank
				: i + 1;
	});

	return { stores: stores, incomplete: incomplete };
}

function readPreviousQscRanks(ss) {
	var output = ss.getSheetByName(SHEET_OUTPUT);
	var map = {};
	if (!output || output.getLastRow() < 2) return map;
	var lastCol = output.getLastColumn();
	var header = output.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
	var codeCol = header.indexOf("店舗コード");
	var qscRankCol = header.indexOf("QSC順位");
	if (codeCol < 0 || qscRankCol < 0) return map;
	output
		.getRange(2, 1, output.getLastRow() - 1, lastCol)
		.getValues()
		.forEach(function (row) {
			var code = String(row[codeCol]).trim();
			var rank = toNumber(row[qscRankCol]);
			if (code && rank !== null) map[code] = rank;
		});
	return map;
}

function writeOutputSheet(ss, stores) {
	var output = getOrCreateSheet(ss, SHEET_OUTPUT);
	var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm");
	var rows = stores
		.slice()
		.sort(function (a, b) {
			return a.overallRank - b.overallRank;
		})
		.map(function (s) {
			return [
				s.code,
				s.name,
				s.kpi,
				s.kpiRank,
				s.overallRank,
				s.cost,
				s.costRank,
				s.labor,
				s.laborRank,
				s.qsc === null ? "" : s.qsc,
				s.qscRank === null ? "" : s.qscRank,
				s.qscPrevRank === null ? "" : s.qscPrevRank,
				now,
			];
		});
	output.clearContents();
	output.getRange(1, 1, 1, OUTPUT_HEADERS.length).setValues([OUTPUT_HEADERS]);
	output.getRange(1, 1, 1, OUTPUT_HEADERS.length).setFontWeight("bold").setBackground("#f6e4dc");
	output.getRange("A:A").setNumberFormat("@");
	output.getRange(2, 1, rows.length, OUTPUT_HEADERS.length).setValues(rows);
}

/* ===================== ⑤ 店舗をアプリに登録 ===================== */

function registerStores() {
	var ss = SpreadsheetApp.getActiveSpreadsheet();
	var settings = readSettings(ss);
	var secret = PropertiesService.getScriptProperties().getProperty("GAS_SYNC_SECRET");
	if (!secret) {
		throw new Error("メニュー「② API シークレットを設定」を先に実行してください");
	}
	var master = ss.getSheetByName(SHEET_MASTER);
	if (!master || master.getLastRow() < 2) {
		throw new Error("「" + SHEET_MASTER + "」に店舗を入力してください");
	}

	var stores = [];
	master
		.getRange(2, 1, master.getLastRow() - 1, 5)
		.getValues()
		.forEach(function (row) {
			var code = String(row[0]).trim();
			var name = String(row[1]).trim();
			if (!code || !name) return;
			var store = { code: code, name: name };
			var brand = String(row[2]).trim();
			if (brand) store.brand = brand;
			var password = String(row[3]).trim();
			if (password) store.password = password;
			var qscUrl = String(row[4]).trim();
			if (qscUrl) store.qsc_url = qscUrl;
			stores.push(store);
		});
	if (stores.length === 0) {
		throw new Error("登録できる店舗がありません(店舗コードと店舗名は必須です)");
	}

	var endpoint = settings.endpoint.replace(/\/kpi\/?\s*$/, "/stores");
	var res = UrlFetchApp.fetch(endpoint, {
		method: "post",
		contentType: "application/json",
		headers: { "x-api-key": secret },
		payload: JSON.stringify({ stores: stores }),
		muteHttpExceptions: true,
	});

	var status = res.getResponseCode();
	Logger.log("HTTP " + status + ": " + res.getContentText());
	if (status !== 200) {
		throw new Error("店舗登録に失敗しました: HTTP " + status + " " + res.getContentText());
	}

	var body = JSON.parse(res.getContentText());
	var msg = "新規登録 " + body.created + " 店舗 / 更新 " + body.updated + " 店舗";
	if (body.skippedNoPassword && body.skippedNoPassword.length > 0) {
		msg +=
			"\n\n次の店舗は「初期パスワード」が未入力のため登録できませんでした:\n" +
			body.skippedNoPassword.join(", ") +
			"\n店舗マスタの D 列にパスワードを入力して、もう一度⑤を実行してください。";
	}
	msg += "\n\n登録が済んだ店舗の「初期パスワード」欄は空欄に戻して構いません。";
	SpreadsheetApp.getUi().alert("店舗登録の結果", msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

/* ===================== ④ 自動同期トリガー ===================== */

function setupDailyTrigger() {
	var settings = readSettings(SpreadsheetApp.getActiveSpreadsheet());
	var hour = settings.syncHour !== null && settings.syncHour >= 0 && settings.syncHour <= 23
		? Math.floor(settings.syncHour)
		: 22;
	ScriptApp.getProjectTriggers().forEach(function (t) {
		if (t.getHandlerFunction() === "syncToDashboard") ScriptApp.deleteTrigger(t);
	});
	ScriptApp.newTrigger("syncToDashboard").timeBased().everyDays(1).atHour(hour).create();
	SpreadsheetApp.getActiveSpreadsheet().toast(
		"毎日 " + hour + " 時ごろに自動同期します。",
		"自動同期を設定しました",
		8,
	);
}

/* ===================== ヘルパー ===================== */

function toNumber(v) {
	if (v === "" || v === null || v === undefined) return null;
	var n = Number(v);
	return isNaN(n) ? null : n;
}

/** % 値。セルが % 表示(0.287)でも 28.7 でも受け付ける */
function toPercent(v) {
	var n = toNumber(v);
	if (n === null) return null;
	return n > 0 && n < 1 ? Math.round(n * 1000) / 10 : n;
}

function average(stores, key) {
	var vals = stores
		.map(function (s) {
			return s[key];
		})
		.filter(function (v) {
			return v !== null;
		});
	if (vals.length === 0) return null;
	var sum = vals.reduce(function (a, b) {
		return a + b;
	}, 0);
	return Math.round((sum / vals.length) * 10) / 10;
}

/** 順位を付与(同値は同順位)。ascending=true は小さいほど上位 */
function assignRanks(stores, key, rankKey, ascending) {
	var ranked = stores.filter(function (s) {
		return s[key] !== null;
	});
	ranked.sort(function (a, b) {
		return ascending ? a[key] - b[key] : b[key] - a[key];
	});
	ranked.forEach(function (s, i) {
		s[rankKey] = i > 0 && s[key] === ranked[i - 1][key] ? ranked[i - 1][rankKey] : i + 1;
	});
	stores.forEach(function (s) {
		if (s[key] === null) s[rankKey] = null;
	});
}
