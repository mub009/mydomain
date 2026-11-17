"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent shadow-[inset_0_2px_4px_rgb(0_0_0/0.22)] transition-colors",
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-border disabled:opacity-50", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff,#e2e8f0_70%)] shadow-[0_2px_4px_rgb(0_0_0/0.3),inset_0_-1px_1px_rgb(0_0_0/0.1)] transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
}
