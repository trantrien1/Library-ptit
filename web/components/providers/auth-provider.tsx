"use client";

import {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { authApi } from "@/lib/api-client";
import type { AppUser, UserRole } from "@/lib/types";

interface AuthContextValue {
	hydrated: boolean;
	token: string | null;
	user: AppUser | null;
	login: (token: string, user: AppUser) => void;
	logout: () => void;
	refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getBrowserStorage() {
	if (typeof window === "undefined") return null;
	const storage = window.localStorage;
	if (
		!storage ||
		typeof storage.getItem !== "function" ||
		typeof storage.setItem !== "function" ||
		typeof storage.removeItem !== "function"
	) {
		return null;
	}
	return storage;
}

function dashboardPath(role?: UserRole) {
	return role === "admin" ? "/admin/dashboard" : "/user/dashboard";
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	const [hydrated, setHydrated] = useState(false);
	const [token, setToken] = useState<string | null>(null);
	const [user, setUser] = useState<AppUser | null>(null);

	useEffect(() => {
		const storage = getBrowserStorage();
		const savedToken = storage?.getItem("token") || null;
		const savedUser = storage?.getItem("user") || null;
		setToken(savedToken);
		try {
			setUser(savedUser ? (JSON.parse(savedUser) as AppUser) : null);
		} catch {
			storage?.removeItem("user");
			setUser(null);
		}
		setHydrated(true);
	}, []);

	const login = (nextToken: string, nextUser: AppUser) => {
		const storage = getBrowserStorage();
		storage?.setItem("token", nextToken);
		storage?.setItem("user", JSON.stringify(nextUser));
		setToken(nextToken);
		setUser(nextUser);
	};

	const logout = () => {
		const storage = getBrowserStorage();
		storage?.removeItem("token");
		storage?.removeItem("user");
		setToken(null);
		setUser(null);
		router.replace("/login");
	};

	const refreshUser = async () => {
		const nextUser = await authApi.me();
		const storage = getBrowserStorage();
		storage?.setItem("user", JSON.stringify(nextUser));
		setUser(nextUser);
	};

	const value = {
		hydrated,
		token,
		user,
		login,
		logout,
		refreshUser,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) throw new Error("useAuth must be used inside AuthProvider");
	return context;
}

function FullPageLoader({ label }: { label: string }) {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<div className="space-y-4 text-center">
				<div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
				<p className="text-sm text-muted-foreground">{label}</p>
			</div>
		</div>
	);
}

export function GuestOnly({ children }: { children: ReactNode }) {
	const router = useRouter();
	const { hydrated, token, user } = useAuth();

	useEffect(() => {
		if (!hydrated) return;
		if (token && user) {
			router.replace(dashboardPath(user.role));
		}
	}, [hydrated, token, user, router]);

	if (!hydrated || (token && user)) {
		return <FullPageLoader label="Đang kiểm tra phiên đăng nhập..." />;
	}

	return <>{children}</>;
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const router = useRouter();
	const { hydrated, token, user } = useAuth();

	useEffect(() => {
		if (!hydrated) return;
		if (!token || !user) {
			router.replace("/login");
			return;
		}
		if (pathname.startsWith("/admin") && user.role !== "admin") {
			router.replace("/user/dashboard");
			return;
		}
		if (pathname.startsWith("/user") && user.role === "admin") {
			router.replace("/admin/dashboard");
		}
	}, [hydrated, pathname, router, token, user]);

	if (!hydrated || !token || !user) {
		return <FullPageLoader label="Đang tải giao diện..." />;
	}

	if (pathname.startsWith("/admin") && user.role !== "admin") {
		return <FullPageLoader label="Đang chuyển hướng..." />;
	}

	if (pathname.startsWith("/user") && user.role === "admin") {
		return <FullPageLoader label="Đang chuyển hướng..." />;
	}

	return <>{children}</>;
}
