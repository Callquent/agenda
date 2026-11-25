"use client";

import { useState } from "react";
import EventForm from "./EventForm";

export default function AddEvent({ date }: { date: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="btn small" onClick={() => setOpen(true)}>
        + Ajouter
      </button>
    );
  }
  return <EventForm date={date} onClose={() => setOpen(false)} />;
}
