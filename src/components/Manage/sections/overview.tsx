"use client";

import React from "react";
import { ModuleToggleGrid } from "./modules";
import { useManage } from "../manage-context";

/* On the day the server was made, a year or more ago, the Overview says so.
   Once a year, one line, and nothing on any other day. */
function ServerBirthday() {
  const { meta } = useManage();
  const [today, setToday] = React.useState<Date | null>(null);
  React.useEffect(() => setToday(new Date()), []);
  const made = meta?.guild.createdAt ? new Date(meta.guild.createdAt) : null;
  if (!today || !made || Number.isNaN(made.getTime())) return null;
  const years = today.getFullYear() - made.getFullYear();
  if (years < 1 || today.getMonth() !== made.getMonth() || today.getDate() !== made.getDate()) return null;
  return (
    <p className="overview-birthday">
      {meta?.guild.name} is {years} year{years === 1 ? "" : "s"} old today. Happy birthday.
    </p>
  );
}

export function OverviewSection({
  onNavigate,
}: {
  onNavigate: (section: string) => void;
}) {
  return (
    <div className="overview-page" data-testid="overview-section">
      <header className="overview-intro">
        <div className="overview-heading-copy">
          <h2>Overview</h2>
          <ServerBirthday />
        </div>
      </header>

      <ModuleToggleGrid onNavigate={onNavigate} variant="overview" />
    </div>
  );
}
