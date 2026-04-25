"use client";

import { Bot, BookOpen, FileText, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/library/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { platformApi } from "@/lib/api-client";
import type { Book, DigitalResource, Recommendation } from "@/lib/types";

export default function DiscoveryPage() {
	const [resources, setResources] = useState<DigitalResource[]>([]);
	const [newTitles, setNewTitles] = useState<Book[]>([]);
	const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);

	const loadData = useCallback(async (query = "") => {
		setLoading(true);
		try {
			const [resourceData, titleData, recommendationData] = await Promise.all([
				platformApi.resources(query),
				platformApi.newTitles(),
				platformApi.recommendations(),
			]);
			setResources(resourceData);
			setNewTitles(titleData);
			setRecommendations(recommendationData);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được dữ liệu tra cứu");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadData("");
	}, [loadData]);

	return (
		<div className="space-y-6">
			<PageHeader
				title="Tra cứu & Tài nguyên số"
				description="Smart Catalog, Digital Library, tài liệu mới và gợi ý cá nhân hóa."
				actions={
					<Button asChild>
						<Link href="/user/chatbot">
							<Bot className="mr-2 h-4 w-4" />
							AI Research Assistant
						</Link>
					</Button>
				}
			/>

			<Card className="rounded-xl">
				<CardContent className="p-4">
					<div className="flex flex-col gap-3 md:flex-row">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								onKeyDown={(event) => event.key === "Enter" && void loadData(search)}
								placeholder="Tìm sách in, ebook, luận văn, tạp chí..."
								className="h-11 rounded-lg pl-9"
							/>
						</div>
						<Button className="h-11 rounded-lg" onClick={() => void loadData(search)}>
							Tra cứu
						</Button>
						<Button variant="outline" className="h-11 rounded-lg" asChild>
							<Link href="/user/books">Smart Catalog</Link>
						</Button>
					</div>
				</CardContent>
			</Card>

			<div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
				<Card className="rounded-xl">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<FileText className="h-4 w-4" />
							Digital Library
						</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-3 md:grid-cols-2">
						{loading ? (
							<p className="text-sm text-muted-foreground">Đang tải...</p>
						) : resources.length === 0 ? (
							<p className="text-sm text-muted-foreground">Chưa có tài nguyên số phù hợp.</p>
						) : (
							resources.slice(0, 8).map((resource) => (
								<div key={resource.id} className="rounded-lg border bg-muted/30 p-4">
									<p className="font-medium">{resource.title}</p>
									<p className="mt-1 text-xs uppercase text-muted-foreground">
										{resource.resource_type} · {resource.access_level}
									</p>
									<p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
										{resource.description || resource.subjects || "Tài nguyên số của thư viện."}
									</p>
								</div>
							))
						)}
					</CardContent>
				</Card>

				<div className="space-y-6">
					<Card className="rounded-xl">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-base">
								<BookOpen className="h-4 w-4" />
								Discover New Titles
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{newTitles.slice(0, 5).map((book) => (
								<div key={book.id} className="flex items-center justify-between rounded-lg border p-3">
									<div className="min-w-0">
										<p className="truncate font-medium">{book.title}</p>
										<p className="truncate text-sm text-muted-foreground">{book.author || "Không rõ tác giả"}</p>
									</div>
									<Button size="sm" variant="outline" asChild>
										<Link href={`/user/books`}>Xem</Link>
									</Button>
								</div>
							))}
						</CardContent>
					</Card>

					<Card className="rounded-xl">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-base">
								<Sparkles className="h-4 w-4" />
								Personalized Recommendations
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{recommendations.slice(0, 4).map((item) => (
								<div key={item.id} className="rounded-lg bg-muted/40 p-3">
									<p className="font-medium">{item.book?.title || "Tài liệu đề xuất"}</p>
									<p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
								</div>
							))}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
