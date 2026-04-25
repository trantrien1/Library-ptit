"use client";

import {
	BookOpen,
	CheckCircle2,
	Clock,
	Gift,
	Handshake,
	Info,
	MapPin,
	MessageSquareHeart,
	Newspaper,
	Plus,
	Route,
	Send,
	Users,
} from "lucide-react";
import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/library/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { platformApi } from "@/lib/api-client";
import type {
	Lab,
	LibraryEvent,
	LibraryFeedback,
	LibraryInfo,
	NewsPost,
	Tutorial,
	VolunteerDonation,
	VolunteerProgram,
} from "@/lib/types";

const newsTypeLabels: Record<string, string> = {
	announcement: "Thông báo",
	event: "Sự kiện",
	lab: "Lab",
	tutorial: "Hướng dẫn",
	volunteer: "Tình nguyện",
	system: "Hệ thống",
};

const feedbackTypeLabels: Record<string, string> = {
	service: "Góp ý dịch vụ thư viện",
	system_bug: "Báo lỗi hệ thống",
	resource_suggestion: "Đề xuất sách/tài liệu",
	event_lab: "Góp ý sự kiện/lab",
	account_support: "Hỗ trợ tài khoản",
};

const priorityLabels: Record<string, string> = {
	low: "Thấp",
	normal: "Bình thường",
	high: "Cao",
};

const feedbackStatusLabels: Record<string, string> = {
	new: "Mới",
	in_progress: "Đang xử lý",
	replied: "Đã phản hồi",
	closed: "Đã đóng",
};

const donationStatusLabels: Record<string, string> = {
	new: "Mới",
	contacted: "Đã liên hệ",
	received: "Đã tiếp nhận",
	rejected: "Từ chối",
	submitted: "Mới",
};

const defaultNewsForm = {
	title: "",
	news_type: "announcement",
	summary: "",
	content: "",
	status: "published",
	related_target_type: "none",
	related_target_id: "",
	cta_label: "",
	cta_url: "",
};

const defaultProgramForm = {
	title: "",
	description: "",
	location: "",
	schedule_note: "",
	status: "open",
	related_target_type: "none",
	related_target_id: "",
	cta_label: "Đăng ký tham gia",
	cta_url: "",
};

function formatDate(value?: string | null) {
	if (!value) return "Chưa cập nhật";
	return new Intl.DateTimeFormat("vi-VN", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function EmptyState({ text }: { text: string }) {
	return (
		<div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
			{text}
		</div>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<Label>{label}</Label>
			{children}
		</div>
	);
}

export function LibraryInfoModule() {
	const { user } = useAuth();
	const router = useRouter();
	const isAdmin = user?.role === "admin";
	const [libraryInfo, setLibraryInfo] = useState<LibraryInfo | null>(null);
	const [news, setNews] = useState<NewsPost[]>([]);
	const [programs, setPrograms] = useState<VolunteerProgram[]>([]);
	const [myFeedback, setMyFeedback] = useState<LibraryFeedback[]>([]);
	const [feedbackItems, setFeedbackItems] = useState<LibraryFeedback[]>([]);
	const [donations, setDonations] = useState<VolunteerDonation[]>([]);
	const [events, setEvents] = useState<LibraryEvent[]>([]);
	const [labs, setLabs] = useState<Lab[]>([]);
	const [tutorials, setTutorials] = useState<Tutorial[]>([]);
	const [loading, setLoading] = useState(true);
	const [feedbackSent, setFeedbackSent] = useState(false);
	const [donationSent, setDonationSent] = useState(false);
	const [feedbackForm, setFeedbackForm] = useState({
		subject: "",
		feedback_type: "service",
		message: "",
		priority: "normal",
	});
	const [donationForm, setDonationForm] = useState({
		program_type: "book",
		title: "",
		message: "",
		contact_info: "",
	});
	const [newsForm, setNewsForm] = useState(defaultNewsForm);
	const [editingNewsId, setEditingNewsId] = useState<number | null>(null);
	const [programForm, setProgramForm] = useState(defaultProgramForm);
	const [libraryInfoDraft, setLibraryInfoDraft] = useState({
		locations: "",
		opening_hours: "",
		rules: "",
	});

	const loadData = async () => {
		setLoading(true);
		try {
			const [infoData, newsData, programData, myFeedbackData] = await Promise.all([
				platformApi.libraryInfo(),
				platformApi.news(),
				platformApi.volunteerPrograms(isAdmin),
				platformApi.myFeedback(),
			]);
			setLibraryInfo(infoData);
			setLibraryInfoDraft({
				locations: JSON.stringify(infoData.locations, null, 2),
				opening_hours: JSON.stringify(infoData.opening_hours, null, 2),
				rules: infoData.rules.join("\n"),
			});
			setNews(newsData);
			setPrograms(programData);
			setMyFeedback(myFeedbackData);
			if (isAdmin) {
				const [feedbackData, donationData, eventData, labData, tutorialData] = await Promise.all([
					platformApi.allFeedback(),
					platformApi.donations(),
					platformApi.events(),
					platformApi.labs(),
					platformApi.tutorials(),
				]);
				setFeedbackItems(feedbackData);
				setDonations(donationData);
				setEvents(eventData);
				setLabs(labData);
				setTutorials(tutorialData);
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được thông tin thư viện");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadData();
	}, [isAdmin]);

	const volunteerPrograms = useMemo(
		() => programs.filter((program) => program.status === "open"),
		[programs],
	);

	const navigateCta = (url?: string | null) => {
		if (!url) return;
		const nextUrl = isAdmin && url.startsWith("/user/events")
			? url.replace("/user/events", "/admin/platform")
			: url;
		router.push(nextUrl);
	};

	const submitFeedback = async () => {
		if (!feedbackForm.subject.trim() || !feedbackForm.message.trim()) {
			toast.error("Vui lòng nhập chủ đề và nội dung góp ý");
			return;
		}
		try {
			const item = await platformApi.feedback(feedbackForm);
			setMyFeedback((items) => [item, ...items]);
			setFeedbackForm({ subject: "", feedback_type: "service", message: "", priority: "normal" });
			setFeedbackSent(true);
			toast.success("Đã gửi góp ý. Thư viện sẽ xử lý trong thời gian sớm nhất.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không gửi được góp ý");
		}
	};

	const submitDonation = async () => {
		if (!donationForm.message.trim() && !donationForm.title.trim()) {
			toast.error("Vui lòng nhập thông tin tài liệu hoặc ghi chú đóng góp");
			return;
		}
		try {
			const item = await platformApi.volunteerDonation(donationForm);
			if (isAdmin) setDonations((items) => [item, ...items]);
			setDonationForm({ program_type: "book", title: "", message: "", contact_info: "" });
			setDonationSent(true);
			toast.success("Đã gửi đăng ký đóng góp");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không gửi được đăng ký đóng góp");
		}
	};

	const submitVolunteer = async (program: VolunteerProgram) => {
		if (program.cta_url) {
			navigateCta(program.cta_url);
			return;
		}
		try {
			await platformApi.volunteerDonation({
				program_type: "volunteer",
				title: program.title,
				message: `Đăng ký tham gia hoạt động tình nguyện: ${program.title}`,
				contact_info: user?.email,
			});
			toast.success("Đã gửi đăng ký tình nguyện");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không gửi được đăng ký tình nguyện");
		}
	};

	return (
		<div className="space-y-6">
			<PageHeader
				title="Thông tin thư viện"
				description="Giờ mở cửa, địa điểm, tin tức, thông báo, hỗ trợ, góp ý, tình nguyện và đóng góp cho thư viện."
			/>

			{loading ? (
				<div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
					Đang tải thông tin thư viện...
				</div>
			) : null}

			<div className="grid gap-6 xl:grid-cols-[360px_1fr]">
				<div className="space-y-6">
					<Card className="rounded-xl border-muted/70 shadow-sm">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-base">
								<Clock className="h-4 w-4" />
								Giờ mở cửa & Địa điểm
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4 text-sm">
							<div className="rounded-xl border bg-muted/30 p-4">
								<div className="flex items-center justify-between gap-3">
									<p className="font-semibold">Trạng thái hôm nay</p>
									<Badge>{libraryInfo?.today_status || "Đang cập nhật"}</Badge>
								</div>
							</div>
							{libraryInfo?.locations.map((location) => (
								<div key={location.name} className="rounded-xl border p-4">
									<p className="font-semibold">{location.name}</p>
									<p className="mt-1 flex items-center gap-2 text-muted-foreground">
										<MapPin className="h-4 w-4" />
										{location.location}
									</p>
									<p className="mt-2 leading-6 text-muted-foreground">{location.description}</p>
								</div>
							))}
							<div className="space-y-2">
								{libraryInfo?.opening_hours.map((item) => (
									<div key={item.label} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
										<span>{item.label}</span>
										<span className="font-medium">{item.hours}</span>
									</div>
								))}
							</div>
							<div className="flex flex-wrap gap-2">
								<Button variant="outline" onClick={() => window.open("https://maps.google.com", "_blank")}>
									<MapPin className="mr-2 h-4 w-4" />
									Xem bản đồ
								</Button>
								<Button variant="outline" onClick={() => toast.info(libraryInfo?.rules.join("\n"))}>
									<BookOpen className="mr-2 h-4 w-4" />
									Xem quy định thư viện
								</Button>
							</div>
						</CardContent>
					</Card>

					<Card className="rounded-xl border-muted/70 shadow-sm" id="volunteer">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-base">
								<Gift className="h-4 w-4" />
								Tình nguyện & Đóng góp
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-5">
							<div className="space-y-3">
								<p className="font-semibold">Hoạt động tình nguyện</p>
								{volunteerPrograms.length === 0 ? (
									<EmptyState text="Chưa có hoạt động tình nguyện đang mở." />
								) : (
									volunteerPrograms.map((program) => (
										<div key={program.id} className="rounded-xl border p-4">
											<p className="font-semibold">{program.title}</p>
											<p className="mt-1 text-sm leading-6 text-muted-foreground">{program.description}</p>
											<p className="mt-2 text-xs text-muted-foreground">
												{program.location} · {program.schedule_note}
											</p>
											<Button className="mt-3" size="sm" onClick={() => void submitVolunteer(program)}>
												<Users className="mr-2 h-4 w-4" />
												{program.cta_label || "Đăng ký tham gia"}
											</Button>
										</div>
									))
								)}
							</div>

							<div className="space-y-3 rounded-xl border bg-muted/20 p-4">
								<p className="font-semibold">Đóng góp sách / tài liệu</p>
								<Field label="Loại đóng góp">
									<Select value={donationForm.program_type} onValueChange={(value) => setDonationForm((form) => ({ ...form, program_type: value }))}>
										<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
										<SelectContent>
											<SelectItem value="book">Sách giấy</SelectItem>
											<SelectItem value="ebook">Ebook</SelectItem>
											<SelectItem value="study_material">Tài liệu học tập</SelectItem>
											<SelectItem value="event_support">Hỗ trợ sự kiện</SelectItem>
										</SelectContent>
									</Select>
								</Field>
								<Field label="Tiêu đề/tên tài liệu nếu có">
									<Input value={donationForm.title} onChange={(event) => setDonationForm((form) => ({ ...form, title: event.target.value }))} />
								</Field>
								<Field label="Thông tin liên hệ">
									<Input value={donationForm.contact_info} onChange={(event) => setDonationForm((form) => ({ ...form, contact_info: event.target.value }))} placeholder="Email hoặc số điện thoại" />
								</Field>
								<Field label="Nội dung ghi chú">
									<Textarea value={donationForm.message} onChange={(event) => setDonationForm((form) => ({ ...form, message: event.target.value }))} />
								</Field>
								<Button onClick={() => void submitDonation()}>
									<Send className="mr-2 h-4 w-4" />
									Gửi đăng ký đóng góp
								</Button>
								{donationSent ? (
									<p className="flex items-center gap-2 text-sm text-primary">
										<CheckCircle2 className="h-4 w-4" />
										Đã gửi đăng ký đóng góp.
									</p>
								) : null}
							</div>
						</CardContent>
					</Card>
				</div>

				<div className="space-y-6">
					<Card className="rounded-xl border-muted/70 shadow-sm">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-base">
								<Newspaper className="h-4 w-4" />
								Tin tức & Thông báo
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-4 md:grid-cols-2">
							{news.length === 0 ? (
								<div className="md:col-span-2">
									<EmptyState text="Chưa có tin tức hoặc thông báo mới." />
								</div>
							) : (
								news.map((item) => (
									<article key={item.id} className="rounded-xl border bg-background p-4 transition hover:-translate-y-0.5 hover:shadow-md">
										<div className="flex items-start justify-between gap-3">
											<Badge variant="secondary">{newsTypeLabels[item.news_type || item.category] || item.category}</Badge>
											<span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
										</div>
										<h3 className="mt-3 font-semibold leading-6">{item.title}</h3>
										<p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
											{item.summary || item.content}
										</p>
										{item.cta_label && item.cta_url ? (
											<Button className="mt-4" size="sm" onClick={() => navigateCta(item.cta_url)}>
												<Route className="mr-2 h-4 w-4" />
												{item.cta_label}
											</Button>
										) : (
											<Button className="mt-4" size="sm" variant="outline">
												Xem chi tiết
											</Button>
										)}
									</article>
								))
							)}
						</CardContent>
					</Card>

					<Card className="rounded-xl border-muted/70 shadow-sm">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-base">
								<MessageSquareHeart className="h-4 w-4" />
								Hỗ trợ & Góp ý
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-5 lg:grid-cols-[1fr_340px]">
							<div className="space-y-3 rounded-xl border bg-muted/20 p-4">
								<Field label="Chủ đề góp ý">
									<Input value={feedbackForm.subject} onChange={(event) => setFeedbackForm((form) => ({ ...form, subject: event.target.value }))} />
								</Field>
								<div className="grid gap-3 md:grid-cols-2">
									<Field label="Loại yêu cầu">
										<Select value={feedbackForm.feedback_type} onValueChange={(value) => setFeedbackForm((form) => ({ ...form, feedback_type: value }))}>
											<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
											<SelectContent>
												{Object.entries(feedbackTypeLabels).map(([value, label]) => (
													<SelectItem key={value} value={value}>{label}</SelectItem>
												))}
											</SelectContent>
										</Select>
									</Field>
									<Field label="Mức độ ưu tiên">
										<Select value={feedbackForm.priority} onValueChange={(value) => setFeedbackForm((form) => ({ ...form, priority: value }))}>
											<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
											<SelectContent>
												{Object.entries(priorityLabels).map(([value, label]) => (
													<SelectItem key={value} value={value}>{label}</SelectItem>
												))}
											</SelectContent>
										</Select>
									</Field>
								</div>
								<Field label="Nội dung">
									<Textarea value={feedbackForm.message} onChange={(event) => setFeedbackForm((form) => ({ ...form, message: event.target.value }))} className="min-h-28" />
								</Field>
								<Button onClick={() => void submitFeedback()}>
									<Send className="mr-2 h-4 w-4" />
									Gửi góp ý
								</Button>
								{feedbackSent ? (
									<p className="flex items-center gap-2 text-sm text-primary">
										<CheckCircle2 className="h-4 w-4" />
										Đã gửi góp ý.
									</p>
								) : null}
							</div>

							<div className="space-y-3">
								<p className="font-semibold">Góp ý của tôi</p>
								{myFeedback.length === 0 ? (
									<EmptyState text="Bạn chưa gửi góp ý nào." />
								) : (
									myFeedback.slice(0, 5).map((item) => (
										<div key={item.id} className="rounded-lg border p-3">
											<div className="flex items-center justify-between gap-2">
												<p className="font-medium">{item.subject}</p>
												<Badge variant="outline">{feedbackStatusLabels[item.status] || item.status}</Badge>
											</div>
											<p className="mt-1 text-xs text-muted-foreground">{feedbackTypeLabels[item.feedback_type] || item.feedback_type}</p>
										</div>
									))
								)}
							</div>
						</CardContent>
					</Card>

					{isAdmin ? (
						<AdminLibraryInfo
							news={news}
							feedbackItems={feedbackItems}
							donations={donations}
							events={events}
							labs={labs}
							tutorials={tutorials}
							newsForm={newsForm}
							setNewsForm={setNewsForm}
							editingNewsId={editingNewsId}
							setEditingNewsId={setEditingNewsId}
							programForm={programForm}
							setProgramForm={setProgramForm}
							libraryInfoDraft={libraryInfoDraft}
							setLibraryInfoDraft={setLibraryInfoDraft}
							onRefresh={loadData}
						/>
					) : null}
				</div>
			</div>
		</div>
	);
}

function AdminLibraryInfo({
	news,
	feedbackItems,
	donations,
	events,
	labs,
	tutorials,
	newsForm,
	setNewsForm,
	editingNewsId,
	setEditingNewsId,
	programForm,
	setProgramForm,
	libraryInfoDraft,
	setLibraryInfoDraft,
	onRefresh,
}: {
	news: NewsPost[];
	feedbackItems: LibraryFeedback[];
	donations: VolunteerDonation[];
	events: LibraryEvent[];
	labs: Lab[];
	tutorials: Tutorial[];
	newsForm: typeof defaultNewsForm;
	setNewsForm: React.Dispatch<React.SetStateAction<typeof defaultNewsForm>>;
	editingNewsId: number | null;
	setEditingNewsId: (id: number | null) => void;
	programForm: typeof defaultProgramForm;
	setProgramForm: React.Dispatch<React.SetStateAction<typeof defaultProgramForm>>;
	libraryInfoDraft: { locations: string; opening_hours: string; rules: string };
	setLibraryInfoDraft: React.Dispatch<React.SetStateAction<{ locations: string; opening_hours: string; rules: string }>>;
	onRefresh: () => Promise<void>;
}) {
	const targetOptions = useMemo(() => {
		if (newsForm.related_target_type === "event") {
			return events.map((item) => ({ id: item.id, label: item.title, url: `/user/events?tab=upcoming&eventId=${item.id}` }));
		}
		if (newsForm.related_target_type === "lab") {
			return labs.map((item) => ({ id: item.id, label: item.name, url: `/user/events?tab=labs&labId=${item.id}` }));
		}
		if (newsForm.related_target_type === "tutorial") {
			return tutorials.map((item) => ({ id: item.id, label: item.title, url: `/user/events?tab=tutorials&tutorialId=${item.id}` }));
		}
		return [];
	}, [events, labs, newsForm.related_target_type, tutorials]);

	const saveNews = async () => {
		if (!newsForm.title.trim() || !newsForm.content.trim()) {
			toast.error("Vui lòng nhập tiêu đề và nội dung tin");
			return;
		}
		try {
			const selectedTarget = targetOptions.find((item) => String(item.id) === newsForm.related_target_id);
			const payload = {
				title: newsForm.title,
				category: newsForm.news_type,
				news_type: newsForm.news_type,
				summary: newsForm.summary,
				content: newsForm.content,
				status: newsForm.status,
				published: newsForm.status === "published",
				related_target_type: newsForm.related_target_type,
				related_target_id: newsForm.related_target_id ? Number(newsForm.related_target_id) : null,
				cta_label: newsForm.cta_label || undefined,
				cta_url: newsForm.cta_url || selectedTarget?.url,
			};
			if (editingNewsId) {
				await platformApi.updateNews(editingNewsId, payload);
				toast.success("Đã cập nhật tin tức");
			} else {
				await platformApi.createNews(payload);
				toast.success("Đã tạo tin tức");
			}
			setNewsForm(defaultNewsForm);
			setEditingNewsId(null);
			await onRefresh();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không lưu được tin tức");
		}
	};

	const editNews = (item: NewsPost) => {
		setEditingNewsId(item.id);
		setNewsForm({
			title: item.title,
			news_type: item.news_type || item.category || "announcement",
			summary: item.summary || "",
			content: item.content,
			status: item.status || (item.published ? "published" : "hidden"),
			related_target_type: item.related_target_type || "none",
			related_target_id: item.related_target_id ? String(item.related_target_id) : "",
			cta_label: item.cta_label || "",
			cta_url: item.cta_url || "",
		});
	};

	const hideNews = async (id: number) => {
		try {
			await platformApi.deleteNews(id);
			await onRefresh();
			toast.success("Đã ẩn tin tức");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không ẩn được tin tức");
		}
	};

	const saveProgram = async () => {
		if (!programForm.title.trim()) {
			toast.error("Vui lòng nhập tên chương trình tình nguyện");
			return;
		}
		try {
			await platformApi.createVolunteerProgram({
				...programForm,
				related_target_id: programForm.related_target_id ? Number(programForm.related_target_id) : null,
			});
			setProgramForm(defaultProgramForm);
			await onRefresh();
			toast.success("Đã tạo chương trình tình nguyện");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tạo được chương trình");
		}
	};

	const updateFeedback = async (id: number, status: string) => {
		try {
			await platformApi.updateFeedbackStatus(id, status);
			await onRefresh();
			toast.success("Đã cập nhật trạng thái góp ý");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không cập nhật được góp ý");
		}
	};

	const updateDonation = async (id: number, status: string) => {
		try {
			await platformApi.updateDonationStatus(id, status);
			await onRefresh();
			toast.success("Đã cập nhật trạng thái đóng góp");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không cập nhật được đăng ký đóng góp");
		}
	};

	const saveLibraryInfo = async () => {
		try {
			await platformApi.updateLibraryInfo({
				locations: JSON.parse(libraryInfoDraft.locations),
				opening_hours: JSON.parse(libraryInfoDraft.opening_hours),
				rules: libraryInfoDraft.rules.split("\n").map((item) => item.trim()).filter(Boolean),
			});
			await onRefresh();
			toast.success("Đã cập nhật giờ mở cửa, địa điểm và quy định");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Dữ liệu cấu hình chưa đúng định dạng");
		}
	};

	return (
		<Card className="rounded-xl border-primary/20 bg-primary/5 shadow-sm">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<Info className="h-4 w-4" />
					Quản trị thông tin thư viện
				</CardTitle>
			</CardHeader>
			<CardContent>
				<Tabs defaultValue="news">
					<TabsList className="mb-4 w-full justify-start overflow-x-auto md:w-fit">
						<TabsTrigger value="news">Tin tức</TabsTrigger>
						<TabsTrigger value="feedback">Góp ý</TabsTrigger>
						<TabsTrigger value="donations">Đóng góp</TabsTrigger>
						<TabsTrigger value="volunteer">Tình nguyện</TabsTrigger>
						<TabsTrigger value="info">Giờ & quy định</TabsTrigger>
					</TabsList>

					<TabsContent value="news" className="grid gap-5 xl:grid-cols-[420px_1fr]">
						<div className="space-y-3 rounded-xl border bg-background p-4">
							<p className="font-semibold">{editingNewsId ? "Sửa tin tức" : "Tạo tin tức / thông báo"}</p>
							<Field label="Tiêu đề">
								<Input value={newsForm.title} onChange={(event) => setNewsForm((form) => ({ ...form, title: event.target.value }))} />
							</Field>
							<div className="grid gap-3 md:grid-cols-2">
								<Field label="Loại tin">
									<Select value={newsForm.news_type} onValueChange={(value) => setNewsForm((form) => ({ ...form, news_type: value, related_target_type: value === "event" || value === "lab" || value === "tutorial" ? value : "none" }))}>
										<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
										<SelectContent>
											{Object.entries(newsTypeLabels).map(([value, label]) => (
												<SelectItem key={value} value={value}>{label}</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
								<Field label="Trạng thái">
									<Select value={newsForm.status} onValueChange={(value) => setNewsForm((form) => ({ ...form, status: value }))}>
										<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
										<SelectContent>
											<SelectItem value="published">Công khai</SelectItem>
											<SelectItem value="hidden">Ẩn</SelectItem>
										</SelectContent>
									</Select>
								</Field>
							</div>
							<Field label="Tóm tắt">
								<Textarea value={newsForm.summary} onChange={(event) => setNewsForm((form) => ({ ...form, summary: event.target.value }))} />
							</Field>
							<Field label="Nội dung">
								<Textarea value={newsForm.content} onChange={(event) => setNewsForm((form) => ({ ...form, content: event.target.value }))} className="min-h-28" />
							</Field>
							<Field label="Liên kết sang Event/Lab/Tutorial">
								<Select value={newsForm.related_target_type} onValueChange={(value) => setNewsForm((form) => ({ ...form, related_target_type: value, related_target_id: "" }))}>
									<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
									<SelectContent>
										<SelectItem value="none">Không liên kết</SelectItem>
										<SelectItem value="event">Sự kiện</SelectItem>
										<SelectItem value="lab">Lab</SelectItem>
										<SelectItem value="tutorial">Video hướng dẫn</SelectItem>
									</SelectContent>
								</Select>
							</Field>
							{targetOptions.length > 0 ? (
								<Field label="Chọn mục liên kết">
									<Select value={newsForm.related_target_id} onValueChange={(value) => setNewsForm((form) => ({ ...form, related_target_id: value }))}>
										<SelectTrigger className="w-full"><SelectValue placeholder="Chọn mục liên kết" /></SelectTrigger>
										<SelectContent>
											{targetOptions.map((item) => (
												<SelectItem key={item.id} value={String(item.id)}>{item.label}</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
							) : null}
							<Field label="Nhãn nút CTA">
								<Input value={newsForm.cta_label} onChange={(event) => setNewsForm((form) => ({ ...form, cta_label: event.target.value }))} placeholder="Đăng ký sự kiện / Đặt lịch Lab / Xem hướng dẫn" />
							</Field>
							<div className="flex flex-wrap gap-2">
								<Button onClick={() => void saveNews()}>
									<Plus className="mr-2 h-4 w-4" />
									{editingNewsId ? "Lưu thay đổi" : "Tạo tin"}
								</Button>
								{editingNewsId ? (
									<Button variant="outline" onClick={() => { setNewsForm(defaultNewsForm); setEditingNewsId(null); }}>
										Hủy sửa
									</Button>
								) : null}
							</div>
						</div>
						<div className="space-y-3">
							{news.map((item) => (
								<div key={item.id} className="rounded-xl border bg-background p-4">
									<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
										<div>
											<p className="font-semibold">{item.title}</p>
											<p className="mt-1 text-sm text-muted-foreground">{newsTypeLabels[item.news_type || item.category] || item.category} · {item.status}</p>
										</div>
										<div className="flex gap-2">
											<Button size="sm" variant="outline" onClick={() => editNews(item)}>Sửa</Button>
											<Button size="sm" variant="destructive" onClick={() => void hideNews(item.id)}>Ẩn</Button>
										</div>
									</div>
								</div>
							))}
						</div>
					</TabsContent>

					<TabsContent value="feedback" className="space-y-3">
						{feedbackItems.length === 0 ? <EmptyState text="Chưa có góp ý nào." /> : feedbackItems.map((item) => (
							<div key={item.id} className="rounded-xl border bg-background p-4">
								<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
									<div>
										<p className="font-semibold">{item.subject}</p>
										<p className="mt-1 text-sm text-muted-foreground">
											{item.user?.full_name || item.user?.username || `User #${item.user_id}`} · {feedbackTypeLabels[item.feedback_type] || item.feedback_type} · {priorityLabels[item.priority] || item.priority}
										</p>
										<p className="mt-2 text-sm leading-6">{item.message}</p>
									</div>
									<Select value={item.status} onValueChange={(value) => void updateFeedback(item.id, value)}>
										<SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
										<SelectContent>
											{Object.entries(feedbackStatusLabels).map(([value, label]) => (
												<SelectItem key={value} value={value}>{label}</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						))}
					</TabsContent>

					<TabsContent value="donations" className="space-y-3">
						{donations.length === 0 ? <EmptyState text="Chưa có đăng ký đóng góp nào." /> : donations.map((item) => (
							<div key={item.id} className="rounded-xl border bg-background p-4">
								<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
									<div>
										<p className="font-semibold">{item.title || "Đăng ký đóng góp"}</p>
										<p className="mt-1 text-sm text-muted-foreground">
											{item.user?.full_name || item.user?.username || `User #${item.user_id}`} · {item.program_type} · {item.contact_info || "Chưa có liên hệ"}
										</p>
										<p className="mt-2 text-sm leading-6">{item.message}</p>
									</div>
									<Select value={item.status} onValueChange={(value) => void updateDonation(item.id, value)}>
										<SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
										<SelectContent>
											{Object.entries(donationStatusLabels).filter(([value]) => value !== "submitted").map(([value, label]) => (
												<SelectItem key={value} value={value}>{label}</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						))}
					</TabsContent>

					<TabsContent value="volunteer" className="max-w-2xl space-y-3 rounded-xl border bg-background p-4">
						<p className="font-semibold">Tạo chương trình tình nguyện</p>
						<Field label="Tên chương trình">
							<Input value={programForm.title} onChange={(event) => setProgramForm((form) => ({ ...form, title: event.target.value }))} />
						</Field>
						<Field label="Mô tả">
							<Textarea value={programForm.description} onChange={(event) => setProgramForm((form) => ({ ...form, description: event.target.value }))} />
						</Field>
						<div className="grid gap-3 md:grid-cols-2">
							<Field label="Địa điểm">
								<Input value={programForm.location} onChange={(event) => setProgramForm((form) => ({ ...form, location: event.target.value }))} />
							</Field>
							<Field label="Lịch dự kiến">
								<Input value={programForm.schedule_note} onChange={(event) => setProgramForm((form) => ({ ...form, schedule_note: event.target.value }))} />
							</Field>
						</div>
						<Button onClick={() => void saveProgram()}>
							<Handshake className="mr-2 h-4 w-4" />
							Tạo chương trình
						</Button>
					</TabsContent>

					<TabsContent value="info" className="max-w-3xl space-y-3 rounded-xl border bg-background p-4">
						<p className="font-semibold">Quản lý giờ mở cửa, địa điểm và quy định</p>
						<p className="text-sm text-muted-foreground">
							Địa điểm và giờ mở cửa dùng JSON để giữ cấu trúc linh hoạt. Quy định nhập mỗi dòng một mục.
						</p>
						<Field label="Địa điểm">
							<Textarea
								value={libraryInfoDraft.locations}
								onChange={(event) => setLibraryInfoDraft((draft) => ({ ...draft, locations: event.target.value }))}
								className="min-h-36 font-mono text-xs"
							/>
						</Field>
						<Field label="Giờ mở cửa">
							<Textarea
								value={libraryInfoDraft.opening_hours}
								onChange={(event) => setLibraryInfoDraft((draft) => ({ ...draft, opening_hours: event.target.value }))}
								className="min-h-28 font-mono text-xs"
							/>
						</Field>
						<Field label="Quy định thư viện">
							<Textarea
								value={libraryInfoDraft.rules}
								onChange={(event) => setLibraryInfoDraft((draft) => ({ ...draft, rules: event.target.value }))}
								className="min-h-28"
							/>
						</Field>
						<Button onClick={() => void saveLibraryInfo()}>Lưu thông tin thư viện</Button>
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}
