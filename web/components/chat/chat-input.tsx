"use client";

import { CornerDownLeft, Loader2, Send } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { ChatModeItem, ChatModeOptions } from "./types";

interface ChatInputProps {
	value: string;
	loading?: boolean;
	placeholder?: string;
	modes: ChatModeItem[];
	selectedModeId: string;
	modeOptions: ChatModeOptions;
	onChange: (value: string) => void;
	onModeChange: (modeId: string) => void;
	onModeOptionsChange: (options: ChatModeOptions) => void;
	onSend: () => void;
}

export function ChatInput({
	value,
	loading,
	placeholder,
	modes,
	selectedModeId,
	modeOptions,
	onChange,
	onModeChange,
	onModeOptionsChange,
	onSend,
}: ChatInputProps) {
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const selectedMode = useMemo(
		() => modes.find((mode) => mode.id === selectedModeId) || modes[0],
		[modes, selectedModeId],
	);
	const structuredMode = selectedModeId === "quiz" || selectedModeId === "flashcard";
	const updateOptions = (patch: Partial<ChatModeOptions>) => onModeOptionsChange({ ...modeOptions, ...patch });

	useEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
	}, [value]);

	return (
		<div className="bg-gradient-to-t from-background via-background to-background/70 px-3 pb-4 pt-3 backdrop-blur sm:px-6 sm:pb-6">
			<div className="mx-auto max-w-3xl">
				<div className="rounded-2xl border bg-background p-2 shadow-lg transition-shadow duration-200 focus-within:shadow-xl">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						<label className="sr-only" htmlFor="chat-mode">
							Chọn chức năng chatbot
						</label>
						<Select
							value={selectedModeId}
							onValueChange={onModeChange}
						>
							<SelectTrigger
								id="chat-mode"
								className="h-10 w-full rounded-xl border-border bg-muted/50 text-sm font-medium shadow-none transition hover:bg-muted focus:ring-2 focus:ring-primary/20 sm:w-56"
							>
								<SelectValue placeholder="Chọn chức năng" />
							</SelectTrigger>
							<SelectContent className="rounded-xl border-border p-1 shadow-xl">
								{modes.map((mode) => {
									const Icon = mode.icon;

									return (
										<SelectItem
											key={mode.id}
											value={mode.id}
											className="rounded-lg py-2.5 pl-2 pr-8"
										>
											<Icon className="h-4 w-4 text-primary" />
											<span>{mode.label}</span>
										</SelectItem>
									);
								})}
							</SelectContent>
						</Select>
						<div className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground sm:block">
							{selectedMode?.description}
						</div>
					</div>

					{structuredMode ? (
						<div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 p-2">
							{selectedModeId === "quiz" ? (
								<Select
									value={String(modeOptions.questionCount)}
									onValueChange={(value) => updateOptions({ questionCount: Number(value) })}
								>
									<SelectTrigger className="h-9 w-[128px] rounded-lg bg-background">
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="rounded-xl p-1">
										{[5, 10, 15, 20].map((count) => (
											<SelectItem key={count} value={String(count)} className="rounded-lg">
												{count} câu
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							) : (
								<Select
									value={String(modeOptions.cardCount)}
									onValueChange={(value) => updateOptions({ cardCount: Number(value) })}
								>
									<SelectTrigger className="h-9 w-[128px] rounded-lg bg-background">
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="rounded-xl p-1">
										{[5, 10, 20].map((count) => (
											<SelectItem key={count} value={String(count)} className="rounded-lg">
												{count} thẻ
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
							<Select
								value={modeOptions.difficulty}
								onValueChange={(value) => updateOptions({ difficulty: value as ChatModeOptions["difficulty"] })}
							>
								<SelectTrigger className="h-9 w-[142px] rounded-lg bg-background">
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="rounded-xl p-1">
									<SelectItem value="mixed" className="rounded-lg">Trộn mức độ</SelectItem>
									<SelectItem value="easy" className="rounded-lg">Dễ</SelectItem>
									<SelectItem value="medium" className="rounded-lg">Trung bình</SelectItem>
									<SelectItem value="hard" className="rounded-lg">Khó</SelectItem>
								</SelectContent>
							</Select>
							{selectedModeId === "quiz" ? (
								<div className="ml-auto flex items-center gap-2 rounded-lg px-2">
									<Switch
										id="quiz-explanations"
										checked={modeOptions.includeExplanations}
										onCheckedChange={(checked) => updateOptions({ includeExplanations: checked })}
									/>
									<Label htmlFor="quiz-explanations" className="cursor-pointer text-xs text-muted-foreground">
										Có giải thích
									</Label>
								</div>
							) : null}
						</div>
					) : null}

					<Textarea
						ref={textareaRef}
						value={value}
						onChange={(event) => onChange(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.shiftKey) {
								event.preventDefault();
								onSend();
							}
						}}
						rows={1}
						placeholder={placeholder || selectedMode?.placeholder || "Nhập tin nhắn..."}
						className="max-h-[180px] min-h-11 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
					/>
					<div className="flex items-center justify-between gap-3 px-2 pt-1">
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							{loading ? (
								<>
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
									AI typing...
								</>
							) : (
								<>
									<CornerDownLeft className="h-3.5 w-3.5" />
									Enter để gửi, Shift+Enter xuống dòng
								</>
							)}
						</div>
						<Button
							type="button"
							size="icon"
							onClick={onSend}
							disabled={loading || !value.trim()}
							className={cn("h-9 w-9 rounded-lg", value.trim() && "shadow-sm")}
							title="Gửi tin nhắn"
						>
							{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
