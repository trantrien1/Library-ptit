"use client";

import {
	AlertTriangle,
	BookOpen,
	Bot,
	CalendarDays,
	Clock3,
	FileText,
	FlaskConical,
	Heart,
	History,
	MessageCircle,
	PlusCircle,
	RefreshCw,
	Search,
	ShoppingBasket,
	Sparkles,
	UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
	BarChart,
	DonutChart,
	Heatmap,
	LineAreaChart,
	ProgressRing,
	Sparkline,
} from "@/components/dashboard/charts";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { ChartPoint, KpiValue, UserDashboardOverview } from "@/lib/types";
import { cn } from "@/lib/utils";

const periodLabels: Record<string, string> = {
	today: "Hôm nay",
	"7d": "7 ngày",
	"30d": "30 ngày",
	"3m": "3 tháng",
	"6m": "6 tháng",
	"12m": "12 tháng",
};

const statusLabels: Record<string, string> = {
	pending: "Chờ duyệt",
	need_edit: "Cần chỉnh sửa",
	approved: "Đang mượn",
	returned: "Đã trả",
	rejected: "Từ chối",
};

function LoadingSkeleton() {
	return (
		<div className="space-y-5">
			<div className="h-40 animate-pulse rounded-2xl bg-muted" />
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{Array.from({ length: 8 }).map((_, index) => (
					<div key={index} className="h-32 animate-pulse rounded-2xl bg-muted" />
				))}
			</div>
			<div className="grid gap-5 xl:grid-cols-2">
				<div className="h-80 animate-pulse rounded-2xl bg-muted" />
				<div className="h-80 animate-pulse rounded-2xl bg-muted" />
			</div>
		</div>
	);
}

function KpiCard({
	title,
	value,
	icon: Icon,
	tone,
	href,
	sparkline,
}: {
	title: string;
	value: KpiValue;
	icon: typeof BookOpen;
	tone: string;
	href: string;
	sparkline?: ChartPoint[];
}) {
	const up = value.trendDirection === "up";
	const content = (
		<Card className="group rounded-2xl border-muted/70 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
			<CardContent className="p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="text-sm text-muted-foreground">{title}</p>
						<p className="mt-2 text-3xl font-semibold tracking-normal">{formatNumber(value.currentValue)}</p>
					</div>
					<div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tone)}>
						<Icon className="h-5 w-5" />
					</div>
				</div>
				<div className="mt-4 flex items-center justify-between gap-3">
					<Badge variant={up ? "default" : value.trendDirection === "down" ? "destructive" : "secondary"}>
						{up ? "+" : ""}
						{value.changePercent}%
					</Badge>
					{sparkline ? <Sparkline data={sparkline} className="text-primary" /> : null}
				</div>
			</CardContent>
		</Card>
	);
	return <Link href={href}>{content}</Link>;
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

export default function UserDashboardPage() {
	const { user } = useAuth();
	const [period, setPeriod] = useState("30d");
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [data, setData] = useState<UserDashboardOverview | null>(null);

	const loadDashboard = async (showRefresh = false) => {
		if (showRefresh) setRefreshing(true);
		else setLoading(true);
		try {
			setData(await dashboardApi.userOverview(period));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được dashboard cá nhân");
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	useEffect(() => {
		void loadDashboard();
	}, [period]);

	const shortTrend = useMemo(() => (data?.borrowTrend || []).slice(-8), [data?.borrowTrend]);

	if (loading) return <LoadingSkeleton />;
	if (!data) {
		return (
			<Card className="rounded-2xl">
				<CardContent className="p-8 text-center text-muted-foreground">
					Không có dữ liệu dashboard. Vui lòng thử tải lại.
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			<section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-cyan-500/10 p-5 shadow-sm md:p-6">
				<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
					<div className="max-w-3xl">
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="secondary">{data.profile.role}</Badge>
							<Badge>{data.profile.accountStatus}</Badge>
							<span className="text-sm text-muted-foreground">
								{new Intl.DateTimeFormat("vi-VN", { dateStyle: "full" }).format(new Date())}
							</span>
						</div>
						<h1 className="mt-4 text-2xl font-semibold tracking-normal md:text-3xl">
							Chào {data.profile.name || user?.username}, hôm nay bạn muốn học gì?
						</h1>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							Theo dõi phiếu mượn, mục tiêu đọc sách, hoạt động cộng đồng, sự kiện, lab và các phiên học với Chatbot AI trong một không gian cá nhân.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Select value={period} onValueChange={setPeriod}>
							<SelectTrigger className="w-[140px] bg-background">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(periodLabels).map(([value, label]) => (
									<SelectItem key={value} value={value}>{label}</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button variant="outline" onClick={() => void loadDashboard(true)} disabled={refreshing}>
							<RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
							Làm mới
						</Button>
					</div>
				</div>
				<div className="mt-5 flex flex-wrap gap-2">
					<Button asChild><Link href="/user/books"><Search className="mr-2 h-4 w-4" />Tìm sách ngay</Link></Button>
					<Button variant="secondary" asChild><Link href="/user/chatbot"><Bot className="mr-2 h-4 w-4" />Mở Chatbot AI</Link></Button>
					<Button variant="outline" asChild><Link href="/user/social"><PlusCircle className="mr-2 h-4 w-4" />Tạo bài viết</Link></Button>
					<Button variant="outline" asChild><Link href="/user/events"><CalendarDays className="mr-2 h-4 w-4" />Xem sự kiện</Link></Button>
				</div>
			</section>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<KpiCard title="Sách trong giỏ mượn" value={data.kpis.cartCount} icon={ShoppingBasket} tone="bg-blue-50 text-blue-600 dark:bg-blue-950/40" href="/user/wishlist" sparkline={shortTrend} />
				<KpiCard title="Phiếu chờ duyệt" value={data.kpis.pendingBorrowRequests} icon={Clock3} tone="bg-amber-50 text-amber-600 dark:bg-amber-950/40" href="/user/borrows" sparkline={shortTrend} />
				<KpiCard title="Sách đang mượn" value={data.kpis.activeBorrows} icon={BookOpen} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40" href="/user/borrows" sparkline={shortTrend} />
				<KpiCard title="Sách đã trả" value={data.kpis.returnedBooks} icon={History} tone="bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40" href="/user/borrows" sparkline={shortTrend} />
				<KpiCard title="Sắp đến hạn" value={data.kpis.dueSoonCount} icon={AlertTriangle} tone="bg-orange-50 text-orange-600 dark:bg-orange-950/40" href="/user/borrows" />
				<KpiCard title="Bài viết cộng đồng" value={data.kpis.myPosts} icon={MessageCircle} tone="bg-violet-50 text-violet-600 dark:bg-violet-950/40" href="/user/social" />
				<KpiCard title="Sự kiện đã đăng ký" value={data.kpis.registeredEvents} icon={CalendarDays} tone="bg-rose-50 text-rose-600 dark:bg-rose-950/40" href="/user/events?tab=registered" />
				<KpiCard title="Phiên Chatbot AI" value={data.kpis.chatbotSessions} icon={Bot} tone="bg-teal-50 text-teal-600 dark:bg-teal-950/40" href="/user/chatbot" />
			</div>

			<div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
				<ChartCard title="Tổng quan hoạt động cá nhân" subtitle="Số phiếu mượn và hoạt động đọc theo thời gian">
					<LineAreaChart data={data.borrowTrend} area color="#2563eb" />
				</ChartCard>
				<ChartCard title="Tình trạng phiếu mượn" subtitle="Cơ cấu trạng thái hiện tại">
					<DonutChart data={data.statusDistribution} />
				</ChartCard>
			</div>

			<div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
				<ChartCard title="Mục tiêu đọc sách tháng này" subtitle={`${data.readingGoalProgress.completed}/${data.readingGoalProgress.target} sách · streak ${data.readingGoalProgress.streakDays} ngày`}>
					<div className="flex flex-col items-center gap-5 sm:flex-row">
						<ProgressRing value={data.readingGoalProgress.percent} label="hoàn thành" />
						<div className="flex-1 space-y-3">
							<p className="text-sm leading-6 text-muted-foreground">
								Mục tiêu đọc được tính từ số sách đã trả trong tháng và hoạt động mượn gần đây.
							</p>
							<div className="rounded-xl bg-muted/40 p-4">
								<p className="text-sm font-medium">Gợi ý hôm nay</p>
								<p className="mt-1 text-sm text-muted-foreground">Đọc tiếp một chương hoặc tạo quiz nhanh từ tài liệu đang học.</p>
							</div>
						</div>
					</div>
				</ChartCard>
				<ChartCard title="Lịch hoạt động" subtitle="Heatmap hoạt động đọc, lab và học tập">
					<Heatmap data={data.activityHeatmap} />
				</ChartCard>
			</div>

			<div className="grid gap-5 xl:grid-cols-[1fr_360px]">
				<Card className="rounded-2xl border-muted/70 shadow-sm">
					<CardHeader className="flex flex-row items-center justify-between">
						<CardTitle className="text-base">Phiếu mượn gần đây</CardTitle>
						<Button variant="outline" size="sm" asChild><Link href="/user/borrows">Xem tất cả</Link></Button>
					</CardHeader>
					<CardContent className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Mã phiếu</TableHead>
									<TableHead>Sách</TableHead>
									<TableHead>Ngày tạo</TableHead>
									<TableHead>Hạn trả</TableHead>
									<TableHead>Trạng thái</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.recentBorrows.length === 0 ? (
									<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Bạn chưa có phiếu mượn nào.</TableCell></TableRow>
								) : data.recentBorrows.map((borrow) => (
									<TableRow key={borrow.id}>
										<TableCell className="font-medium">#{borrow.id}</TableCell>
										<TableCell>{borrow.firstBookTitle || `${borrow.totalItems} sách`}</TableCell>
										<TableCell>{formatDateTime(borrow.createdAt)}</TableCell>
										<TableCell>{formatDate(borrow.dueDate)}</TableCell>
										<TableCell>
											<Badge variant={borrow.status === "approved" ? "default" : borrow.status === "pending" ? "secondary" : "outline"}>
												{statusLabels[borrow.status] || borrow.status}
											</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				<ChartCard title="Lời nhắc & cảnh báo" subtitle="Việc cần chú ý gần nhất">
					<div className="space-y-3">
						{data.reminders.length === 0 ? (
							<p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Không có lời nhắc mới.</p>
						) : data.reminders.map((item, index) => (
							<Link key={`${item.title}-${index}`} href={item.ctaUrl || "/user/dashboard"} className="block rounded-xl border p-3 transition hover:bg-muted/40">
								<div className="flex items-start gap-3">
									<div className={cn("mt-0.5 rounded-lg p-2", item.severity === "high" ? "bg-rose-50 text-rose-600" : item.severity === "medium" ? "bg-amber-50 text-amber-600" : "bg-primary/10 text-primary")}>
										<AlertTriangle className="h-4 w-4" />
									</div>
									<div className="min-w-0">
										<p className="font-medium">{item.title}</p>
										<p className="mt-1 text-sm leading-5 text-muted-foreground">{item.message}</p>
										<p className="mt-1 text-xs text-muted-foreground">{item.time ? formatDate(item.time) : item.ctaLabel}</p>
									</div>
								</div>
							</Link>
						))}
					</div>
				</ChartCard>
			</div>

			<div className="grid gap-5 xl:grid-cols-3">
				<ChartCard title="Cộng đồng của tôi" subtitle={`${data.communitySummary.joinedGroups} nhóm · ${data.communitySummary.receivedLikes} lượt thích`}>
					<div className="space-y-4">
						<BarChart data={data.communitySummary.weeklyPosts.slice(-7)} />
						<div className="space-y-2">
							{data.communitySummary.recentPosts.slice(0, 3).map((post) => (
								<Link key={post.id} href="/user/social" className="block rounded-lg bg-muted/40 p-3 hover:bg-muted">
									<p className="line-clamp-1 font-medium">{post.title}</p>
									<p className="mt-1 text-xs text-muted-foreground">{post.groupName} · {post.author}</p>
								</Link>
							))}
						</div>
						<Button variant="outline" className="w-full" asChild><Link href="/user/social"><UsersRound className="mr-2 h-4 w-4" />Vào cộng đồng</Link></Button>
					</div>
				</ChartCard>

				<ChartCard title="Sự kiện & Lab của tôi" subtitle={`${data.eventLabSummary.registeredEvents} sự kiện đã đăng ký`}>
					<div className="space-y-3">
						{[...data.eventLabSummary.upcomingEvents, ...data.eventLabSummary.labBookings].slice(0, 6).map((item, index) => (
							<div key={`${item.id}-${index}`} className="rounded-xl border p-3">
								<div className="flex items-center gap-3">
									<div className="rounded-lg bg-primary/10 p-2 text-primary">
										{"labName" in item ? <FlaskConical className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
									</div>
									<div className="min-w-0">
										<p className="line-clamp-1 font-medium">{"labName" in item ? item.labName : item.title}</p>
										<p className="text-xs text-muted-foreground">{formatDate("startTime" in item ? item.startTime : null)} · {item.status}</p>
									</div>
								</div>
							</div>
						))}
						<div className="grid grid-cols-2 gap-2">
							<Button variant="outline" asChild><Link href="/user/events">Xem sự kiện</Link></Button>
							<Button variant="outline" asChild><Link href="/user/events?tab=labs">Đặt lịch Lab</Link></Button>
						</div>
					</div>
				</ChartCard>

				<ChartCard title="Chatbot AI & học tập" subtitle={`${data.chatbotSummary.messages} tin nhắn · ${data.chatbotSummary.quizCount} quiz`}>
					<div className="space-y-4">
						<DonutChart data={data.chatbotSummary.modeDistribution.length ? data.chatbotSummary.modeDistribution : [{ name: "Chưa có dữ liệu", value: 1 }]} size={132} />
						<div className="grid grid-cols-2 gap-2">
							<Button variant="outline" asChild><Link href="/user/chatbot"><Bot className="mr-2 h-4 w-4" />Hỏi AI</Link></Button>
							<Button variant="outline" asChild><Link href="/user/chatbot"><Sparkles className="mr-2 h-4 w-4" />Tạo quiz</Link></Button>
						</div>
					</div>
				</ChartCard>
			</div>

			<div className="grid gap-5 xl:grid-cols-[1fr_360px]">
				<ChartCard title="Timeline hoạt động" subtitle="Các hoạt động mới nhất trong workspace">
					<div className="space-y-4">
						{data.activityTimeline.map((item, index) => (
							<Link key={`${item.title}-${index}`} href={item.url || "/user/dashboard"} className="flex gap-3 rounded-xl border p-3 transition hover:bg-muted/40">
								<div className="mt-1 h-3 w-3 rounded-full bg-primary" />
								<div>
									<p className="font-medium">{item.title}</p>
									<p className="text-sm text-muted-foreground">{item.description}</p>
									<p className="mt-1 text-xs text-muted-foreground">{item.time ? formatDateTime(item.time) : ""}</p>
								</div>
							</Link>
						))}
					</div>
				</ChartCard>

				<ChartCard title="Hành động nhanh" subtitle="Điều hướng tới các việc thường làm">
					<div className="grid gap-2">
						{[
							["Tìm sách ngay", "/user/books", Search],
							["Xem giỏ mượn", "/user/wishlist", ShoppingBasket],
							["Tạo bài viết", "/user/social", FileText],
							["Hỏi Chatbot AI", "/user/chatbot", Bot],
							["Đăng ký sự kiện", "/user/events", CalendarDays],
							["Đặt lịch Lab", "/user/events?tab=labs", FlaskConical],
							["Gửi feedback", "/user/library-info", Heart],
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
