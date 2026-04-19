"use client";

import React, { useEffect, useState } from "react";
import { useWebContext } from "@context/auth";
import { getCookie } from "@utils/cookies";
import {
    OpenInNew as ArrowRightIcon,
    Storage as DatabaseIcon,
    Search as SearchIcon
} from "@mui/icons-material";
import { Card } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { SERVER } from "@constants";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Button } from "@components/ui/button";

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

function ThemeList() {
    const { authorizedUser, isAuthenticated, isLoading } = useWebContext();
    const [themes, setThemes] = useState<Theme[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");

    const fetchThemes = async () => {
        try {
            const response = await fetch("/api/get/submissions", {
                headers: {
                    Authorization: `Bearer ${getCookie("_dtoken")}`
                }
            });

            if (!response.ok) {
                throw new Error("Failed to fetch themes");
            }

            const data = await response.json();
            setThemes(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load themes");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isAuthenticated || !authorizedUser?.admin) {
            window.location.href = "/";
            return;
        }

        fetchThemes();
    }, [isAuthenticated, authorizedUser]);

    const filteredThemes = themes.filter((theme) => {
        const matchesSearch = theme.title.toLowerCase().includes(search.toLowerCase()) || Object.values(theme.validatedUsers).some((user) => user.username.toLowerCase().includes(search.toLowerCase()));
        const matchesFilter = filter === "all" || theme.state === filter;
        return matchesSearch && matchesFilter;
    });

    if (isLoading || loading) {
        return (
            <div className="min-h-screen p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <Card key={i} className="p-6 animate-pulse">
                            <div className="h-4 bg-muted/30 rounded w-3/4 mb-4" />
                            <div className="h-4 bg-muted/30 rounded w-1/2" />
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen p-4 flex items-center justify-center">
                <Card className="p-6 max-w-md w-full border-destructive/20 bg-destructive/5">
                    <p className="text-destructive font-medium">Error: {error}</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="space-y-8">
                <div className="space-y-6">
                    <div>
                        <h1 className="text-4xl font-bold text-primary mb-2">Theme Submissions</h1>
                        <p className="text-muted-foreground">Review and manage theme submissions</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                            <Input
                                placeholder="Search themes or authors..."
                                className="pl-10 h-10"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Select value={filter} onValueChange={setFilter}>
                            <SelectTrigger className="w-full sm:w-40 h-10">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {filteredThemes.length === 0 ? (
                    <Card className="p-12 text-center border-border/40">
                        <DatabaseIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <p className="text-muted-foreground text-lg">No themes found matching your criteria</p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredThemes.map((theme) => (
                            <Card key={theme._id} className="p-6 border-border/40 hover:border-border/80 transition-all duration-200 flex flex-col h-full">
                                <div className="space-y-4 flex flex-col flex-grow">
                                    <div className="flex justify-between items-start gap-3">
                                        <h3 className="font-semibold text-lg text-foreground break-words flex-grow leading-tight">{theme.title}</h3>
                                        <Badge
                                            variant={theme.state === "approved" ? "default" : theme.state === "rejected" ? "destructive" : "secondary"}
                                            className="flex-shrink-0 whitespace-nowrap"
                                        >
                                            {theme.state.charAt(0).toUpperCase() + theme.state.slice(1)}
                                        </Badge>
                                    </div>

                                    <div className="space-y-3 flex-grow">
                                        {Object.values(theme.validatedUsers)
                                            .reverse()
                                            .map((user, index) => (
                                                <div key={user.id} className="flex items-center gap-3">
                                                    <img
                                                        draggable={false}
                                                        src={user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png`}
                                                        alt={user.username}
                                                        className="w-10 h-10 rounded-full flex-shrink-0"
                                                        onError={(e) => {
                                                            const target = e.target as HTMLImageElement;
                                                            target.onerror = null;
                                                            target.src = `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png`;
                                                        }}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm truncate">{user.username}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{user.id}</p>
                                                    </div>
                                                    {index === 0 && (
                                                        <Badge variant="outline" className="flex-shrink-0 text-xs">
                                                            Submitter
                                                        </Badge>
                                                    )}
                                                </div>
                                            ))}
                                    </div>

                                    <div className="pt-4 border-t border-border/30 space-y-3">
                                        <p className="text-xs text-muted-foreground">Submitted {formatDistanceToNow(new Date(theme.submittedAt))} ago</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            asChild
                                            className="w-full text-xs h-9"
                                        >
                                            <a href={`${SERVER}/theme/submitted/view/${theme._id}`} target="_blank" rel="noopener noreferrer">
                                                <ArrowRightIcon className="h-4 w-4 mr-2" />
                                                View Details
                                            </a>
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ThemeList;
