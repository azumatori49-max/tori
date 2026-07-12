"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getProvider } from "@/lib/data";
import { DEFAULT_UI_SETTINGS, type CommentRole } from "@/lib/types";

async function requireAdmin(): Promise<void> {
	const session = await getSession();
	if (session?.role !== "admin") redirect("/admin/login");
}

export async function createComment(formData: FormData): Promise<void> {
	await requireAdmin();
	const provider = await getProvider();
	const storeId = String(formData.get("storeId") ?? "");
	const authorRole = String(formData.get("authorRole") ?? "hq") as CommentRole;
	const authorName = String(formData.get("authorName") ?? "").trim();
	const body = String(formData.get("body") ?? "").trim();
	if (!authorName || !body) return;
	await provider.createComment({
		storeId: storeId === "all" ? null : storeId,
		authorName,
		authorRole,
		body,
	});
	revalidatePath("/admin/comments");
	revalidatePath("/");
}

export async function deleteComment(formData: FormData): Promise<void> {
	await requireAdmin();
	const provider = await getProvider();
	const id = String(formData.get("id") ?? "");
	if (id) await provider.deleteComment(id);
	revalidatePath("/admin/comments");
	revalidatePath("/");
}

export async function saveUiSettings(formData: FormData): Promise<void> {
	await requireAdmin();
	const provider = await getProvider();
	const roles = String(formData.get("roles") ?? "")
		.split("\n")
		.map((r) => r.trim())
		.filter(Boolean)
		.slice(0, 20);
	const text = (key: keyof typeof DEFAULT_UI_SETTINGS.texts) =>
		String(formData.get(key) ?? "").trim() || DEFAULT_UI_SETTINGS.texts[key];
	await provider.saveUiSettings({
		roles: roles.length > 0 ? roles : DEFAULT_UI_SETTINGS.roles,
		texts: {
			betterLowNote: text("betterLowNote"),
			rankNote: text("rankNote"),
			hygieneDailyDesc: text("hygieneDailyDesc"),
			hygieneWeeklyDesc: text("hygieneWeeklyDesc"),
		},
	});
	revalidatePath("/admin/settings");
	revalidatePath("/admin/comments");
	revalidatePath("/");
}

export async function createAnnouncement(formData: FormData): Promise<void> {
	await requireAdmin();
	const provider = await getProvider();
	const title = String(formData.get("title") ?? "").trim();
	const linkUrl = String(formData.get("linkUrl") ?? "").trim();
	if (!title) return;
	await provider.createAnnouncement({ title, linkUrl: linkUrl || null });
	revalidatePath("/admin/announcements");
	revalidatePath("/announcements");
	revalidatePath("/");
}

export async function deleteAnnouncement(formData: FormData): Promise<void> {
	await requireAdmin();
	const provider = await getProvider();
	const id = String(formData.get("id") ?? "");
	if (id) await provider.deleteAnnouncement(id);
	revalidatePath("/admin/announcements");
	revalidatePath("/announcements");
	revalidatePath("/");
}
