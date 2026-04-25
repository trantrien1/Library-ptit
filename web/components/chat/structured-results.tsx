"use client";

import { AlertTriangle, BookOpenCheck, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { FlashcardResultData, QuizOptionData, QuizQuestionData, QuizResultData } from "@/lib/chat-structured";

export function JsonValidationError({ message }: { message?: string }) {
	return (
		<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
			<div className="flex items-start gap-2">
				<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
				<div>
					<p className="font-semibold">AI trả về dữ liệu chưa đúng định dạng.</p>
					<p className="mt-1 text-amber-800">{message || "Vui lòng thử lại với yêu cầu rõ hơn."}</p>
				</div>
			</div>
		</div>
	);
}

export function FlashcardProgress({
	current,
	total,
	remembered,
	needsReview,
}: {
	current: number;
	total: number;
	remembered: number;
	needsReview: number;
}) {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between text-xs text-muted-foreground">
				<span>{current}/{total}</span>
				<span>Đã nhớ {remembered} · Cần ôn {needsReview}</span>
			</div>
			<Progress value={(current / total) * 100} />
		</div>
	);
}

export function FlashcardViewer({ data }: { data: FlashcardResultData }) {
	const [index, setIndex] = useState(0);
	const [flipped, setFlipped] = useState(false);
	const [statusById, setStatusById] = useState<Record<string, "remembered" | "needsReview">>({});
	const card = data.cards[index];
	const remembered = Object.values(statusById).filter((status) => status === "remembered").length;
	const needsReview = Object.values(statusById).filter((status) => status === "needsReview").length;

	const goTo = (nextIndex: number) => {
		setIndex(Math.min(Math.max(nextIndex, 0), data.cards.length - 1));
		setFlipped(false);
	};

	const mark = (status: "remembered" | "needsReview") => {
		setStatusById((previous) => ({ ...previous, [card.id]: status }));
	};

	return (
		<div className="space-y-4">
			<FlashcardProgress current={index + 1} total={data.cards.length} remembered={remembered} needsReview={needsReview} />
			<button
				type="button"
				onClick={() => setFlipped((value) => !value)}
				className="min-h-56 w-full rounded-2xl border bg-background p-6 text-left shadow-sm transition duration-200 hover:border-primary/40 hover:shadow-md"
			>
				<div className="flex items-center justify-between gap-3">
					<Badge variant="secondary">{flipped ? "Mặt sau" : "Mặt trước"}</Badge>
					<Badge variant="outline">{card.difficulty}</Badge>
				</div>
				<p className="mt-5 text-lg font-semibold leading-8">{flipped ? card.back : card.front}</p>
				{!flipped && card.hint ? <p className="mt-4 text-sm text-muted-foreground">Gợi ý: {card.hint}</p> : null}
				{card.tags.length ? (
					<div className="mt-5 flex flex-wrap gap-2">
						{card.tags.map((tag) => (
							<Badge key={tag} variant="outline" className="rounded-full">
								{tag}
							</Badge>
						))}
					</div>
				) : null}
			</button>
			<div className="flex flex-wrap items-center gap-2">
				<Button type="button" variant="outline" size="sm" onClick={() => goTo(index - 1)} disabled={index === 0}>
					Thẻ trước
				</Button>
				<Button type="button" variant="secondary" size="sm" onClick={() => setFlipped((value) => !value)}>
					Lật thẻ
				</Button>
				<Button type="button" variant="outline" size="sm" onClick={() => goTo(index + 1)} disabled={index === data.cards.length - 1}>
					Thẻ tiếp theo
				</Button>
				<Button type="button" size="sm" onClick={() => mark("remembered")}>
					Đã nhớ
				</Button>
				<Button type="button" variant="outline" size="sm" onClick={() => mark("needsReview")}>
					Cần ôn lại
				</Button>
			</div>
		</div>
	);
}

export function FlashcardResult({ data }: { data: FlashcardResultData }) {
	return (
		<div className="mt-3 space-y-4 rounded-2xl border bg-muted/20 p-4">
			<div>
				<div className="flex items-center gap-2">
					<BookOpenCheck className="h-5 w-5 text-primary" />
					<h3 className="text-base font-semibold">{data.title}</h3>
				</div>
				<p className="mt-1 text-sm text-muted-foreground">{data.description}</p>
				<p className="mt-1 text-xs text-muted-foreground">Tổng số thẻ: {data.cards.length}</p>
			</div>
			<FlashcardViewer data={data} />
		</div>
	);
}

export function QuizOption({
	option,
	selected,
	submitted,
	correct,
	wrong,
	onSelect,
}: {
	option: QuizOptionData;
	selected: boolean;
	submitted: boolean;
	correct: boolean;
	wrong: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			disabled={submitted}
			className={cn(
				"flex w-full items-start gap-3 rounded-xl border bg-background p-3 text-left text-sm transition duration-200",
				!submitted && "hover:border-primary/50 hover:bg-primary/5",
				selected && !submitted && "border-primary bg-primary/5",
				correct && "border-emerald-400 bg-emerald-50 text-emerald-950",
				wrong && "border-red-300 bg-red-50 text-red-950",
			)}
		>
			<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background font-semibold">
				{option.id}
			</span>
			<span className="leading-6">{option.text}</span>
		</button>
	);
}

export function QuizQuestion({
	question,
	answer,
	submitted,
	onAnswer,
}: {
	question: QuizQuestionData;
	answer?: string;
	submitted: boolean;
	onAnswer: (optionId: string) => void;
}) {
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="outline">{question.difficulty}</Badge>
				{question.tags.map((tag) => (
					<Badge key={tag} variant="secondary" className="rounded-full">
						{tag}
					</Badge>
				))}
			</div>
			<p className="text-base font-semibold leading-7">{question.question}</p>
			<div className="grid gap-2">
				{question.options.map((option) => (
					<QuizOption
						key={option.id}
						option={option}
						selected={answer === option.id}
						submitted={submitted}
						correct={submitted && option.id === question.correctOptionId}
						wrong={submitted && answer === option.id && answer !== question.correctOptionId}
						onSelect={() => onAnswer(option.id)}
					/>
				))}
			</div>
			{submitted ? (
				<div className="rounded-xl bg-muted/60 p-3 text-sm leading-6">
					<span className="font-semibold">Giải thích: </span>
					{question.explanation || "Chưa có giải thích cho câu này."}
				</div>
			) : null}
		</div>
	);
}

export function QuizScoreSummary({ score, total, onRetry }: { score: number; total: number; onRetry: () => void }) {
	const percent = Math.round((score / total) * 100);
	return (
		<div className="rounded-xl border bg-background p-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="text-sm text-muted-foreground">Kết quả</p>
					<p className="text-2xl font-semibold">{score}/{total} câu đúng · {percent}%</p>
				</div>
				<Button type="button" variant="outline" size="sm" onClick={onRetry}>
					<RotateCcw className="h-4 w-4" />
					Làm lại
				</Button>
			</div>
		</div>
	);
}

export function QuizResult({ data }: { data: QuizResultData }) {
	const [index, setIndex] = useState(0);
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [submitted, setSubmitted] = useState(false);
	const question = data.questions[index];
	const answeredCount = Object.keys(answers).length;
	const score = useMemo(
		() => data.questions.filter((item) => answers[item.id] === item.correctOptionId).length,
		[data.questions, answers],
	);

	const submit = () => {
		if (answeredCount < data.questions.length && !window.confirm("Bạn chưa trả lời hết câu hỏi. Bạn vẫn muốn nộp bài?")) {
			return;
		}
		setSubmitted(true);
	};

	const retry = () => {
		setAnswers({});
		setSubmitted(false);
		setIndex(0);
	};

	return (
		<div className="mt-3 space-y-4 rounded-2xl border bg-muted/20 p-4">
			<div>
				<h3 className="text-base font-semibold">{data.title}</h3>
				<p className="mt-1 text-sm text-muted-foreground">{data.description}</p>
				<p className="mt-1 text-xs text-muted-foreground">Tổng số câu hỏi: {data.questions.length}</p>
			</div>
			{submitted ? <QuizScoreSummary score={score} total={data.questions.length} onRetry={retry} /> : null}
			<div className="space-y-2">
				<div className="flex items-center justify-between text-xs text-muted-foreground">
					<span>Câu {index + 1}/{data.questions.length}</span>
					<span>Đã chọn {answeredCount}/{data.questions.length}</span>
				</div>
				<Progress value={((index + 1) / data.questions.length) * 100} />
			</div>
			<QuizQuestion
				question={question}
				answer={answers[question.id]}
				submitted={submitted}
				onAnswer={(optionId) => setAnswers((previous) => ({ ...previous, [question.id]: optionId }))}
			/>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex gap-2">
					<Button type="button" variant="outline" size="sm" onClick={() => setIndex((value) => Math.max(value - 1, 0))} disabled={index === 0}>
						Câu trước
					</Button>
					<Button type="button" variant="outline" size="sm" onClick={() => setIndex((value) => Math.min(value + 1, data.questions.length - 1))} disabled={index === data.questions.length - 1}>
						Câu tiếp theo
					</Button>
				</div>
				{submitted ? (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						{answers[question.id] === question.correctOptionId ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
						Đáp án đúng: {question.correctOptionId}
					</div>
				) : (
					<Button type="button" size="sm" onClick={submit}>
						Nộp bài
					</Button>
				)}
			</div>
		</div>
	);
}
