"use client";

import {
	CalendarDays,
	CheckCircle2,
	Clock,
	Edit3,
	FlaskConical,
	MapPin,
	PlayCircle,
	Plus,
	Search,
	TicketCheck,
	Trash2,
	Users,
	Video,
	XCircle,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/library/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { platformApi } from "@/lib/api-client";
import type {
	EventRegistration,
	Lab,
	LabBooking,
	LibraryEvent,
	Tutorial,
} from "@/lib/types";

type MainTab = "upcoming" | "registered" | "tutorials" | "labs";
type ContentFilter = "all" | "workshop" | "recorded" | "tutorial" | "lab_session";

const eventTypeLabels: Record<string, string> = {
	workshop: "Workshop",
	talk: "Tọa đàm",
	training: "Đào tạo",
	tutorial: "Hướng dẫn",
	lab_session: "Phiên lab",
	recorded: "Bài ghi hình",
};

const eventStatusLabels: Record<string, string> = {
	draft: "Nháp",
	open: "Mở đăng ký",
	closed: "Đóng đăng ký",
	ended: "Đã kết thúc",
	cancelled: "Đã hủy",
};

const labStatusLabels: Record<string, string> = {
	available: "Sẵn sàng",
	in_use: "Đang sử dụng",
	maintenance: "Bảo trì",
	unavailable: "Không khả dụng",
};

const bookingStatusLabels: Record<string, string> = {
	pending: "Chờ duyệt",
	approved: "Đã duyệt",
	rejected: "Từ chối",
	cancelled: "Đã hủy",
	completed: "Hoàn tất",
};

const levelLabels: Record<string, string> = {
	beginner: "Cơ bản",
	intermediate: "Trung cấp",
	advanced: "Nâng cao",
};

const defaultEventForm = {
	title: "",
	event_type: "workshop",
	description: "",
	speaker: "",
	format: "offline",
	location: "Thư viện PTIT",
	online_link: "",
	start_time: "",
	end_time: "",
	capacity: 40,
	registration_deadline: "",
	status: "open",
	tags: "",
	thumbnail: "",
	materials: "",
	recorded_url: "",
	require_checkin: true,
};

const defaultLabForm = {
	name: "",
	description: "",
	location: "Innovation Lab - Thư viện PTIT",
	capacity: 8,
	equipment: "",
	rules: "",
	opening_hours: "08:00 - 17:00, Thứ 2 - Thứ 6",
	status: "available",
	is_bookable: true,
};

const defaultTutorialForm = {
	title: "",
	description: "",
	video_url: "",
	thumbnail: "",
	duration_minutes: 20,
	topic: "Kỹ năng nghiên cứu",
	level: "beginner",
	is_featured: false,
	status: "published",
	attachments: "",
};

function formatDate(value?: string | null) {
	if (!value) return "Chưa cập nhật";
	return new Intl.DateTimeFormat("vi-VN", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function toDateInput(value?: string | null) {
	if (!value) return "";
	return new Date(value).toISOString().slice(0, 16);
}

function tagsOf(tags?: string | null) {
	return (tags || "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function isFull(event: LibraryEvent) {
	return Boolean(event.capacity && (event.registered_count || 0) >= event.capacity);
}

function statusVariant(status: string) {
	if (["open", "available", "approved", "published", "checked_in"].includes(status)) {
		return "default" as const;
	}
	if (["pending", "closed", "draft", "in_use"].includes(status)) {
		return "secondary" as const;
	}
	return "outline" as const;
}

function EmptyState({ title, description }: { title: string; description: string }) {
	return (
		<div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
			<p className="font-semibold">{title}</p>
			<p className="mt-1 text-sm text-muted-foreground">{description}</p>
		</div>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="space-y-2">
			<Label>{label}</Label>
			{children}
		</div>
	);
}

export function EventsLabModule() {
	const { user } = useAuth();
	const searchParams = useSearchParams();
	const handledTargetRef = useRef("");
	const isAdmin = user?.role === "admin";
	const [events, setEvents] = useState<LibraryEvent[]>([]);
	const [tutorials, setTutorials] = useState<Tutorial[]>([]);
	const [labs, setLabs] = useState<Lab[]>([]);
	const [bookings, setBookings] = useState<LabBooking[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<ContentFilter>("all");
	const [tab, setTab] = useState<MainTab>("upcoming");
	const [selectedEvent, setSelectedEvent] = useState<LibraryEvent | null>(null);
	const [cancelEvent, setCancelEvent] = useState<LibraryEvent | null>(null);
	const [checkinEvent, setCheckinEvent] = useState<LibraryEvent | null>(null);
	const [rulesLab, setRulesLab] = useState<Lab | null>(null);
	const [bookingLab, setBookingLab] = useState<Lab | null>(null);
	const [videoTutorial, setVideoTutorial] = useState<Tutorial | null>(null);
	const [bookingForm, setBookingForm] = useState({
		date: "",
		start: "",
		end: "",
		purpose: "",
		participant_count: 1,
	});

	const loadData = async () => {
		setLoading(true);
		try {
			const [eventData, tutorialData, labData, bookingData] = await Promise.all([
				platformApi.events(),
				platformApi.tutorials(),
				platformApi.labs(),
				platformApi.labBookings(),
			]);
			setEvents(eventData);
			setTutorials(tutorialData);
			setLabs(labData);
			setBookings(bookingData);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được dữ liệu sự kiện và lab");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadData();
	}, []);

	useEffect(() => {
		const targetTab = searchParams.get("tab");
		if (targetTab === "lab" || targetTab === "labs") setTab("labs");
		if (targetTab === "tutorial" || targetTab === "tutorials") setTab("tutorials");
		if (targetTab === "registered") setTab("registered");
		if (targetTab === "upcoming") setTab("upcoming");
	}, [searchParams]);

	useEffect(() => {
		if (loading) return;
		const targetKey = searchParams.toString();
		if (handledTargetRef.current === targetKey) return;
		const eventId = Number(searchParams.get("eventId") || 0);
		const labId = Number(searchParams.get("labId") || 0);
		const tutorialId = Number(searchParams.get("tutorialId") || 0);
		if (!eventId && !labId && !tutorialId) return;
		if (eventId) {
			const event = events.find((item) => item.id === eventId);
			if (event) {
				handledTargetRef.current = targetKey;
				setTab("upcoming");
				setSelectedEvent(event);
			}
		}
		if (labId) {
			const lab = labs.find((item) => item.id === labId);
			if (lab) {
				handledTargetRef.current = targetKey;
				setTab("labs");
				setBookingLab(lab);
			}
		}
		if (tutorialId) {
			const tutorial = tutorials.find((item) => item.id === tutorialId);
			if (tutorial) {
				handledTargetRef.current = targetKey;
				setTab("tutorials");
				void openTutorial(tutorial);
			}
		}
	}, [events, labs, loading, searchParams, tutorials]);

	const filteredEvents = useMemo(() => {
		const term = search.trim().toLowerCase();
		return events.filter((event) => {
			const matchesSearch =
				!term ||
				[event.title, event.description, event.tags, event.speaker, event.location]
					.filter(Boolean)
					.some((value) => String(value).toLowerCase().includes(term));
			const matchesFilter =
				filter === "all" ||
				(filter === "recorded" && Boolean(event.recorded_url)) ||
				event.event_type === filter;
			const matchesTab =
				tab === "registered"
					? event.registered_by_me
					: event.status !== "cancelled" && event.status !== "ended";
			return matchesSearch && matchesFilter && matchesTab;
		});
	}, [events, filter, search, tab]);

	const filteredTutorials = useMemo(() => {
		const term = search.trim().toLowerCase();
		return tutorials.filter((tutorial) => {
			const matchesSearch =
				!term ||
				[tutorial.title, tutorial.description, tutorial.topic, tutorial.category]
					.filter(Boolean)
					.some((value) => String(value).toLowerCase().includes(term));
			const matchesFilter = filter === "all" || filter === "recorded" || filter === "tutorial";
			return matchesSearch && matchesFilter;
		});
	}, [filter, search, tutorials]);

	const filteredLabs = useMemo(() => {
		const term = search.trim().toLowerCase();
		return labs.filter((lab) => {
			const matchesSearch =
				!term ||
				[lab.name, lab.description, lab.equipment, lab.location]
					.filter(Boolean)
					.some((value) => String(value).toLowerCase().includes(term));
			return matchesSearch && (filter === "all" || filter === "lab_session");
		});
	}, [filter, labs, search]);

	const updateEvent = (next: LibraryEvent) => {
		setEvents((items) => items.map((item) => (item.id === next.id ? next : item)));
	};

	const registerSelectedEvent = async () => {
		if (!selectedEvent) return;
		try {
			const next = await platformApi.registerEvent(selectedEvent.id);
			updateEvent(next);
			setSelectedEvent(null);
			toast.success("Đăng ký sự kiện thành công");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không đăng ký được sự kiện");
		}
	};

	const cancelSelectedEvent = async () => {
		if (!cancelEvent) return;
		try {
			const next = await platformApi.cancelEventRegistration(cancelEvent.id);
			updateEvent(next);
			setCancelEvent(null);
			toast.success("Đã hủy đăng ký sự kiện");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không hủy được đăng ký");
		}
	};

	const createBooking = async () => {
		if (!bookingLab) return;
		if (!bookingForm.date || !bookingForm.start || !bookingForm.end || !bookingForm.purpose.trim()) {
			toast.error("Vui lòng nhập đầy đủ thông tin đặt lịch");
			return;
		}
		try {
			const booking = await platformApi.createLabBooking(bookingLab.id, {
				start_time: `${bookingForm.date}T${bookingForm.start}`,
				end_time: `${bookingForm.date}T${bookingForm.end}`,
				purpose: bookingForm.purpose,
				participant_count: Number(bookingForm.participant_count),
			});
			setBookings((items) => [booking, ...items]);
			setBookingLab(null);
			setBookingForm({ date: "", start: "", end: "", purpose: "", participant_count: 1 });
			toast.success("Yêu cầu đặt lịch đã được gửi và đang chờ duyệt.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không gửi được yêu cầu đặt lịch");
		}
	};

	const openTutorial = async (tutorial: Tutorial) => {
		try {
			const next = await platformApi.increaseTutorialView(tutorial.id);
			setTutorials((items) => items.map((item) => (item.id === next.id ? next : item)));
			setVideoTutorial(next);
		} catch {
			setVideoTutorial(tutorial);
		}
	};

	return (
		<div className="space-y-6">
			<PageHeader
				title="Sự kiện, Đào tạo & Lab sáng tạo"
				description="Tham gia workshop, xem video hướng dẫn, đăng ký sự kiện và đặt lịch sử dụng lab/thiết bị."
			/>

			<Card className="rounded-xl border-muted/70 shadow-sm">
				<CardContent className="space-y-4 p-4 md:p-5">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
						<div className="relative flex-1">
							<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Tìm sự kiện, video hướng dẫn, lab hoặc thiết bị..."
								className="h-11 pl-9"
							/>
						</div>
						<div className="flex flex-wrap gap-2">
							{[
								["all", "Tất cả"],
								["workshop", "Workshop"],
								["recorded", "Bài ghi hình"],
								["tutorial", "Hướng dẫn"],
								["lab_session", "Lab sáng tạo"],
							].map(([value, label]) => (
								<Button
									key={value}
									type="button"
									variant={filter === value ? "default" : "outline"}
									size="sm"
									onClick={() => setFilter(value as ContentFilter)}
								>
									{label}
								</Button>
							))}
						</div>
					</div>

					<Tabs value={tab} onValueChange={(value) => setTab(value as MainTab)}>
						<TabsList className="w-full justify-start overflow-x-auto md:w-fit">
							<TabsTrigger value="upcoming">Sắp diễn ra</TabsTrigger>
							<TabsTrigger value="registered">Đã đăng ký</TabsTrigger>
							<TabsTrigger value="tutorials">Video hướng dẫn</TabsTrigger>
							<TabsTrigger value="labs">Lab sáng tạo</TabsTrigger>
						</TabsList>
					</Tabs>
				</CardContent>
			</Card>

			{isAdmin ? <AdminManagementPanel events={events} labs={labs} tutorials={tutorials} bookings={bookings} onRefresh={loadData} /> : null}

			{loading ? (
				<div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
					Đang tải dữ liệu sự kiện và lab...
				</div>
			) : null}

			{!loading && (tab === "upcoming" || tab === "registered") ? (
				<div className="grid gap-4 xl:grid-cols-2">
					{filteredEvents.length === 0 ? (
						<div className="xl:col-span-2">
							<EmptyState
								title={tab === "registered" ? "Bạn chưa đăng ký sự kiện nào" : "Chưa có sự kiện phù hợp"}
								description="Hãy thử đổi bộ lọc hoặc quay lại sau khi thư viện mở thêm workshop mới."
							/>
						</div>
					) : (
						filteredEvents.map((event) => (
							<EventCard
								key={event.id}
								event={event}
								onRegister={() => setSelectedEvent(event)}
								onCancel={() => setCancelEvent(event)}
								onCheckin={() => setCheckinEvent(event)}
							/>
						))
					)}
				</div>
			) : null}

			{!loading && tab === "tutorials" ? (
				<div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
					{filteredTutorials.length === 0 ? (
						<div className="lg:col-span-2 xl:col-span-3">
							<EmptyState
								title="Chưa có video hướng dẫn phù hợp"
								description="Các bài ghi hình và tutorial sẽ xuất hiện tại đây khi được xuất bản."
							/>
						</div>
					) : (
						filteredTutorials.map((tutorial) => (
							<TutorialCard key={tutorial.id} tutorial={tutorial} onOpen={() => void openTutorial(tutorial)} />
						))
					)}
				</div>
			) : null}

			{!loading && tab === "labs" ? (
				<div className="grid gap-5 xl:grid-cols-[1fr_360px]">
					<div className="grid gap-4 lg:grid-cols-2">
						{filteredLabs.length === 0 ? (
							<div className="lg:col-span-2">
								<EmptyState
									title="Chưa có lab hoặc thiết bị phù hợp"
									description="Hãy thử tìm theo tên thiết bị, vị trí hoặc trạng thái khác."
								/>
							</div>
						) : (
							filteredLabs.map((lab) => (
								<LabCard
									key={lab.id}
									lab={lab}
									onBook={() => setBookingLab(lab)}
									onRules={() => setRulesLab(lab)}
								/>
							))
						)}
					</div>
					<MyBookingsCard bookings={bookings} />
				</div>
			) : null}

			<Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Đăng ký tham gia sự kiện</DialogTitle>
						<DialogDescription>
							Xác nhận đăng ký sự kiện {selectedEvent?.title}. Sau khi đăng ký, bạn có thể xem mã check-in trong thẻ sự kiện.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setSelectedEvent(null)}>
							Hủy
						</Button>
						<Button onClick={() => void registerSelectedEvent()}>Xác nhận đăng ký</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={Boolean(cancelEvent)} onOpenChange={(open) => !open && setCancelEvent(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Hủy đăng ký sự kiện</DialogTitle>
						<DialogDescription>
							Bạn có chắc chắn muốn hủy đăng ký sự kiện này không?
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setCancelEvent(null)}>
							Giữ đăng ký
						</Button>
						<Button variant="destructive" onClick={() => void cancelSelectedEvent()}>
							Hủy đăng ký
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={Boolean(checkinEvent)} onOpenChange={(open) => !open && setCheckinEvent(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Mã check-in sự kiện</DialogTitle>
						<DialogDescription>
							Xuất trình mã này tại quầy check-in hoặc khu vực tổ chức sự kiện.
						</DialogDescription>
					</DialogHeader>
					<div className="rounded-xl border bg-muted/30 p-5 text-center">
						<div className="mx-auto flex h-36 w-36 items-center justify-center rounded-lg border bg-background font-mono text-lg font-bold">
							PTIT-{checkinEvent?.my_registration?.id || checkinEvent?.id}
						</div>
						<p className="mt-4 font-semibold">{checkinEvent?.title}</p>
						<p className="text-sm text-muted-foreground">{user?.full_name || user?.username}</p>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={Boolean(bookingLab)} onOpenChange={(open) => !open && setBookingLab(null)}>
				<DialogContent className="sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>Đặt lịch sử dụng lab/thiết bị</DialogTitle>
						<DialogDescription>{bookingLab?.name}</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 md:grid-cols-2">
						<Field label="Ngày sử dụng">
							<Input
								type="date"
								value={bookingForm.date}
								onChange={(event) => setBookingForm((form) => ({ ...form, date: event.target.value }))}
							/>
						</Field>
						<Field label="Số người tham gia">
							<Input
								type="number"
								min={1}
								max={bookingLab?.capacity || 1}
								value={bookingForm.participant_count}
								onChange={(event) =>
									setBookingForm((form) => ({ ...form, participant_count: Number(event.target.value) }))
								}
							/>
						</Field>
						<Field label="Giờ bắt đầu">
							<Input
								type="time"
								value={bookingForm.start}
								onChange={(event) => setBookingForm((form) => ({ ...form, start: event.target.value }))}
							/>
						</Field>
						<Field label="Giờ kết thúc">
							<Input
								type="time"
								value={bookingForm.end}
								onChange={(event) => setBookingForm((form) => ({ ...form, end: event.target.value }))}
							/>
						</Field>
						<div className="md:col-span-2">
							<Field label="Mục đích sử dụng">
								<Textarea
									value={bookingForm.purpose}
									onChange={(event) => setBookingForm((form) => ({ ...form, purpose: event.target.value }))}
									placeholder="Ví dụ: làm đồ án AI, demo VR, học nhóm..."
								/>
							</Field>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setBookingLab(null)}>
							Hủy
						</Button>
						<Button onClick={() => void createBooking()}>Gửi yêu cầu đặt lịch</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={Boolean(rulesLab)} onOpenChange={(open) => !open && setRulesLab(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Quy định sử dụng</DialogTitle>
						<DialogDescription>{rulesLab?.name}</DialogDescription>
					</DialogHeader>
					<div className="whitespace-pre-line rounded-lg bg-muted/40 p-4 text-sm leading-6">
						{rulesLab?.rules || "Vui lòng đặt lịch trước, sử dụng thiết bị đúng mục đích và báo lại thủ thư khi có sự cố."}
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={Boolean(videoTutorial)} onOpenChange={(open) => !open && setVideoTutorial(null)}>
				<DialogContent className="sm:max-w-3xl">
					<DialogHeader>
						<DialogTitle>{videoTutorial?.title}</DialogTitle>
						<DialogDescription>{videoTutorial?.description}</DialogDescription>
					</DialogHeader>
					<div className="aspect-video overflow-hidden rounded-xl border bg-muted">
						{videoTutorial?.video_url || videoTutorial?.content_url ? (
							<iframe
								src={videoTutorial.video_url || videoTutorial.content_url || ""}
								title={videoTutorial.title}
								className="h-full w-full"
								allowFullScreen
							/>
						) : (
							<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
								Video chưa có đường dẫn phát.
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function EventCard({
	event,
	onRegister,
	onCancel,
	onCheckin,
}: {
	event: LibraryEvent;
	onRegister: () => void;
	onCancel: () => void;
	onCheckin: () => void;
}) {
	const full = isFull(event);
	const endedWithVideo = event.status === "ended" && Boolean(event.recorded_url);
	return (
		<Card className="rounded-xl border-muted/70 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
			<CardContent className="space-y-4 p-5">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 space-y-2">
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="secondary">{eventTypeLabels[event.event_type] || event.event_type}</Badge>
							<Badge variant={statusVariant(event.status)}>
								{eventStatusLabels[event.status] || event.status}
							</Badge>
						</div>
						<h3 className="text-lg font-semibold leading-7">{event.title}</h3>
					</div>
					<CalendarDays className="h-5 w-5 shrink-0 text-primary" />
				</div>

				<p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
					{event.description || "Sự kiện do thư viện tổ chức cho sinh viên PTIT."}
				</p>

				<div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
					<p className="flex items-center gap-2">
						<Clock className="h-4 w-4" />
						{formatDate(event.start_time)}
					</p>
					<p className="flex items-center gap-2">
						<MapPin className="h-4 w-4" />
						{event.format === "online" ? event.online_link || "Online" : event.location || "Thư viện PTIT"}
					</p>
					<p className="flex items-center gap-2">
						<Users className="h-4 w-4" />
						{event.registered_count || 0}/{event.capacity} người đăng ký
					</p>
					<p className="flex items-center gap-2">
						<TicketCheck className="h-4 w-4" />
						Hạn đăng ký: {formatDate(event.registration_deadline)}
					</p>
				</div>

				{event.speaker ? <p className="text-sm font-medium">Diễn giả: {event.speaker}</p> : null}

				{tagsOf(event.tags).length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{tagsOf(event.tags).map((tag) => (
							<Badge key={tag} variant="outline">
								{tag}
							</Badge>
						))}
					</div>
				) : null}

				<div className="flex flex-wrap gap-2 pt-1">
					{endedWithVideo ? (
						<Button asChild>
							<a href={event.recorded_url || "#"} target="_blank" rel="noreferrer">
								<PlayCircle className="mr-2 h-4 w-4" />
								Xem lại
							</a>
						</Button>
					) : event.registered_by_me ? (
						<>
							<Button variant="secondary" disabled>
								<CheckCircle2 className="mr-2 h-4 w-4" />
								Đã đăng ký
							</Button>
							<Button variant="outline" onClick={onCheckin}>
								Mã check-in
							</Button>
							<Button variant="outline" onClick={onCancel}>
								Hủy đăng ký
							</Button>
						</>
					) : (
						<Button disabled={event.status !== "open" || full} onClick={onRegister}>
							{full ? "Đã đủ chỗ" : event.status === "open" ? "Đăng ký tham gia" : "Không mở đăng ký"}
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function TutorialCard({ tutorial, onOpen }: { tutorial: Tutorial; onOpen: () => void }) {
	return (
		<Card className="overflow-hidden rounded-xl border-muted/70 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
			<div className="flex aspect-video items-center justify-center bg-muted">
				{tutorial.thumbnail ? (
					<img src={tutorial.thumbnail} alt={tutorial.title} className="h-full w-full object-cover" />
				) : (
					<Video className="h-10 w-10 text-muted-foreground" />
				)}
			</div>
			<CardContent className="space-y-3 p-5">
				<div className="flex flex-wrap gap-2">
					<Badge variant="secondary">{tutorial.topic || tutorial.category || "Hướng dẫn"}</Badge>
					<Badge variant="outline">{levelLabels[tutorial.level || "beginner"] || tutorial.level}</Badge>
				</div>
				<h3 className="line-clamp-2 font-semibold leading-6">{tutorial.title}</h3>
				<p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{tutorial.description}</p>
				<div className="flex items-center justify-between text-sm text-muted-foreground">
					<span>{tutorial.duration_minutes || 0} phút</span>
					<span>{tutorial.view_count || 0} lượt xem</span>
				</div>
				<Button className="w-full" onClick={onOpen}>
					<PlayCircle className="mr-2 h-4 w-4" />
					Xem video
				</Button>
			</CardContent>
		</Card>
	);
}

function LabCard({ lab, onBook, onRules }: { lab: Lab; onBook: () => void; onRules: () => void }) {
	const canBook = lab.is_bookable && lab.status === "available";
	return (
		<Card className="rounded-xl border-muted/70 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
			<CardContent className="space-y-4 p-5">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h3 className="font-semibold">{lab.name}</h3>
						<p className="mt-1 text-sm text-muted-foreground">{lab.location}</p>
					</div>
					<Badge variant={statusVariant(lab.status)}>{labStatusLabels[lab.status] || lab.status}</Badge>
				</div>
				<p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{lab.description}</p>
				<div className="grid gap-2 text-sm">
					<p>
						<span className="font-medium">Sức chứa:</span> {lab.capacity} người
					</p>
					<p>
						<span className="font-medium">Thiết bị:</span> {lab.equipment || "Máy tính, màn hình trình chiếu, thiết bị lab"}
					</p>
					<p>
						<span className="font-medium">Giờ mở cửa:</span> {lab.opening_hours || "Theo lịch thư viện"}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button disabled={!canBook} onClick={onBook}>
						<FlaskConical className="mr-2 h-4 w-4" />
						Đặt lịch sử dụng
					</Button>
					<Button variant="outline" onClick={onRules}>
						Xem quy định
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function MyBookingsCard({ bookings }: { bookings: LabBooking[] }) {
	return (
		<Card className="h-fit rounded-xl border-muted/70 shadow-sm">
			<CardHeader>
				<CardTitle className="text-base">Lịch đặt của tôi</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{bookings.length === 0 ? (
					<p className="text-sm text-muted-foreground">Bạn chưa có lịch đặt lab nào.</p>
				) : (
					bookings.slice(0, 6).map((booking) => (
						<div key={booking.id} className="rounded-lg border p-3">
							<div className="flex items-start justify-between gap-2">
								<p className="font-medium">{booking.lab?.name || `Lab #${booking.lab_id}`}</p>
								<Badge variant={statusVariant(booking.status)}>
									{bookingStatusLabels[booking.status] || booking.status}
								</Badge>
							</div>
							<p className="mt-1 text-sm text-muted-foreground">
								{formatDate(booking.start_time)} - {formatDate(booking.end_time)}
							</p>
							{booking.admin_note ? (
								<p className="mt-2 text-sm text-muted-foreground">Ghi chú: {booking.admin_note}</p>
							) : null}
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}

function AdminManagementPanel({
	events,
	labs,
	tutorials,
	bookings,
	onRefresh,
}: {
	events: LibraryEvent[];
	labs: Lab[];
	tutorials: Tutorial[];
	bookings: LabBooking[];
	onRefresh: () => Promise<void>;
}) {
	return (
		<Card className="rounded-xl border-primary/20 bg-primary/5 shadow-sm">
			<CardHeader>
				<CardTitle className="text-base">Quản trị Sự kiện & Lab</CardTitle>
			</CardHeader>
			<CardContent>
				<Tabs defaultValue="events">
					<TabsList className="mb-4 w-full justify-start overflow-x-auto md:w-fit">
						<TabsTrigger value="events">Quản lý sự kiện</TabsTrigger>
						<TabsTrigger value="labs">Quản lý Lab</TabsTrigger>
						<TabsTrigger value="bookings">Duyệt lịch đặt</TabsTrigger>
						<TabsTrigger value="tutorials">Quản lý Video</TabsTrigger>
					</TabsList>
					<TabsContent value="events">
						<AdminEvents events={events} onRefresh={onRefresh} />
					</TabsContent>
					<TabsContent value="labs">
						<AdminLabs labs={labs} onRefresh={onRefresh} />
					</TabsContent>
					<TabsContent value="bookings">
						<AdminBookings bookings={bookings} onRefresh={onRefresh} />
					</TabsContent>
					<TabsContent value="tutorials">
						<AdminTutorials tutorials={tutorials} onRefresh={onRefresh} />
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}

function AdminEvents({ events, onRefresh }: { events: LibraryEvent[]; onRefresh: () => Promise<void> }) {
	const [form, setForm] = useState(defaultEventForm);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
	const [registrationEventId, setRegistrationEventId] = useState<number | null>(null);

	const reset = () => {
		setForm(defaultEventForm);
		setEditingId(null);
	};

	const save = async () => {
		if (!form.title.trim() || !form.start_time) {
			toast.error("Vui lòng nhập tên sự kiện và thời gian bắt đầu");
			return;
		}
		try {
			const payload = {
				...form,
				end_time: form.end_time || null,
				registration_deadline: form.registration_deadline || null,
				capacity: Number(form.capacity),
			};
			if (editingId) {
				await platformApi.updateEvent(editingId, payload);
				toast.success("Đã cập nhật sự kiện");
			} else {
				await platformApi.createEvent(payload);
				toast.success("Đã tạo sự kiện");
			}
			reset();
			await onRefresh();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không lưu được sự kiện");
		}
	};

	const edit = (event: LibraryEvent) => {
		setEditingId(event.id);
		setForm({
			title: event.title,
			event_type: event.event_type || "workshop",
			description: event.description || "",
			speaker: event.speaker || "",
			format: event.format || "offline",
			location: event.location || "",
			online_link: event.online_link || "",
			start_time: toDateInput(event.start_time),
			end_time: toDateInput(event.end_time),
			capacity: event.capacity || 40,
			registration_deadline: toDateInput(event.registration_deadline),
			status: event.status || "open",
			tags: event.tags || "",
			thumbnail: event.thumbnail || "",
			materials: event.materials || "",
			recorded_url: event.recorded_url || "",
			require_checkin: Boolean(event.require_checkin),
		});
	};

	const showRegistrations = async (eventId: number) => {
		try {
			const data = await platformApi.eventRegistrations(eventId);
			setRegistrationEventId(eventId);
			setRegistrations(data);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được danh sách đăng ký");
		}
	};

	const checkin = async (eventId: number, registrationId: number) => {
		try {
			await platformApi.checkinEventUser(eventId, { registration_id: registrationId });
			await showRegistrations(eventId);
			await onRefresh();
			toast.success("Đã check-in người tham gia");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không check-in được");
		}
	};

	const remove = async (eventId: number) => {
		if (!window.confirm("Bạn có chắc chắn muốn hủy sự kiện này không?")) return;
		try {
			await platformApi.deleteEvent(eventId);
			await onRefresh();
			toast.success("Đã hủy sự kiện");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không hủy được sự kiện");
		}
	};

	return (
		<div className="grid gap-5 xl:grid-cols-[420px_1fr]">
			<div className="space-y-3 rounded-xl border bg-background p-4">
				<p className="font-semibold">{editingId ? "Sửa sự kiện" : "Tạo sự kiện mới"}</p>
				<Field label="Tên sự kiện">
					<Input value={form.title} onChange={(event) => setForm((state) => ({ ...state, title: event.target.value }))} />
				</Field>
				<Field label="Mô tả">
					<Textarea value={form.description} onChange={(event) => setForm((state) => ({ ...state, description: event.target.value }))} />
				</Field>
				<div className="grid gap-3 md:grid-cols-2">
					<Field label="Loại">
						<Select value={form.event_type} onValueChange={(value) => setForm((state) => ({ ...state, event_type: value }))}>
							<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
							<SelectContent>
								{["workshop", "talk", "training", "tutorial", "lab_session"].map((value) => (
									<SelectItem key={value} value={value}>{eventTypeLabels[value]}</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field label="Trạng thái">
						<Select value={form.status} onValueChange={(value) => setForm((state) => ({ ...state, status: value }))}>
							<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
							<SelectContent>
								{["draft", "open", "closed", "ended", "cancelled"].map((value) => (
									<SelectItem key={value} value={value}>{eventStatusLabels[value]}</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field label="Hình thức">
						<Select value={form.format} onValueChange={(value) => setForm((state) => ({ ...state, format: value }))}>
							<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value="offline">Trực tiếp</SelectItem>
								<SelectItem value="online">Online</SelectItem>
								<SelectItem value="hybrid">Kết hợp</SelectItem>
							</SelectContent>
						</Select>
					</Field>
					<Field label="Sức chứa">
						<Input type="number" value={form.capacity} onChange={(event) => setForm((state) => ({ ...state, capacity: Number(event.target.value) }))} />
					</Field>
					<Field label="Bắt đầu">
						<Input type="datetime-local" value={form.start_time} onChange={(event) => setForm((state) => ({ ...state, start_time: event.target.value }))} />
					</Field>
					<Field label="Kết thúc">
						<Input type="datetime-local" value={form.end_time} onChange={(event) => setForm((state) => ({ ...state, end_time: event.target.value }))} />
					</Field>
					<Field label="Hạn đăng ký">
						<Input type="datetime-local" value={form.registration_deadline} onChange={(event) => setForm((state) => ({ ...state, registration_deadline: event.target.value }))} />
					</Field>
					<Field label="Diễn giả">
						<Input value={form.speaker} onChange={(event) => setForm((state) => ({ ...state, speaker: event.target.value }))} />
					</Field>
				</div>
				<Field label="Địa điểm">
					<Input value={form.location} onChange={(event) => setForm((state) => ({ ...state, location: event.target.value }))} />
				</Field>
				<Field label="Link online">
					<Input value={form.online_link} onChange={(event) => setForm((state) => ({ ...state, online_link: event.target.value }))} />
				</Field>
				<Field label="Tags">
					<Input value={form.tags} onChange={(event) => setForm((state) => ({ ...state, tags: event.target.value }))} placeholder="AI, học thuật, workshop" />
				</Field>
				<Field label="Link video ghi hình">
					<Input value={form.recorded_url} onChange={(event) => setForm((state) => ({ ...state, recorded_url: event.target.value }))} />
				</Field>
				<div className="flex items-center justify-between rounded-lg border p-3">
					<Label>Yêu cầu check-in</Label>
					<Switch checked={form.require_checkin} onCheckedChange={(checked) => setForm((state) => ({ ...state, require_checkin: checked }))} />
				</div>
				<div className="flex gap-2">
					<Button onClick={() => void save()}>
						<Plus className="mr-2 h-4 w-4" />
						{editingId ? "Lưu thay đổi" : "Tạo sự kiện"}
					</Button>
					{editingId ? <Button variant="outline" onClick={reset}>Hủy sửa</Button> : null}
				</div>
			</div>

			<div className="space-y-3">
				{events.map((event) => (
					<div key={event.id} className="rounded-xl border bg-background p-4">
						<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
							<div>
								<p className="font-semibold">{event.title}</p>
								<p className="mt-1 text-sm text-muted-foreground">
									{formatDate(event.start_time)} · {event.registered_count || 0}/{event.capacity} đăng ký
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button size="sm" variant="outline" onClick={() => edit(event)}>
									<Edit3 className="mr-2 h-4 w-4" />
									Sửa
								</Button>
								<Button size="sm" variant="outline" onClick={() => void showRegistrations(event.id)}>
									<Users className="mr-2 h-4 w-4" />
									Người đăng ký
								</Button>
								<Button size="sm" variant="destructive" onClick={() => void remove(event.id)}>
									<Trash2 className="mr-2 h-4 w-4" />
									Hủy
								</Button>
							</div>
						</div>
					</div>
				))}
				{registrationEventId ? (
					<div className="rounded-xl border bg-background p-4">
						<p className="font-semibold">Danh sách đăng ký</p>
						<div className="mt-3 space-y-2">
							{registrations.length === 0 ? (
								<p className="text-sm text-muted-foreground">Chưa có người đăng ký.</p>
							) : (
								registrations.map((registration) => (
									<div key={registration.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
										<div>
											<p className="font-medium">{registration.user?.full_name || registration.user?.username || `User #${registration.user_id}`}</p>
											<p className="text-sm text-muted-foreground">{bookingStatusLabels[registration.status] || registration.status}</p>
										</div>
										<Button
											size="sm"
											disabled={registration.status !== "registered"}
											onClick={() => void checkin(registrationEventId, registration.id)}
										>
											Check-in
										</Button>
									</div>
								))
							)}
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}

function AdminLabs({ labs, onRefresh }: { labs: Lab[]; onRefresh: () => Promise<void> }) {
	const [form, setForm] = useState(defaultLabForm);
	const [editingId, setEditingId] = useState<number | null>(null);

	const reset = () => {
		setForm(defaultLabForm);
		setEditingId(null);
	};

	const save = async () => {
		if (!form.name.trim()) {
			toast.error("Vui lòng nhập tên lab/thiết bị");
			return;
		}
		try {
			const payload = { ...form, capacity: Number(form.capacity) };
			if (editingId) {
				await platformApi.updateLab(editingId, payload);
				toast.success("Đã cập nhật lab");
			} else {
				await platformApi.createLab(payload);
				toast.success("Đã tạo lab");
			}
			reset();
			await onRefresh();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không lưu được lab");
		}
	};

	const edit = (lab: Lab) => {
		setEditingId(lab.id);
		setForm({
			name: lab.name,
			description: lab.description || "",
			location: lab.location || "",
			capacity: lab.capacity,
			equipment: lab.equipment || "",
			rules: lab.rules || "",
			opening_hours: lab.opening_hours || "",
			status: lab.status,
			is_bookable: lab.is_bookable,
		});
	};

	const remove = async (labId: number) => {
		if (!window.confirm("Bạn có chắc chắn muốn xóa lab này không?")) return;
		try {
			await platformApi.deleteLab(labId);
			await onRefresh();
			toast.success("Đã xóa lab");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không xóa được lab");
		}
	};

	return (
		<div className="grid gap-5 xl:grid-cols-[420px_1fr]">
			<div className="space-y-3 rounded-xl border bg-background p-4">
				<p className="font-semibold">{editingId ? "Sửa lab" : "Tạo lab/thiết bị mới"}</p>
				<Field label="Tên lab/thiết bị">
					<Input value={form.name} onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))} />
				</Field>
				<Field label="Mô tả">
					<Textarea value={form.description} onChange={(event) => setForm((state) => ({ ...state, description: event.target.value }))} />
				</Field>
				<div className="grid gap-3 md:grid-cols-2">
					<Field label="Vị trí">
						<Input value={form.location} onChange={(event) => setForm((state) => ({ ...state, location: event.target.value }))} />
					</Field>
					<Field label="Sức chứa">
						<Input type="number" value={form.capacity} onChange={(event) => setForm((state) => ({ ...state, capacity: Number(event.target.value) }))} />
					</Field>
					<Field label="Trạng thái">
						<Select value={form.status} onValueChange={(value) => setForm((state) => ({ ...state, status: value }))}>
							<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
							<SelectContent>
								{["available", "in_use", "maintenance", "unavailable"].map((value) => (
									<SelectItem key={value} value={value}>{labStatusLabels[value]}</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field label="Giờ mở cửa">
						<Input value={form.opening_hours} onChange={(event) => setForm((state) => ({ ...state, opening_hours: event.target.value }))} />
					</Field>
				</div>
				<Field label="Thiết bị">
					<Input value={form.equipment} onChange={(event) => setForm((state) => ({ ...state, equipment: event.target.value }))} />
				</Field>
				<Field label="Quy định">
					<Textarea value={form.rules} onChange={(event) => setForm((state) => ({ ...state, rules: event.target.value }))} />
				</Field>
				<div className="flex items-center justify-between rounded-lg border p-3">
					<Label>Mở đặt lịch</Label>
					<Switch checked={form.is_bookable} onCheckedChange={(checked) => setForm((state) => ({ ...state, is_bookable: checked }))} />
				</div>
				<div className="flex gap-2">
					<Button onClick={() => void save()}>{editingId ? "Lưu lab" : "Tạo lab"}</Button>
					{editingId ? <Button variant="outline" onClick={reset}>Hủy sửa</Button> : null}
				</div>
			</div>
			<div className="space-y-3">
				{labs.map((lab) => (
					<div key={lab.id} className="rounded-xl border bg-background p-4">
						<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
							<div>
								<p className="font-semibold">{lab.name}</p>
								<p className="mt-1 text-sm text-muted-foreground">{lab.location} · {lab.capacity} người</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<Badge variant={statusVariant(lab.status)}>{labStatusLabels[lab.status]}</Badge>
								<Button size="sm" variant="outline" onClick={() => edit(lab)}>Sửa</Button>
								<Button size="sm" variant="destructive" onClick={() => void remove(lab.id)}>Xóa</Button>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function AdminBookings({ bookings, onRefresh }: { bookings: LabBooking[]; onRefresh: () => Promise<void> }) {
	const act = async (action: () => Promise<unknown>, success: string) => {
		try {
			await action();
			await onRefresh();
			toast.success(success);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không cập nhật được lịch đặt");
		}
	};

	return (
		<div className="space-y-3">
			{bookings.length === 0 ? (
				<EmptyState title="Chưa có lịch đặt lab" description="Các yêu cầu đặt lịch của sinh viên sẽ hiển thị tại đây." />
			) : (
				bookings.map((booking) => (
					<div key={booking.id} className="rounded-xl border bg-background p-4">
						<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
							<div>
								<div className="flex flex-wrap items-center gap-2">
									<p className="font-semibold">{booking.lab?.name || `Lab #${booking.lab_id}`}</p>
									<Badge variant={statusVariant(booking.status)}>
										{bookingStatusLabels[booking.status] || booking.status}
									</Badge>
								</div>
								<p className="mt-1 text-sm text-muted-foreground">
									{formatDate(booking.start_time)} - {formatDate(booking.end_time)}
								</p>
								<p className="mt-1 text-sm text-muted-foreground">
									Người đặt: {booking.user?.full_name || booking.user?.username || `User #${booking.user_id}`} · {booking.participant_count} người
								</p>
								<p className="mt-2 text-sm">{booking.purpose}</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button
									size="sm"
									disabled={booking.status !== "pending"}
									onClick={() => void act(() => platformApi.approveLabBooking(booking.id), "Đã duyệt lịch đặt")}
								>
									<CheckCircle2 className="mr-2 h-4 w-4" />
									Duyệt
								</Button>
								<Button
									size="sm"
									variant="outline"
									disabled={booking.status !== "pending"}
									onClick={() => void act(() => platformApi.rejectLabBooking(booking.id, "Không phù hợp lịch lab hiện tại"), "Đã từ chối lịch đặt")}
								>
									<XCircle className="mr-2 h-4 w-4" />
									Từ chối
								</Button>
								<Button
									size="sm"
									variant="destructive"
									disabled={booking.status === "cancelled"}
									onClick={() => void act(() => platformApi.cancelLabBooking(booking.id), "Đã hủy lịch đặt")}
								>
									Hủy
								</Button>
							</div>
						</div>
					</div>
				))
			)}
		</div>
	);
}

function AdminTutorials({ tutorials, onRefresh }: { tutorials: Tutorial[]; onRefresh: () => Promise<void> }) {
	const [form, setForm] = useState(defaultTutorialForm);
	const [editingId, setEditingId] = useState<number | null>(null);

	const reset = () => {
		setForm(defaultTutorialForm);
		setEditingId(null);
	};

	const save = async () => {
		if (!form.title.trim()) {
			toast.error("Vui lòng nhập tiêu đề video/tutorial");
			return;
		}
		try {
			const payload = { ...form, duration_minutes: Number(form.duration_minutes), category: form.topic, content_url: form.video_url };
			if (editingId) {
				await platformApi.updateTutorial(editingId, payload);
				toast.success("Đã cập nhật video/tutorial");
			} else {
				await platformApi.createTutorial(payload);
				toast.success("Đã tạo video/tutorial");
			}
			reset();
			await onRefresh();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không lưu được video/tutorial");
		}
	};

	const edit = (tutorial: Tutorial) => {
		setEditingId(tutorial.id);
		setForm({
			title: tutorial.title,
			description: tutorial.description || "",
			video_url: tutorial.video_url || tutorial.content_url || "",
			thumbnail: tutorial.thumbnail || "",
			duration_minutes: tutorial.duration_minutes || 0,
			topic: tutorial.topic || tutorial.category || "",
			level: tutorial.level || "beginner",
			is_featured: Boolean(tutorial.is_featured),
			status: tutorial.status || "published",
			attachments: tutorial.attachments || "",
		});
	};

	const remove = async (tutorialId: number) => {
		if (!window.confirm("Bạn có chắc chắn muốn xóa video/tutorial này không?")) return;
		try {
			await platformApi.deleteTutorial(tutorialId);
			await onRefresh();
			toast.success("Đã xóa video/tutorial");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không xóa được video/tutorial");
		}
	};

	return (
		<div className="grid gap-5 xl:grid-cols-[420px_1fr]">
			<div className="space-y-3 rounded-xl border bg-background p-4">
				<p className="font-semibold">{editingId ? "Sửa video/tutorial" : "Tạo video/tutorial mới"}</p>
				<Field label="Tiêu đề">
					<Input value={form.title} onChange={(event) => setForm((state) => ({ ...state, title: event.target.value }))} />
				</Field>
				<Field label="Mô tả">
					<Textarea value={form.description} onChange={(event) => setForm((state) => ({ ...state, description: event.target.value }))} />
				</Field>
				<Field label="Link video">
					<Input value={form.video_url} onChange={(event) => setForm((state) => ({ ...state, video_url: event.target.value }))} />
				</Field>
				<div className="grid gap-3 md:grid-cols-2">
					<Field label="Chủ đề">
						<Input value={form.topic} onChange={(event) => setForm((state) => ({ ...state, topic: event.target.value }))} />
					</Field>
					<Field label="Thời lượng phút">
						<Input type="number" value={form.duration_minutes} onChange={(event) => setForm((state) => ({ ...state, duration_minutes: Number(event.target.value) }))} />
					</Field>
					<Field label="Mức độ">
						<Select value={form.level} onValueChange={(value) => setForm((state) => ({ ...state, level: value }))}>
							<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
							<SelectContent>
								{["beginner", "intermediate", "advanced"].map((value) => (
									<SelectItem key={value} value={value}>{levelLabels[value]}</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field label="Trạng thái">
						<Select value={form.status} onValueChange={(value) => setForm((state) => ({ ...state, status: value }))}>
							<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value="draft">Nháp</SelectItem>
								<SelectItem value="published">Công khai</SelectItem>
								<SelectItem value="hidden">Ẩn</SelectItem>
							</SelectContent>
						</Select>
					</Field>
				</div>
				<Field label="Thumbnail">
					<Input value={form.thumbnail} onChange={(event) => setForm((state) => ({ ...state, thumbnail: event.target.value }))} />
				</Field>
				<div className="flex items-center justify-between rounded-lg border p-3">
					<Label>Đánh dấu nổi bật</Label>
					<Switch checked={form.is_featured} onCheckedChange={(checked) => setForm((state) => ({ ...state, is_featured: checked }))} />
				</div>
				<div className="flex gap-2">
					<Button onClick={() => void save()}>{editingId ? "Lưu video" : "Tạo video"}</Button>
					{editingId ? <Button variant="outline" onClick={reset}>Hủy sửa</Button> : null}
				</div>
			</div>
			<div className="space-y-3">
				{tutorials.map((tutorial) => (
					<div key={tutorial.id} className="rounded-xl border bg-background p-4">
						<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
							<div>
								<p className="font-semibold">{tutorial.title}</p>
								<p className="mt-1 text-sm text-muted-foreground">
									{tutorial.topic || tutorial.category || "Hướng dẫn"} · {tutorial.duration_minutes || 0} phút · {tutorial.view_count || 0} lượt xem
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<Badge variant={statusVariant(tutorial.status || "published")}>{tutorial.status === "published" ? "Công khai" : tutorial.status}</Badge>
								<Button size="sm" variant="outline" onClick={() => edit(tutorial)}>Sửa</Button>
								<Button size="sm" variant="destructive" onClick={() => void remove(tutorial.id)}>Xóa</Button>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
