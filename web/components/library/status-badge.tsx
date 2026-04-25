import { Badge } from "@/components/ui/badge";
import { getStatusMeta } from "@/lib/format";

export function StatusBadge({ status }: { status?: string | null }) {
	const meta = getStatusMeta(status);
	return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
