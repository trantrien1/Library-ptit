"use client";

import {
	BrainCircuit,
	BookMarked,
	FileQuestion,
	Library,
	Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ChatLayout } from "@/components/chat/chat-layout";
import type {
	ChatModeItem,
	ChatModeOptions,
	ChatMessageItem,
	ChatSessionItem,
	FeatureCardItem,
} from "@/components/chat/types";
import { chatbotApi } from "@/lib/api-client";
import type { ChatSessionDetail } from "@/lib/types";

const GENERIC_TITLE = "Cuộc trò chuyện mới";

const chatModes: ChatModeItem[] = [
	{
		id: "smart-qa",
		label: "Hỏi đáp thông minh",
		description: "Hỏi đáp theo nội dung tài liệu, sách hoặc PDF trong thư viện.",
		placeholder: "Nhập câu hỏi về tài liệu, khái niệm hoặc nội dung bạn đang học...",
		prompt: "Dựa trên tài liệu thư viện, hãy giải thích khái niệm vector embedding bằng ví dụ dễ hiểu.",
		icon: FileQuestion,
	},
	{
		id: "library-bot",
		label: "Chatbot thư viện",
		description: "Tra cứu sách, tác giả, danh mục và tài nguyên thư viện.",
		placeholder: "Bạn muốn tìm sách, ebook, luận văn hoặc tài liệu về chủ đề nào?",
		prompt: "Tôi muốn tìm sách về Python, dữ liệu và AI. Hãy gợi ý theo mức độ từ cơ bản đến nâng cao.",
		icon: Library,
	},
	{
		id: "summary",
		label: "Tóm tắt nội dung",
		description: "Rút gọn nội dung dài thành bản tóm tắt rõ ý.",
		placeholder: "Dán nội dung cần tóm tắt, hoặc nhập yêu cầu tóm tắt khoảng 200 từ...",
		prompt: "Hãy tóm tắt nội dung sau trong khoảng 200 từ, giữ lại ý chính và thuật ngữ quan trọng: ",
		icon: Sparkles,
	},
	{
		id: "quiz",
		label: "Quiz trắc nghiệm",
		description: "Tạo câu hỏi trắc nghiệm từ nội dung đang học.",
		placeholder: "Nhập chủ đề hoặc dán nội dung để tạo quiz trắc nghiệm...",
		prompt: "Tạo 10 câu hỏi trắc nghiệm về chủ đề cơ sở dữ liệu, có đáp án và giải thích ngắn.",
		icon: BrainCircuit,
	},
	{
		id: "flashcard",
		label: "Flashcard ôn tập",
		description: "Tạo thẻ ôn tập theo phương pháp spaced repetition.",
		placeholder: "Nhập chủ đề hoặc nội dung để tạo bộ flashcard ôn tập...",
		prompt: "Tạo flashcard ôn tập theo spaced repetition cho chủ đề thuật toán tìm kiếm.",
		icon: BookMarked,
	},
];

const quickSuggestions: FeatureCardItem[] = chatModes.map((mode) => ({
	id: mode.id,
	title: mode.label,
	description: mode.description,
	status: "",
	prompt: mode.prompt,
	icon: mode.icon,
}));

function toBackendMode(modeId: string) {
	if (modeId === "library-bot") return "library";
	if (modeId === "summary") return "summary";
	if (modeId === "quiz") return "quiz";
	if (modeId === "flashcard") return "flashcard";
	return "qa";
}

function toChatSession(detail: ChatSessionDetail): ChatSessionItem {
	return {
		id: detail.id,
		title: detail.title,
		messages: detail.messages.map((message) => ({ ...message })),
	};
}

function generateTitle(content: string) {
	const clean = content.replace(/[#*_`>|-]/g, " ").replace(/\s+/g, " ").trim();
	if (!clean) return GENERIC_TITLE;
	return clean.length > 54 ? `${clean.slice(0, 54).trim()}...` : clean;
}

function wait(ms: number) {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function UserChatbotPage() {
	const [currentSession, setCurrentSession] = useState<ChatSessionItem | null>(null);
	const [, setBackendAvailable] = useState(true);
	const [titleDraft, setTitleDraft] = useState("");
	const [draft, setDraft] = useState("");
	const [selectedModeId, setSelectedModeId] = useState(chatModes[0].id);
	const [modeOptions, setModeOptions] = useState<ChatModeOptions>({
		questionCount: 10,
		cardCount: 10,
		difficulty: "mixed",
		includeExplanations: true,
	});
	const [sending, setSending] = useState(false);

	const notifySessionsUpdated = useCallback(() => {
		if (typeof window !== "undefined") {
			window.dispatchEvent(new CustomEvent("chatbot:sessions-updated"));
		}
	}, []);

	const notifyActiveSession = useCallback((sessionId: number | null) => {
		if (typeof window !== "undefined") {
			window.dispatchEvent(
				new CustomEvent("chatbot:active-session", {
					detail: { sessionId },
				}),
			);
		}
	}, []);

	const openSession = async (sessionId: number) => {
		try {
			const detail = await chatbotApi.getSession(sessionId);
			const nextSession = toChatSession(detail);
			setBackendAvailable(true);
			setCurrentSession(nextSession);
			setTitleDraft(nextSession.title);
			notifyActiveSession(nextSession.id);
		} catch {
			setBackendAvailable(false);
			toast.error("Server chưa hoạt động");
		}
	};

	const createSession = async (initialTitle = GENERIC_TITLE) => {
		try {
			const session = await chatbotApi.createSession(initialTitle);
			const nextSession: ChatSessionItem = { id: session.id, title: session.title, messages: [] };
			setBackendAvailable(true);
			setCurrentSession(nextSession);
			setTitleDraft(nextSession.title);
			notifyActiveSession(nextSession.id);
			notifySessionsUpdated();
			return nextSession;
		} catch {
			setBackendAvailable(false);
			throw new Error("Server chưa hoạt động");
		}
	};

	const deleteSession = async (sessionId: number) => {
		if (!window.confirm("Xóa cuộc trò chuyện này?")) return;

		try {
			await chatbotApi.deleteSession(sessionId);
			setBackendAvailable(true);
			if (currentSession?.id === sessionId) {
				setCurrentSession(null);
				setTitleDraft("");
				notifyActiveSession(null);
			}
			notifySessionsUpdated();
		} catch {
			setBackendAvailable(false);
			toast.error("Server chưa hoạt động");
		}
	};

	const saveTitle = async () => {
		if (!currentSession || !titleDraft.trim()) return;
		const nextTitle = titleDraft.trim();
		const nextSession = { ...currentSession, title: nextTitle };
		setCurrentSession(nextSession);
		notifySessionsUpdated();

		try {
			await chatbotApi.updateSession(currentSession.id, nextTitle);
			setBackendAvailable(true);
		} catch {
			setBackendAvailable(false);
			toast.error("Server chưa hoạt động");
		}
	};

	const streamAssistantMessage = async (
		session: ChatSessionItem,
		baseMessages: ChatMessageItem[],
		answer: string,
		metadata?: string,
	) => {
		const assistantId = Date.now() + 1;
		const assistantMessage: ChatMessageItem = {
			id: assistantId,
			sender_type: "assistant",
			content: "",
			metadata_: metadata,
			streaming: true,
		};

		setCurrentSession({ ...session, messages: [...baseMessages, assistantMessage] });

		for (let index = 0; index < answer.length; index += 3) {
			await wait(12);
			const chunk = answer.slice(0, index + 3);
			setCurrentSession((previous) => {
				if (!previous || previous.id !== session.id) return previous;
				return {
					...previous,
					messages: previous.messages.map((message) =>
						message.id === assistantId ? { ...message, content: chunk } : message,
					),
				};
			});
		}

		const finalMessage: ChatMessageItem = {
			...assistantMessage,
			content: answer,
			streaming: false,
		};
		const finalSession = { ...session, messages: [...baseMessages, finalMessage] };
		setCurrentSession(finalSession);
		return finalSession;
	};

	const sendContent = async (
		content: string,
		options?: { regenerate?: boolean; sessionOverride?: ChatSessionItem },
	) => {
		const outgoing = content.trim();
		if (!outgoing || sending) return;

		setSending(true);
		if (!options?.regenerate) setDraft("");

		try {
			let activeSession = options?.sessionOverride || currentSession;
			const shouldTitleFromMessage =
				!activeSession || (activeSession.messages.length === 0 && activeSession.title === GENERIC_TITLE);
			const nextTitle = shouldTitleFromMessage ? generateTitle(outgoing) : activeSession?.title || GENERIC_TITLE;

			if (!activeSession) {
				activeSession = await createSession(nextTitle);
			} else if (shouldTitleFromMessage) {
				activeSession = { ...activeSession, title: nextTitle };
				setTitleDraft(nextTitle);
				setCurrentSession(activeSession);
				notifySessionsUpdated();
				try {
					await chatbotApi.updateSession(activeSession.id, nextTitle);
					setBackendAvailable(true);
				} catch {
					setBackendAvailable(false);
					throw new Error("Server chưa hoạt động");
				}
			}

			if (!activeSession) return;

			const userMessage: ChatMessageItem = {
				id: Date.now(),
				sender_type: "user",
				content: outgoing,
			};
			const baseMessages = options?.regenerate
				? activeSession.messages
				: [...activeSession.messages, userMessage];
			const optimisticSession = { ...activeSession, title: nextTitle, messages: baseMessages };
			setCurrentSession(optimisticSession);
			setTitleDraft(nextTitle);

			try {
				const backendMode = toBackendMode(selectedModeId);
				const response = await chatbotApi.sendMessage(activeSession.id, {
					message: outgoing,
					mode: backendMode,
					options: { ...modeOptions },
				});
				const metadata = JSON.stringify({
					...(response.metadata || {}),
					mode: backendMode,
					resultType: response.result_type || response.metadata?.resultType || "text",
					sources: response.sources || response.metadata?.sources || [],
					rewritten_query: response.rewritten_query || null,
				});
				setBackendAvailable(true);
				await streamAssistantMessage(optimisticSession, baseMessages, response.answer, metadata);
				notifySessionsUpdated();
				return;
			} catch (error) {
				setBackendAvailable(false);
				throw new Error(error instanceof Error ? error.message : "Server chưa hoạt động");
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không gửi được tin nhắn");
		} finally {
			setSending(false);
		}
	};

	const regenerateResponse = async () => {
		if (!currentSession || sending) return;
		const lastUserIndex = currentSession.messages
			.map((message) => message.sender_type)
			.lastIndexOf("user");
		if (lastUserIndex < 0) return;

		const lastUserMessage = currentSession.messages[lastUserIndex];
		const baseSession = {
			...currentSession,
			messages: currentSession.messages.slice(0, lastUserIndex + 1),
		};
		setCurrentSession(baseSession);
		await sendContent(lastUserMessage.content, { regenerate: true, sessionOverride: baseSession });
	};

	const copyMessage = async (content: string) => {
		try {
			await navigator.clipboard.writeText(content);
			toast.success("Đã copy tin nhắn");
		} catch {
			toast.error("Không copy được tin nhắn");
		}
	};

	const selectQuickPrompt = (prompt: string) => {
		const mode = chatModes.find((item) => item.prompt === prompt);
		if (mode) setSelectedModeId(mode.id);
		setDraft(prompt);
	};

	useEffect(() => {
		const handleNewSession = () => void createSession();
		const handleOpenSession = (event: Event) => {
			const detail = (event as CustomEvent<{ sessionId: number }>).detail;
			if (detail?.sessionId) void openSession(detail.sessionId);
		};
		const handleDeleteSession = (event: Event) => {
			const detail = (event as CustomEvent<{ sessionId: number }>).detail;
			if (detail?.sessionId) void deleteSession(detail.sessionId);
		};

		window.addEventListener("chatbot:new-session", handleNewSession);
		window.addEventListener("chatbot:open-session", handleOpenSession);
		window.addEventListener("chatbot:delete-session", handleDeleteSession);
		return () => {
			window.removeEventListener("chatbot:new-session", handleNewSession);
			window.removeEventListener("chatbot:open-session", handleOpenSession);
			window.removeEventListener("chatbot:delete-session", handleDeleteSession);
		};
	});

	const messages = useMemo(() => currentSession?.messages || [], [currentSession]);
	const selectedMode = useMemo(
		() => chatModes.find((mode) => mode.id === selectedModeId) || chatModes[0],
		[selectedModeId],
	);

	return (
		<div className="flex h-[calc(100vh-8.5rem)] min-h-[620px] overflow-hidden rounded-xl border bg-background shadow-sm">
			<ChatLayout
				title={currentSession?.title || "Chatbot AI"}
				titleDraft={titleDraft}
				messages={messages}
				features={quickSuggestions}
				modes={chatModes}
				selectedModeId={selectedModeId}
				modeOptions={modeOptions}
				draft={draft}
				sending={sending}
				hasActiveSession={Boolean(currentSession)}
				placeholder={selectedMode.placeholder}
				onTitleDraftChange={setTitleDraft}
				onSaveTitle={() => void saveTitle()}
				onDeleteCurrent={() => currentSession && void deleteSession(currentSession.id)}
				onDraftChange={setDraft}
				onModeChange={setSelectedModeId}
				onModeOptionsChange={setModeOptions}
				onSelectPrompt={selectQuickPrompt}
				onSend={() => void sendContent(draft)}
				onCopyMessage={(content) => void copyMessage(content)}
				onRegenerate={() => void regenerateResponse()}
			/>
		</div>
	);
}
