import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MetricCard({
	title,
	value,
	description,
	icon: Icon,
}: {
	title: string;
	value: string;
	description: string;
	icon: LucideIcon;
}) {
	return (
		<Card className="rounded-3xl border bg-card/90 shadow-sm">
			<CardHeader className="flex flex-row items-start justify-between space-y-0">
				<div>
					<CardTitle className="text-sm font-medium text-muted-foreground">
						{title}
					</CardTitle>
					<p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
				</div>
				<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
					<Icon className="h-5 w-5" />
				</div>
			</CardHeader>
			<CardContent>
				<p className="text-sm text-muted-foreground">{description}</p>
			</CardContent>
		</Card>
	);
}
