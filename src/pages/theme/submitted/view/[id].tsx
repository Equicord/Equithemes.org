"use client";

import { useEffect, useState } from "react";
import { useWebContext } from "@context/auth";
import { getCookie } from "@utils/cookies";
import { Check as CheckIcon, OpenInNew } from "@mui/icons-material";
import CloseIcon from "@mui/icons-material/Close";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { useRouter } from "next/router";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@components/ui/input";
import { Alert } from "@components/ui/alert";
import { toast } from "@hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@lib/utils";
import clientPromise from "@utils/db";
import { ObjectId } from "mongodb";
import { getUser } from "@utils/auth";

interface Theme {
    _id: string;
    title: string;
    description: string;
    file: string;
    fileUrl: string;
    contributors: string[];
    sourceLink: string;
    validatedUsers: {
        id: string;
        username: string;
        avatar: string;
    };
    state: "approved" | "rejected" | "pending";
    themeContent: string;
    submittedAt: Date;
    submittedBy: string;
}

export async function getServerSideProps({ params, req }) {
    if (!params?.id) {
        return { notFound: true };
    }

    const client = await clientPromise;
    const db = client.db("submittedThemesDatabase");

    const cookieHeader = req.headers.cookie || "";
    const getCookieServer = (name: string) => {
        const value = "; " + cookieHeader;
        const parts = value.split("; " + name + "=");
        if (parts.length === 2) return parts.pop()?.split(";").shift();
        return undefined;
    };

    const token = getCookieServer("_dtoken");
    const user = await getUser(token || "");

    try {
        const theme = await db.collection("pending").findOne({ _id: new ObjectId(params.id) });
        if (!theme) return { notFound: true };

        const isAdmin = user?.admin || false;
        const isOwner = user?.username === theme.user;

        if (!isAdmin && !isOwner) {
            return {
                redirect: {
                    destination: "/",
                    permanent: false,
                },
            };
        }

        return {
            props: {
                id: params.id,
                initialTheme: JSON.parse(JSON.stringify(theme)),
            },
        };
    } catch (err) {
        console.error("Error in getServerSideProps:", err);
        return { notFound: true };
    }
}

export default function ThemeList({ id, initialTheme }: { id: string; initialTheme: Theme }) {
    const { authorizedUser, isAuthenticated, isLoading } = useWebContext();
    const router = useRouter();
    const [theme, setTheme] = useState<Theme>(initialTheme);
    const [loading, setLoading] = useState(!initialTheme);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState("");
    const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
    const [rejectionReason, setRejectionReason] = useState("");
    const [banUser, setBanUser] = useState(false);
    const [banReason, setBanReason] = useState("");

    const handleAddTag = () => {
        if (newTag && selectedTags.length < 5 && !selectedTags.includes(newTag)) {
            setSelectedTags([...selectedTags, newTag]);
            setNewTag("");
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setSelectedTags(selectedTags.filter((tag) => tag !== tagToRemove));
    };

    const handleApprove = async () => {
        if (!id) return;

        try {
            const response = await fetch(`/api/submit/approve?id=${id}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${getCookie("_dtoken")}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ tags: selectedTags })
            });

            if (!response.ok) {
                return toast({
                    title: "Error",
                    description: "Failed to approve theme, backend failed to respond"
                });
            }

            toast({
                title: "Approved",
                description: `Approved the theme '${theme.title}'! You may need to wait a few minutes for the changes to take effect.`
            });

            router.push("/theme/submitted");
        } catch (err) {
            toast({
                title: "Error",
                description: `Failed to approve theme with reason: ${err.message}`
            });
        }
    };

    const handleReject = async () => {
        if (!id) return;

        try {
            const response = await fetch(`/api/submit/reject?id=${id}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${getCookie("_dtoken")}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    reason: rejectionReason || "No reason provided",
                    banUser,
                    banReason: banReason || "Policy violation"
                })
            });

            if (!response.ok) {
                throw new Error("Failed to reject theme");
            }

            router.push("/theme/submitted");

            toast({
                title: "Rejected",
                description: `Rejected the theme '${theme.title}'!${banUser ? " User has been banned from submissions." : ""}`
            });
        } catch (err) {
            toast({
                title: "Error",
                description: `Failed to reject theme with reason: ${err.message}`
            });
        }
    };

    const analyzeThemeContent = (content: string): string[] => {
        const tags: string[] = [];
        const decodedContent = Buffer.from(content, "base64").toString();

        if (decodedContent.includes("import") || decodedContent.length > 500) {
            tags.push("theme");
        } else {
            tags.push("snippet");
        }

        return tags;
    };

    const analyzeImage = async (imageUrl: string) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";

        return new Promise<string[]>((resolve) => {
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                canvas.width = 100;
                canvas.height = 100;
                ctx?.drawImage(img, 0, 0, 100, 100);

                const imageData = ctx?.getImageData(0, 0, 100, 100);
                if (!imageData) return resolve([]);

                let brightness = 0;
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    brightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
                }
                brightness = brightness / (data.length / 4);

                resolve([brightness < 128 ? "dark" : "light"]);
            };
            img.onerror = () => resolve([]);
            img.src = imageUrl;
        });
    };

    const handleSuggestedTagClick = (tag: string) => {
        if (!selectedTags.includes(tag) && selectedTags.length < 5) {
            setSelectedTags([...selectedTags, tag]);
        }
    };

    useEffect(() => {
        if (!id) {
            router.replace("/theme/submitted");
        }
    }, [id]);


    useEffect(() => {
        if (theme?.file && theme?.themeContent) {
            const analyzeTags = async () => {
                const contentTags = analyzeThemeContent(theme.themeContent);
                const imageTags = await analyzeImage(theme.file);
                setSuggestedTags([...new Set([...contentTags, ...imageTags])]);
            };
            analyzeTags();
        }
    }, [theme]);

    useEffect(() => {
        if (!isLoading && (!isAuthenticated || !authorizedUser?.admin)) {
            window.location.href = "/";
        }
    }, [isAuthenticated, authorizedUser, isLoading]);

    useEffect(() => {
        if (!id || !isAuthenticated || theme) return;

        const fetchThemes = async () => {
            try {
                const response = await fetch(`/api/get/submissions?id=${id}`, {
                    headers: {
                        Authorization: `Bearer ${getCookie("_dtoken")}`
                    }
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch theme");
                }

                const data = await response.json();
                setTheme(data);
            } catch (err) {
                console.error(err);
                window.location.href = "/theme/submitted";
            } finally {
                setLoading(false);
            }
        };

        fetchThemes();
    }, [isAuthenticated, authorizedUser, isLoading, id, theme]);

    if (isLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-primary"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <div className="container mx-auto px-4 py-12 rounded-lg">
                {isLoading || loading ? (
                    <div className="flex items-center justify-center min-h-[60vh]">
                        <div className="flex flex-col items-center gap-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-primary"></div>
                            <p className="text-muted-foreground">Loading theme details...</p>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-6xl mx-auto rounded-lg">
                        <Card className="shadow-lg border-0 border-muted rounded-lg">
                            <CardHeader className="border-b border-muted backdrop-blur">
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <CardTitle className="text-3xl font-bold">{theme?.title}</CardTitle>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <span>Submitted {theme?.submittedAt && formatDistanceToNow(new Date(theme.submittedAt))} ago</span>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className={cn("text-sm px-3 py-1", theme?.state === "approved" && "bg-green-500/10 text-green-600 border-green-500/20", theme?.state === "rejected" && "bg-red-500/10 text-red-600 border-red-500/20", theme?.state === "pending" && "bg-yellow-500/10 text-yellow-600 border-yellow-500/20")}>
                                            {theme?.state === "approved" ? "Approved" : theme?.state === "rejected" ? "Rejected" : "Pending Review"}
                                        </Badge>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="p-6">
                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                                    <div className="lg:col-span-3 space-y-8">
                                        <div className="prose dark:prose-invert max-w-none">
                                            <h3 className="text-xl font-semibold mb-4">Description</h3>
                                            <div className="text-muted-foreground">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {theme?.description}
                                                </ReactMarkdown>
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-xl font-semibold mb-4">Theme Preview</h3>
                                            {theme?.file ? (
                                                <img src={theme.fileUrl} alt={theme.title} className="rounded-lg border border-muted shadow-sm w-full hover:shadow-md transition-shadow" />
                                            ) : (
                                                <div className="rounded-lg border border-muted bg-muted/30 h-48 flex items-center justify-center">
                                                    <p className="text-muted-foreground">No preview available</p>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <h3 className="text-xl font-semibold mb-4">Theme Content</h3>
                                            <div className="rounded-lg border border-muted bg-muted/30 p-4 relative">
                                                <pre className="text-sm overflow-auto max-h-[400px]">
                                                    <code>{Buffer.from(theme?.themeContent || "", "base64").toString()}</code>
                                                </pre>
                                            </div>
                                            <a href={theme?.sourceLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                                                <OpenInNew sx={{ width: 16, height: 16 }} />
                                                View source code
                                            </a>
                                        </div>
                                    </div>
                                    <div className="lg:col-span-2 space-y-6">
                                        <div className="sticky top-16">
                                            <div className="rounded-lg border border-muted p-6 space-y-6">
                                                <div>
                                                    <h3 className="text-xl font-semibold mb-4">Contributors</h3>
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.values(theme?.validatedUsers || {}).map((user: any) => (
                                                            <div key={user.id} className="inline-flex items-center gap-2 bg-muted/30 rounded-full px-3 py-1">
                                                                <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} alt={user.username} className="w-6 h-6 rounded-full" />
                                                                <span className="text-sm">{user.username}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {theme?.state === "pending" && (
                                                    <>
                                                        <div>
                                                            <h3 className="text-xl font-semibold mb-4">Theme Tags</h3>
                                                            <div className="space-y-4">
                                                                {suggestedTags.length > 0 && (
                                                                    <div className="space-y-2">
                                                                        <label className="text-sm font-medium">Suggested Tags</label>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {suggestedTags.map((tag) => (
                                                                                <Badge key={tag} variant="outline" className="cursor-pointer hover:bg-primary/10" onClick={() => handleSuggestedTagClick(tag)}>
                                                                                    {tag}
                                                                                </Badge>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <div className="space-y-2">
                                                                    <label className="text-sm font-medium">Selected Tags ({selectedTags.length}/5)</label>
                                                                    <div className="flex flex-wrap gap-2 min-h-[2rem]">
                                                                        {selectedTags.map((tag) => (
                                                                            <Badge key={tag} variant="secondary">
                                                                                {tag}
                                                                                <button onClick={() => handleRemoveTag(tag)} className="ml-2 hover:text-destructive">
                                                                                    ×
                                                                                </button>
                                                                            </Badge>
                                                                        ))}
                                                                        {selectedTags.length === 0 && <p className="text-sm text-muted-foreground">No tags selected</p>}
                                                                    </div>
                                                                </div>

                                                                <div className="flex gap-2">
                                                                    <Input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add custom tag..." disabled={selectedTags.length >= 5} onKeyPress={(e) => e.key === "Enter" && handleAddTag()} />
                                                                    <Button variant="outline" onClick={handleAddTag} disabled={selectedTags.length >= 5 || !newTag}>
                                                                        Add
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="pt-4 border-t border-muted space-y-4">
                                                            <div className="space-y-4">
                                                                <div>
                                                                    <label htmlFor="reject-reason" className="text-sm font-medium mb-2 block">Rejection Reason</label>
                                                                    <textarea
                                                                        id="reject-reason"
                                                                        value={rejectionReason}
                                                                        onChange={(e) => setRejectionReason(e.target.value)}
                                                                        placeholder="Explain why this theme is being rejected..."
                                                                        className="w-full h-20 p-2 border border-muted rounded-lg bg-muted/30 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                                                                    />
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        id="ban-user"
                                                                        checked={banUser}
                                                                        onChange={(e) => setBanUser(e.target.checked)}
                                                                        className="w-4 h-4 rounded border-muted"
                                                                    />
                                                                    <label htmlFor="ban-user" className="text-sm font-medium cursor-pointer">Ban user from submissions</label>
                                                                </div>

                                                                {banUser && (
                                                                    <div>
                                                                        <label htmlFor="ban-reason" className="text-sm font-medium mb-2 block">Ban Reason <span className="text-xs text-muted-foreground">({banReason.length}/40)</span></label>
                                                                        <input
                                                                            id="ban-reason"
                                                                            type="text"
                                                                            value={banReason}
                                                                            onChange={(e) => setBanReason(e.target.value.slice(0, 40))}
                                                                            maxLength={40}
                                                                            placeholder="e.g., Policy violation, spam..."
                                                                            className="w-full h-9 px-2 border border-muted rounded-lg bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <Button variant="default" className="w-full bg-green-600 hover:bg-green-700" onClick={handleApprove}>
                                                                <CheckIcon sx={{ width: 16, height: 16, marginRight: 1 }} />
                                                                Approve Theme
                                                            </Button>
                                                            <Button variant="destructive" className="w-full" onClick={handleReject}>
                                                                <CloseIcon sx={{ width: 16, height: 16, marginRight: 1 }} />
                                                                Reject Theme
                                                            </Button>
                                                        </div>
                                                    </>
                                                )}

                                                {theme?.state !== "pending" && (
                                                    <Alert variant={theme.state === "approved" ? "default" : "destructive"}>
                                                        <p>
                                                            This theme has been {theme.state} and cannot be modified.
                                                            {theme?.reason && (
                                                                <div>
                                                                    <>Reason: {theme.reason.endsWith('.') ? theme.reason : `${theme.reason}.`}</>
                                                                </div>
                                                            )}
                                                        </p>
                                                    </Alert>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
