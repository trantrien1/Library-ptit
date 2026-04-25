import { Button } from "@/components/ui/button";

export function PaginationControls({
	page,
	totalPages,
	onChange,
}: {
	page: number;
	totalPages: number;
	onChange: (nextPage: number) => void;
}) {
	if (totalPages <= 1) return null;

	return (
		<div className="mt-6 flex items-center justify-end gap-2">
			<Button
				variant="outline"
				onClick={() => onChange(page - 1)}
				disabled={page <= 1}
			>
				Trước
			</Button>
			<div className="rounded-xl border bg-card px-4 py-2 text-sm text-muted-foreground">
				Trang {page} / {totalPages}
			</div>
			<Button
				variant="outline"
				onClick={() => onChange(page + 1)}
				disabled={page >= totalPages}
			>
				Sau
			</Button>
		</div>
	);
}
