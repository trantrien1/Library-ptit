"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { chatbotApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import type { ChatSessionItem, ChatSessionNavItem } from "./types";

const STORAGE_KEY = "library-ptit-chatbot-sessions";

function readLocalSessions(): ChatSessionItem[] {
	if (typeof window === "undefined") return [];
	const raw = window.localStorage.getItem(STORAGE_KEY);
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as ChatSessionItem[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function toNavItems(sessions: Array<{ id: number; title: string }>): ChatSessionNavItem[] {
	return sessions.map((session) => ({
		id: session.id,
		title: session.title,
	}));
}

export function ChatSidebarHistory({ collapsed }: { collapsed: boolean }) {
	const [sessions, setSessions] = useState<ChatSessionNavItem[]>([]);
	const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);

	const loadSessions = async () => {
		setLoading(true);
		try {
			const remoteSessions = await chatbotApi.sessions();
			setSessions(toNavItems(remoteSessions));
		} catch {
			setSessions(toNavItems(readLocalSessions()));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadSessions();

		const handleSessionsUpdated = () => void loadSessions();
		const handleActiveSession = (event: Event) => {
			const detail = (event as CustomEvent<{ sessionId: number | null }>).detail;
			setActiveSessionId(detail?.sessionId ?? null);
		};

		window.addEventListener("chatbot:sessions-updated", handleSessionsUpdated);
		window.addEventListener("chatbot:active-session", handleActiveSession);
		return () => {
			window.removeEventListener("chatbot:sessions-updated", handleSessionsUpdated);
			window.removeEventListener("chatbot:active-session", handleActiveSession);
		};
	}, []);

	if (collapsed) return null;

	return (
		<div className="mt-2 border-l border-border/70 pl-3">
			<div className="mb-2 flex items-center justify-between gap-2 px-1">
				<p className="text-xs font-medium text-muted-foreground">Lịch sử chat</p>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-7 w-7 rounded-lg"
					title="New Chat"
					onClick={() => window.dispatchEvent(new CustomEvent("chatbot:new-session"))}
				>
					<Plus className="h-3.5 w-3.5" />
				</Button>
			</div>

			<div className="max-h-[42vh] space-y-1 overflow-y-auto pr-1">
				{loading ? (
					<div className="space-y-1">
						{Array.from({ length: 4 }).map((_, index) => (
							<div key={index} className="h-8 animate-pulse rounded-lg bg-muted" />
						))}
					</div>
				) : sessions.length === 0 ? (
					<p className="px-2 py-1 text-xs leading-5 text-muted-foreground">Chưa có cuộc trò chuyện.</p>
				) : (
					sessions.map((session) => {
						const active = activeSessionId === session.id;
						return (
							<div
								key={session.id}
								className={cn(
									"group flex items-center gap-1 rounded-lg text-sm transition-colors duration-200",
									active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
								)}
							>
								<button
									type="button"
									className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left"
									title={session.title}
									onClick={() => {
										setActiveSessionId(session.id);
										window.dispatchEvent(
											new CustomEvent("chatbot:open-session", {
												detail: { sessionId: session.id },
											}),
										);
									}}
								>
									<MessageSquare className="h-3.5 w-3.5 shrink-0" />
									<span className="truncate">{session.title}</span>
								</button>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="h-7 w-7 shrink-0 rounded-md opacity-0 transition-opacity group-hover:opacity-100"
									title="Xóa cuộc trò chuyện"
									onClick={() =>
										window.dispatchEvent(
											new CustomEvent("chatbot:delete-session", {
												detail: { sessionId: session.id },
											}),
										)
									}
								>
									<Trash2 className="h-3.5 w-3.5" />
								</Button>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
