import { cva, type VariantProps } from 'class-variance-authority'
import { twMerge } from 'tailwind-merge'
import type { ButtonHTMLAttributes } from 'react'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-accent text-surface hover:bg-accent-hover',
        ghost: 'text-text-muted hover:bg-surface-raised hover:text-text',
        destructive: 'bg-error/20 text-error hover:bg-error/30',
      },
      size: {
        sm: 'px-2 py-1 text-xs',
        md: 'px-3 py-1.5 text-sm',
        lg: 'px-4 py-2 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = ({ className, variant, size, ...props }: ButtonProps) => {
  return (
    <button className={twMerge(buttonVariants({ variant, size }), className)} {...props} />
  )
}

export { Button, buttonVariants }
