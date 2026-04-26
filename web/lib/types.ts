export type UserRole = "admin" | "user";

export interface AppUser {
	id: number;
	username: string;
	email: string;
	role: UserRole;
	full_name?: string | null;
	phone?: string | null;
	is_active?: boolean;
	created_at?: string;
}

export interface PaginatedResponse<T> {
	items: T[];
	total: number;
	page: number;
	page_size: number;
	total_pages: number;
}

export interface Book {
	id: number;
	title: string;
	author?: string | null;
	isbn?: string | null;
	category?: string | null;
	quantity: number;
	available_quantity: number;
	description?: string | null;
	cover_image?: string | null;
	pdf_file?: string | null;
}

export interface WishlistItem {
	book_id: number;
	quantity: number;
	book?: Book;
}

export interface BorrowItem {
	book_id: number;
	quantity: number;
	book?: Book;
}

export interface BorrowRequest {
	id: number;
	status: string;
	created_at: string;
	due_date?: string | null;
	note?: string | null;
	admin_note?: string | null;
	renewal_count?: number;
	user?: AppUser;
	items: BorrowItem[];
}

export interface Review {
	id: number;
	rating: number;
	comment?: string | null;
	username?: string;
	full_name?: string | null;
	created_at: string;
}

export interface ReviewSummary {
	average_rating: number;
	total_reviews: number;
}

export interface ReminderItem {
	request_id: number;
	message: string;
	first_book_title?: string | null;
	total_books: number;
}

export interface ReminderResponse {
	items: ReminderItem[];
	due_soon_count: number;
	overdue_count: number;
}

export interface RenewalRequest {
	id: number;
	request_id: number;
	requested_days: number;
	reason?: string | null;
	created_at: string;
}

export interface AdminOverview {
	total_titles: number;
	total_users: number;
	pending_borrows: number;
	active_borrows: number;
	total_book_copies: number;
	available_book_copies: number;
	new_users_in_period: number;
	overdue_borrows: number;
	borrow_requests_in_period: number;
	borrow_items_in_period: number;
	recent_borrows: BorrowRequest[];
}

export interface BookStats {
	top_borrowed_books: Array<{
		book_id: number;
		title: string;
		borrow_count: number;
	}>;
	category_distribution: Array<{
		category: string;
		title_count: number;
	}>;
}

export interface UserStats {
	active_users_in_period: number;
	inactive_users_in_period: number;
	registrations_by_day: Array<{
		date: string;
		count: number;
	}>;
}

export interface ChatSessionSummary {
	id: number;
	title: string;
}

export interface ChatSessionMessage {
	id: number;
	sender_type: "user" | "assistant";
	content: string;
	metadata_?: string | null;
}

export interface ChatSessionDetail {
	id: number;
	title: string;
	messages: ChatSessionMessage[];
}

export interface DigitalResource {
	id: number;
	title: string;
	resource_type: string;
	source_type: string;
	url?: string | null;
	description?: string | null;
	subjects?: string | null;
	access_level: string;
	created_at: string;
}

export interface Recommendation {
	id: number;
	reason?: string | null;
	score: number;
	book?: Book | null;
}

export interface PlatformOverview {
	digital_resources: number;
	discussion_groups: number;
	discussion_posts: number;
	active_challenges: number;
	booking_resources: number;
	upcoming_events: number;
	news_posts: number;
}

export interface DiscussionGroup {
	id: number;
	name: string;
	slug: string;
	topic?: string | null;
	description?: string | null;
	owner_id?: number | null;
	is_public: boolean;
	requires_approval?: boolean;
	rules?: string | null;
	status?: string;
	created_at: string;
	member_count?: number;
	post_count?: number;
	is_member?: boolean;
	membership_status?: string | null;
	group_role?: string | null;
	is_group_admin?: boolean;
}

export interface DiscussionPost {
	id: number;
	group_id: number;
	user_id: number;
	book_id?: number | null;
	title: string;
	content: string;
	post_type: string;
	tags?: string | null;
	rating?: number | null;
	status?: string;
	created_at: string;
	user?: AppUser | null;
	book?: Book | null;
	group?: DiscussionGroup | null;
	like_count?: number;
	comment_count?: number;
	save_count?: number;
	liked_by_me?: boolean;
	saved_by_me?: boolean;
	is_owner?: boolean;
	can_edit?: boolean;
	can_delete?: boolean;
}

export interface DiscussionPostComment {
	id: number;
	post_id: number;
	user_id: number;
	content: string;
	status?: string;
	created_at: string;
	user?: AppUser | null;
}

export interface DiscussionGroupMember {
	id: number;
	group_id: number;
	user_id: number;
	role: string;
	status: string;
	joined_at: string;
	user?: AppUser | null;
}

export interface ReadingChallenge {
	id: number;
	title: string;
	description?: string | null;
	start_date: string;
	end_date: string;
	target_books: number;
	created_at: string;
	participant_count?: number;
	average_progress?: number;
}

export interface UserBadge {
	id: number;
	badge_code: string;
	title: string;
	description?: string | null;
	points: number;
	awarded_at: string;
}

export interface SocialActionResult {
	active: boolean;
	like_count: number;
	save_count: number;
}

export interface CommunityLeaderboardItem {
	user_id: number;
	full_name?: string | null;
	username: string;
	community_points: number;
	post_count: number;
	comment_count: number;
	like_count?: number;
	badge_count: number;
}

export interface SocialHubSidebar {
	featured_groups: DiscussionGroup[];
	active_challenges: ReadingChallenge[];
	leaderboard: CommunityLeaderboardItem[];
	my_badges: UserBadge[];
}

export interface BookingResource {
	id: number;
	name: string;
	resource_type: string;
	location?: string | null;
	capacity: number;
	status: string;
	description?: string | null;
	created_at: string;
}

export interface Lab {
	id: number;
	name: string;
	description?: string | null;
	location?: string | null;
	capacity: number;
	equipment?: string | null;
	rules?: string | null;
	opening_hours?: string | null;
	status: string;
	is_bookable: boolean;
	created_at: string;
	updated_at?: string | null;
}

export interface LabBooking {
	id: number;
	lab_id: number;
	user_id: number;
	start_time: string;
	end_time: string;
	purpose?: string | null;
	participant_count: number;
	status: string;
	admin_note?: string | null;
	created_at: string;
	updated_at?: string | null;
	lab?: Lab | null;
	user?: AppUser | null;
}

export interface Booking {
	id: number;
	resource_id: number;
	user_id: number;
	start_time: string;
	end_time: string;
	purpose?: string | null;
	status: string;
	created_at: string;
	resource?: BookingResource | null;
}

export interface PrintJob {
	id: number;
	user_id: number;
	file_name: string;
	page_count: number;
	pickup_code: string;
	status: string;
	created_at: string;
}

export interface LibrarianQuestion {
	id: number;
	user_id: number;
	question: string;
	response?: string | null;
	status: string;
	appointment_at?: string | null;
	created_at: string;
}

export interface LibraryEvent {
	id: number;
	title: string;
	event_type: string;
	description?: string | null;
	speaker?: string | null;
	format?: string;
	location?: string | null;
	online_link?: string | null;
	start_time: string;
	end_time?: string | null;
	capacity: number;
	registration_deadline?: string | null;
	status: string;
	tags?: string | null;
	thumbnail?: string | null;
	materials?: string | null;
	recorded_url?: string | null;
	require_checkin?: boolean;
	created_by?: number | null;
	created_at: string;
	updated_at?: string | null;
	registered_count?: number;
	registered_by_me?: boolean;
	my_registration?: EventRegistration | null;
}

export interface EventRegistration {
	id: number;
	event_id: number;
	user_id: number;
	status: string;
	registered_at: string;
	checked_in_at?: string | null;
	cancelled_at?: string | null;
	user?: AppUser | null;
}

export interface Tutorial {
	id: number;
	title: string;
	category?: string | null;
	description?: string | null;
	content_url?: string | null;
	duration_minutes: number;
	video_url?: string | null;
	thumbnail?: string | null;
	topic?: string | null;
	level?: string;
	view_count?: number;
	is_featured?: boolean;
	status?: string;
	attachments?: string | null;
	created_by?: number | null;
	created_at: string;
	updated_at?: string | null;
}

export interface NewsPost {
	id: number;
	title: string;
	category: string;
	news_type?: string;
	summary?: string | null;
	content: string;
	published: boolean;
	status?: string;
	related_target_type?: string;
	related_target_id?: number | null;
	cta_label?: string | null;
	cta_url?: string | null;
	created_at: string;
	updated_at?: string | null;
}

export interface LibraryFeedback {
	id: number;
	user_id?: number | null;
	feedback_type: string;
	subject: string;
	message: string;
	priority: string;
	status: string;
	created_at: string;
	updated_at?: string | null;
	user?: AppUser | null;
}

export interface VolunteerDonation {
	id: number;
	user_id?: number | null;
	program_type: string;
	title?: string | null;
	contact_info?: string | null;
	message?: string | null;
	status: string;
	created_at: string;
	updated_at?: string | null;
	user?: AppUser | null;
}

export interface VolunteerProgram {
	id: number;
	title: string;
	description?: string | null;
	location?: string | null;
	schedule_note?: string | null;
	status: string;
	related_target_type?: string;
	related_target_id?: number | null;
	cta_label?: string | null;
	cta_url?: string | null;
	created_at: string;
	updated_at?: string | null;
}

export interface LibraryInfo {
	locations: Array<{ name: string; location: string; description: string }>;
	opening_hours: Array<{ label: string; hours: string }>;
	rules: string[];
	today_status: string;
}

export interface KpiValue {
	currentValue: number;
	previousValue: number;
	changePercent: number;
	trendDirection: "up" | "down" | "flat";
}

export interface ChartPoint {
	date?: string;
	name?: string;
	count?: number;
	value?: number;
	[key: string]: string | number | null | undefined;
}

export interface DashboardAlert {
	title: string;
	count?: number;
	severity: "high" | "medium" | "normal" | string;
	url?: string;
	message?: string;
	ctaLabel?: string;
	ctaUrl?: string;
	time?: string;
}

export interface UserDashboardOverview {
	periodDays: number;
	profile: { name: string; role: string; accountStatus: string };
	kpis: Record<string, KpiValue>;
	readingGoalProgress: { target: number; completed: number; percent: number; streakDays: number };
	borrowTrend: ChartPoint[];
	statusDistribution: ChartPoint[];
	activityHeatmap: ChartPoint[];
	activityTimeline: Array<{ type: string; title: string; description: string; time?: string | null; url?: string }>;
	reminders: DashboardAlert[];
	recentBorrows: Array<{ id: number; createdAt: string; dueDate?: string | null; status: string; totalItems: number; firstBookTitle?: string | null }>;
	communitySummary: {
		joinedGroups: number;
		myPosts: number;
		receivedLikes: number;
		receivedComments: number;
		recentPosts: Array<{ id: number; title: string; groupName: string; author: string; createdAt: string }>;
		weeklyPosts: ChartPoint[];
	};
	eventLabSummary: {
		registeredEvents: number;
		upcomingEvents: Array<{ id: number; title: string; startTime?: string | null; status: string }>;
		labBookings: Array<{ id: number; labName: string; startTime?: string | null; status: string }>;
	};
	chatbotSummary: {
		sessions: number;
		messages: number;
		quizCount: number;
		flashcardCount: number;
		modeDistribution: ChartPoint[];
		recentSessions: Array<{ id: number; title: string; updatedAt?: string | null }>;
	};
}

export interface AdminDashboardOverview {
	periodDays: number;
	admin: { name: string };
	kpis: Record<string, KpiValue>;
	libraryStats: {
		totalTitles: number;
		totalCopies: number;
		availableCopies: number;
		categoryDistribution: ChartPoint[];
		topBooks: Array<{ id: number; title: string; author?: string | null; count: number }>;
		lowStockBooks: Array<{ id: number; title: string; available: number; quantity: number }>;
	};
	circulationStats: {
		borrowTrend: ChartPoint[];
		statusDistribution: ChartPoint[];
		borrowItemsTrend: ChartPoint[];
		funnel: ChartPoint[];
	};
	memberStats: { memberGrowth: ChartPoint[]; activeUsers: number; newUsers: number };
	communityStats: {
		groups: number;
		posts: number;
		comments: number;
		likes: number;
		engagementTrend: ChartPoint[];
		topGroups: Array<{ id: number; name: string; score: number }>;
	};
	eventStats: {
		events: number;
		openEvents: number;
		registrations: number;
		checkinRate: number;
		registrationTrend: ChartPoint[];
		typeDistribution: ChartPoint[];
		upcomingEvents: Array<{ id: number; title: string; startTime?: string | null; registeredCount: number; capacity: number }>;
	};
	labStats: {
		labs: number;
		pendingBookings: number;
		approvedBookings: number;
		utilizationRate: number;
		bookingTrend: ChartPoint[];
		pendingList: Array<{ id: number; labName: string; user: string; createdAt?: string | null }>;
	};
	feedbackStats: {
		total: number;
		new: number;
		distribution: ChartPoint[];
		recent: Array<{ id: number; subject: string; status: string; priority?: string; createdAt?: string | null }>;
	};
	chatbotStats: {
		sessions: number;
		messages: number;
		mostUsedFeature: string;
		quizCount: number;
		flashcardCount: number;
		usageTrend: ChartPoint[];
		modeDistribution: ChartPoint[];
	};
	tutorialStats: {
		popular: Array<{ id: number; title: string; topic?: string | null; views: number }>;
		topicDistribution: ChartPoint[];
	};
	alerts: DashboardAlert[];
	activityFeed: Array<{ type: string; title: string; description: string; time?: string | null; url?: string }>;
	heatmapData: ChartPoint[];
	recentTransactions: Array<{ id: number; createdAt: string; dueDate?: string | null; status: string; totalItems: number; firstBookTitle?: string | null; userName?: string | null }>;
}
