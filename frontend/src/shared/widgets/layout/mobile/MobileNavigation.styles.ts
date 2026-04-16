import { cva } from "class-variance-authority";

export const mobileNavLinkVariants = cva(
  "group/moblink relative flex items-center gap-4 rounded-[1.25rem] px-5 py-3.5 transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 active:scale-[0.98] will-change-transform",
  {
    variants: {
      isActive: {
        true: "bg-ethereal-gold/10 border border-ethereal-gold/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]",
        false: "border border-transparent hover:bg-white/20",
      },
    },
    defaultVariants: {
      isActive: false,
    },
  },
);
