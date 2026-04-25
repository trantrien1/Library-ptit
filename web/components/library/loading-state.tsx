export function LoadingState({ label = "Đang tải..." }: { label?: string }) {
	return (
		<div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-3xl border bg-card/40">
			<div className="h-9 w-9 animate-spin rounded-full border-4 border-muted border-t-primary" />
			<p className="text-sm text-muted-foreground">{label}</p>
		</div>
	);
}
