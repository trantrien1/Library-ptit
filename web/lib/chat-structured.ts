export type Difficulty = "easy" | "medium" | "hard";

export interface FlashcardCard {
	id: string;
	front: string;
	back: string;
	hint?: string;
	difficulty: Difficulty;
	tags: string[];
}

export interface FlashcardResultData {
	type: "flashcards";
	title: string;
	description: string;
	sourceSummary: string;
	cards: FlashcardCard[];
}

export interface QuizOptionData {
	id: "A" | "B" | "C" | "D";
	text: string;
}

export interface QuizQuestionData {
	id: string;
	question: string;
	options: QuizOptionData[];
	correctOptionId: "A" | "B" | "C" | "D";
	explanation: string;
	difficulty: Difficulty;
	tags: string[];
}

export interface QuizResultData {
	type: "quiz";
	title: string;
	description: string;
	sourceSummary: string;
	questions: QuizQuestionData[];
}

export interface StructuredOptions {
	questionCount?: number;
	cardCount?: number;
	difficulty?: Difficulty | "mixed";
	includeExplanations?: boolean;
}

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const OPTION_IDS = new Set(["A", "B", "C", "D"]);

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fallback = "") {
	return typeof value === "string" ? value.trim() : fallback;
}

function asTags(value: unknown) {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
}

export function parseAIJsonResponse(raw: string): unknown {
	const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
	try {
		return JSON.parse(clean);
	} catch {
		const start = clean.indexOf("{");
		const end = clean.lastIndexOf("}");
		if (start >= 0 && end > start) {
			return JSON.parse(clean.slice(start, end + 1));
		}
		throw new Error("AI trả về dữ liệu chưa đúng định dạng JSON.");
	}
}

export function validateFlashcardJson(value: unknown): FlashcardResultData {
	const data = asRecord(value);
	if (data.type !== "flashcards") throw new Error("Flashcard JSON phải có type = flashcards.");
	if (!Array.isArray(data.cards) || data.cards.length === 0) throw new Error("Flashcard JSON thiếu danh sách thẻ.");

	const seen = new Set<string>();
	const cards = data.cards.map((item, index) => {
		const card = asRecord(item);
		const id = asString(card.id, `fc_${index + 1}`) || `fc_${index + 1}`;
		if (seen.has(id)) throw new Error("ID flashcard bị trùng.");
		seen.add(id);

		const front = asString(card.front);
		const back = asString(card.back);
		if (!front || !back) throw new Error("Mặt trước và mặt sau flashcard không được rỗng.");

		const difficulty = asString(card.difficulty, "medium");
		if (!DIFFICULTIES.has(difficulty)) throw new Error("Difficulty của flashcard không hợp lệ.");

		return {
			id,
			front,
			back,
			hint: asString(card.hint),
			difficulty: difficulty as Difficulty,
			tags: asTags(card.tags),
		};
	});

	return {
		type: "flashcards",
		title: asString(data.title, "Bộ flashcard ôn tập"),
		description: asString(data.description, "Ôn tập nhanh bằng thẻ lật."),
		sourceSummary: asString(data.sourceSummary),
		cards,
	};
}

export function validateQuizJson(value: unknown): QuizResultData {
	const data = asRecord(value);
	if (data.type !== "quiz") throw new Error("Quiz JSON phải có type = quiz.");
	if (!Array.isArray(data.questions) || data.questions.length === 0) throw new Error("Quiz JSON thiếu câu hỏi.");

	const seen = new Set<string>();
	const questions = data.questions.map((item, index) => {
		const question = asRecord(item);
		const id = asString(question.id, `q_${index + 1}`) || `q_${index + 1}`;
		if (seen.has(id)) throw new Error("ID câu hỏi bị trùng.");
		seen.add(id);

		const text = asString(question.question);
		if (!text) throw new Error("Câu hỏi không được rỗng.");
		if (!Array.isArray(question.options) || question.options.length !== 4) {
			throw new Error("Mỗi câu hỏi phải có đúng 4 đáp án.");
		}

		const options = question.options.map((option) => {
			const optionRecord = asRecord(option);
			const optionId = asString(optionRecord.id);
			const optionText = asString(optionRecord.text);
			if (!OPTION_IDS.has(optionId) || !optionText) throw new Error("Đáp án quiz không hợp lệ.");
			return { id: optionId as QuizOptionData["id"], text: optionText };
		});

		const correctOptionId = asString(question.correctOptionId);
		if (!options.some((option) => option.id === correctOptionId)) {
			throw new Error("correctOptionId không khớp với đáp án nào.");
		}

		const difficulty = asString(question.difficulty, "medium");
		if (!DIFFICULTIES.has(difficulty)) throw new Error("Difficulty của quiz không hợp lệ.");

		return {
			id,
			question: text,
			options,
			correctOptionId: correctOptionId as QuizQuestionData["correctOptionId"],
			explanation: asString(question.explanation),
			difficulty: difficulty as Difficulty,
			tags: asTags(question.tags),
		};
	});

	return {
		type: "quiz",
		title: asString(data.title, "Quiz trắc nghiệm"),
		description: asString(data.description, "Luyện tập nhanh với câu hỏi trắc nghiệm."),
		sourceSummary: asString(data.sourceSummary),
		questions,
	};
}

export function buildFlashcardPrompt(input: string, options: StructuredOptions = {}, sources: unknown[] = []) {
	const cardCount = options.cardCount || 10;
	return [
		"Bạn là AI tạo flashcard học tập cho sinh viên từ nội dung được cung cấp.",
		"Hãy tạo bộ flashcard dựa trên yêu cầu của người dùng và nguồn tài liệu nếu có.",
		"Chỉ trả về JSON hợp lệ, không Markdown, không giải thích ngoài JSON.",
		`Tạo đúng ${cardCount} thẻ.`,
		`Mức độ: ${options.difficulty || "mixed"}.`,
		"Schema bắt buộc:",
		'{"type":"flashcards","title":string,"description":string,"sourceSummary":string,"cards":[{"id":string,"front":string,"back":string,"hint":string,"difficulty":"easy|medium|hard","tags":string[]}]}',
		`Yêu cầu người dùng: ${input}`,
		`Nguồn tham khảo: ${JSON.stringify(sources)}`,
	].join("\n");
}

export function buildQuizPrompt(input: string, options: StructuredOptions = {}, sources: unknown[] = []) {
	const questionCount = options.questionCount || 10;
	return [
		"Bạn là AI tạo câu hỏi trắc nghiệm học tập cho sinh viên từ nội dung được cung cấp.",
		"Hãy tạo quiz dựa trên yêu cầu của người dùng và nguồn tài liệu nếu có.",
		"Chỉ trả về JSON hợp lệ, không Markdown, không giải thích ngoài JSON.",
		`Tạo đúng ${questionCount} câu hỏi.`,
		`Mức độ: ${options.difficulty || "mixed"}.`,
		`Có giải thích: ${options.includeExplanations === false ? "không bắt buộc" : "bắt buộc"}.`,
		"Schema bắt buộc:",
		'{"type":"quiz","title":string,"description":string,"sourceSummary":string,"questions":[{"id":string,"question":string,"options":[{"id":"A","text":string},{"id":"B","text":string},{"id":"C","text":string},{"id":"D","text":string}],"correctOptionId":"A|B|C|D","explanation":string,"difficulty":"easy|medium|hard","tags":string[]}]}',
		`Yêu cầu người dùng: ${input}`,
		`Nguồn tham khảo: ${JSON.stringify(sources)}`,
	].join("\n");
}
