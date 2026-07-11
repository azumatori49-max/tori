import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// リポジトリ直下に別プロジェクトの pnpm-lock.yaml があるため、Next.js が
	// ワークスペースのルートを取り違えないようこのアプリのディレクトリに固定する。
	// これが無いと Firebase App Hosting の standalone 出力が
	// .next/standalone/tenpo-dashboard/ 配下に入れ子になり、アダプタが
	// routes-manifest.json を見つけられずデプロイが失敗する。
	outputFileTracingRoot: path.join(__dirname),
	// 検証用: App Hosting と同じ standalone 出力をローカルでも確認する場合は
	// BUILD_STANDALONE=1 pnpm build
	...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
