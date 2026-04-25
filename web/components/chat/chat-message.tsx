"use client";

import { Bot, Copy, RefreshCcw, UserRound } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { validateFlashcardJson, validateQuizJson } from "@/lib/chat-structured";
import { cn } from "@/lib/utils";

import { FlashcardResult, JsonValidationError, QuizResult } from "./structured-results";
import type { ChatMessageItem, ChatSource } from "./types";

interface ChatMessageProps {
	message: ChatMessageItem;
	onCopy: (content: string) => void;
	onRegenerate?: () => void;
}

interface MarkdownBlock {
	type: "paragraph" | "code" | "table" | "list";
	content?: string;
	language?: string;
	headers?: string[];
	rows?: string[][];
	items?: string[];
}

function parseMessageMetadata(metadata?: string | null) {
	if (!metadata) return { sources: [] as ChatSource[] };
	try {
		const parsed = JSON.parse(metadata) as {
			sources?: ChatSource[];
			resultType?: string;
			result_type?: string;
			quiz?: unknown;
			flashcards?: unknown;
			validationError?: string;
		};
		return {
			sources: Array.isArray(parsed.sources) ? parsed.sources : [],
			resultType: parsed.resultType || parsed.result_type,
			quiz: parsed.quiz,
			flashcards: parsed.flashcards,
			validationError: parsed.validationError,
		};
	} catch {
		return { sources: [] as ChatSource[] };
	}
}

function StructuredContent({ metadata }: { metadata: ReturnType<typeof parseMessageMetadata> }) {
	try {
		if (metadata.resultType === "quiz" && metadata.quiz) {
			return <QuizResult data={validateQuizJson(metadata.quiz)} />;
		}
		if (metadata.resultType === "flashcards" && metadata.flashcards) {
			return <FlashcardResult data={validateFlashcardJson(metadata.flashcards)} />;
		}
		if (metadata.resultType === "validation_error") {
			return <JsonValidationError message={metadata.validationError} />;
		}
		return null;
	} catch (error) {
		return <JsonValidationError message={error instanceof Error ? error.message : undefined} />;
	}
}

function tableCells(line: string) {
	return line
		.replace(/^\|/, "")
		.replace(/\|$/, "")
		.split("|")
		.map((cell) => cell.trim());
}

function isTableSeparator(line?: string) {
	return Boolean(line && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line));
}

function parseMarkdown(content: string): MarkdownBlock[] {
	const lines = content.split(/\r?\n/);
	const blocks: MarkdownBlock[] = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index];

		if (!line.trim()) {
			index += 1;
			continue;
		}

		const codeStart = line.match(/^```(\w+)?/);
		if (codeStart) {
			const language = codeStart[1] || "";
			const codeLines: string[] = [];
			index += 1;
			while (index < lines.length && !lines[index].startsWith("```")) {
				codeLines.push(lines[index]);
				index += 1;
			}
			index += 1;
			blocks.push({ type: "code", content: codeLines.join("\n"), language });
			continue;
		}

		if (line.includes("|") && isTableSeparator(lines[index + 1])) {
			const headers = tableCells(line);
			const rows: string[][] = [];
			index += 2;
			while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
				rows.push(tableCells(lines[index]));
				index += 1;
			}
			blocks.push({ type: "table", headers, rows });
			continue;
		}

		if (/^\s*[-*]\s+/.test(line)) {
			const items: string[] = [];
			while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
				items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
				index += 1;
			}
			blocks.push({ type: "list", items });
			continue;
		}

		const paragraphLines = [line];
		index += 1;
		while (
			index < lines.length &&
			lines[index].trim() &&
			!lines[index].startsWith("```") &&
			!/^\s*[-*]\s+/.test(lines[index]) &&
			!(lines[index].includes("|") && isTableSeparator(lines[index + 1]))
		) {
			paragraphLines.push(lines[index]);
			index += 1;
		}
		blocks.push({ type: "paragraph", content: paragraphLines.join("\n") });
	}

	return blocks;
}

function InlineMarkdown({ text }: { text: string }) {
	const parts = text.split(/(`[^`]+`|\*\*[^*]+?\*\*|\[[^\]]+\]\([^)]+\))/g);

	return (
		<>
			{parts.map((part, index) => {
				if (!part) return null;
				if (part.startsWith("`") && part.endsWith("`")) {
					return (
						<code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">
							{part.slice(1, -1)}
						</code>
					);
				}
				if (part.startsWith("**") && part.endsWith("**")) {
					return <strong key={index}>{part.slice(2, -2)}</strong>;
				}
				const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
				if (link) {
					return (
						<a
							key={index}
							href={link[2]}
							target="_blank"
							rel="noreferrer"
							className="font-medium underline underline-offset-4"
						>
							{link[1]}
						</a>
					);
				}
				return <span key={index}>{part}</span>;
			})}
		</>
	);
}

function MarkdownContent({ content }: { content: string }) {
	const blocks = useMemo(() => parseMarkdown(content), [content]);

	return (
		<div className="space-y-3">
			{blocks.map((block, index) => {
				if (block.type === "code") {
					return (
						<div key={index} className="overflow-hidden rounded-lg border bg-zinc-950 text-zinc-50">
							{block.language ? (
								<div className="border-b border-white/10 px-3 py-1.5 text-xs text-zinc-300">
									{block.language}
								</div>
							) : null}
							<pre className="overflow-x-auto p-3 text-xs leading-6">
								<code>{block.content}</code>
							</pre>
						</div>
					);
				}

				if (block.type === "table") {
					return (
						<div key={index} className="overflow-x-auto rounded-lg border">
							<table className="w-full min-w-[520px] border-collapse text-sm">
								<thead className="bg-muted">
									<tr>
										{block.headers?.map((header, cellIndex) => (
											<th key={cellIndex} className="border-b px-3 py-2 text-left font-semibold">
												<InlineMarkdown text={header} />
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{block.rows?.map((row, rowIndex) => (
										<tr key={rowIndex} className="border-b last:border-b-0">
											{row.map((cell, cellIndex) => (
												<td key={cellIndex} className="px-3 py-2 align-top">
													<InlineMarkdown text={cell} />
												</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					);
				}

				if (block.type === "list") {
					return (
						<ul key={index} className="ml-5 list-disc space-y-1">
							{block.items?.map((item, itemIndex) => (
								<li key={itemIndex}>
									<InlineMarkdown text={item} />
								</li>
							))}
						</ul>
					);
				}

				return (
					<p key={index} className="whitespace-pre-wrap">
						<InlineMarkdown text={block.content || ""} />
					</p>
				);
			})}
		</div>
	);
}

export function ChatMessage({ message, onCopy, onRegenerate }: ChatMessageProps) {
	const fromUser = message.sender_type === "user";
	const metadata = parseMessageMetadata(message.metadata_);
	const { sources } = metadata;
	const hasStructuredResult = !fromUser && ["quiz", "flashcards", "validation_error"].includes(metadata.resultType || "");

	return (
		<div className={cn("group flex gap-3", fromUser ? "justify-end" : "justify-start")}>
			{!fromUser ? (
				<div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
					<Bot className="h-4 w-4" />
				</div>
			) : null}

			<div className={cn("flex max-w-[86%] flex-col gap-2 sm:max-w-[76%]", fromUser && "items-end")}>
				<div
					className={cn(
						"rounded-lg px-4 py-3 text-sm leading-7 shadow-sm",
						fromUser ? "bg-primary text-primary-foreground" : "border bg-card",
					)}
				>
					{message.content ? <MarkdownContent content={message.content} /> : null}
					{message.streaming ? <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current align-middle" /> : null}
					{!message.streaming && hasStructuredResult ? <StructuredContent metadata={metadata} /> : null}
				</div>

				{sources.length > 0 ? (
					<div className="w-full rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
						<p className="font-medium text-foreground">Nguồn tham khảo</p>
						<div className="mt-2 grid gap-2">
							{sources.map((source, index) => (
								<div key={`${message.id}-${index}`} className="rounded-md bg-background/70 p-2">
									<p className="font-medium text-foreground">{source.title || "Sách thư viện"}</p>
									<p className="mt-1">
										{source.author || "Không rõ tác giả"} · {source.category || "Chưa phân loại"}
									</p>
								</div>
							))}
						</div>
					</div>
				) : null}

				<div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() => onCopy(message.content)}
						className="h-8 w-8 rounded-md"
						title="Copy message"
					>
						<Copy className="h-4 w-4" />
					</Button>
					{!fromUser && onRegenerate ? (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={onRegenerate}
							className="h-8 w-8 rounded-md"
							title="Regenerate response"
						>
							<RefreshCcw className="h-4 w-4" />
						</Button>
					) : null}
				</div>
			</div>

			{fromUser ? (
				<div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
					<UserRound className="h-4 w-4" />
				</div>
			) : null}
		</div>
	);
}
