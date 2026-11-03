"use client";

import React from "react";

import { cn } from "@/lib/utils";

interface ExpandableContainerProps {
    children: React.ReactNode;
    isExpanded: boolean;
    className?: string;
}

const ExpandableContainer = ({
    children,
    isExpanded,
    className,
}: ExpandableContainerProps) => {
    return (
        <div
            className={cn(
                "grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-in-out",
                {
                    "grid-rows-[1fr]": isExpanded,
                },
                className
            )}
        >
            <div
                className={cn(
                    "overflow-hidden opacity-0 transition-opacity duration-300 ease-in-out",
                    {
                        "opacity-100": isExpanded,
                    }
                )}
            >
                {children}
            </div>
        </div>
    );
};

export default ExpandableContainer;
