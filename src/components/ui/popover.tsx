"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return <PopoverPrimitive.Content data-slot="popover-content" sideOffset={4} {...props} />;
}

export { Popover, PopoverTrigger, PopoverContent };
