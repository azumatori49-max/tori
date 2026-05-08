# 鶏ヤロー 衛生管理システム

鶏ヤロー全51店舗の衛生管理写真報告 Web アプリ。
店舗スタッフがスマホで毎日 7 枚（デイリー）・週 1 回 7 枚（ウィークリー）の写真を撮影して提出し、管理者が全店舗の提出状況を一覧確認できる。

## 技術スタック

- Vite + React 18 + TypeScript
- Tailwind CSS v3
- Firebase (Realtime Database + Storage)

## セットアップ

```bash
npm install
npm run dev          # http://localhost:5173
npm run build
npm run preview
npm run typecheck
```

## 初回デプロイ後の手順

1. 管理者でログイン（パスワード: `admin2024`）
2. 「店舗管理」タブを開く
3. 「🔥 Firebaseに51店舗を一括登録」ボタンをクリック
4. 完了 → 各店舗にURLとパスワード（`Toriyaro1`）を配布

## Firebase セキュリティルール

### Realtime Database

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

### Storage

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

> 将来的には Firebase Auth と組み合わせてルールを強化推奨。

## データ構造

```
/
├── stores/{storeKey}
│   ├── name: string
│   └── password: string
└── submissions/{storeKey}/{daily|weekly}/{periodKey}
    ├── count: number
    ├── submittedAt: ISO8601 string
    ├── storeName: string
    └── photos/[0..6]: string  // Storage URL
```

- デイリーキー: `YYYY-MM-DD`
- ウィークリーキー: `WYYYY-MM-DD`（その週の月曜日の日付）
