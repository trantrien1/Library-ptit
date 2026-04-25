"use client";

import {
	AlertTriangle,
	BookCopy,
	BookOpen,
	Bot,
	CalendarDays,
	Clock3,
	FileClock,
	FileText,
	FlaskConical,
	Library,
	MessageSquareWarning,
	Newspaper,
	RefreshCw,
	Search,
	Users,
	UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
	BarChart,
	DonutChart,
	Heatmap,
	HorizontalBarChart,
	LineAreaChart,
	ProgressRing,
	Sparkline,
} from "@/components/dashboard/charts";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { dashboardApi } from "@/lib/api-client";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import type { AdminDashboardOverview, ChartPoint, KpiValue } from "@/lib/types";
import { cn } from "@/lib/utils";

const periodLabels: Record<string, string> = {
	today: "Hôm nay",
	"7d": "7 ngày",
	"30d": "30 ngày",
	"3m": "3 tháng",
	"6m": "6 tháng",
	"12m": "12 tháng",
};

function DashboardSkeleton() {
	return (
		<div className="space-y-5">
			<div className="h-36 animate-pulse rounded-2xl bg-muted" />
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
				{Array.from({ length: 10 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
			</div>
			<div className="grid gap-5 xl:grid-cols-2">
				<div className="h-80 animate-pulse rounded-2xl bg-muted" />
				<div className="h-80 animate-pulse rounded-2xl bg-muted" />
			</div>
		</div>
	);
}

function AdminKpiCard({
	title,
	value,
	icon: Icon,
	href,
	tone,
	sparkline,
}: {
	title: string;
	value: KpiValue;
	icon: typeof Library;
	href: string;
	tone: string;
	sparkline?: ChartPoint[];
}) {
	const up = value.trendDirection === "up";
	return (
		<Link href={href}>
			<Card className="group rounded-2xl border-muted/70 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
				<CardContent className="p-4">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<p className="text-sm text-muted-foreground">{title}</p>
							<p className="mt-2 text-3xl font-semibold tracking-normal">{formatNumber(value.currentValue)}</p>
						</div>
						<div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", tone)}>
							<Icon className="h-5 w-5" />
						</div>
					</div>
					<div className="mt-3 flex items-center justify-between gap-3">
						<Badge variant={up ? "default" : value.trendDirection === "down" ? "destructive" : "secondary"}>
							{up ? "+" : ""}
							{value.changePercent}%
						</Badge>
						{sparkline ? <Sparkline data={sparkline} className="text-primary" /> : null}
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}

function ChartCard({
	title,
	subtitle,
	action,
	children,
}: {
	title: string;
	subtitle?: string;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<Card className="rounded-2xl border-muted/70 shadow-sm">
			<CardHeader className="flex flex-row items-start justify-between gap-4">
				<div>
					<CardTitle className="text-base">{title}</CardTitle>
					{subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
				</div>
				{action}
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}

export default function AdminDashboardPage() {
	const { user } = useAuth();
	const [period, setPeriod] = useState("30d");
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [data, setData] = useState<AdminDashboardOverview | null>(null);
	const [activityFilter, setActivityFilter] = useState("all");

	const loadDashboard = async (showRefresh = false) => {
		if (showRefresh) setRefreshing(true);
		else setLoading(true);
		try {
			setData(await dashboardApi.adminOverview(period));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được dashboard quản trị");
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	useEffect(() => {
		void loadDashboard();
	}, [period]);

	const trend = useMemo(() => (data?.circulationStats.borrowTrend || []).slice(-8), [data?.circulationStats.borrowTrend]);
	const filteredActivity = useMemo(() => {
		if (!data) return [];
		return activityFilter === "all"
			? data.activityFeed
			: data.activityFeed.filter((item) => item.type === activityFilter);
	}, [activityFilter, data]);

	if (loading) return <DashboardSkeleton />;
	if (!data) {
		return (
			<Card className="rounded-2xl">
				<CardContent className="p-8 text-center text-muted-foreground">Không có dữ liệu dashboard quản trị.</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			<section className="rounded-2xl border bg-gradient-to-br from-slate-950 via-slate-900 to-primary p-5 text-white shadow-sm md:p-6">
				<div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<Badge className="bg-white/15 text-white hover:bg-white/15">Admin Console</Badge>
							<span className="text-sm text-white/70">
								{new Intl.DateTimeFormat("vi-VN", { dateStyle: "full", timeStyle: "short" }).format(new Date())}
							</span>
						</div>
						<h1 className="mt-4 text-2xl font-semibold tracking-normal md:text-3xl">
							Chào {data.admin.name || user?.username}, đây là toàn cảnh Library PTIT
						</h1>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
							Theo dõi mượn trả, độc giả, cộng đồng, sự kiện, lab, feedback, chatbot và các cảnh báo cần xử lý.
						</p>
					</div>
					<div className="flex flex-col gap-3 sm:flex-row">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
							<Input className="h-10 border-white/20 bg-white/10 pl-9 text-white placeholder:text-white/60" placeholder="Tìm nhanh sách, độc giả, phiếu..." />
						</div>
						<Select value={period} onValueChange={setPeriod}>
							<SelectTrigger className="w-[140px] border-white/20 bg-white/10 text-white">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(periodLabels).map(([value, label]) => (
									<SelectItem key={value} value={value}>{label}</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button variant="secondary" onClick={() => void loadDashboard(true)} disabled={refreshing}>
							<RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
							Làm mới
						</Button>
					</div>
				</div>
				<div className="mt-5 flex flex-wrap gap-2">
					<Button variant="secondary" asChild><Link href="/admin/books"><BookOpen className="mr-2 h-4 w-4" />Thêm sách</Link></Button>
					<Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" asChild><Link href="/admin/borrows"><FileClock className="mr-2 h-4 w-4" />Duyệt phiếu mượn</Link></Button>
					<Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" asChild><Link href="/admin/platform"><CalendarDays className="mr-2 h-4 w-4" />Tạo sự kiện</Link></Button>
					<Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" asChild><Link href="/admin/library-info"><MessageSquareWarning className="mr-2 h-4 w-4" />Xem feedback</Link></Button>
				</div>
			</section>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
				<AdminKpiCard title="Tổng số sách" value={data.kpis.totalBooks} icon={BookCopy} href="/admin/books" tone="bg-blue-50 text-blue-600 dark:bg-blue-950/40" sparkline={trend} />
				<AdminKpiCard title="Bản sách khả dụng" value={data.kpis.availableCopies} icon={Library} href="/admin/books" tone="bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40" sparkline={trend} />
				<AdminKpiCard title="Tổng độc giả" value={data.kpis.totalReaders} icon={Users} href="/admin/users" tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40" />
				<AdminKpiCard title="Phiếu chờ duyệt" value={data.kpis.pendingBorrows} icon={Clock3} href="/admin/borrows?status=pending" tone="bg-amber-50 text-amber-600 dark:bg-amber-950/40" />
				<AdminKpiCard title="Phiếu quá hạn" value={data.kpis.overdueBorrows} icon={AlertTriangle} href="/admin/borrows?status=overdue" tone="bg-rose-50 text-rose-600 dark:bg-rose-950/40" />
				<AdminKpiCard title="Nhóm cộng đồng" value={data.kpis.communityGroups} icon={UsersRound} href="/user/social" tone="bg-violet-50 text-violet-600 dark:bg-violet-950/40" />
				<AdminKpiCard title="Bài viết cộng đồng" value={data.kpis.communityPosts} icon={FileText} href="/user/social" tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40" />
				<AdminKpiCard title="Sự kiện mở đăng ký" value={data.kpis.eventOpen} icon={CalendarDays} href="/admin/platform?tab=events&status=open" tone="bg-orange-50 text-orange-600 dark:bg-orange-950/40" />
				<AdminKpiCard title="Booking lab chờ duyệt" value={data.kpis.pendingLabBookings} icon={FlaskConical} href="/admin/platform?tab=labs&status=pending" tone="bg-teal-50 text-teal-600 dark:bg-teal-950/40" />
				<AdminKpiCard title="Feedback mới" value={data.kpis.feedbackNew} icon={MessageSquareWarning} href="/admin/library-info?tab=feedback" tone="bg-pink-50 text-pink-600 dark:bg-pink-950/40" />
			</div>

			<div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
				<ChartCard title="Xu hướng mượn sách" subtitle="Line/area chart số phiếu mượn theo thời gian" action={<Button variant="outline" size="sm" asChild><Link href="/admin/borrows">Chi tiết</Link></Button>}>
					<LineAreaChart data={data.circulationStats.borrowTrend} area color="#2563eb" />
				</ChartCard>
				<ChartCard title="Phân bổ phiếu mượn" subtitle="Stacked bar theo trạng thái">
					<BarChart data={data.circulationStats.statusDistribution} stacked />
					<div className="mt-6">
						<ProgressRing value={data.kpis.onTimeRate.currentValue} label="đúng hạn" />
					</div>
				</ChartCard>
			</div>

			<div className="grid gap-5 xl:grid-cols-3">
				<ChartCard title="Cơ cấu sách theo thể loại" subtitle={`${data.libraryStats.totalTitles} đầu sách · ${data.libraryStats.totalCopies} bản`}>
					<DonutChart data={data.libraryStats.categoryDistribution} />
				</ChartCard>
				<ChartCard title="Cộng đồng & tương tác" subtitle={`${data.communityStats.posts} bài viết · ${data.communityStats.likes} lượt thích`}>
					<LineAreaChart data={data.communityStats.engagementTrend} color="#7c3aed" />
				</ChartCard>
				<ChartCard title="Sự kiện & đăng ký" subtitle={`Tỷ lệ check-in ${data.eventStats.checkinRate}%`}>
					<BarChart data={data.eventStats.registrationTrend.slice(-10)} />
				</ChartCard>
			</div>

			<div className="grid gap-5 xl:grid-cols-[1fr_380px]">
				<ChartCard title="Heatmap hoạt động mượn sách" subtitle="Phân bổ theo ngày trong tuần và khung giờ 3 tiếng">
					<Heatmap data={data.heatmapData} />
				</ChartCard>
				<ChartCard title="Cảnh báo & việc cần xử lý" subtitle="Ưu tiên xử lý trong ngày">
					<div className="space-y-3">
						{data.alerts.length === 0 ? (
							<p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Không có cảnh báo mới.</p>
						) : data.alerts.map((alert, index) => (
							<Link key={`${alert.title}-${index}`} href={alert.url || "/admin/dashboard"} className="block rounded-xl border p-3 transition hover:bg-muted/40">
								<div className="flex items-start justify-between gap-3">
									<div className="flex gap-3">
										<div className={cn("rounded-lg p-2", alert.severity === "high" ? "bg-rose-50 text-rose-600" : alert.severity === "medium" ? "bg-amber-50 text-amber-600" : "bg-primary/10 text-primary")}>
											<AlertTriangle className="h-4 w-4" />
										</div>
										<div>
											<p className="font-medium">{alert.title}</p>
											<p className="text-sm text-muted-foreground">Nhấn để xử lý ngay</p>
										</div>
									</div>
									<Badge>{alert.count || 0}</Badge>
								</div>
							</Link>
						))}
					</div>
				</ChartCard>
			</div>

			<div className="grid gap-5 xl:grid-cols-3">
				<ChartCard title="Top sách được mượn nhiều" subtitle="Horizontal bar chart">
					<HorizontalBarChart data={data.libraryStats.topBooks.map((book) => ({ name: book.title, value: book.count }))} />
				</ChartCard>
				<ChartCard title="Top nhóm hoạt động mạnh" subtitle="Điểm dựa trên bài viết, bình luận, lượt thích">
					<HorizontalBarChart data={data.communityStats.topGroups.map((group) => ({ name: group.name, value: group.score }))} />
				</ChartCard>
				<ChartCard title="Chatbot AI usage" subtitle={`${data.chatbotStats.sessions} phiên · ${data.chatbotStats.mostUsedFeature} dùng nhiều nhất`}>
					<DonutChart data={data.chatbotStats.modeDistribution.length ? data.chatbotStats.modeDistribution : [{ name: "Chưa có dữ liệu", value: 1 }]} />
				</ChartCard>
			</div>

			<div className="grid gap-5 xl:grid-cols-[1fr_420px]">
				<Card className="rounded-2xl border-muted/70 shadow-sm">
					<CardHeader className="flex flex-row items-center justify-between gap-3">
						<div>
							<CardTitle className="text-base">Bảng dữ liệu cần theo dõi</CardTitle>
							<p className="mt-1 text-sm text-muted-foreground">Phiếu mượn gần đây, trạng thái và số lượng sách</p>
						</div>
						<Button variant="outline" size="sm" asChild><Link href="/admin/borrows">Xem tất cả</Link></Button>
					</CardHeader>
					<CardContent className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Mã phiếu</TableHead>
									<TableHead>Độc giả</TableHead>
									<TableHead>Sách</TableHead>
									<TableHead>Ngày tạo</TableHead>
									<TableHead>Hạn trả</TableHead>
									<TableHead>Trạng thái</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.recentTransactions.map((item) => (
									<TableRow key={item.id}>
										<TableCell className="font-medium">#{item.id}</TableCell>
										<TableCell>{item.userName || "Bạn đọc"}</TableCell>
										<TableCell>{item.firstBookTitle || `${item.totalItems} sách`}</TableCell>
										<TableCell>{formatDateTime(item.createdAt)}</TableCell>
										<TableCell>{formatDate(item.dueDate)}</TableCell>
										<TableCell><Badge variant={item.status === "approved" ? "default" : item.status === "pending" ? "secondary" : "outline"}>{item.status}</Badge></TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				<ChartCard
					title="Hoạt động gần đây"
					subtitle="Timeline từ mượn trả, feedback và lab"
					action={
						<Select value={activityFilter} onValueChange={setActivityFilter}>
							<SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Tất cả</SelectItem>
								<SelectItem value="borrow">Mượn trả</SelectItem>
								<SelectItem value="feedback">Feedback</SelectItem>
								<SelectItem value="lab">Lab</SelectItem>
							</SelectContent>
						</Select>
					}
				>
					<div className="space-y-3">
						{filteredActivity.map((item, index) => (
							<Link key={`${item.title}-${index}`} href={item.url || "/admin/dashboard"} className="flex gap-3 rounded-xl border p-3 transition hover:bg-muted/40">
								<div className="mt-1 h-3 w-3 rounded-full bg-primary" />
								<div className="min-w-0">
									<p className="line-clamp-1 font-medium">{item.title}</p>
									<p className="text-sm text-muted-foreground">{item.description}</p>
									<p className="mt-1 text-xs text-muted-foreground">{item.time ? formatDateTime(item.time) : ""}</p>
								</div>
							</Link>
						))}
					</div>
				</ChartCard>
			</div>

			<div className="grid gap-5 xl:grid-cols-4">
				<ChartCard title="Sự kiện sắp tới" subtitle="Setup check-in và sức chứa">
					<div className="space-y-3">
						{data.eventStats.upcomingEvents.slice(0, 5).map((event) => (
							<Link key={event.id} href={`/admin/platform?tab=events&eventId=${event.id}`} className="block rounded-xl border p-3 hover:bg-muted/40">
								<p className="line-clamp-1 font-medium">{event.title}</p>
								<p className="mt-1 text-xs text-muted-foreground">{formatDate(event.startTime)} · {event.registeredCount}/{event.capacity}</p>
							</Link>
						))}
					</div>
				</ChartCard>
				<ChartCard title="Booking lab chờ duyệt" subtitle={`${data.labStats.pendingBookings} yêu cầu`}>
					<div className="space-y-3">
						{data.labStats.pendingList.length === 0 ? <p className="text-sm text-muted-foreground">Không có yêu cầu chờ duyệt.</p> : data.labStats.pendingList.map((item) => (
							<Link key={item.id} href="/admin/platform?tab=labs" className="block rounded-xl border p-3 hover:bg-muted/40">
								<p className="font-medium">{item.labName}</p>
								<p className="text-xs text-muted-foreground">{item.user} · {formatDateTime(item.createdAt)}</p>
							</Link>
						))}
					</div>
				</ChartCard>
				<ChartCard title="Feedback mới" subtitle={`${data.feedbackStats.new} mục cần phản hồi`}>
					<div className="space-y-3">
						{data.feedbackStats.recent.slice(0, 5).map((item) => (
							<Link key={item.id} href="/admin/library-info?tab=feedback" className="block rounded-xl border p-3 hover:bg-muted/40">
								<p className="line-clamp-1 font-medium">{item.subject}</p>
								<p className="text-xs text-muted-foreground">{item.status} · {item.priority}</p>
							</Link>
						))}
					</div>
				</ChartCard>
				<ChartCard title="Control Panel" subtitle="Hành động quản trị nhanh">
					<div className="grid gap-2">
						{[
							["Thêm sách", "/admin/books", BookOpen],
							["Duyệt phiếu mượn", "/admin/borrows", FileClock],
							["Duyệt booking lab", "/admin/platform?tab=labs", FlaskConical],
							["Tạo sự kiện", "/admin/platform?tab=events", CalendarDays],
							["Tạo tin tức", "/admin/library-info", Newspaper],
							["Quản lý cộng đồng", "/user/social", UsersRound],
							["Xem chatbot usage", "/admin/dashboard", Bot],
						].map(([label, href, Icon]) => (
							<Button key={String(label)} variant="outline" className="justify-start" asChild>
								<Link href={String(href)}>
									<Icon className="mr-2 h-4 w-4" />
									{String(label)}
								</Link>
							</Button>
						))}
					</div>
				</ChartCard>
			</div>
		</div>
	);
}
