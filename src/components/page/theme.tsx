"use client";

import React, { useEffect, useState } from "react";
import { ThemeGrid } from "@components/theme/grid";
import { Button } from "@components/ui/button";
import { FilterDropdown } from "@components/ui/filter-dropdown";
import { ArrowUp, Plus, SearchX, Info, ExternalLinkIcon, Sparkles } from "lucide-react";
import { getCookie } from "@utils/cookies";
import { type UserData } from "@types";
import { useWebContext } from "@context/auth";
import ThemeCarousel from "@components/theme/carousel";
import HeroHighlights from "@components/page/hero-highlights";
import { DropdownFilter } from "@components/ui/dropdown-filter";
import { useSearch } from "@context/search";
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert";
import { type Theme } from "@types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@components/ui/tabs";
import { DiscordIcon } from "@utils/icons";
import { Badge } from "@components/ui/badge";

const Skeleton = ({ className = "", ...props }) => <div className={`animate-pulse bg-muted/30 rounded ${className}`} {...props} />;

const SkeletonGrid = ({ amount = 6 }) => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener("resize", checkMobile);

        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    const displayAmount = isMobile ? Math.min(2, amount) : amount;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(displayAmount)].map((_, i) => (
                <Skeleton key={i} className="w-full h-[280px] rounded-lg" />
            ))}
        </div>
    );
};

const NoResults = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-muted rounded-full p-4 mb-4">
            <SearchX className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2 text-primary">No results found</h3>
        <p className="text-foreground max-w-md">Try adjusting your search query or filters to find what you're looking for.</p>
    </div>
);

function App({ themes }: { themes: Theme[] }) {
    const { searchQuery, setSearchQuery } = useSearch();
    const [isValid, setUser] = useState<UserData | boolean>(false);
    const [filters, setFilters] = useState([]);
    const [likedThemes, setLikedThemes] = useState([]);
    const [sort, setSort] = useState("most-popular");
    const { authorizedUser, isAuthenticated, isLoading, error } = useWebContext();
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const deferredQuery = React.useDeferredValue(searchQuery);

    useEffect(() => {
        const handleScroll = () => {
            const scrollPos = window.scrollY;
            setShowScrollTop(scrollPos > 300);
            setScrolled(scrollPos > 150);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    useEffect(() => {
        if (isLoading) return;

        const token = getCookie("_dtoken");

        async function getLikedThemes() {
            const cachedLikedThemes = localStorage.getItem("likedThemes");
            const cacheTime = localStorage.getItem("ct");
            const now = Date.now();

            if (cachedLikedThemes && cacheTime && now - parseInt(cacheTime, 10) < 3600000) {
                setLikedThemes(JSON.parse(cachedLikedThemes));
                return;
            }

            const response = await fetch("/api/likes/get", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                }
            }).then((res) => res.json());

            localStorage.setItem("likedThemes", JSON.stringify(response));
            localStorage.setItem("ct", now.toString());
            setLikedThemes(response);
        }

        if (token && isAuthenticated) {
            setUser(authorizedUser);
            getLikedThemes();
        } else {
            setUser(false);
        }
    }, [isLoading, authorizedUser, isAuthenticated]);

    const allFilters = React.useMemo(() => {
        if (isLoading) return [];
        return [
            ...themes.reduce((acc, theme) => {
                theme.tags.forEach((tag) => acc.set(tag, (acc.get(tag) || 0) + 1));
                return acc;
            }, new Map())
        ]
            .sort(([, countA], [, countB]) => countB - countA)
            .map(([tag]) => ({
                value: tag,
                label: tag.charAt(0).toUpperCase() + tag.slice(1)
            }));
    }, [themes, isLoading]);

    const { themesOnly, snippetsOnly } = React.useMemo(() => ({
        themesOnly: themes.filter((t) => t.type === "theme"),
        snippetsOnly: themes.filter((t) => t.type === "snippet")
    }), [themes]);

    // Most popular themes for header highlights (sorted by downloads desc)
    const popularThemes = React.useMemo(() => [...themesOnly]
        .map((t) => ({ ...t, downloads: t.downloads ?? 0 }))
        .sort((a, b) => b.downloads - a.downloads)
        .slice(0, 6), [themesOnly]);

    const lowerQuery = deferredQuery.toLowerCase();

    const filteredThemes = React.useMemo(() => {
        if (isLoading) return [];
        return themesOnly
            .filter((t) => {
                const match = t.name.toLowerCase().includes(lowerQuery) || t.description.toLowerCase().includes(lowerQuery);
                const tags = filters.length === 0 || filters.every((f) => t.tags.includes(f.value));
                return match && tags;
            })
            .sort((a, b) => {
                switch (sort) {
                    case "most-liked":
                        return (b.likes ?? 0) - (a.likes ?? 0);
                    case "most-popular":
                        return (b.downloads ?? 0) - (a.downloads ?? 0);
                    case "recently-updated":
                        return +new Date(b.last_updated ?? b.release_date) - +new Date(a.last_updated ?? a.release_date);
                    case "recently-uploaded":
                        return +new Date(b.release_date) - +new Date(a.release_date);
                    default:
                        return (b.likes ?? 0) - (a.likes ?? 0);
                }
            });
    }, [themesOnly, lowerQuery, filters, sort, isLoading]);

    const filteredSnippets = React.useMemo(() => {
        if (isLoading) return [];
        return snippetsOnly
            .filter((t) => {
                const match = t.name.toLowerCase().includes(lowerQuery) || t.description.toLowerCase().includes(lowerQuery);
                const tags = filters.length === 0 || filters.every((f) => t.tags.includes(f.value));
                return match && tags;
            })
            .sort((a, b) => {
                switch (sort) {
                    case "most-liked":
                        return (b.likes ?? 0) - (a.likes ?? 0);
                    case "most-popular":
                        return (b.downloads ?? 0) - (a.downloads ?? 0);
                    case "recently-updated":
                        return +new Date(b.last_updated ?? b.release_date) - +new Date(a.last_updated ?? a.release_date);
                    case "recently-uploaded":
                        return +new Date(b.release_date) - +new Date(a.release_date);
                    default:
                        return (b.likes ?? 0) - (a.likes ?? 0);
                }
            });
    }, [snippetsOnly, lowerQuery, filters, sort, isLoading]);

    const handleSubmit = () => {
        if (isValid) {
            window.location.href = "/theme/submit";
        } else {
            window.location.href = "/auth/login";
        }
    };

    return (
        <div className="min-h-screen">
            <div className="relative pt-12 pb-16 md:pt-20 md:pb-24 rounded-xl overflow-hidden">
                <div className="relative z-10">
                    <div className={`max-w-7xl mx-auto px-4 lg:px-8 transition-all duration-300`}>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center mb-10">
                            <div className="lg:col-span-2">
                                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 text-foreground">Discord Themes & Snippets</h1>
                                <p className="text-base md:text-lg text-foreground/80 max-w-3xl leading-relaxed mb-6">
                                    Explore thousands of beautiful themes and CSS snippets for <span className="font-semibold text-foreground">Equicord</span> and <span className="font-semibold text-foreground">Vencord</span>. Customize your Discord experience exactly the way you like it.
                                </p>

                                <div className="flex flex-col sm:flex-row gap-4 justify-start items-center">
                                    <Button size="lg" className="px-6 h-12 text-base font-semibold rounded-lg" onClick={handleSubmit}>
                                        {isValid ? (
                                            <>
                                                <Plus className="h-5 w-5 mr-2" />
                                                Submit Theme
                                            </>
                                        ) : (
                                            <>
                                                <DiscordIcon className="h-5 w-5 mr-2 fill-current" />
                                                Connect via Discord
                                            </>
                                        )}
                                    </Button>
                                    <Button size="lg" variant="outline" className="px-6 h-12 text-base font-semibold rounded-lg" onClick={() => window.open("https://equicord.org/", "_blank")}>
                                        <ExternalLinkIcon className="h-5 w-5 mr-2" />
                                        Get the Extension for Discord
                                    </Button>
                                </div>


                            </div>

                            <div className="lg:col-span-1">
                                <HeroHighlights themes={popularThemes} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`m-4 mb-0 transform transition-all duration-300 ease-in-out overflow-hidden ${searchQuery === "" ? "opacity-100 translate-y-0 mb-12" : "opacity-0 -translate-y-10 h-0 mb-0"}`}>
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-semibold mb-2 text-primary mt-6">Recently Updated</h2>
                    <p className="text-foreground">Latest themes and updates from the community</p>
                </div>
                <ThemeCarousel themes={themesOnly} />
            </div>

            <Tabs defaultValue="themes" className="w-full mb-8">
                <TabsList className="w-full grid grid-cols-2 h-12 rounded-none mb-8">
                    <TabsTrigger value="themes" className="text-sm font-medium">
                        Themes
                    </TabsTrigger>
                    <TabsTrigger value="snippets" className="text-sm font-medium">
                        Snippets
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="themes" className="mt-0">
                    {isLoading ? (
                        <SkeletonGrid amount={6} />
                    ) : error ? (
                        <div className="text-center py-8">
                            <div className="text-destructive text-lg font-medium mb-2">Oops! Something went wrong</div>
                            <div className="text-foreground">Couldn't fetch themes. Please try refreshing the page.</div>
                        </div>
                    ) : filteredThemes.length ? (
                        <ThemeGrid likedThemes={likedThemes as any as []} themes={filteredThemes} />
                    ) : (
                        <NoResults />
                    )}
                </TabsContent>

                <TabsContent value="snippets" className="mt-0">
                    <Alert className="mb-6 w-full">
                        <Info className="h-5 w-5" />
                        <AlertTitle>About Snippets</AlertTitle>
                        <AlertDescription>
                            Most snippets are made specifically for{" "}
                            <a href="https://vencord.dev" className="text-primary hover:underline font-medium">
                                Vencord / Equicord
                            </a>{" "}
                            and may not work with other client mods.
                        </AlertDescription>
                    </Alert>

                    {isLoading ? (
                        <SkeletonGrid amount={6} />
                    ) : error ? (
                        <div className="text-center py-8">
                            <div className="text-destructive text-lg font-medium mb-2">Oops! Something went wrong</div>
                            <div className="text-foreground">Couldn't fetch snippets. Please try refreshing the page.</div>
                        </div>
                    ) : filteredSnippets.length ? (
                        <ThemeGrid likedThemes={likedThemes as any as []} themes={filteredSnippets} />
                    ) : (
                        <NoResults />
                    )}
                </TabsContent>
            </Tabs>

            {showScrollTop && (
                <Button variant="outline" size="icon" className="fixed bottom-6 right-6 rounded-full" onClick={scrollToTop}>
                    <ArrowUp className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
}

export default App;
