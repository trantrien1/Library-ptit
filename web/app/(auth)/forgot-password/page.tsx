"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, KeyRound, Mail } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AnimatedBackground, AuthHero } from "@/components/auth/auth-page";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const formSchema = z.object({
	email: z.string().email({
		message: "Please enter a valid email address.",
	}),
});

const accent = "#be123c";
const accentSoft = "rgba(190,18,60,0.16)";
const authInputClassName =
	"auth-input h-12 rounded-2xl border-slate-200/80 bg-white/85 text-slate-950 placeholder:text-slate-400 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-0 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-50 dark:placeholder:text-slate-500";

export default function ForgotPasswordPage() {
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
		},
	});

	function onSubmit(values: z.infer<typeof formSchema>) {
		console.log(values);
		toast.success("Password reset email sent!", {
			description:
				"If an account exists with that email, you will receive a password reset link.",
		});
	}

	return (
		<div className="relative min-h-screen overflow-hidden bg-slate-950 lg:grid lg:grid-cols-[55fr_45fr]">
			<div className="absolute inset-0 hidden lg:block">
				<AnimatedBackground mode="login" />
			</div>
			<div className="relative z-10">
				<AuthHero mode="login" />
			</div>
			<main className="relative z-10 flex min-h-screen items-center justify-center overflow-hidden bg-transparent px-4 py-8 sm:px-6 lg:px-10">
				<div
					className="absolute inset-0 bg-cover bg-center opacity-40 lg:hidden"
					style={{ backgroundImage: "url(/Background.png)" }}
				/>
				<div className="absolute inset-0 bg-white/72 dark:bg-slate-950/82 lg:hidden" />
				<div
					className="absolute right-10 top-16 h-52 w-52 rounded-full blur-3xl transition duration-500"
					style={{ backgroundColor: accentSoft }}
				/>
				<div
					className="absolute bottom-12 left-10 h-64 w-64 rounded-full blur-3xl transition duration-500"
					style={{ backgroundColor: "rgba(244,63,94,0.12)" }}
				/>
				<div className="relative z-10 w-full max-w-xl">
					<div className="auth-panel-enter rounded-[2rem] border border-white/80 bg-white/78 p-5 shadow-[0_28px_90px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/72 dark:shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:p-7">
						<Link
							href="/login"
							className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100"
						>
							<ArrowLeft className="h-4 w-4" />
							Back to sign in
						</Link>
						<div className="mb-6 flex items-start gap-4">
							<div
								className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
								style={{ backgroundColor: accent, boxShadow: `0 16px 36px ${accentSoft}` }}
							>
								<KeyRound className="h-6 w-6" />
							</div>
							<div>
								<h2 className="text-3xl font-semibold tracking-normal text-slate-950 dark:text-slate-50">
									Forgot password
								</h2>
								<p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
									Enter your email and we will send you a link to reset your password.
								</p>
							</div>
						</div>
						<Form {...form}>
							<form onSubmit={form.handleSubmit(onSubmit)} className="auth-form-enter space-y-5">
								<FormField
									control={form.control}
									name="email"
									render={({ field }) => (
										<FormItem>
											<FormLabel className="text-sm font-medium text-slate-700 dark:text-slate-200">
												Email
											</FormLabel>
											<FormControl>
												<div className="relative">
													<Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
													<Input
														placeholder="m@example.com"
														className={cn(authInputClassName, "pl-10")}
														style={{ "--tw-ring-color": accent } as React.CSSProperties}
														{...field}
													/>
												</div>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<Button
									type="submit"
									className="h-12 w-full rounded-2xl text-base font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
									style={{ backgroundColor: accent, boxShadow: `0 18px 40px ${accentSoft}` }}
								>
									Send reset link
									<ArrowRight className="ml-2 h-4 w-4" />
								</Button>
							</form>
						</Form>
						<div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
							Remember your password?{" "}
							<Link href="/login" className="font-semibold hover:underline" style={{ color: accent }}>
								Sign in
							</Link>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
