/**
 * KPI スプレッドシート → 店長ダッシュボード 同期スクリプト (Google Apps Script)
 *
 * ■ セットアップ
 * 1. KPI 集計スプレッドシートの「拡張機能 > Apps Script」にこのファイルを貼り付ける
 * 2. ENDPOINT をデプロイ先の URL に変更する
 * 3. スクリプトプロパティに GAS_SYNC_SECRET を追加する
 *    (アプリ側の環境変数 GAS_SYNC_SECRET と同じ値)
 * 4. syncToDashboard を一度手動実行して動作確認する
 * 5. setupDailyTrigger を一度実行すると毎日 22 時に自動同期される
 *
 * ■ 連携シートのフォーマット(1 行目はヘッダー、2 行目以降が店舗データ)
 * 店舗コード | KPI点数 | KPI平均 | 総合順位 | 原価率 | 原価率順位 | 原価率目標 | 原価率平均 |
 * 人件費率 | 人件費率順位 | 人件費率目標 | 人件費率平均 | QSC点数 | QSC順位 | QSC前回順位 |
 * 日次提出 | 週次提出
 * (QSC・衛生チェックの列は無くても可。列の並び順は自由で、ヘッダー名で判別します)
 */

var CONFIG = {
	SHEET_NAME: "ダッシュボード連携",
	ENDPOINT: "https://your-app.example.com/api/gas/kpi",
};

function syncToDashboard() {
	var secret = PropertiesService.getScriptProperties().getProperty("GAS_SYNC_SECRET");
	if (!secret) {
		throw new Error("スクリプトプロパティ GAS_SYNC_SECRET を設定してください");
	}

	var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
	if (!sheet) {
		throw new Error("シート「" + CONFIG.SHEET_NAME + "」が見つかりません");
	}

	var values = sheet.getDataRange().getValues();
	if (values.length < 2) {
		throw new Error("データ行がありません");
	}

	var header = values[0].map(function (h) {
		return String(h).trim();
	});
	function col(name) {
		return header.indexOf(name);
	}
	function num(row, name) {
		var i = col(name);
		if (i < 0) return null;
		var v = row[i];
		if (v === "" || v === null) return null;
		var n = Number(v);
		return isNaN(n) ? null : n;
	}

	var required = ["店舗コード", "KPI点数", "総合順位", "原価率", "人件費率"];
	required.forEach(function (name) {
		if (col(name) < 0) throw new Error("ヘッダー「" + name + "」が見つかりません");
	});

	var stores = [];
	for (var r = 1; r < values.length; r++) {
		var row = values[r];
		var code = String(row[col("店舗コード")]).trim();
		if (!code) continue;

		var store = {
			code: code,
			kpi_score: num(row, "KPI点数"),
			kpi_avg: num(row, "KPI平均"),
			overall_rank: num(row, "総合順位"),
			cost_rate: num(row, "原価率"),
			cost_rate_rank: num(row, "原価率順位"),
			cost_rate_target: num(row, "原価率目標"),
			cost_rate_avg: num(row, "原価率平均"),
			labor_rate: num(row, "人件費率"),
			labor_rate_rank: num(row, "人件費率順位"),
			labor_rate_target: num(row, "人件費率目標"),
			labor_rate_avg: num(row, "人件費率平均"),
			qsc_score: num(row, "QSC点数"),
			qsc_rank: num(row, "QSC順位"),
			qsc_prev_rank: num(row, "QSC前回順位"),
		};

		var daily = num(row, "日次提出");
		var weekly = num(row, "週次提出");
		if (daily !== null || weekly !== null) {
			store.hygiene = {
				daily_submitted: daily || 0,
				weekly_submitted: weekly || 0,
			};
		}

		stores.push(store);
	}

	var payload = {
		date: Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd"),
		total_stores: stores.length,
		stores: stores,
	};

	var res = UrlFetchApp.fetch(CONFIG.ENDPOINT, {
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
}

/** 毎日 22 時に自動同期するトリガーを設定(初回に一度だけ実行) */
function setupDailyTrigger() {
	ScriptApp.getProjectTriggers().forEach(function (t) {
		if (t.getHandlerFunction() === "syncToDashboard") {
			ScriptApp.deleteTrigger(t);
		}
	});
	ScriptApp.newTrigger("syncToDashboard").timeBased().everyDays(1).atHour(22).create();
}
