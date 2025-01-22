import { ReactNode } from "react";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { IconProps } from "@radix-ui/react-icons/dist/types";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const BentoGrid = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-[180px] md:auto-rows-[200px]",
        className,
      )}
    >
      {children}
    </div>
  );
};

type BentoCardProps = {
  name: string;
  className: string;
  background: ReactNode;
  Icon: React.ComponentType<IconProps>;
  description: string;
  href: string;
  cta: string;
};

const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
}: BentoCardProps) => (
  <div
    key={name}
    className={cn(
      "group relative col-span-1 row-span-1 flex flex-col overflow-hidden rounded-xl p-6",
      // light styles
      "bg-white [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
      // dark styles
      "transform-gpu dark:bg-black dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]",
      className,
    )}
  >
    <div className="absolute inset-0 z-0">{background}</div>
    <div className="relative z-10 flex h-full flex-col">
      <Icon className="h-8 w-8 text-neutral-700 dark:text-neutral-300" />
      <div className="flex-grow">
        <h3 className="mt-4 text-lg font-medium text-neutral-700 dark:text-neutral-300">
          {name}
        </h3>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2">
          {description}
        </p>
      </div>
      <Button
        variant="ghost"
        asChild
        size="sm"
        className="mt-4 w-fit opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <a href={href}>
          {cta}
          <ArrowRightIcon className="ml-2 h-4 w-4" />
        </a>
      </Button>
    </div>
    <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-black/[.03] group-hover:dark:bg-neutral-800/10" />
  </div>
);

export { BentoCard, BentoGrid }; 