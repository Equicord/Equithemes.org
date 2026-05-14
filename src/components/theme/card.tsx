import { Check, Clock, Download, Heart } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover";
import { Card, CardContent, CardFooter, CardHeader } from "@components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@components/ui/tooltip";
import { Button } from "@components/ui/button";
import { cn } from "@lib/utils";
import { MouseEvent, useEffect, useState } from "react";
import { type Theme } from "@types";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from "next/image";

interface ThemeCardProps {
    theme: Theme;
    likedThemes: any;
    className?: string;
    disableDownloads?: boolean;
    noFooter?: boolean;
    diagonal?: boolean;
}

function timeSince(date: Date) {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) {
        return interval + " year" + (interval !== 1 ? "s" : "") + " ago";
    }
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) {
        return interval + " month" + (interval !== 1 ? "s" : "") + " ago";
    }
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) {
        return interval + " day" + (interval !== 1 ? "s" : "") + " ago";
    }
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) {
        return interval + " hour" + (interval !== 1 ? "s" : "") + " ago";
    }
    interval = Math.floor(seconds / 60);
    if (interval >= 1) {
        return interval + " minute" + (interval !== 1 ? "s" : "") + " ago";
    }
    return "Just now";
}

export const ThemeCard = React.memo(({ theme, likedThemes, className, noFooter = false, disableDownloads = false, diagonal = false }: ThemeCardProps) => {
    const [isLiked, setLiked] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isDownloaded, setIsDownloaded] = useState(false);

    useEffect(() => {
        if (likedThemes?.likes?.length) {
            const hasLiked = likedThemes.likes.some((liked: any) => liked.themeId === theme.id && liked.hasLiked !== false);
            setLiked(hasLiked);
        } else {
            setLiked(false);
        }
    }, [likedThemes, theme.id]);

    const handleDownload = async (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setIsDownloaded(true);

        window.location.href = `/api/download/${theme.id}`;

        setTimeout(() => {
            setIsDownloaded(false);
        }, 5000);
    };

    const handleMouseEnter = () => {
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        setIsOpen(false);
    };

    const lastUpdated = theme.last_updated ?? theme.release_date;
    const relativeTime = React.useMemo(() => timeSince(new Date(lastUpdated)), [lastUpdated]);

    return (
        <Card className={cn("group overflow-hidden flex flex-col h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-border/40 bg-card/50 backdrop-blur-sm", className)}>
            <Link href={`/theme/${Number(theme.id)}`} className="h-full flex flex-col">
                {diagonal ? (
                    <div className="flex">
                        <div className="w-1/2 relative" onMouseLeave={handleMouseLeave}>
                            <div className="aspect-[16/9] overflow-hidden bg-muted/20 relative rounded-2xl">
                                <Image draggable={false} width={854} height={480} src={theme.thumbnail_url} alt={theme.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 select-none rounded-2xl" />
                            </div>
                            <div className="absolute top-3 left-3 z-2 flex flex-wrap gap-2">
                                {theme.tags?.slice(0, 3).map((tag) => (
                                    <Button key={tag} variant="outline" size="sm" className="text-xs h-7 px-3 bg-background/90 backdrop-blur-md border-border/50 hover:bg-background/60 hover:border-border/80 rounded-2xl" onClick={(e) => e.preventDefault()}>
                                        {tag}
                                    </Button>
                                ))}
                                {theme.tags && theme.tags.length > 3 && (
                                    <Popover open={isOpen} onOpenChange={setIsOpen}>
                                        <div onMouseEnter={handleMouseEnter}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" size="sm" onClick={(e) => e.preventDefault()} className="text-xs h-7 px-3 bg-background/90 backdrop-blur-md border-border/50 hover:bg-background/60 hover:border-border/80">
                                                    +{theme.tags.length - 3}
                                                </Button>
                                            </PopoverTrigger>
                                        </div>
                                        <PopoverContent className="w-auto p-3 border-border/50 bg-background/95 backdrop-blur-md">
                                            <div className="flex flex-wrap gap-2">
                                                {theme.tags.slice(3).map((tag) => (
                                                    <Button key={tag} variant="outline" size="sm" className="text-xs h-7 px-3 hover:bg-background/60 hover:border-border/80" onClick={(e) => e.preventDefault()}>
                                                        {tag}
                                                    </Button>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </div>
                        </div>
                        <div className="w-1/2 p-5 flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-semibold tracking-tight text-primary mb-2">{theme.name}</h3>
                                <div className="description text-sm text-foreground leading-relaxed line-clamp-3">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {theme.description}
                                    </ReactMarkdown>
                                </div>
                            </div>
                            <div className="flex flex-col mt-4">
                                <div className="flex justify-between items-center">
                                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger className="text-xs text-muted-foreground flex items-center gap-2 hover:text-foreground transition-colors">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    <span>{relativeTime}</span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Updated on {new Date(lastUpdated).toLocaleDateString()}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>
                            </div>
                            {!noFooter && (
                                <div className="mt-4 flex flex-col">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <div className={cn("flex items-center gap-1", isLiked && "text-red-500")}>
                                                <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
                                                <span>{theme.likes}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Download className="h-4 w-4" />
                                                <span>{theme?.downloads ?? 0}</span>
                                            </div>
                                        </div>
                                        {!disableDownloads && (
                                            <Button disabled={isDownloaded} size="sm" className="h-8" onClick={handleDownload}>
                                                {isDownloaded ? (
                                                    <>
                                                        <Check className="mr-1.5 h-3.5 w-3.5" />
                                                        Downloaded
                                                    </>
                                                ) : (
                                                    <>
                                                        <Download className="mr-1.5 h-3.5 w-3.5" />
                                                        Download
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <CardHeader className="p-0 relative" onMouseLeave={handleMouseLeave}>
                            <div className="aspect-[16/9] overflow-hidden bg-muted/20 relative rounded-t-2xl">
                                <Image draggable={false} width={854} height={480} src={theme.thumbnail_url} alt={theme.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 select-none" />
                            </div>
                            <div className="absolute bottom-3 left-3 z-2 flex flex-wrap gap-2">
                                {theme.tags?.slice(0, 3).map((tag) => (
                                    <Button key={tag} variant="outline" size="sm" className="text-xs h-7 px-3 bg-background/90 backdrop-blur-md border-border/50 hover:bg-background/60 hover:border-border/80" onClick={(e) => e.preventDefault()}>
                                        {tag}
                                    </Button>
                                ))}
                                {theme.tags && theme.tags.length > 3 && (
                                    <Popover open={isOpen} onOpenChange={setIsOpen}>
                                        <div onMouseEnter={handleMouseEnter}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" size="sm" onClick={(e) => e.preventDefault()} className="text-xs h-7 px-3 bg-background/90 backdrop-blur-md border-border/50 hover:bg-background/60 hover:border-border/80">
                                                    +{theme.tags.length - 3}
                                                </Button>
                                            </PopoverTrigger>
                                        </div>
                                        <PopoverContent className="w-auto p-3 border-border/50 bg-background/95 backdrop-blur-md">
                                            <div className="flex flex-wrap gap-2">
                                                {theme.tags.slice(3).map((tag) => (
                                                    <Button key={tag} variant="outline" size="sm" className="text-xs h-7 px-3 hover:bg-background/60 hover:border-border/80" onClick={(e) => e.preventDefault()}>
                                                        {tag}
                                                    </Button>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-5 flex-grow">
                            <h3 className="text-lg font-semibold tracking-tight text-primary mb-2">{theme.name}</h3>
                            <div className="description line-clamp-3 text-sm text-foreground leading-relaxed">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {theme.description}
                                </ReactMarkdown>
                            </div>
                        </CardContent>
                        {!noFooter && (
                            <CardFooter className="p-5 pt-0 mt-auto">
                                <div className="flex justify-between items-center w-full">
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <div className={cn("flex items-center gap-1", isLiked && "text-red-500")}>
                                            <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
                                            <span>{theme.likes}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Download className="h-4 w-4" />
                                            <span>{theme?.downloads ?? 0}</span>
                                        </div>
                                    </div>
                                    {!disableDownloads && (
                                        <Button disabled={isDownloaded} size="sm" className="h-8" onClick={handleDownload}>
                                            {isDownloaded ? (
                                                <>
                                                    <Check className="mr-1.5 h-3.5 w-3.5" />
                                                    Downloaded
                                                </>
                                            ) : (
                                                <>
                                                    <Download className="mr-1.5 h-3.5 w-3.5" />
                                                    Download
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </CardFooter>
                        )}
                    </>
                )}
            </Link>
        </Card>
    );
});

ThemeCard.displayName = "ThemeCard";
