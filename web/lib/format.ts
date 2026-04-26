export function formatDate(value?: string | null) {
	if (!value) return "-";
	return new Date(value).toLocaleDateString("vi-VN");
}

export function formatDateTime(value?: string | null) {
	if (!value) return "-";
	return new Date(value).toLocaleString("vi-VN");
}

export function formatNumber(value?: number | null) {
	return Number(value || 0).toLocaleString("vi-VN");
}

export function getStatusMeta(status?: string | null) {
	switch (status) {
		case "pending":
			return { label: "Chờ duyệt", variant: "secondary" as const };
		case "approved":
			return { label: "Đã duyệt", variant: "default" as const };
		case "returned":
			return { label: "Đã trả", variant: "outline" as const };
		case "rejected":
			return { label: "Từ chối", variant: "destructive" as const };
		case "need_edit":
			return { label: "Cần chỉnh sửa", variant: "secondary" as const };
		default:
			return { label: status || "Không rõ", variant: "outline" as const };
	}
}

export function resolveAssetUrl(value?: string | null) {
	if (!value) return "";
	if (/^https?:\/\//i.test(value)) return value;
	const root =
		process.env.NEXT_PUBLIC_API_ROOT?.replace(/\/$/, "") || "http://127.0.0.1:8000";
	if (value.startsWith("/uploads") || value.startsWith("uploads/")) {
		return `${root}${value.startsWith("/") ? "" : "/"}${value}`;
	}
	if (value.startsWith("/static") || value.startsWith("static/")) {
		return `${root}${value.startsWith("/") ? "" : "/"}${value}`;
	}
	return value.startsWith("/") ? value : `/${value}`;
}
