/**
 * 店長ダッシュボード連携 Google Apps Script
 *
 * このファイル 1 つをスプレッドシートに貼るだけで、
 * 必要なシートの自動生成・順位/平均の自動計算・ダッシュボードへの同期がすべて行えます。
 *
 * ■ セットアップ手順
 * 1. スプレッドシートの「拡張機能 > Apps Script」を開き、このファイルの内容を貼り付けて保存
 * 2. スプレッドシートを再読み込みすると「ダッシュボード連携」メニューが表示される
 * 3. メニュー「① 初期セットアップ」→ シート(店舗マスタ/データ入力/設定/ダッシュボード連携)が生成される
 * 4. 「設定」シートにエンドポイント URL を入力、「店舗マスタ」を実店舗に書き換える
 * 5. メニュー「② API シークレットを設定」→ アプリ側の GAS_SYNC_SECRET と同じ値を入力
 * 6. 「データ入力」に各店舗の数値を入れて、メニュー「③ 今すぐ同期」で動作確認
 * 7. メニュー「④ 毎日の自動同期を設定」で毎日自動送信(時刻は「設定」シートで変更可)
 *
 * ■ 各シートの役割
 * - 店舗マスタ:       店舗コードと店舗名(アプリ側の店舗コードと一致させる)
 * - データ入力:       毎日更新する数値(KPI点数・原価率・人件費率・QSC点数・衛生チェック提出枚数)
 * - 設定:             エンドポイント URL・目標値・同期時刻
 * - ダッシュボード連携: 同期時に自動生成される計算結果(順位・平均)。手で編集しない
 *
 * 順位・全店平均は同期のたびに GAS が自動計算します:
 * - KPI順位:   KPI点数の高い順
 * - 原価率順位: 原価率の低い順 / 人件費率順位: 人件費率の低い順 / QSC順位: QSC点数の高い順
 * - 総合順位:   上記 4 つの順位の平均が小さい順(同率は KPI点数の高い方が上位)
 * - QSC前回順位: 前回同期時の QSC順位を自動で引き継ぎ
 */

var SHEET_MASTER = "店舗マスタ";
var SHEET_INPUT = "データ入力";
var SHEET_OUTPUT = "ダッシュボード連携";
var SHEET_SETTINGS = "設定";

var INPUT_HEADERS = [
	"店舗コード",
	"店舗名(自動)",
	"KPI点数",
	"原価率(%)",
	"人件費率(%)",
	"QSC点数",
	"日次提出(枚)",
	"週次提出(枚)",
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
	"日次提出",
	"週次提出",
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
		settings.getRange("A1:B1").setFontWeight("bold").setBackground("#f4e8dd");
		settings.setColumnWidth(1, 180);
		settings.setColumnWidth(2, 360);
		settings
			.getRange("B2")
			.setNote("デプロイした店長ダッシュボードの URL + /api/gas/kpi を入力してください");
	}

	// --- 店舗マスタ ---
	var master = getOrCreateSheet(ss, SHEET_MASTER);
	if (master.getLastRow() === 0) {
		master
			.getRange(1, 1, 4, 3)
			.setValues([
				["店舗コード", "店舗名", "ブランド"],
				["101", "福島栄町店", "鶏ヤロー・まる助"],
				["102", "郡山駅前店", "鶏ヤロー"],
				["103", "いわき平店", "鶏ヤロー"],
			]);
		master.getRange("A1:C1").setFontWeight("bold").setBackground("#f4e8dd");
		master.getRange("A:A").setNumberFormat("@"); // 店舗コードは文字列扱い
		master.setColumnWidth(2, 160);
		master
			.getRange("A1")
			.setNote("アプリ(Firestore の stores)に登録した店舗コードと一致させてください");
		master.setFrozenRows(1);
	}

	// --- データ入力 ---
	var input = getOrCreateSheet(ss, SHEET_INPUT);
	if (input.getLastRow() === 0) {
		input.getRange(1, 1, 1, INPUT_HEADERS.length).setValues([INPUT_HEADERS]);
		input
			.getRange(1, 1, 1, INPUT_HEADERS.length)
			.setFontWeight("bold")
			.setBackground("#fdeee3");
		input.getRange("A:A").setNumberFormat("@");
		// 店舗コードを入れると店舗名が自動表示される
		input
			.getRange(2, 2, 100, 1)
			.setFormulaR1C1(
				'=IF(RC[-1]="","",IFERROR(VLOOKUP(RC[-1],\'' +
					SHEET_MASTER +
					'\'!C1:C2,2,FALSE),"未登録"))',
			);
		// サンプル行
		input.getRange(2, 1, 3, 1).setValues([["101"], ["102"], ["103"]]);
		input
			.getRange(2, 3, 3, 6)
			.setValues([
				[86.4, 28.7, 24.1, 89.2, 6, 5],
				[80.2, 30.1, 25.3, 86.0, 7, 7],
				[74.4, 31.0, 26.0, 89.0, 4, 6],
			]);
		input.setFrozenRows(1);
		input
			.getRange("C1")
			.setNote("原価率・人件費率は 28.7 のように % の数値で入力してください(0.287 でも自動判別します)");
	}

	// --- ダッシュボード連携(出力先) ---
	var output = getOrCreateSheet(ss, SHEET_OUTPUT);
	if (output.getLastRow() === 0) {
		output.getRange(1, 1, 1, OUTPUT_HEADERS.length).setValues([OUTPUT_HEADERS]);
		output
			.getRange(1, 1, 1, OUTPUT_HEADERS.length)
			.setFontWeight("bold")
			.setBackground("#e3edfb");
		output.getRange("A:A").setNumberFormat("@");
		output.setFrozenRows(1);
		output
			.getRange("A1")
			.setNote("このシートは「今すぐ同期」実行時に自動生成されます。手で編集しないでください");
	}

	SpreadsheetApp.getActiveSpreadsheet().toast(
		"シートを作成しました。「設定」シートと「店舗マスタ」を編集してください。",
		"初期セットアップ完了",
		8,
	);
}

function getOrCreateSheet(ss, name) {
	return ss.getSheetByName(name) || ss.insertSheet(name);
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

/* ===================== ③ 同期 ===================== */

function syncToDashboard() {
	var ss = SpreadsheetApp.getActiveSpreadsheet();
	var settings = readSettings(ss);
	var secret = PropertiesService.getScriptProperties().getProperty("GAS_SYNC_SECRET");
	if (!secret) {
		throw new Error("メニュー「② API シークレットを設定」を先に実行してください");
	}

	var stores = computeStores(ss, settings);
	if (stores.length === 0) {
		throw new Error("「" + SHEET_INPUT + "」に店舗データがありません");
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
				hygiene: {
					daily_submitted: s.daily,
					weekly_submitted: s.weekly,
					last_submitted_at: new Date().toISOString(),
				},
			};
			if (s.qsc !== null) {
				row.qsc_score = s.qsc;
				row.qsc_rank = s.qscRank;
				if (s.qscPrevRank !== null) row.qsc_prev_rank = s.qscPrevRank;
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
	if (body.unknownCodes && body.unknownCodes.length > 0) {
		msg += "(アプリ未登録の店舗コード: " + body.unknownCodes.join(", ") + ")";
	}
	ss.toast(msg, "同期完了", 8);
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

function computeStores(ss, settings) {
	var master = ss.getSheetByName(SHEET_MASTER);
	var input = ss.getSheetByName(SHEET_INPUT);
	if (!master || !input) {
		throw new Error("メニュー「① 初期セットアップ」を先に実行してください");
	}

	var nameByCode = {};
	master
		.getRange(2, 1, Math.max(master.getLastRow() - 1, 1), 2)
		.getValues()
		.forEach(function (row) {
			var code = String(row[0]).trim();
			if (code) nameByCode[code] = String(row[1]).trim();
		});

	// 前回の QSC 順位(出力シートから引き継ぎ)
	var qscPrevByCode = readPreviousQscRanks(ss);

	var stores = [];
	var lastRow = input.getLastRow();
	if (lastRow >= 2) {
		input
			.getRange(2, 1, lastRow - 1, INPUT_HEADERS.length)
			.getValues()
			.forEach(function (row) {
				var code = String(row[0]).trim();
				if (!code) return;
				var kpi = toNumber(row[2]);
				if (kpi === null) return; // KPI 点数が無い行はスキップ
				stores.push({
					code: code,
					name: nameByCode[code] || String(row[1]).trim() || code,
					kpi: kpi,
					cost: toPercent(row[3]),
					labor: toPercent(row[4]),
					qsc: toNumber(row[5]),
					daily: toNumber(row[6]) || 0,
					weekly: toNumber(row[7]) || 0,
					qscPrevRank: qscPrevByCode[code] !== undefined ? qscPrevByCode[code] : null,
				});
			});
	}
	if (stores.length === 0) return stores;

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

	return stores;
}

function readPreviousQscRanks(ss) {
	var output = ss.getSheetByName(SHEET_OUTPUT);
	var map = {};
	if (!output || output.getLastRow() < 2) return map;
	var codeCol = OUTPUT_HEADERS.indexOf("店舗コード");
	var qscRankCol = OUTPUT_HEADERS.indexOf("QSC順位");
	output
		.getRange(2, 1, output.getLastRow() - 1, OUTPUT_HEADERS.length)
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
				s.daily,
				s.weekly,
				now,
			];
		});
	output.clearContents();
	output.getRange(1, 1, 1, OUTPUT_HEADERS.length).setValues([OUTPUT_HEADERS]);
	output.getRange(1, 1, 1, OUTPUT_HEADERS.length).setFontWeight("bold").setBackground("#e3edfb");
	output.getRange("A:A").setNumberFormat("@");
	output.getRange(2, 1, rows.length, OUTPUT_HEADERS.length).setValues(rows);
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
