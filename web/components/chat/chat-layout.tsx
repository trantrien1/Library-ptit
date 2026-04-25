"use client";

import { Bot, Edit3, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";
import { FeatureCards } from "./feature-cards";
import type { ChatMessageItem, ChatModeItem, ChatModeOptions, FeatureCardItem } from "./types";

interface ChatLayoutProps {
	title: string;
	titleDraft: string;
	messages: ChatMessageItem[];
	features: FeatureCardItem[];
	modes: ChatModeItem[];
	selectedModeId: string;
	modeOptions: ChatModeOptions;
	draft: string;
	sending?: boolean;
	hasActiveSession: boolean;
	placeholder?: string;
	onTitleDraftChange: (value: string) => void;
	onSaveTitle: () => void;
	onDeleteCurrent: () => void;
	onDraftChange: (value: string) => void;
	onModeChange: (modeId: string) => void;
	onModeOptionsChange: (options: ChatModeOptions) => void;
	onSelectPrompt: (prompt: string) => void;
	onSend: () => void;
	onCopyMessage: (content: string) => void;
	onRegenerate: () => void;
}

export function ChatLayout({
	title,
	titleDraft,
	messages,
	features,
	modes,
	selectedModeId,
	modeOptions,
	draft,
	sending,
	hasActiveSession,
	placeholder,
	onTitleDraftChange,
	onSaveTitle,
	onDeleteCurrent,
	onDraftChange,
	onModeChange,
	onModeOptionsChange,
	onSelectPrompt,
	onSend,
	onCopyMessage,
	onRegenerate,
}: ChatLayoutProps) {
	const [renaming, setRenaming] = useState(false);
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const bottomRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
	}, [messages, sending]);

	const lastAssistantId = [...messages].reverse().find((message) => message.sender_type === "assistant")?.id;

	return (
		<section className="flex min-h-0 flex-1 flex-col bg-background">
			<header className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:px-6">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
						<Bot className="h-4 w-4" />
					</div>
					<div className="min-w-0">
						{renaming ? (
							<Input
								value={titleDraft}
								onChange={(event) => onTitleDraftChange(event.target.value)}
								onBlur={() => {
									setRenaming(false);
									onSaveTitle();
								}}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.currentTarget.blur();
									}
									if (event.key === "Escape") {
										setRenaming(false);
									}
								}}
								autoFocus
								className="h-9 max-w-[52vw] rounded-lg"
							/>
						) : (
							<>
								<h1 className="truncate text-sm font-medium">{title || "Chatbot AI"}</h1>
							</>
						)}
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() => setRenaming(true)}
						disabled={!hasActiveSession}
						className="rounded-lg"
						title="Đổi tên cuộc trò chuyện"
					>
						<Edit3 className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={onRegenerate}
						disabled={!messages.some((message) => message.sender_type === "user") || sending}
						className="rounded-lg"
						title="Regenerate response"
					>
						<RefreshCcw className={cn("h-4 w-4", sending && "animate-spin")} />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={onDeleteCurrent}
						disabled={!hasActiveSession}
						className="rounded-lg text-destructive hover:text-destructive"
						title="Xóa cuộc trò chuyện"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</header>

			<div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
				{messages.length === 0 ? (
					<FeatureCards items={features} onSelectPrompt={onSelectPrompt} />
				) : (
					<div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-8 pt-4 sm:px-6">
						{messages.map((message) => (
							<ChatMessage
								key={message.id}
								message={message}
								onCopy={onCopyMessage}
								onRegenerate={message.id === lastAssistantId ? onRegenerate : undefined}
							/>
						))}
						{sending && !messages.some((message) => message.streaming) ? (
							<div className="flex items-center gap-3 text-sm text-muted-foreground">
								<div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
									<Bot className="h-4 w-4" />
								</div>
								<div className="rounded-lg border bg-card px-4 py-3">AI typing...</div>
							</div>
						) : null}
						<div ref={bottomRef} />
					</div>
				)}
			</div>

			<div className="sticky bottom-0 shrink-0">
				<ChatInput
					value={draft}
					loading={sending}
					placeholder={placeholder}
					modes={modes}
					selectedModeId={selectedModeId}
					modeOptions={modeOptions}
					onChange={onDraftChange}
					onModeChange={onModeChange}
					onModeOptionsChange={onModeOptionsChange}
					onSend={onSend}
				/>
			</div>
		</section>
	);
}
