"use client";

import type {
	AdminOverview,
	AdminDashboardOverview,
	AppUser,
	Book,
	BookStats,
	Booking,
	BookingResource,
	BorrowRequest,
	ChatSessionDetail,
	ChatSessionSummary,
	DigitalResource,
	DiscussionGroup,
	DiscussionGroupMember,
	DiscussionPost,
	DiscussionPostComment,
	LibraryEvent,
	LibraryFeedback,
	LibraryInfo,
	LibrarianQuestion,
	EventRegistration,
	Lab,
	LabBooking,
	NewsPost,
	PaginatedResponse,
	PlatformOverview,
	PrintJob,
	ReadingChallenge,
	Recommendation,
	ReminderResponse,
	RenewalRequest,
	Review,
	ReviewSummary,
	SocialActionResult,
	SocialHubSidebar,
	Tutorial,
	UserBadge,
	UserDashboardOverview,
	VolunteerDonation,
	VolunteerProgram,
	UserStats,
	WishlistItem,
} from "@/lib/types";

export const API_ROOT =
	process.env.NEXT_PUBLIC_API_ROOT?.replace(/\/$/, "") || "http://127.0.0.1:8000";
export const API_BASE_URL =
	process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || `${API_ROOT}/api`;

function getToken() {
	if (typeof window === "undefined") return null;
	const storage = window.localStorage;
	if (!storage || typeof storage.getItem !== "function") return null;
	return storage.getItem("token") || null;
}

async function parseResponse<T>(response: Response): Promise<T> {
	const text = await response.text();
	const data = text ? JSON.parse(text) : {};

	if (!response.ok) {
		let message = "Có lỗi xảy ra";
		if (typeof data?.detail === "string") {
			message = data.detail;
		} else if (Array.isArray(data?.detail)) {
			message = data.detail
				.map((item: { msg?: string }) => item.msg || "Dữ liệu không hợp lệ")
				.join(". ");
		} else if (data?.message) {
			message = data.message;
		}
		throw new Error(message);
	}

	return data as T;
}

async function request<T>(
	path: string,
	init?: RequestInit & { auth?: boolean; isFormData?: boolean },
) {
	const headers = new Headers(init?.headers);

	if (!init?.isFormData) {
		headers.set("Content-Type", "application/json");
	}

	if (init?.auth !== false) {
		const token = getToken();
		if (token) headers.set("Authorization", `Bearer ${token}`);
	}

	return parseResponse<T>(
		await fetch(`${API_BASE_URL}${path}`, {
			...init,
			headers,
		}),
	);
}

export const authApi = {
	login: async (username: string, password: string) => {
		const formData = new URLSearchParams();
		formData.append("username", username);
		formData.append("password", password);
		return parseResponse<{ access_token: string }>(
			await fetch(`${API_BASE_URL}/auth/login`, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: formData,
			}),
		);
	},
	register: async (payload: {
		username: string;
		email: string;
		password: string;
		full_name?: string | null;
		phone?: string | null;
	}) =>
		request<AppUser>("/auth/register", {
			method: "POST",
			auth: false,
			body: JSON.stringify(payload),
		}),
	me: async () => request<AppUser>("/auth/me"),
};

export const booksApi = {
	list: async (page = 1, pageSize = 10, search = "", category = "") => {
		const params = new URLSearchParams({
			page: String(page),
			page_size: String(pageSize),
		});
		if (search) params.set("search", search);
		if (category) params.set("category", category);
		return request<PaginatedResponse<Book>>(`/books?${params.toString()}`, {
			auth: false,
		});
	},
	get: async (id: number) => request<Book>(`/books/${id}`, { auth: false }),
	categories: async () => request<string[]>("/books/categories", { auth: false }),
	create: async (payload: Partial<Book>) =>
		request<Book>("/books", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	update: async (id: number, payload: Partial<Book>) =>
		request<Book>(`/books/${id}`, {
			method: "PUT",
			body: JSON.stringify(payload),
		}),
	remove: async (id: number) =>
		request<boolean>(`/books/${id}`, { method: "DELETE" }),
	uploadPdf: async (id: number, file: File) => {
		const formData = new FormData();
		formData.append("pdf", file);
		return request(`/books/${id}/upload-pdf`, {
			method: "POST",
			body: formData,
			isFormData: true,
		});
	},
	previewPdfUrl: (id: number) => `${API_ROOT}/api/books/${id}/preview-pdf`,
	reviews: async (bookId: number) =>
		request<Review[]>(`/books/${bookId}/reviews`, { auth: false }),
	reviewSummary: async (bookId: number) =>
		request<ReviewSummary>(`/books/${bookId}/reviews/summary`, {
			auth: false,
		}),
	myReview: async (bookId: number) => {
		try {
			return await request<Review>(`/books/${bookId}/reviews/me`);
		} catch {
			return null;
		}
	},
	saveReview: async (bookId: number, rating: number, comment: string) =>
		request(`/books/${bookId}/reviews`, {
			method: "POST",
			body: JSON.stringify({ rating, comment }),
		}),
};

export const usersApi = {
	list: async (page = 1, pageSize = 10, search = "") => {
		const params = new URLSearchParams({
			page: String(page),
			page_size: String(pageSize),
		});
		if (search) params.set("search", search);
		return request<AppUser[]>(`/users?${params.toString()}`);
	},
	get: async (id: number) => request<AppUser>(`/users/${id}`),
	update: async (id: number, payload: Partial<AppUser>) =>
		request<AppUser>(`/users/${id}`, {
			method: "PUT",
			body: JSON.stringify(payload),
		}),
	resetPassword: async (id: number, newPassword: string) =>
		request(`/users/${id}/reset-password`, {
			method: "PUT",
			body: JSON.stringify({ new_password: newPassword }),
		}),
	remove: async (id: number) =>
		request<boolean>(`/users/${id}`, { method: "DELETE" }),
};

export const wishlistApi = {
	get: async () =>
		request<{ items: WishlistItem[]; total_items: number }>("/wishlist"),
	add: async (bookId: number, quantity = 1) =>
		request("/wishlist", {
			method: "POST",
			body: JSON.stringify({ book_id: bookId, quantity }),
		}),
	update: async (bookId: number, quantity: number) =>
		request(`/wishlist/${bookId}`, {
			method: "PUT",
			body: JSON.stringify({ quantity }),
		}),
	remove: async (bookId: number) =>
		request<boolean>(`/wishlist/${bookId}`, { method: "DELETE" }),
	clear: async () => request<boolean>("/wishlist", { method: "DELETE" }),
};

export const borrowsApi = {
	list: async (page = 1, pageSize = 10, status = "", search = "") => {
		const params = new URLSearchParams({
			page: String(page),
			page_size: String(pageSize),
		});
		if (status) params.set("status_filter", status);
		if (search) params.set("search", search);
		return request<PaginatedResponse<BorrowRequest>>(
			`/borrows?${params.toString()}`,
		);
	},
	get: async (id: number) => request<BorrowRequest>(`/borrows/${id}`),
	create: async (
		note = "",
		items?: Array<{ book_id: number; quantity: number }>,
		dueDate?: string,
	) =>
		request("/borrows", {
			method: "POST",
			body: JSON.stringify({
				note,
				items: items || null,
				due_date: dueDate || null,
			}),
		}),
	update: async (
		id: number,
		note: string,
		items: Array<{ book_id: number; quantity: number }>,
		dueDate?: string,
	) =>
		request(`/borrows/${id}`, {
			method: "PUT",
			body: JSON.stringify({ note, items, due_date: dueDate || null }),
		}),
	approve: async (id: number, adminNote = "") =>
		request(`/borrows/${id}/approve`, {
			method: "PUT",
			body: JSON.stringify({ admin_note: adminNote }),
		}),
	reject: async (id: number, adminNote: string, requireEdit = false) =>
		request(`/borrows/${id}/reject`, {
			method: "PUT",
			body: JSON.stringify({ admin_note: adminNote, require_edit: requireEdit }),
		}),
	returnBooks: async (id: number) =>
		request(`/borrows/${id}/return`, { method: "PUT" }),
	remove: async (id: number) =>
		request<boolean>(`/borrows/${id}`, { method: "DELETE" }),
	reminders: async (daysAhead = 3, limit = 10) =>
		request<ReminderResponse>(
			`/borrows/reminders?days_ahead=${daysAhead}&limit=${limit}`,
		),
	waitlistJoin: async (bookId: number, quantity = 1) =>
		request("/borrows/waitlist", {
			method: "POST",
			body: JSON.stringify({ book_id: bookId, quantity }),
		}),
};

export const renewalApi = {
	getPending: async () => request<RenewalRequest[]>("/borrows/renewals"),
	requestRenewal: async (borrowId: number, requestedDays: number, reason: string) =>
		request(`/borrows/${borrowId}/renew`, {
			method: "POST",
			body: JSON.stringify({ requested_days: requestedDays, reason }),
		}),
	approve: async (renewalId: number) =>
		request(`/borrows/renewals/${renewalId}/approve`, { method: "POST" }),
	reject: async (renewalId: number, adminNote: string) =>
		request(
			`/borrows/renewals/${renewalId}/reject?admin_note=${encodeURIComponent(adminNote)}`,
			{ method: "POST" },
		),
};

export const adminStatsApi = {
	overview: async (periodDays = 30) =>
		request<AdminOverview>(`/admin/stats/overview?period_days=${periodDays}`),
	bookStats: async (periodDays = 30, lowStockThreshold = 2, topLimit = 10) =>
		request<BookStats>(
			`/admin/stats/books?period_days=${periodDays}&low_stock_threshold=${lowStockThreshold}&top_limit=${topLimit}`,
		),
	userStats: async (periodDays = 30, topLimit = 10) =>
		request<UserStats>(
			`/admin/stats/users?period_days=${periodDays}&top_limit=${topLimit}`,
		),
};

export const dashboardApi = {
	userOverview: async (period = "30d") =>
		request<UserDashboardOverview>(`/dashboard/user/overview?period=${encodeURIComponent(period)}`),
	adminOverview: async (period = "30d") =>
		request<AdminDashboardOverview>(`/dashboard/admin/overview?period=${encodeURIComponent(period)}`),
};

export const chatbotApi = {
	sessions: async () => request<ChatSessionSummary[]>("/chatbot/sessions"),
	createSession: async (title: string) =>
		request<ChatSessionSummary>("/chatbot/sessions", {
			method: "POST",
			body: JSON.stringify({ title }),
		}),
	getSession: async (id: number) =>
		request<ChatSessionDetail>(`/chatbot/sessions/${id}`),
	updateSession: async (id: number, title: string) =>
		request(`/chatbot/sessions/${id}`, {
			method: "PATCH",
			body: JSON.stringify({ title }),
		}),
	deleteSession: async (id: number) =>
		request<boolean>(`/chatbot/sessions/${id}`, { method: "DELETE" }),
	sendMessage: async (
		id: number,
		payload: string | { message: string; mode?: string; options?: Record<string, unknown> },
	) =>
		request<{
			answer: string;
			sources: Array<Record<string, unknown>>;
			rewritten_query?: string | null;
			result_type?: string;
			metadata?: Record<string, unknown>;
		}>(`/chatbot/sessions/${id}/chat`, {
			method: "POST",
			body: JSON.stringify(typeof payload === "string" ? { message: payload } : payload),
		}),
};

export const platformApi = {
	overview: async () => request<PlatformOverview>("/platform/overview"),
	resources: async (search = "", resourceType = "") => {
		const params = new URLSearchParams();
		if (search) params.set("search", search);
		if (resourceType) params.set("resource_type", resourceType);
		return request<DigitalResource[]>(`/platform/resources?${params.toString()}`);
	},
	createResource: async (payload: Partial<DigitalResource>) =>
		request<DigitalResource>("/platform/resources", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	newTitles: async () => request<Book[]>("/platform/discover/new-titles"),
	recommendations: async () => request<Recommendation[]>("/platform/recommendations"),
	groups: async () => request<DiscussionGroup[]>("/platform/groups"),
	group: async (id: number) => request<DiscussionGroup>(`/platform/groups/${id}`),
	joinGroup: async (id: number) =>
		request<DiscussionGroup>(`/platform/groups/${id}/join`, { method: "POST" }),
	leaveGroup: async (id: number) =>
		request<DiscussionGroup>(`/platform/groups/${id}/leave`, { method: "DELETE" }),
	deleteGroup: async (id: number) =>
		request<{ ok: boolean }>(`/platform/groups/${id}`, { method: "DELETE" }),
	groupMembers: async (id: number, statusFilter = "approved") =>
		request<DiscussionGroupMember[]>(
			`/platform/groups/${id}/members?status_filter=${encodeURIComponent(statusFilter)}`,
		),
	approveGroupMember: async (groupId: number, userId: number) =>
		request<DiscussionGroupMember>(
			`/platform/groups/${groupId}/members/${userId}/approve`,
			{ method: "PATCH" },
		),
	rejectGroupMember: async (groupId: number, userId: number) =>
		request<DiscussionGroupMember>(
			`/platform/groups/${groupId}/members/${userId}/reject`,
			{ method: "PATCH" },
		),
	createGroup: async (payload: {
		name: string;
		slug: string;
		topic?: string;
		description?: string;
		requires_approval?: boolean;
		rules?: string | null;
	}) =>
		request<DiscussionGroup>("/platform/groups", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	feed: async (groupId?: number, sort = "latest", limit = 30, offset = 0) => {
		const params = new URLSearchParams({
			sort,
			limit: String(limit),
			offset: String(offset),
		});
		if (groupId) params.set("group_id", String(groupId));
		return request<DiscussionPost[]>(`/platform/feed?${params.toString()}`);
	},
	createPost: async (payload: {
		group_id: number;
		title: string;
		content: string;
		book_id?: number | null;
		post_type?: string;
		tags?: string | null;
		rating?: number | null;
	}) =>
		request<DiscussionPost>("/platform/posts", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	updatePost: async (postId: number, payload: {
		group_id?: number;
		title?: string;
		content?: string;
		book_id?: number | null;
		post_type?: string;
		tags?: string | null;
		rating?: number | null;
	}) =>
		request<DiscussionPost>(`/platform/posts/${postId}`, {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	deletePost: async (postId: number) =>
		request<{ ok: boolean }>(`/platform/posts/${postId}`, { method: "DELETE" }),
	comments: async (postId: number) =>
		request<DiscussionPostComment[]>(`/platform/posts/${postId}/comments`),
	commentPost: async (postId: number, content: string) =>
		request<DiscussionPostComment>(`/platform/posts/${postId}/comments`, {
			method: "POST",
			body: JSON.stringify({ content }),
		}),
	likePost: async (postId: number) =>
		request<SocialActionResult>(`/platform/posts/${postId}/like`, {
			method: "POST",
		}),
	savePost: async (postId: number) =>
		request<SocialActionResult>(`/platform/posts/${postId}/save`, {
			method: "POST",
		}),
	socialSidebar: async () => request<SocialHubSidebar>("/platform/social/sidebar"),
	challenges: async () => request<ReadingChallenge[]>("/platform/challenges"),
	createChallenge: async (payload: {
		title: string;
		description?: string;
		start_date: string;
		end_date: string;
		target_books: number;
	}) =>
		request<ReadingChallenge>("/platform/challenges", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	joinChallenge: async (id: number) =>
		request(`/platform/challenges/${id}/join`, { method: "POST" }),
	badges: async () => request<UserBadge[]>("/platform/badges/me"),
	bookingResources: async (resourceType = "") =>
		request<BookingResource[]>(
			`/platform/booking-resources${resourceType ? `?resource_type=${resourceType}` : ""}`,
		),
	createBookingResource: async (payload: Partial<BookingResource>) =>
		request<BookingResource>("/platform/booking-resources", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	createBooking: async (payload: {
		resource_id: number;
		start_time: string;
		end_time: string;
		purpose?: string;
	}) =>
		request<Booking>("/platform/bookings", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	bookings: async () => request<Booking[]>("/platform/bookings"),
	createPrintJob: async (payload: { file_name: string; page_count: number }) =>
		request<PrintJob>("/platform/print-jobs", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	printJobs: async () => request<PrintJob[]>("/platform/print-jobs"),
	askLibrarian: async (payload: { question: string; appointment_at?: string | null }) =>
		request<LibrarianQuestion>("/platform/librarian-questions", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	librarianQuestions: async () =>
		request<LibrarianQuestion[]>("/platform/librarian-questions"),
	events: async (params: Record<string, string | boolean | number | undefined> = {}) => {
		const search = new URLSearchParams();
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== "") search.set(key, String(value));
		});
		return request<LibraryEvent[]>(`/events${search.toString() ? `?${search.toString()}` : ""}`);
	},
	eventDetail: async (id: number) => request<LibraryEvent>(`/events/${id}`),
	createEvent: async (payload: Partial<LibraryEvent>) =>
		request<LibraryEvent>("/events", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	updateEvent: async (id: number, payload: Partial<LibraryEvent>) =>
		request<LibraryEvent>(`/events/${id}`, {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	deleteEvent: async (id: number) =>
		request<{ ok: boolean }>(`/events/${id}`, { method: "DELETE" }),
	registerEvent: async (id: number) =>
		request<LibraryEvent>(`/events/${id}/register`, { method: "POST" }),
	cancelEventRegistration: async (id: number) =>
		request<LibraryEvent>(`/events/${id}/register`, { method: "DELETE" }),
	eventRegistrations: async (id: number) =>
		request<EventRegistration[]>(`/events/${id}/registrations`),
	checkinEventUser: async (eventId: number, payload: { user_id?: number; registration_id?: number }) =>
		request<EventRegistration>(`/events/${eventId}/checkin`, {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	labs: async (params: Record<string, string | boolean | number | undefined> = {}) => {
		const search = new URLSearchParams();
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== "") search.set(key, String(value));
		});
		return request<Lab[]>(`/labs${search.toString() ? `?${search.toString()}` : ""}`);
	},
	createLab: async (payload: Partial<Lab>) =>
		request<Lab>("/labs", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	updateLab: async (id: number, payload: Partial<Lab>) =>
		request<Lab>(`/labs/${id}`, {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	deleteLab: async (id: number) =>
		request<{ ok: boolean }>(`/labs/${id}`, { method: "DELETE" }),
	createLabBooking: async (labId: number, payload: {
		start_time: string;
		end_time: string;
		purpose?: string;
		participant_count: number;
	}) =>
		request<LabBooking>(`/labs/${labId}/bookings`, {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	labBookings: async (params: Record<string, string | number | undefined> = {}) => {
		const search = new URLSearchParams();
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== "") search.set(key, String(value));
		});
		return request<LabBooking[]>(`/lab-bookings${search.toString() ? `?${search.toString()}` : ""}`);
	},
	approveLabBooking: async (id: number) =>
		request<LabBooking>(`/lab-bookings/${id}/approve`, { method: "PATCH" }),
	rejectLabBooking: async (id: number, admin_note?: string) =>
		request<LabBooking>(`/lab-bookings/${id}/reject`, {
			method: "PATCH",
			body: JSON.stringify({ admin_note }),
		}),
	cancelLabBooking: async (id: number) =>
		request<LabBooking>(`/lab-bookings/${id}/cancel`, { method: "PATCH" }),
	tutorials: async (params: Record<string, string | boolean | number | undefined> = {}) => {
		const search = new URLSearchParams();
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== "") search.set(key, String(value));
		});
		return request<Tutorial[]>(`/tutorials${search.toString() ? `?${search.toString()}` : ""}`);
	},
	createTutorial: async (payload: Partial<Tutorial>) =>
		request<Tutorial>("/tutorials", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	updateTutorial: async (id: number, payload: Partial<Tutorial>) =>
		request<Tutorial>(`/tutorials/${id}`, {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	deleteTutorial: async (id: number) =>
		request<{ ok: boolean }>(`/tutorials/${id}`, { method: "DELETE" }),
	increaseTutorialView: async (id: number) =>
		request<Tutorial>(`/tutorials/${id}/view`, { method: "POST" }),
	libraryInfo: async () => request<LibraryInfo>("/library-info"),
	updateLibraryInfo: async (payload: Partial<LibraryInfo>) =>
		request<LibraryInfo>("/library-info", {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	news: async (params: Record<string, string | number | undefined> = {}) => {
		const search = new URLSearchParams();
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== "") search.set(key, String(value));
		});
		return request<NewsPost[]>(`/news${search.toString() ? `?${search.toString()}` : ""}`);
	},
	newsDetail: async (id: number) => request<NewsPost>(`/news/${id}`),
	createNews: async (payload: Partial<NewsPost>) =>
		request<NewsPost>("/news", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	updateNews: async (id: number, payload: Partial<NewsPost>) =>
		request<NewsPost>(`/news/${id}`, {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	deleteNews: async (id: number) =>
		request<{ ok: boolean }>(`/news/${id}`, { method: "DELETE" }),
	feedback: async (payload: {
		feedback_type?: string;
		subject: string;
		message: string;
		priority?: string;
	}) =>
		request<LibraryFeedback>("/feedback", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	myFeedback: async () => request<LibraryFeedback[]>("/my-feedback"),
	allFeedback: async (params: Record<string, string | undefined> = {}) => {
		const search = new URLSearchParams();
		Object.entries(params).forEach(([key, value]) => {
			if (value) search.set(key, value);
		});
		return request<LibraryFeedback[]>(`/feedback${search.toString() ? `?${search.toString()}` : ""}`);
	},
	updateFeedbackStatus: async (id: number, status: string) =>
		request<LibraryFeedback>(`/feedback/${id}/status`, {
			method: "PATCH",
			body: JSON.stringify({ status }),
		}),
	volunteerDonation: async (payload: {
		program_type: string;
		title?: string;
		contact_info?: string;
		message?: string;
	}) =>
		request<VolunteerDonation>("/donations", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	donations: async () => request<VolunteerDonation[]>("/donations"),
	updateDonationStatus: async (id: number, status: string) =>
		request<VolunteerDonation>(`/donations/${id}/status`, {
			method: "PATCH",
			body: JSON.stringify({ status }),
		}),
	volunteerPrograms: async (includeHidden = false) =>
		request<VolunteerProgram[]>(`/volunteer-programs${includeHidden ? "?include_hidden=true" : ""}`),
	createVolunteerProgram: async (payload: Partial<VolunteerProgram>) =>
		request<VolunteerProgram>("/volunteer-programs", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	updateVolunteerProgram: async (id: number, payload: Partial<VolunteerProgram>) =>
		request<VolunteerProgram>(`/volunteer-programs/${id}`, {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
};
