// ブランド別のロゴマーク。
// ロゴ画像(public/brand/*.png)が追加されたブランドは画像を表示し、
// 未追加のブランドは頭文字+ブランドカラーの丸で表示する。
// 新ブランドは BRANDS に 1 行足すだけで追加できる。
import Image from "next/image";

type BrandDef = {
	match: string; // store.brand にこの文字列が含まれたら一致
	initial: string;
	bg: string;
	image?: string; // public/ 配下のロゴ画像(用意できたら設定)
};

const BRANDS: BrandDef[] = [
	{ match: "鶏ヤロー", initial: "鶏", bg: "#e8590c" },
	{ match: "まる助", initial: "ま", bg: "#c62828" },
	{ match: "イザカラ", initial: "イ", bg: "#6d28d9" },
	{ match: "すし鳥", initial: "す", bg: "#1d4ed8" },
];

const DEFAULT: BrandDef = { match: "", initial: "店", bg: "#e8590c" };

export default function BrandLogo({ brand }: { brand?: string }) {
	const def = (brand && BRANDS.find((b) => brand.includes(b.match))) || DEFAULT;
	if (def.image) {
		return (
			<Image
				className="logo logo-img"
				src={def.image}
				alt={def.match}
				width={40}
				height={40}
			/>
		);
	}
	return (
		<span className="logo" style={{ background: def.bg }}>
			{def.initial}
		</span>
	);
}
