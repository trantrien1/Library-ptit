import type { LucideIcon } from "lucide-react";

export function EmptyState({
	title,
	description,
	icon: Icon,
}: {
	title: string;
	description: string;
	icon: LucideIcon;
}) {
	return (
		<div className="flex min-h-[240px] flex-col items-center justify-center rounded-3xl border border-dashed bg-card/40 px-6 text-center">
			<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
				<Icon className="h-6 w-6" />
			</div>
			<h3 className="text-lg font-semibold">{title}</h3>
			<p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
		</div>
	);
}
