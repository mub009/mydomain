"use client";

import { Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { Fragment } from "react";
import { istTime } from "@/lib/format";
import { displayName, TEAM } from "@/lib/team";
import type { Message, MessageTable } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "./agent-avatar";
import { RiskTag, StockSymbolChip, VerdictBadge } from "./primitives";

const VERDICTS = ["STRONG BUY", "BUY", "WATCH", "AVOID"];
const RISKS = ["LOW", "MEDIUM", "HIGH"];

/** Turn the stock symbols a message mentions into clickable chips. */
function withChips(text: string, tickers: string[]) {
  if (!tickers.length) return text;
  const esc = [...new Set(tickers)].sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\&-]/g, "\\$&"));
  const re = new RegExp(`(?<![A-Za-z0-9])(${esc.join("|")})(?![A-Za-z0-9])`, "g");
  return text.split(re).map((part, i) => (i % 2 ? <StockSymbolChip key={i} symbol={part} /> : <Fragment key={i}>{part}</Fragment>));
}

/** MiniReportTable: the inline table inside a report message. */
export function MiniReportTable({ table, compact }: { table: MessageTable; compact?: boolean }) {
  // In the narrow live panel, keep only the first three columns.
  const cols = compact ? table.columns.slice(0, 3) : table.columns;
  return (
    <div className="mt-2 max-w-full overflow-x-auto rounded-lg border bg-card scroll-thin">
      <table className="w-full text-left text-xs tnum">
        <thead>
          <tr className="border-b bg-muted/60 text-[10.5px] uppercase tracking-wide text-muted-foreground">
            {cols.map((c, i) => <th key={c} className={cn("whitespace-nowrap px-2.5 py-1.5 font-semibold", i > 0 && /Score|Combined|Entry|Stop|Target/.test(c) && "text-right")}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row[0]} className="border-b last:border-0">
              {row.slice(0, cols.length).map((cell, i) => (
                <td key={i} className={cn("whitespace-nowrap px-2.5 py-1.5", /^[₹\d.+-]/.test(cell) && i > 0 && "text-right",
                  cols[i] === "Reason" && "whitespace-normal text-muted-foreground", cols[i] === "Holding plan" && "text-muted-foreground")}>
                  {i === 0 ? <StockSymbolChip symbol={cell} />
                    : VERDICTS.includes(cell) ? <VerdictBadge verdict={cell} />
                    : RISKS.includes(cell) ? <RiskTag risk={cell} /> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** ChatMessage */
export function ChatMessage({ m, time, compact }: { m: Message; time?: number; compact?: boolean }) {
  if (m.kind === "system") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="rounded-lg border border-dashed px-3 py-1.5 text-center text-[11.5px] leading-relaxed text-muted-foreground">
        {m.text}
      </motion.div>
    );
  }
  const person = m.sender === "System" ? null : TEAM[m.sender];
  const decision = m.kind === "decision";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn("flex gap-2.5", decision && "rounded-xl border-2 border-final/50 bg-final/[0.07] p-3")}>
      <AgentAvatar who={m.sender} size={compact ? 30 : 38} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <span className="text-[13.5px] font-semibold" style={{ color: person?.color }}>{displayName(m.sender)}</span>
          {!compact && person && <span className="hidden text-[11.5px] text-muted-foreground sm:inline">{person.title}</span>}
          <span className="text-[11.5px] text-muted-foreground">to {displayName(m.to)}</span>
          {time && <time className="ml-auto text-[11px] text-muted-foreground tnum">{istTime(time)}{compact ? "" : " IST"}</time>}
        </div>
        {decision && <div className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wider text-final">Final decision</div>}
        <div className={cn("mt-0.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed", decision && "font-medium")}>
          {withChips(m.text, m.tickers)}
        </div>
        {m.table && <MiniReportTable table={m.table} compact={compact} />}
        {m.aiNote && (
          <div className="mt-2 flex gap-2 rounded-lg bg-primary-soft/60 px-2.5 py-2 text-[12.5px] leading-relaxed text-foreground/90">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
            <span><b className="mr-1 text-[10.5px] font-bold uppercase tracking-wide text-primary">AI note</b><span className="whitespace-pre-wrap">{m.aiNote}</span></span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
