"use client";

import {
	ArrowRight,
	BookOpen,
	Bot,
	CheckCircle2,
	Eye,
	EyeOff,
	FlaskConical,
	KeyRound,
	Library,
	LockKeyhole,
	Mail,
	Network,
	Phone,
	ShieldCheck,
	Sparkles,
	UserRound,
	UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register";

const modeConfig = {
	login: {
		accent: "#be123c",
		accentSoft: "rgba(190,18,60,0.16)",
		background: "/Background.png",
		title: "Đăng nhập",
		description: "Truy cập hệ thống thư viện PTIT bằng tài khoản hiện có.",
		button: "Đăng nhập",
		loading: "Đang đăng nhập...",
		tabClass: "bg-rose-600 text-white shadow-rose-500/30",
		gradient: "from-rose-600 via-red-500 to-pink-500",
	},
	register: {
		accent: "#0284c7",
		accentSoft: "rgba(2,132,199,0.16)",
		background: "/Background2.png",
		title: "Đăng ký tài khoản",
		description: "Tạo tài khoản mới để bắt đầu sử dụng hệ thống thư viện số.",
		button: "Tạo tài khoản",
		loading: "Đang tạo tài khoản...",
		tabClass: "bg-sky-600 text-white shadow-sky-500/30",
		gradient: "from-sky-600 via-cyan-500 to-blue-500",
	},
} satisfies Record<AuthMode, Record<string, string>>;

function getBrowserStorage() {
	if (typeof window === "undefined") return null;
	const storage = window.localStorage;
	if (!storage || typeof storage.setItem !== "function") return null;
	return storage;
}

function PasswordInput({
	id,
	value,
	onChange,
	placeholder,
	accent,
	required = true,
}: {
	id: string;
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	accent: string;
	required?: boolean;
}) {
	const [visible, setVisible] = useState(false);
	return (
		<div className="relative">
			<KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
			<Input
				id={id}
				type={visible ? "text" : "password"}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				className="h-12 rounded-2xl border-slate-200 bg-white/80 pl-10 pr-11 shadow-sm transition focus-visible:ring-2"
				style={{ "--tw-ring-color": accent } as React.CSSProperties}
				required={required}
				minLength={6}
			/>
			<button
				type="button"
				onClick={() => setVisible((current) => !current)}
				className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
				aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
			>
				{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
			</button>
		</div>
	);
}

function PasswordStrength({ password, accent }: { password: string; accent: string }) {
	const score = useMemo(() => {
		let next = 0;
		if (password.length >= 6) next += 1;
		if (password.length >= 10) next += 1;
		if (/[A-Z]/.test(password)) next += 1;
		if (/[0-9]/.test(password)) next += 1;
		if (/[^A-Za-z0-9]/.test(password)) next += 1;
		return next;
	}, [password]);
	const label = ["Rất yếu", "Yếu", "Trung bình", "Khá", "Mạnh", "Rất mạnh"][score] || "Rất yếu";
	return (
		<div className="space-y-2">
			<div className="flex gap-1.5">
				{Array.from({ length: 5 }).map((_, index) => (
					<div
						key={index}
						className="h-1.5 flex-1 rounded-full bg-slate-200 transition-all duration-300"
						style={{ backgroundColor: index < score ? accent : undefined }}
					/>
				))}
			</div>
			<p className="text-xs text-slate-500">Độ mạnh mật khẩu: {label}</p>
		</div>
	);
}

function AuthInput({
	id,
	label,
	icon: Icon,
	value,
	onChange,
	placeholder,
	type = "text",
	accent,
	required = true,
}: {
	id: string;
	label: string;
	icon: typeof UserRound;
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	type?: string;
	accent: string;
	required?: boolean;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id} className="text-sm font-medium text-slate-700">
				{label}
			</Label>
			<div className="relative">
				<Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
				<Input
					id={id}
					type={type}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					placeholder={placeholder}
					className="h-12 rounded-2xl border-slate-200 bg-white/80 pl-10 shadow-sm transition focus-visible:ring-2"
					style={{ "--tw-ring-color": accent } as React.CSSProperties}
					required={required}
				/>
			</div>
		</div>
	);
}

function AnimatedBackground({ mode }: { mode: AuthMode }) {
	const config = modeConfig[mode];
	return (
		<div className="absolute inset-0 overflow-hidden">
			<div
				className={cn(
					"absolute inset-0 bg-cover bg-center transition-opacity duration-500",
					mode === "login" ? "opacity-100" : "opacity-0",
				)}
				style={{ backgroundImage: "url(/Background.png)" }}
			/>
			<div
				className={cn(
					"absolute inset-0 bg-cover bg-center transition-opacity duration-500",
					mode === "register" ? "opacity-100" : "opacity-0",
				)}
				style={{ backgroundImage: "url(/Background2.png)" }}
			/>
			<div
				className={cn(
					"absolute inset-0 transition-opacity duration-500",
					mode === "login"
						? "bg-gradient-to-r from-red-950/38 via-red-700/20 to-slate-950/10"
						: "bg-gradient-to-r from-cyan-950/30 via-sky-700/14 to-slate-950/8",
				)}
			/>
			<div className="absolute inset-0 bg-gradient-to-t from-slate-950/18 via-transparent to-white/5" />
			<div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:52px_52px] opacity-20" />
			<div
				className="auth-float absolute left-[10%] top-[18%] h-40 w-40 rounded-full blur-3xl transition duration-500"
				style={{ backgroundColor: config.accentSoft }}
			/>
			<div
				className="auth-float-delayed absolute bottom-[12%] right-[12%] h-56 w-56 rounded-full blur-3xl transition duration-500"
				style={{ backgroundColor: mode === "login" ? "rgba(244,63,94,0.28)" : "rgba(34,211,238,0.28)" }}
			/>
		</div>
	);
}

function AuthHero({ mode }: { mode: AuthMode }) {
	const features = [
		{ title: "Tra cứu tài liệu số", icon: BookOpen, text: "Sách, ebook, luận văn và tài nguyên học thuật." },
		{ title: "Chatbot AI học tập", icon: Bot, text: "Hỏi đáp, tóm tắt, quiz và flashcard thông minh." },
		{ title: "Cộng đồng học tập", icon: UsersRound, text: "Thảo luận nhóm, review sách và chia sẻ tài liệu." },
		{ title: "Sự kiện & Lab sáng tạo", icon: FlaskConical, text: "Đăng ký workshop, tutorial và đặt lịch thiết bị." },
	];
	return (
		<section className="relative hidden min-h-screen overflow-hidden lg:flex lg:items-center">
			<AnimatedBackground mode={mode} />
			<div className="relative z-10 max-w-2xl px-12 py-12 text-white xl:px-16">
				<div className="inline-flex items-center gap-3 rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm shadow-lg backdrop-blur-xl">
					<div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-950">
						<Library className="h-4 w-4" />
					</div>
					<span className="font-semibold">Library PTIT</span>
				</div>
				<h1 className="mt-8 max-w-xl text-5xl font-semibold leading-tight tracking-normal">
					Cổng thư viện số thông minh cho sinh viên PTIT
				</h1>
				<p className="mt-5 max-w-xl text-base leading-8 text-white/82">
					Tra cứu tài liệu, mượn sách, sử dụng Chatbot AI, tham gia cộng đồng học tập và đặt lịch Lab trong một không gian duy nhất.
				</p>

				<div className="mt-10 grid gap-4 sm:grid-cols-2">
					{features.map((feature, index) => {
						const Icon = feature.icon;
						return (
							<div
								key={feature.title}
								className={cn(
									"auth-card-float rounded-3xl border border-white/25 bg-white/15 p-4 shadow-2xl backdrop-blur-md transition hover:-translate-y-1 hover:bg-white/20",
									index % 2 === 1 && "translate-y-5",
								)}
								style={{
									animationDelay: `${index * 120}ms`,
									boxShadow: `0 18px 44px ${modeConfig[mode].accentSoft}`,
								}}
							>
								<div className="flex items-start gap-3">
									<div className="rounded-2xl bg-white/18 p-3">
										<Icon className="h-5 w-5" />
									</div>
									<div>
										<p className="font-semibold">{feature.title}</p>
										<p className="mt-1 text-sm leading-6 text-white/72">{feature.text}</p>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>
			<div className="auth-orbit absolute bottom-12 left-16 z-10 hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/80 backdrop-blur-xl xl:flex">
				<Network className="h-4 w-4" />
				AI-powered Digital Library Portal
			</div>
		</section>
	);
}

function AuthTabs({ mode, onModeChange }: { mode: AuthMode; onModeChange: (mode: AuthMode) => void }) {
	const activeClass = modeConfig[mode].tabClass;
	return (
		<div className="relative grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
			<button
				type="button"
				onClick={() => onModeChange("login")}
				className={cn(
					"relative z-10 rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-all duration-300",
					mode === "login" ? activeClass : "text-slate-500 hover:text-slate-900",
				)}
			>
				Đăng nhập
			</button>
			<button
				type="button"
				onClick={() => onModeChange("register")}
				className={cn(
					"relative z-10 rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-all duration-300",
					mode === "register" ? activeClass : "text-slate-500 hover:text-slate-900",
				)}
			>
				Đăng ký
			</button>
		</div>
	);
}

function LoginForm({ accent }: { accent: string }) {
	const router = useRouter();
	const { login } = useAuth();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [remember, setRemember] = useState(true);
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSubmitting(true);
		try {
			const session = await authApi.login(username, password);
			getBrowserStorage()?.setItem("token", session.access_token);
			if (remember) getBrowserStorage()?.setItem("remember_login", "true");
			const user = await authApi.me();
			login(session.access_token, user);
			toast.success("Đăng nhập thành công");
			router.replace(user.role === "admin" ? "/admin/dashboard" : "/user/dashboard");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Đăng nhập thất bại");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="auth-form-enter space-y-5">
			<AuthInput
				id="username"
				label="Tên đăng nhập hoặc email"
				icon={UserRound}
				value={username}
				onChange={setUsername}
				placeholder="Nhập tên đăng nhập hoặc email"
				accent={accent}
			/>
			<div className="space-y-2">
				<Label htmlFor="password" className="text-sm font-medium text-slate-700">Mật khẩu</Label>
				<PasswordInput id="password" value={password} onChange={setPassword} placeholder="Nhập mật khẩu" accent={accent} />
			</div>
			<div className="flex items-center justify-between gap-3 text-sm">
				<label className="flex cursor-pointer items-center gap-2 text-slate-600">
					<input
						type="checkbox"
						checked={remember}
						onChange={(event) => setRemember(event.target.checked)}
						className="h-4 w-4 rounded border-slate-300"
						style={{ accentColor: accent }}
					/>
					Ghi nhớ đăng nhập
				</label>
				<Link href="/forgot-password" className="font-medium hover:underline" style={{ color: accent }}>
					Quên mật khẩu?
				</Link>
			</div>
			<Button
				type="submit"
				disabled={submitting}
				className="h-12 w-full rounded-2xl text-base font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
				style={{ backgroundColor: accent, boxShadow: `0 18px 40px ${modeConfig.login.accentSoft}` }}
			>
				{submitting ? modeConfig.login.loading : modeConfig.login.button}
				<ArrowRight className="ml-2 h-4 w-4" />
			</Button>
		</form>
	);
}

function RegisterForm({ accent }: { accent: string }) {
	const router = useRouter();
	const { login } = useAuth();
	const [accepted, setAccepted] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [form, setForm] = useState({
		username: "",
		email: "",
		full_name: "",
		phone: "",
		password: "",
		confirmPassword: "",
	});

	const setField = (field: keyof typeof form, value: string) => {
		setForm((current) => ({ ...current, [field]: value }));
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (form.password !== form.confirmPassword) {
			toast.error("Mật khẩu xác nhận không khớp");
			return;
		}
		if (!accepted) {
			toast.error("Vui lòng đồng ý điều khoản sử dụng");
			return;
		}
		setSubmitting(true);
		try {
			await authApi.register({
				username: form.username,
				email: form.email,
				password: form.password,
				full_name: form.full_name || null,
				phone: form.phone || null,
			});
			const session = await authApi.login(form.username, form.password);
			getBrowserStorage()?.setItem("token", session.access_token);
			const user = await authApi.me();
			login(session.access_token, user);
			toast.success("Đăng ký thành công");
			router.replace("/user/dashboard");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Đăng ký thất bại");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="auth-form-enter space-y-4">
			<div className="grid gap-4 sm:grid-cols-2">
				<AuthInput id="reg-username" label="Tên đăng nhập" icon={UserRound} value={form.username} onChange={(value) => setField("username", value)} placeholder="vd: nguyenvana" accent={accent} />
				<AuthInput id="reg-email" label="Email" icon={Mail} value={form.email} onChange={(value) => setField("email", value)} placeholder="ban@ptit.edu.vn" type="email" accent={accent} />
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<AuthInput id="full-name" label="Họ và tên" icon={ShieldCheck} value={form.full_name} onChange={(value) => setField("full_name", value)} placeholder="Nguyễn Văn A" accent={accent} required={false} />
				<AuthInput id="phone" label="Số điện thoại" icon={Phone} value={form.phone} onChange={(value) => setField("phone", value)} placeholder="09xxxxxxxx" accent={accent} required={false} />
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="reg-password" className="text-sm font-medium text-slate-700">Mật khẩu</Label>
					<PasswordInput id="reg-password" value={form.password} onChange={(value) => setField("password", value)} placeholder="Ít nhất 6 ký tự" accent={accent} />
				</div>
				<div className="space-y-2">
					<Label htmlFor="confirm-password" className="text-sm font-medium text-slate-700">Xác nhận mật khẩu</Label>
					<div className="relative">
						<LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
						<Input
							id="confirm-password"
							type={showConfirm ? "text" : "password"}
							value={form.confirmPassword}
							onChange={(event) => setField("confirmPassword", event.target.value)}
							placeholder="Nhập lại mật khẩu"
							className="h-12 rounded-2xl border-slate-200 bg-white/80 pl-10 pr-11 shadow-sm transition focus-visible:ring-2"
							style={{ "--tw-ring-color": accent } as React.CSSProperties}
							required
						/>
						<button
							type="button"
							onClick={() => setShowConfirm((current) => !current)}
							className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
						>
							{showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
						</button>
					</div>
				</div>
			</div>
			<PasswordStrength password={form.password} accent={accent} />
			<label className="flex cursor-pointer items-start gap-2 text-sm leading-6 text-slate-600">
				<input
					type="checkbox"
					checked={accepted}
					onChange={(event) => setAccepted(event.target.checked)}
					className="mt-1 h-4 w-4 rounded border-slate-300"
					style={{ accentColor: accent }}
				/>
				Tôi đồng ý với điều khoản sử dụng thư viện số và chính sách bảo vệ dữ liệu học tập.
			</label>
			<Button
				type="submit"
				disabled={submitting}
				className="h-12 w-full rounded-2xl text-base font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
				style={{ backgroundColor: accent, boxShadow: `0 18px 40px ${modeConfig.register.accentSoft}` }}
			>
				{submitting ? modeConfig.register.loading : modeConfig.register.button}
				<ArrowRight className="ml-2 h-4 w-4" />
			</Button>
		</form>
	);
}

export function AuthPage({ mode }: { mode: AuthMode }) {
	const router = useRouter();
	const [activeMode, setActiveMode] = useState<AuthMode>(mode);
	const config = modeConfig[activeMode];

	useEffect(() => {
		setActiveMode(mode);
	}, [mode]);

	const switchMode = (nextMode: AuthMode) => {
		if (nextMode === activeMode) return;
		setActiveMode(nextMode);
		window.setTimeout(() => {
			router.push(nextMode === "login" ? "/login" : "/register");
		}, 160);
	};

	return (
		<div className="min-h-screen overflow-hidden bg-slate-950 lg:grid lg:grid-cols-[55fr_45fr]">
			<AuthHero mode={activeMode} />
			<main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
				<div
					className={cn(
						"absolute inset-0 bg-cover bg-center transition-opacity duration-500 lg:hidden",
						activeMode === "login" ? "opacity-40" : "opacity-0",
					)}
					style={{ backgroundImage: "url(/Background.png)" }}
				/>
				<div
					className={cn(
						"absolute inset-0 bg-cover bg-center transition-opacity duration-500 lg:hidden",
						activeMode === "register" ? "opacity-40" : "opacity-0",
					)}
					style={{ backgroundImage: "url(/Background2.png)" }}
				/>
				<div className="absolute inset-0 bg-white/72 lg:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.92),transparent_32%),linear-gradient(135deg,rgba(248,250,252,0.96),rgba(255,255,255,0.82))]" />
				<div
					className="absolute right-10 top-16 h-52 w-52 rounded-full blur-3xl transition duration-500"
					style={{ backgroundColor: config.accentSoft }}
				/>
				<div
					className="absolute bottom-12 left-10 h-64 w-64 rounded-full blur-3xl transition duration-500"
					style={{ backgroundColor: activeMode === "login" ? "rgba(244,63,94,0.12)" : "rgba(14,165,233,0.13)" }}
				/>
				<div className="relative z-10 w-full max-w-xl">
					<div className="auth-panel-enter rounded-[2rem] border border-white/80 bg-white/78 p-5 shadow-[0_28px_90px_rgba(15,23,42,0.18)] backdrop-blur-2xl sm:p-7">
						<div className="mb-6">
							<AuthTabs mode={activeMode} onModeChange={switchMode} />
						</div>
						<div className="mb-6 flex items-start gap-4">
							<div
								className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg transition duration-500"
								style={{ backgroundColor: config.accent, boxShadow: `0 16px 36px ${config.accentSoft}` }}
							>
								{activeMode === "login" ? <KeyRound className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
							</div>
							<div>
								<h2 className="text-3xl font-semibold tracking-normal text-slate-950">{config.title}</h2>
								<p className="mt-2 text-sm leading-6 text-slate-500">{config.description}</p>
							</div>
						</div>
						{activeMode === "login" ? <LoginForm accent={config.accent} /> : <RegisterForm accent={config.accent} />}
						<div className="mt-6 text-center text-sm text-slate-500">
							{activeMode === "login" ? (
								<>
									Chưa có tài khoản?{" "}
									<button type="button" onClick={() => switchMode("register")} className="font-semibold hover:underline" style={{ color: config.accent }}>
										Đăng ký ngay
									</button>
								</>
							) : (
								<>
									Đã có tài khoản?{" "}
									<button type="button" onClick={() => switchMode("login")} className="font-semibold hover:underline" style={{ color: config.accent }}>
										Đăng nhập
									</button>
								</>
							)}
						</div>
					</div>
					<div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
						<CheckCircle2 className="h-4 w-4" />
						Bảo mật phiên đăng nhập và đồng bộ với Library PTIT API
					</div>
				</div>
			</main>
		</div>
	);
}
