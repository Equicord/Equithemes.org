/* eslint-disable no-constant-binary-expression */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/rules-of-hooks */
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@components/ui/button";
import { MouseEvent, useEffect, useState } from "react";
import Head from "next/head";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from "next/image";
import { useWebContext } from "@context/auth";
import { Card, CardContent } from "@components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@components/ui/tooltip";
import { useToast } from "@hooks/use-toast";
import { getCookie } from "@utils/cookies";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { EditThemeModal } from "@components/theme/edit-modal";
import { ConfirmDialog } from "@components/ui/confirm-modal";
import { type Theme } from "@types";
import { Download as DownloadIcon, Favorite as HeartIcon, FavoriteBorder as HeartOutlineIcon, CalendarMonth as CalendarIcon, BookOutlined as BookIcon, Code as CodeIcon, ContentCopy as CopyIcon, Done as CheckIcon, GitHub as GithubIcon, RemoveRedEye as EyeIcon, OpenInNew as ExternalLinkIcon, Edit as EditIcon, Delete as DeleteIcon } from "@mui/icons-material";

const Skeleton = ({ className = "", ...props }) => <div className={`animate-pulse bg-muted/30 rounded ${className}`} {...props} />;

export default function Component({ id, theme }: { id?: string; theme: Theme }) {
    const [isDownloaded, setIsDownloaded] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [likedThemes, setLikedThemes] = useState();
    const [isLikeDisabled, setIsLikeDisabled] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const { authorizedUser, isAuthenticated, isLoading, mutateThemes } = useWebContext();
    const { toast } = useToast();
    const [isCopied, setIsCopied] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const router = useRouter();
    const previewUrl = `/api/preview?url=/api/${id}`;

    useEffect(() => {
        setIsMobile(window.innerWidth <= 768);

        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            getLikedThemes();
        }
    }, [isAuthenticated]);

    if (!id) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Skeleton className="w-32 h-8" />
            </div>
        );
    }

    const handleAuthorClick = (author) => {
        router.push(`/users/${author.discord_snowflake}`);
    };

    const handleGithubClick = (githubName) => {
        window.open(`https://github.com/${githubName}`, "_blank");
    };

    const handleEdit = async (updatedTheme) => {
        try {
            const response = await fetch(`/api/themes/${theme.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${getCookie("_dtoken")}`
                },
                body: JSON.stringify(updatedTheme)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Failed to update theme");
            }

            toast({
                title: "Success",
                description: "Theme updated successfully"
            });
            
            
            if (mutateThemes) {
                await mutateThemes();
            }
            
            
            window.location.reload();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to update theme",
                variant: "destructive"
            });
        }
    };

    const handleDelete = async () => {
        try {
            const response = await fetch(`/api/themes/${theme.id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${getCookie("_dtoken")}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Failed to delete theme");
            }

            toast({
                title: "Success",
                description: "Theme deleted successfully"
            });
            window.location.href = "/";
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to delete theme",
                variant: "destructive"
            });
        }
    };

    const renderAuthor = (author) => {
        if (isLoading) {
            return (
                <div key={author.discord_snowflake} className="p-2 rounded-lg border bg-background border-input">
                    <Skeleton className="h-4 w-1/2 mb-2" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/4 mt-2" />
                </div>
            );
        }

        return (
            <div key={author.discord_snowflake} className="p-4 rounded-2xl border bg-card/50 border-border/40 hover:border-primary/40 transition-all duration-200">
                <div className="flex flex-col gap-3">
                    <div>
                        <p className="font-semibold text-sm">{author.discord_name}</p>
                        <p className="text-xs text-muted-foreground">ID: {author.discord_snowflake}</p>
                    </div>
                    <div className={`grid gap-2 ${author.github_name ? "grid-cols-1" : ""}`}>
                        <Button variant="outline" size="sm" onClick={() => handleAuthorClick(author)} className="text-xs h-9">
                            <ExternalLinkIcon className="mr-2 h-3.5 w-3.5" />
                            View Profile
                        </Button>
                        {author.github_name && (
                            <Button variant="outline" size="sm" onClick={() => handleGithubClick(author.github_name)} className="text-xs h-9">
                                <GithubIcon className="mr-2 h-3.5 w-3.5" />
                                GitHub
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const handleDownload = async (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setIsDownloaded(true);

        window.location.href = `/api/download/${theme.id}`;

        setTimeout(() => {
            setIsDownloaded(false);
        }, 5000);
    };

    const handleLike = (themeId) => async () => {
        if (!isAuthenticated || isLikeDisabled) return;
        if (!themeId || !likedThemes) return;

        setIsLikeDisabled(true);

        const token = getCookie("_dtoken");
        let response: Response;
        // @ts-ignore
        const isCurrentlyLiked = likedThemes?.likes?.find((t) => t.themeId === themeId)?.hasLiked;

        setLikedThemes((prev) => ({
            // @ts-ignore
            ...prev,
            likes: (prev as any)!.likes.map((like) => (like.themeId === themeId ? { ...like, hasLiked: !isCurrentlyLiked } : like))
        }));

        try {
            if (isCurrentlyLiked) {
                response = await fetch("/api/likes/remove", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ themeId })
                });
            } else {
                response = await fetch("/api/likes/add", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ themeId })
                });
            }

            if (!response.ok) {
                setLikedThemes((prev) => ({
                    // @ts-ignore
                    ...prev,
                    likes: (prev as any)!.likes.map((like) => (like.themeId === themeId ? { ...like, hasLiked: isCurrentlyLiked } : like))
                }));

                toast({
                    description: "Failed to like theme, try again later."
                });
            }
        } catch {
            setLikedThemes((prev) => ({
                // @ts-ignore
                ...prev,
                likes: (prev as any)!.likes.map((like) => (like.themeId === themeId ? { ...like, hasLiked: isCurrentlyLiked } : like))
            }));

            toast({
                description: "Failed to like theme, try again later."
            });
        }

        setTimeout(() => {
            setIsLikeDisabled(false);
        }, 1500);
    };

    async function getLikedThemes() {
        const token = getCookie("_dtoken");

        const response = await fetch("/api/likes/get", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            }
        }).then((res) => res.json());

        setLikedThemes(response);
    }

    const decodeThemeContent = (content: string) => {
        try {
            return atob(content);
        } catch {
            return content;
        }
    };

    const handleCopyCode = (content: string) => {
        navigator.clipboard.writeText(content);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const statsItems = [
        {
            icon: DownloadIcon,
            label: "Downloads",
            value: theme?.downloads || 0
        },
        {
            icon: HeartIcon,
            label: "Likes",
            value: theme?.likes || 0
        },
        {
            icon: CalendarIcon,
            label: "Created",
            value: theme?.release_date ? new Date(theme.release_date).toLocaleDateString() : "Recently"
        },
        {
            icon: BookIcon,
            label: "Version",
            value: theme?.version || "1.0.0"
        }
    ];

    const ThemeStats = () => (
        <div className="grid grid-cols-2 gap-4 mt-6 select-none">
            {statsItems.map(({ icon: Icon, label, value }) => (
                <Card key={label} className="p-4">
                    <CardContent className="p-0 flex flex-col items-center">
                        <Icon className="h-5 w-5 text-muted-foreground mb-2" />
                        <p className="text-xl font-bold">{value}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );

    return (
        <>
            <Head>
                <title>{theme.name} - Discord Theme</title>
                <meta name="description" content={theme.description} />
                <meta name="keywords" content={theme.tags.join(", ")} />
                <meta name="author" content="themes.equicord.org" />

                <meta property="og:type" content="website" />
                <meta property="og:title" content={theme.name} />
                <meta property="og:description" content={theme.description} />
                <meta property="og:image" content={theme.thumbnail_url} />
                <meta property="og:url" content="https://themes.equicord.org" />
                <meta
                    property="og:site_name"
                    content={`${
                        // @ts-ignore
                        theme.author?.discord_name ? `@${theme.author.discord_name}` : theme.author.map((x) => `@${x.discord_name}`).join(", ")
                    } - https://themes.equicord.org`}
                />

                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={theme.name} />
                <meta name="twitter:description" content={theme.description} />
                <meta name="twitter:image" content={theme.thumbnail_url} />
                <meta name="twitter:site" content="themes.equicord.org" />
            </Head>

            <div className="">
                <div className="max-w-6xl mx-auto px-4 py-8">
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
                        <div className="space-y-8 min-w-0">
                            {isLoading ? (
                                <>
                                    <Skeleton className="h-8 w-3/4" />
                                    <Skeleton className="h-32 w-full" />
                                    <Skeleton className="h-64 w-full" />
                                </>
                            ) : (
                                <div>
                                    <div className="mb-8">
                                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-primary">{theme.name}</h1>
                                        <div className="description text-lg text-foreground leading-relaxed">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{theme.description}</ReactMarkdown>
                                        </div>
                                        {theme.tags && theme.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-6">
                                                {theme.tags.map((tag) => (
                                                    <span key={tag} className="px-3 py-1.5 bg-muted/50 text-sm font-medium rounded-full border border-border/30">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <Card className="overflow-hidden border-border/40 mb-4">
                                        <CardContent className="p-0">
                                            <div className="bg-muted/20 rounded-2xl flex justify-center items-center overflow-hidden aspect-video">
                                                <Image draggable={false} src={theme.thumbnail_url} alt={theme.name} width={1920} height={1080} className="object-cover w-full h-full" priority />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-border/40">
                                        <CardContent className="p-6">
                                            <div className="flex justify-between items-center mb-4">
                                                <h2 className="text-xl font-semibold text-primary">Source Code</h2>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => handleCopyCode(decodeThemeContent(theme.content))} 
                                                    className="flex items-center gap-2 hover:text-foreground hover:border-foreground"
                                                >
                                                    {isCopied ? (
                                                        <>
                                                            <CheckIcon className="h-4 w-4" />
                                                            Copied
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CopyIcon className="h-4 w-4" />
                                                            Copy Code
                                                        </>
                                                    )}
                                                </Button>
                                            </div>

                                            <div className="codeblock rounded-2xl border border-border/30 bg-muted/10 p-4 relative overflow-hidden">
                                                <SyntaxHighlighter
                                                    language="css"
                                                    style={vscDarkPlus}
                                                    customStyle={{
                                                        maxHeight: 500,
                                                        borderRadius: "0.75rem",
                                                        fontSize: "0.875rem",
                                                        background: "transparent",
                                                        margin: 0,
                                                        padding: "1rem",
                                                        fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                                                    }}
                                                    codeTagProps={{ style: { fontFamily: "inherit" } }}
                                                    wrapLongLines={true}
                                                >
                                                    {decodeThemeContent(theme.content)}
                                                </SyntaxHighlighter>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </div>

                        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                            <Card className="border-border/40">
                                <CardContent className="p-6">
                                    <div className="space-y-3">
                                        <Button size="lg" disabled={isLoading || isDownloaded} onClick={handleDownload} className="w-full h-12 text-base font-medium">
                                            {isDownloaded ? (
                                                <>
                                                    <CheckIcon className="h-5 w-5 mr-2" />
                                                    Downloaded
                                                </>
                                            ) : (
                                                <>
                                                    <DownloadIcon className="h-5 w-5 mr-2" />
                                                    Download Theme
                                                </>
                                            )}
                                        </Button>

                                        {theme.source && (
                                            <Button disabled={isLoading} variant="outline" className="w-full h-11" onClick={() => window.open(theme.source, "_blank", "noopener,noreferrer")}>
                                                <GithubIcon className="mr-2 h-4 w-4" />
                                                View on GitHub
                                            </Button>
                                        )}

                                        <Button disabled={isLoading || isMobile} variant="outline" className="w-full h-11" onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}>
                                            <EyeIcon className="mr-2 h-4 w-4" />
                                            {isMobile ? "Preview (Desktop Only)" : "Live Preview"}
                                        </Button>

                                        {!isLoading &&
                                            (isAuthenticated ? (
                                                <Button
                                                    variant="outline"
                                                    disabled={!isAuthenticated || isLoading || isLikeDisabled}
                                                    className={`w-full h-11 ${
                                                        // @ts-ignore
                                                        likedThemes?.likes?.find((t) => t.themeId === theme.id)?.hasLiked ? "text-red-500 border-red-200 hover:bg-red-50" : "hover:text-red-500 hover:border-red-200"
                                                    }`}
                                                    onClick={handleLike(theme.id)}
                                                >
                                                    {
                                                        // @ts-ignore
                                                        likedThemes?.likes?.find((t) => t.themeId === theme.id)?.hasLiked ? <HeartIcon className="mr-2 h-4 w-4" /> : <HeartOutlineIcon className="mr-2 h-4 w-4" />
                                                    }
                                                    {
                                                        // @ts-ignore
                                                        likedThemes?.likes?.find((t) => t.themeId === theme.id)?.hasLiked ? "Liked" : "Like Theme"
                                                    }
                                                </Button>
                                            ) : (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger className="w-full">
                                                            <Button variant="outline" disabled={!isAuthenticated} className="w-full h-11">
                                                                <HeartOutlineIcon className="mr-2 h-4 w-4" /> Like Theme
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Log in to like themes</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {!isLoading &&
                                isAuthenticated &&
                                (authorizedUser?.id ===
                                    // @ts-ignore
                                    theme?.author?.discord_snowflake ||
                                    authorizedUser?.is_admin) && (
                                    <Card className="border-destructive/20">
                                        <CardContent className="p-6">
                                            <h3 className="font-semibold mb-4">Author Options</h3>
                                            <div className="space-y-2">
                                                <Button 
                                                    variant="outline" 
                                                    className="w-full hover:text-foreground hover:border-foreground" 
                                                    onClick={() => setEditModalOpen(true)}
                                                >
                                                    <EditIcon className="mr-2 h-4 w-4" />
                                                    Edit Theme
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors" 
                                                    onClick={() => setDeleteDialogOpen(true)}
                                                >
                                                    <DeleteIcon className="mr-2 h-4 w-4" />
                                                    Delete Theme
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                            {!isLoading && (
                                <Card className="border-border/40">
                                    <CardContent className="p-6">
                                        <h3 className="font-semibold mb-4">Statistics</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            {statsItems.map(({ icon: Icon, label, value }) => (
                                                <div key={label} className="text-center">
                                                    <Icon className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                                                    <div className="text-lg font-semibold">{value}</div>
                                                    <div className="text-xs text-muted-foreground">{label}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {!isLoading && (
                                <Card className="border-border/40">
                                    <CardContent className="p-6">
                                        <h3 className="font-semibold mb-4">Contributors</h3>
                                        <div className="space-y-3">{Array.isArray(theme.author) ? theme.author.map(renderAuthor) : renderAuthor(theme.author)}</div>
                                    </CardContent>
                                </Card>
                            )}

                            {!isLoading && theme.guild && (
                                <Card className="border-border/40">
                                    <CardContent className="p-6">
                                        <h3 className="font-semibold mb-4">Support Server</h3>
                                        <Button variant="outline" onClick={() => window.open(theme?.guild?.invite_link, "_blank")} className="w-full h-11">
                                            <ExternalLinkIcon className="mr-2 h-4 w-4" />
                                            Join {theme.guild.name}
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
                {!isLoading && (
                    <>
                        <EditThemeModal open={editModalOpen} onOpenChange={setEditModalOpen} theme={theme} onSave={handleEdit} />

                        <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={handleDelete} title="Delete Theme" description="Are you sure you want to delete this theme? This action cannot be undone." />
                    </>
                )}
            </div>
        </>
    );
}
