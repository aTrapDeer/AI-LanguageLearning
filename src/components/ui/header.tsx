"use client";

import { Button } from "@/components/ui/button";
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Menu, MoveRight, X } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { LanguageSelect } from "@/components/ui/language-select";
import { useSession, signOut } from "next-auth/react";

function Header1() {
    const navigationItems = [
        {
            title: "",
            href: "/",
            description: "",
            isLogo: true,
        },
        {
            title: "Learn",
            description: "Start your language learning journey with AI-powered tools.",
            items: [
                {
                    title: "Chat",
                    href: "/learn/chat",
                },
                {
                    title: "Flashcards",
                    href: "/learn/flashcards",
                },
                {
                    title: "Conversation",
                    href: "/learn/conversation",
                },
                {
                    title: "Visual Learning",
                    href: "/learn/visual",
                },
            ],
        },
    ];

    const [isOpen, setOpen] = useState(false);
    const { data: session } = useSession();

    return (
        <header className="w-full z-40 fixed top-0 left-0 bg-background">
            <div className="container relative mx-auto min-h-20 flex gap-4 flex-row lg:grid lg:grid-cols-3 items-center">
                <div className="justify-start items-center gap-4 lg:flex hidden flex-row">
                    <NavigationMenu className="flex justify-start items-start">
                        <NavigationMenuList className="flex justify-start gap-4 flex-row">
                            {navigationItems.map((item) => (
                                <NavigationMenuItem key={item.title || 'home'}>
                                    {item.href ? (
                                        item.isLogo ? (
                                            <Link href="/" legacyBehavior passHref>
                                                <NavigationMenuLink className="flex items-center">
                                                    <Image
                                                        src="/favicon/LOGO1.png"
                                                        alt="Laignfy Logo"
                                                        width={32}
                                                        height={32}
                                                        className="hover:opacity-90 transition-opacity"
                                                    />
                                                </NavigationMenuLink>
                                            </Link>
                                        ) : (
                                            <Link href={item.href} legacyBehavior passHref>
                                                <NavigationMenuLink>
                                                    <Button variant="ghost">{item.title}</Button>
                                                </NavigationMenuLink>
                                            </Link>
                                        )
                                    ) : (
                                        <>
                                            <NavigationMenuTrigger className="font-medium text-sm">
                                                {item.title}
                                            </NavigationMenuTrigger>
                                            <NavigationMenuContent className="!w-[450px] p-4">
                                                <div className="flex flex-col lg:grid grid-cols-2 gap-4">
                                                    <div className="flex flex-col h-full justify-between">
                                                        <div className="flex flex-col">
                                                            <p className="text-base">{item.title}</p>
                                                            <p className="text-muted-foreground text-sm">
                                                                {item.description}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col text-sm h-full justify-end">
                                                        {item.items?.map((subItem) => (
                                                            <NavigationMenuLink
                                                                href={subItem.href}
                                                                key={subItem.title}
                                                                className="flex flex-row justify-between items-center hover:bg-muted py-2 px-4 rounded"
                                                            >
                                                                <span>{subItem.title}</span>
                                                                <MoveRight className="w-4 h-4 text-muted-foreground" />
                                                            </NavigationMenuLink>
                                                        ))}
                                                    </div>
                                                </div>
                                            </NavigationMenuContent>
                                        </>
                                    )}
                                </NavigationMenuItem>
                            ))}
                        </NavigationMenuList>
                    </NavigationMenu>
                </div>
                <div className="flex lg:justify-center">
                    <Link href="/" className="font-bold text-2xl">
                        <span className="bg-gradient-to-r from-indigo-600 to-rose-500 bg-clip-text text-transparent hover:from-indigo-500 hover:to-rose-400 transition-all">L</span>
                        <span className="bg-gradient-to-r from-rose-500 to-violet-500 bg-clip-text text-transparent hover:from-rose-400 hover:to-violet-400 transition-all">AI</span>
                        <span className="bg-gradient-to-r from-violet-500 to-indigo-600 bg-clip-text text-transparent hover:from-violet-400 hover:to-indigo-500 transition-all">GNFY</span>
                    </Link>
                </div>
                <div className="flex justify-end w-full gap-4 items-center">
                    <LanguageSelect />
                    <div className="border-r hidden md:inline"></div>
                    {session ? (
                        <>
                            <Button variant="outline" onClick={() => signOut()}>
                                Sign Out
                            </Button>
                            <Button asChild>
                                <Link href="/dashboard">Dashboard</Link>
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" asChild>
                                <Link href="/login">Sign In</Link>
                            </Button>
                            <Button asChild>
                                <Link href="/register">Get Started</Link>
                            </Button>
                        </>
                    )}
                </div>
                <div className="flex w-12 shrink lg:hidden items-end justify-end">
                    <Button variant="ghost" onClick={() => setOpen(!isOpen)}>
                        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </Button>
                    {isOpen && (
                        <div className="absolute top-20 border-t flex flex-col w-full right-0 bg-background shadow-lg py-4 container gap-8">
                            {navigationItems.map((item) => (
                                <div key={item.title}>
                                    <div className="flex flex-col gap-2">
                                        {item.href ? (
                                            <Link
                                                href={item.href}
                                                className="flex justify-between items-center"
                                            >
                                                <span className="text-lg">{item.title}</span>
                                                <MoveRight className="w-4 h-4 stroke-1 text-muted-foreground" />
                                            </Link>
                                        ) : (
                                            <p className="text-lg">{item.title}</p>
                                        )}
                                        {item.items &&
                                            item.items.map((subItem) => (
                                                <Link
                                                    key={subItem.title}
                                                    href={subItem.href}
                                                    className="flex justify-between items-center"
                                                >
                                                    <span className="text-muted-foreground">
                                                        {subItem.title}
                                                    </span>
                                                    <MoveRight className="w-4 h-4 stroke-1" />
                                                </Link>
                                            ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

export { Header1 }; 