import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Theme } from "@types";

export default function HeroHighlights({ themes }: { themes: Theme[] }) {
    const highlights = themes.slice(0, 6);

    return (
        <div className="w-full">
            <div className="hidden lg:grid grid-cols-2 gap-4">
                {highlights.slice(0, 4).map((t) => (
                    <Link key={t.id} href={`/theme/${t.id}`} className="group block overflow-hidden rounded-2xl bg-card/60 border border-border/30 hover:shadow-lg transition-shadow">
                        <div className="aspect-[16/9] relative">
                            <Image src={t.thumbnail_url} alt={t.name} draggable={false} fill className="object-cover group-hover:scale-105 transition-transform" />
                        </div>
                        <div className="p-3">
                            <div className="text-sm font-semibold text-primary truncate">{t.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{t.tags?.slice(0, 2).join(", ")}</div>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="lg:hidden flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
                {highlights.map((t) => (
                    <Link key={t.id} href={`/theme/${t.id}`} className="w-64 flex-shrink-0 rounded-xl overflow-hidden bg-card/60 border border-border/30">
                        <div className="aspect-[16/9] relative">
                            <Image src={t.thumbnail_url} alt={t.name} draggable={false} fill className="object-cover" />
                        </div>
                        <div className="p-3">
                            <div className="text-sm font-semibold text-primary truncate">{t.name}</div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
