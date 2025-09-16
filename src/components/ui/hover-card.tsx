"use client";

import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";

function HoverCard({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root {...props} />;
}

function HoverCardTrigger({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return <HoverCardPrimitive.Trigger {...props} />;
}

function HoverCardContent({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return <HoverCardPrimitive.Content sideOffset={4} {...props} />;
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
