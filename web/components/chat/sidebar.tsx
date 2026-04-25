"use client";

import { MessageSquare, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ChatSessionNavItem } from "./types";

interface SidebarProps {
	sessions: ChatSessionNavItem[];
	activeSessionId?: number | null;
	collapsed: boolean;
	loading?: boolean;
	onToggleCollapsed: () => void;
	onNewChat: () => void;
	onOpenChat: (sessionId: number) => void;
	onDeleteChat: (sessionId: number) => void;
}

export function Sidebar({
	sessions,
	activeSessionId,
	collapsed,
	loading,
	onToggleCollapsed,
	onNewChat,
	onOpenChat,
	onDeleteChat,
}: SidebarProps) {
	return (
		<aside
			className={cn(
				"flex min-h-0 shrink-0 flex-col border-r bg-muted/45 transition-[width] duration-300",
				collapsed ? "w-16" : "w-72 max-md:w-16",
			)}
		>
			<div className="flex h-14 shrink-0 items-center gap-2 px-3">
				<Button
					type="button"
					onClick={onNewChat}
					variant="outline"
					className={cn("h-10 flex-1 justify-start rounded-lg bg-background max-md:w-10 max-md:flex-none max-md:px-0", collapsed && "w-10 flex-none px-0")}
					title="New Chat"
				>
					<Plus className="h-4 w-4" />
					<span className={cn("truncate max-md:sr-only", collapsed && "sr-only")}>New Chat</span>
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={onToggleCollapsed}
					className="h-10 w-10 rounded-lg"
					title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
				>
					{collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
				</Button>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
				{loading ? (
					<div className="space-y-2 p-2">
						{Array.from({ length: 5 }).map((_, index) => (
							<div key={index} className="h-10 animate-pulse rounded-lg bg-muted" />
						))}
					</div>
				) : sessions.length === 0 ? (
					<div className={cn("p-3 text-sm text-muted-foreground", collapsed && "sr-only")}>
						Chưa có cuộc trò chuyện.
					</div>
				) : (
					<nav className="space-y-1">
						{sessions.map((session) => {
							const active = activeSessionId === session.id;

							return (
								<div
									key={session.id}
									className={cn(
										"group flex items-center gap-1 rounded-lg transition-colors duration-200",
										active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
									)}
								>
									<button
										type="button"
										onClick={() => onOpenChat(session.id)}
										className={cn(
											"flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left text-sm",
											collapsed && "justify-center px-2",
										)}
										title={session.title}
									>
										<MessageSquare className="h-4 w-4 shrink-0" />
										<span className={cn("truncate max-md:sr-only", collapsed && "sr-only")}>
											{session.title}
										</span>
									</button>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={() => onDeleteChat(session.id)}
										className={cn(
											"h-8 w-8 shrink-0 rounded-md opacity-0 transition-opacity group-hover:opacity-100",
											active && "hover:bg-primary-foreground/15 hover:text-primary-foreground",
											collapsed && "hidden",
											"max-md:hidden",
										)}
										title="Xóa cuộc trò chuyện"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							);
						})}
					</nav>
				)}
			</div>
		</aside>
	);
}
