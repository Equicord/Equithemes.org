"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useWebContext } from "@context/auth";
import { Button } from "@components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@components/ui/card";
import {
	Loader2,
	Search,
	Bell,
} from "lucide-react";
import {
	PendingActions as PendingIcon,
	People as UsersIcon,
	Code as FileCodeIcon,
	Download as DownloadIcon,
	Schedule as ClockIcon,
	Storage as DatabaseIcon
} from "@mui/icons-material";
import { getCookie } from "@utils/cookies";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@components/ui/dialog";
import { Input } from "@components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar";
import { Badge } from "@components/ui/badge";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { toast } from "@hooks/use-toast";

interface InternalStats {
	users: {
		monthly: {
			count: number;
			timeframe: string;
		};
		total: number;
	};
	themes: {
		total: number;
		totalDownloads: number;
		pendingSubmissions: number;
		topAuthor: {
			discord_snowflake: string;
			themeCount: number;
		};
		mostLiked: string;
	};
	dbst: {
		collections: number;
		objects: number;
		dataSize: number;
		storageSize: number;
		indexes: number;
		size: number;
	};
	sst: {
		cn: any;
		nw: any;
		op: any;
		up: number;
	};
}

interface Theme {
	_id: string;
	title: string;
	description: string;
	file: string;
	fileUrl: string;
	contributors: string[];
	sourceLink: string;
	validatedUsers: {
		[key: string]: {
			id: string;
			username: string;
			avatar: string;
		};
	};
	state: "pending" | "approved" | "rejected";
	themeContent: string;
	submittedAt: Date;
	submittedBy: string;
}

export default function AdminDashboard() {
	const router = useRouter();
	const { isAuthenticated, authorizedUser, isLoading } = useWebContext();
	const [stats, setStats] = useState<InternalStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [submissions, setSubmissions] = useState([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState(null);
	const [isSearching, setIsSearching] = useState(false);
	const [searchError, setSearchError] = useState(null);
	const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);
	const [announcementTitle, setAnnouncementTitle] = useState("");
	const [announcementMessage, setAnnouncementMessage] = useState("");
	const [isSubmittingAnnouncement, setIsSubmittingAnnouncement] = useState(false);
	const [isSyncingThemes, setIsSyncingThemes] = useState(false);
	const [syncResult, setSyncResult] = useState<any>(null);

	useEffect(() => {
		if (!isLoading && (!isAuthenticated || !authorizedUser?.admin)) {
			router.push("/");
			return;
		}

		const fetchStats = async () => {
			try {
				const token = getCookie("_dtoken");
				if (!token) {
					router.push("/");
					return;
				}

				const response = await fetch("/api/internal", {
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`
					}
				});

				if (response.ok) {
					const data = await response.json();
					setStats(data);
				} else {
					router.push("/");
				}
			} catch (error) {
				console.error("Error fetching admin data:", error);
				router.push("/");
			} finally {
				setLoading(false);
			}
		};

		fetchStats();
	}, [isAuthenticated, authorizedUser, isLoading, router]);

	if (isLoading || loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin" />
			</div>
		);
	}

	if (!isAuthenticated || !authorizedUser?.admin) {
		return null;
	}

	const handleUserSearch = async () => {
		if (!searchQuery.trim()) return;

		setIsSearching(true);
		setSearchError(null);

		try {
			const token = getCookie("_dtoken");
			const response = await fetch(
				`/api/users?userString=${encodeURIComponent(searchQuery)}`,
				{
					headers: {
						Authorization: `Bearer ${token}`
					}
				}
			);

			if (!response.ok) {
				throw new Error(response.statusText);
			}

			const data = await response.json();
			setSearchResults(data);
		} catch (error) {
			setSearchError(error.message);
			setSearchResults(null);
		} finally {
			setIsSearching(false);
		}
	};

	const handleSendAnnouncement = async () => {
		if (!announcementTitle.trim() || !announcementMessage.trim()) {
			toast({
				title: "Error",
				description: "Please fill in both title and message",
				variant: "destructive"
			});
			return;
		}

		setIsSubmittingAnnouncement(true);
		try {
			const token = getCookie("_dtoken");
			const response = await fetch("/api/admin/announcement", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					title: announcementTitle,
					message: announcementMessage
				})
			});

			if (!response.ok) {
				throw new Error(response.statusText);
			}

			toast({
				title: "Success",
				description: "Announcement sent to all users",
				variant: "default"
			});

			setAnnouncementTitle("");
			setAnnouncementMessage("");
			setAnnouncementDialogOpen(false);
		} catch (error) {
			toast({
				title: "Error",
				description: error.message || "Failed to send announcement",
				variant: "destructive"
			});
		} finally {
			setIsSubmittingAnnouncement(false);
		}
	};

	const handleSyncThemes = async () => {
		setIsSyncingThemes(true);
		setSyncResult(null);
		try {
			const token = getCookie("_dtoken");
			const response = await fetch("/api/admin/sync-themes", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`
				}
			});

			if (!response.ok) {
				throw new Error(response.statusText);
			}

			const data = await response.json();
			setSyncResult(data);
			toast({
				title: "Success",
				description: `Synced ${data.approved?.total || 0} approved themes and updated ${data.submissions?.updated || 0} submissions`,
				variant: "default"
			});
		} catch (error) {
			toast({
				title: "Error",
				description: error.message || "Failed to sync themes",
				variant: "destructive"
			});
		} finally {
			setIsSyncingThemes(false);
		}
	};

	const formatBytes = (bytes: number) => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
	};

	return (
		<div className="container mx-auto p-4 md:p-8 max-w-7xl">
			<div className="flex justify-between items-center mb-8">
				<div>
					<h1 className="text-4xl font-bold text-primary mb-2">
						Admin Dashboard
					</h1>
					<p className="text-muted-foreground">Site statistics and management</p>
				</div>
			</div>


			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

				<Card className="border-border/40">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Pending Submissions
						</CardTitle>
						<PendingIcon className="h-5 w-5 text-muted-foreground" />
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="text-3xl font-bold">
							{stats?.themes.pendingSubmissions ?? "0"}
						</div>
						<Button
							size="sm"
							variant="outline"
							className="w-full mt-4 text-xs h-9"
							onClick={() => router.push("/theme/submitted")}
						>
							View All
						</Button>
					</CardContent>
				</Card>


				<Card className="border-border/40">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Total Users
						</CardTitle>
						<UsersIcon className="h-5 w-5 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">
							{stats?.users.total.toLocaleString()}
						</div>
						<p className="text-xs text-muted-foreground mt-2">
							<span className="text-green-500 font-medium">
								+{stats?.users.monthly.count.toLocaleString()}
							</span>{" "}
							this month
						</p>
					</CardContent>
				</Card>


				<Card className="border-border/40">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Total Themes
						</CardTitle>
						<FileCodeIcon className="h-5 w-5 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">
							{stats?.themes.total}
						</div>
						<p className="text-xs text-muted-foreground mt-2">
							Top author: <span className="font-medium">{stats?.themes.topAuthor.themeCount}</span> themes
						</p>
					</CardContent>
				</Card>


				<Card className="border-border/40">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Total Downloads
						</CardTitle>
						<DownloadIcon className="h-5 w-5 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">
							{stats?.themes.totalDownloads.toLocaleString()}
						</div>
					</CardContent>
				</Card>
			</div>


			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

				<Card className="border-border/40">
					<CardHeader className="flex flex-row items-center justify-between space-y-0">
						<CardTitle className="text-sm font-medium">
							Server Uptime
						</CardTitle>
						<ClockIcon className="h-5 w-5 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">
							{Math.floor(stats?.sst.up / 86400)} days
						</div>
					</CardContent>
				</Card>


				<Card className="border-border/40">
					<CardHeader className="flex flex-row items-center justify-between space-y-0">
						<CardTitle className="text-sm font-medium">
							User Management
						</CardTitle>
						<UsersIcon className="h-5 w-5 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<Dialog>
							<DialogTrigger asChild>
								<Button variant="outline" className="w-full">
									<Search className="h-4 w-4 mr-2" />
									Search Users
								</Button>
							</DialogTrigger>

							<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
								<DialogHeader>
									<DialogTitle>Search Users</DialogTitle>
								</DialogHeader>

								<div className="flex flex-col sm:flex-row gap-2">
									<Input
										placeholder="Search by ID or username..."
										value={searchQuery}
										onChange={e =>
											setSearchQuery(e.target.value)
										}
										onKeyDown={e =>
											e.key === "Enter" &&
											handleUserSearch()
										}
										className="flex-1"
									/>
									<Button
										onClick={handleUserSearch}
										disabled={isSearching}
										size="sm"
									>
										{isSearching ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Search className="h-4 w-4" />
										)}
									</Button>
								</div>

								{isSearching && (
									<div className="flex justify-center py-8">
										<Loader2 className="h-8 w-8 animate-spin" />
									</div>
								)}

								{searchError && (
									<div className="text-destructive p-4 rounded-lg bg-destructive/10 border border-destructive/20">
										Error: {searchError}
									</div>
								)}

								{searchResults && (
									<div className="mt-6 space-y-6">

										<div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border border-border/40">
											<Avatar className="h-16 w-16">
												<AvatarImage
													src={
														searchResults.discord
															?.avatar
															? `https://cdn.discordapp.com/avatars/${searchResults.discord.id}/${searchResults.discord.avatar}.png`
															: undefined
													}
												/>
												<AvatarFallback>
													{searchResults.discord?.username?.charAt(
														0
													) || "U"}
												</AvatarFallback>
											</Avatar>
											<div className="space-y-1">
												<h3 className="text-lg font-semibold">
													{searchResults.discord
														?.global_name ||
														searchResults.discord
															?.username}
													{searchResults.discord
														?.discriminator &&
														searchResults.discord
															.discriminator !==
														"0" && (
															<span className="text-muted-foreground text-sm">
																#{
																	searchResults
																		.discord
																		.discriminator
																}
															</span>
														)}
												</h3>
												<p className="text-sm text-muted-foreground">
													{searchResults.discord?.id}
												</p>
											</div>
										</div>


										<div className="space-y-3 grid grid-cols-2 gap-3">
											<div>
												<Label htmlFor="userId">
													User ID
												</Label>
												<Input
													id="userId"
													value={
														searchResults.discord
															?.id || ""
													}
													disabled
													className="mt-1"
												/>
											</div>

											<div>
												<Label htmlFor="username">
													Username
												</Label>
												<Input
													id="username"
													value={
														searchResults.discord
															?.username || ""
													}
													disabled
													className="mt-1"
												/>
											</div>

											<div>
												<Label htmlFor="displayName">
													Display Name
												</Label>
												<Input
													id="displayName"
													value={
														searchResults.discord
															?.global_name ||
														"None"
													}
													disabled
													className="mt-1"
												/>
											</div>

											{searchResults.user && (
												<>
													<div>
														<Label htmlFor="createdAt">
															Account Created
														</Label>
														<Input
															id="createdAt"
															value={
																searchResults.discord
																	? new Date(
																		searchResults
																			.discord
																			.id /
																		4194304 +
																		1420070400000
																	).toLocaleDateString()
																	: "Unknown"
															}
															disabled
															className="mt-1"
														/>
													</div>

													<div>
														<Label htmlFor="registeredAt">
															Registered On Site
														</Label>
														<Input
															id="registeredAt"
															value={new Date(
																searchResults.user.createdAt
															).toLocaleDateString()}
															disabled
															className="mt-1"
														/>
													</div>

													<div>
														<Label htmlFor="adminStatus">
															Admin
														</Label>
														<Input
															id="adminStatus"
															value={
																searchResults
																	.user
																	.user
																	.admin
																	? "Yes"
																	: "No"
															}
															disabled
															className="mt-1"
														/>
													</div>

													<div>
														<Label htmlFor="themeCount">
															Themes
														</Label>
														<Input
															id="themeCount"
															value={
																searchResults
																	.user
																	.user
																	.themes
																	?.length ||
																0
															}
															disabled
															className="mt-1"
														/>
													</div>

													{searchResults.user.user
														.githubAccount && (
															<div className="col-span-2">
																<Label htmlFor="githubAccount">
																	GitHub Account
																</Label>
																<Input
																	id="githubAccount"
																	value={
																		searchResults
																			.user
																			.user
																			.githubAccount
																	}
																	disabled
																	className="mt-1"
																/>
															</div>
														)}
												</>
											)}
										</div>
									</div>
								)}
							</DialogContent>
						</Dialog>
					</CardContent>
				</Card>
			</div>


			<div className="mt-8">
				<Card className="border-border/40">
					<CardHeader>
						<div className="flex items-center gap-2">
							<Bell className="h-5 w-5 text-muted-foreground" />
							<div>
								<CardTitle>Send Announcement</CardTitle>
								<CardDescription>
									Send a notification to all users
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<Dialog open={announcementDialogOpen} onOpenChange={setAnnouncementDialogOpen}>
							<DialogTrigger asChild>
								<Button className="w-full">
									<Bell className="h-4 w-4 mr-2" />
									New Announcement
								</Button>
							</DialogTrigger>
							<DialogContent className="max-w-md">
								<DialogHeader>
									<DialogTitle>Send Announcement</DialogTitle>
								</DialogHeader>
								<div className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="announcementTitle">
											Title
										</Label>
										<Input
											id="announcementTitle"
											placeholder="Announcement title..."
											value={announcementTitle}
											onChange={(e) =>
												setAnnouncementTitle(
													e.target.value
												)
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="announcementMessage">
											Message
										</Label>
										<Textarea
											id="announcementMessage"
											placeholder="Announcement message..."
											value={announcementMessage}
											onChange={(e) =>
												setAnnouncementMessage(
													e.target.value
												)
											}
											rows={5}
										/>
									</div>
									<Button
										onClick={handleSendAnnouncement}
										disabled={isSubmittingAnnouncement}
										className="w-full"
									>
										{isSubmittingAnnouncement ? (
											<>
												<Loader2 className="h-4 w-4 mr-2 animate-spin" />
												Sending...
											</>
										) : (
											<>
												<Bell className="h-4 w-4 mr-2" />
												Send Announcement
											</>
										)}
									</Button>
								</div>
							</DialogContent>
						</Dialog>
					</CardContent>
				</Card>
			</div>

			<div className="mt-8">
				<Card className="border-border/40">
					<CardHeader>
						<div className="flex items-center gap-2">
							<DatabaseIcon className="h-5 w-5 text-muted-foreground" />
							<div>
								<CardTitle>Sync Database</CardTitle>
								<CardDescription>
									Sync theme titles and trunicate them
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<Button
							onClick={handleSyncThemes}
							disabled={isSyncingThemes}
							className="w-full"
						>
							{isSyncingThemes ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Syncing...
								</>
							) : (
								<>
									<DatabaseIcon className="h-4 w-4 mr-2" />
									Sync Themes Now
								</>
							)}
						</Button>

						{syncResult && (
							<div className="text-sm space-y-2 p-3 bg-muted rounded-lg">
								<div className="font-medium">Sync Results:</div>
								<div>Approved Themes: <span className="font-semibold">{syncResult.approved?.updated}</span> updated, <span className="font-semibold">{syncResult.approved?.total}</span> total</div>
								<div>Submissions: <span className="font-semibold">{syncResult.submissions?.updated}</span> updated, <span className="font-semibold">{syncResult.submissions?.total}</span> total</div>
								<div className="text-xs text-muted-foreground mt-2">{syncResult.submissions?.description}</div>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<div className="mt-8">
				<Card className="border-border/40">
					<CardHeader>
						<div className="flex items-center gap-2">
							<DatabaseIcon className="h-5 w-5 text-muted-foreground" />
							<div>
								<CardTitle>Database Statistics</CardTitle>
								<CardDescription>
									Current database metrics and usage
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							{[
								{
									title: "Collections",
									value: stats?.dbst.collections
								},
								{
									title: "Objects",
									value: stats?.dbst.objects.toLocaleString()
								},
								{
									title: "Data Size",
									value: formatBytes(stats?.dbst.dataSize)
								},
								{
									title: "Storage Size",
									value: formatBytes(stats?.dbst.storageSize)
								}
							].map((item, index) => (
								<div key={index} className="p-4 rounded-lg border border-border/40 bg-muted/20">
									<h3 className="text-sm font-medium text-muted-foreground">
										{item.title}
									</h3>
									<p className="text-2xl font-bold mt-2">
										{item.value}
									</p>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
