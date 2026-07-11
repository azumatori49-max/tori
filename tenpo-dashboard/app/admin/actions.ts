"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getProvider } from "@/lib/data";
import type { CommentRole } from "@/lib/types";

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
