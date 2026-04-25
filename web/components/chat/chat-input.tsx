"use client";

import { Loader2, Send } from "lucide-react";
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

const controlClassName =
	"h-9 rounded-full border-border/70 bg-muted/60 text-foreground shadow-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

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

	const SelectedModeIcon = selectedMode?.icon;
	const structuredMode = selectedModeId === "quiz" || selectedModeId === "flashcard";

	const updateOptions = (patch: Partial<ChatModeOptions>) => {
		onModeOptionsChange({ ...modeOptions, ...patch });
	};

	useEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
	}, [value]);

	const handleSend = () => {
		if (!value.trim() || loading) return;
		onSend();
	};

	return (
		<div className="z-20 px-3 pb-4 pt-4 sm:px-6 sm:pb-6">
			<div className="mx-auto w-full max-w-3xl">
				<div className="rounded-[2rem] border border-border/70 bg-background/92 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
					<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-3 sm:px-4">
						<Select value={selectedModeId} onValueChange={onModeChange}>
							<SelectTrigger
								className={cn(
									controlClassName,
									"min-w-[180px] justify-start gap-2 px-3 text-sm font-medium",
								)}
							>
								<div className="flex min-w-0 items-center gap-2">
									{SelectedModeIcon ? (
										<SelectedModeIcon className="h-4 w-4 shrink-0 text-primary" />
									) : null}
									<SelectValue placeholder="Chọn chức năng" />
								</div>
							</SelectTrigger>
							<SelectContent className="rounded-2xl">
								{modes.map((mode) => (
									<SelectItem key={mode.id} value={mode.id} className="rounded-xl py-2.5">
										{mode.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						{loading ? (
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								AI typing...
							</div>
						) : null}
					</div>

					{structuredMode ? (
						<div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-3 sm:px-4">
							{selectedModeId === "quiz" ? (
								<Select
									value={String(modeOptions.questionCount)}
									onValueChange={(nextValue) =>
										updateOptions({ questionCount: Number(nextValue) })
									}
								>
									<SelectTrigger className={cn(controlClassName, "w-[132px] text-xs")}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="rounded-2xl">
										{[5, 10, 15, 20].map((count) => (
											<SelectItem key={count} value={String(count)} className="rounded-xl">
												{count} câu
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							) : (
								<Select
									value={String(modeOptions.cardCount)}
									onValueChange={(nextValue) =>
										updateOptions({ cardCount: Number(nextValue) })
									}
								>
									<SelectTrigger className={cn(controlClassName, "w-[132px] text-xs")}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="rounded-2xl">
										{[5, 10, 20].map((count) => (
											<SelectItem key={count} value={String(count)} className="rounded-xl">
												{count} thẻ
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}

							<Select
								value={modeOptions.difficulty}
								onValueChange={(nextValue) =>
									updateOptions({
										difficulty: nextValue as ChatModeOptions["difficulty"],
									})
								}
							>
								<SelectTrigger className={cn(controlClassName, "w-[148px] text-xs")}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="rounded-2xl">
									<SelectItem value="mixed" className="rounded-xl">
										Trộn mức độ
									</SelectItem>
									<SelectItem value="easy" className="rounded-xl">
										Dễ
									</SelectItem>
									<SelectItem value="medium" className="rounded-xl">
										Trung bình
									</SelectItem>
									<SelectItem value="hard" className="rounded-xl">
										Khó
									</SelectItem>
								</SelectContent>
							</Select>

							{selectedModeId === "quiz" ? (
								<div className="ml-auto flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5">
									<Switch
										id="quiz-explanations"
										checked={modeOptions.includeExplanations}
										onCheckedChange={(checked) =>
											updateOptions({ includeExplanations: checked })
										}
									/>
									<Label
										htmlFor="quiz-explanations"
										className="cursor-pointer text-xs text-muted-foreground"
									>
										Có giải thích
									</Label>
								</div>
							) : null}
						</div>
					) : null}

					<div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
						<Textarea
							ref={textareaRef}
							value={value}
							onChange={(event) => onChange(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault();
									handleSend();
								}
							}}
							rows={1}
							placeholder={
								placeholder ||
								selectedMode?.placeholder ||
								"Nhập câu hỏi về tài liệu, khái niệm hoặc nội dung bạn đang học..."
							}
							className="min-h-[96px] max-h-[220px] resize-none border-0 bg-transparent px-0 pb-3 pt-2 text-[15px] leading-7 shadow-none focus-visible:ring-0"
						/>

						<div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
							<p className="min-w-0 text-xs leading-5 text-muted-foreground">
								{selectedMode?.description}
							</p>

							<Button
								type="button"
								size="icon"
								onClick={handleSend}
								disabled={loading || !value.trim()}
								className="h-10 w-10 rounded-full shadow-sm"
								title="Gửi tin nhắn"
							>
								{loading ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Send className="h-4 w-4" />
								)}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
