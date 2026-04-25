"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";

export default function HomePage() {
	const router = useRouter();
	const { hydrated, token, user } = useAuth();

	useEffect(() => {
		if (!hydrated) return;
		if (!token || !user) {
			router.replace("/login");
			return;
		}
		router.replace(user.role === "admin" ? "/admin/dashboard" : "/user/dashboard");
	}, [hydrated, router, token, user]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
		</div>
	);
}
