# IdeaCloud — Full MVP

**環境変数は2つのみ（.env.productionを常用）**
```
VITE_OPENAI_API_KEY=sk-REPLACE_ME
VITE_OPENAI_MODEL=gpt-4o-mini
```

## セットアップ (Windows)
```powershell
# 解凍後
cd ideacloud

# 依存をインストール
npm install

# まず .env.production を .env にコピー
copy .env.production .env

# 開発起動
npm run dev
# -> http://localhost:5173
```

## 含まれる機能
- Capture: 一行メモ投入 + OpenAIでタグ自動付与
- Map: クラスタ再計算（OpenAI, 3〜8クラスタ）/ Cytoscape表示 / 色分け
- Insight: 要約 + 次の一手 + タイトル案（OpenAI）/ PDF出力 / JSON出入
- IndexedDB (dexie) / PWA (vite-plugin-pwa) / Tailwind

## 注意（本番キーの扱い）
- この構成はフロントからOpenAIを直呼びします。実運用ではサーバレス関数経由を推奨。
