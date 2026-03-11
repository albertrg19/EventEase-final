// Type declarations for modules without built-in types

declare module 'next/navigation' {
  export function useRouter(): {
    push: (path: string) => void;
    replace: (path: string) => void;
    refresh: () => void;
    back: () => void;
    forward: () => void;
    prefetch: (path: string) => void;
  };
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
  export function useParams<T extends Record<string, string | string[]> = Record<string, string | string[]>>(): T;
  export function redirect(url: string): never;
  export function notFound(): never;
}

declare module 'date-fns' {
  export function format(date: Date | number, formatStr: string, options?: object): string;
  export function isSameDay(dateLeft: Date | number, dateRight: Date | number): boolean;
  export function isSameMonth(dateLeft: Date | number, dateRight: Date | number): boolean;
  export function startOfMonth(date: Date | number): Date;
  export function endOfMonth(date: Date | number): Date;
  export function eachDayOfInterval(interval: { start: Date | number; end: Date | number }): Date[];
  export function getDay(date: Date | number): number;
  export function addDays(date: Date | number, amount: number): Date;
  export function subDays(date: Date | number, amount: number): Date;
  export function addMonths(date: Date | number, amount: number): Date;
  export function subMonths(date: Date | number, amount: number): Date;
  export function parseISO(dateString: string): Date;
  export function isValid(date: Date | number): boolean;
}

