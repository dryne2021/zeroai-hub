import { BookOpen, Briefcase, ChartColumn, Code, FileCheck, Languages, Palette, PenLine, Server, Table, type LucideProps } from "lucide-react";

const ICONS = {
  code: Code,
  server: Server,
  chart: ChartColumn,
  "pen-line": PenLine,
  book: BookOpen,
  palette: Palette,
  table: Table,
  languages: Languages,
  briefcase: Briefcase,
  "file-check": FileCheck,
};
export const CATEGORY_ICON_NAMES = Object.keys(ICONS);

export function CategoryIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? Briefcase;
  return <Icon aria-hidden {...props} />;
}
