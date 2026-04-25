import type { LucideIcon } from "lucide-react";

export type ChatSender = "user" | "assistant";

export interface ChatSource {
	title?: string | null;
	author?: string | null;
	category?: string | null;
	score?: number | null;
	[key: string]: unknown;
}

export interface ChatMessageItem {
	id: number;
	sender_type: ChatSender;
	content: string;
	metadata_?: string | null;
	streaming?: boolean;
}

export interface ChatSessionItem {
	id: number;
	title: string;
	messages: ChatMessageItem[];
}

export interface ChatSessionNavItem {
	id: number;
	title: string;
}

export interface FeatureCardItem {
	id: string;
	title: string;
	description: string;
	status: string;
	prompt: string;
	icon: LucideIcon;
}

export interface ChatModeItem {
	id: string;
	label: string;
	description: string;
	placeholder: string;
	prompt: string;
	icon: LucideIcon;
}

export interface ChatModeOptions {
	questionCount: number;
	cardCount: number;
	difficulty: "easy" | "medium" | "hard" | "mixed";
	includeExplanations: boolean;
}
