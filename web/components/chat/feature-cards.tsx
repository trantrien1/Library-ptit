"use client";

import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

import type { FeatureCardItem } from "./types";

interface FeatureCardsProps {
	items: FeatureCardItem[];
	onSelectPrompt: (prompt: string) => void;
}

export function FeatureCards({ items, onSelectPrompt }: FeatureCardsProps) {
	const visibleItems = items.slice(0, 5);

	return (
		<div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
			<div className="w-full max-w-3xl text-center">
				<div className="mx-auto mb-6 max-w-xl">
					<h2 className="text-2xl font-semibold tracking-normal sm:text-3xl">
						Bạn muốn hỏi gì hôm nay?
					</h2>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						Chọn chế độ ngay trong ô nhập liệu, hoặc dùng một gợi ý nhanh bên dưới để bắt đầu.
					</p>
				</div>

				<div className="flex flex-wrap justify-center gap-2">
					{visibleItems.map((item) => {
						const Icon = item.icon;

						return (
							<button
								key={item.id}
								type="button"
								onClick={() => onSelectPrompt(item.prompt)}
								className={cn(
									"group inline-flex max-w-full items-center gap-2 rounded-full border bg-background px-3 py-2 text-left text-sm shadow-sm",
									"transition-all duration-200 hover:border-primary/30 hover:bg-muted/50 hover:shadow-md",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								)}
							>
								<Icon className="h-4 w-4 shrink-0 text-primary" />
								<span className="truncate font-medium">{item.title}</span>
								<ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
