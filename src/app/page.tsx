"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { db } from "@/lib/firebase/config";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { Terminal, SupportTicket } from "@/lib/firebase/types";

export default function PublicDisplay() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  // Fetch tickets that are relevant for public display (queued, called, in_progress)
  const [activeTickets, setActiveTickets] = useState<SupportTicket[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(false); // State to track audio permission
  const audioRef = useRef<HTMLAudioElement | null>(null); // Ref to store the audio object

  // Fetch Terminals (ordered by name)
  useEffect(() => {
    const q = query(collection(db, "terminals"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const terminalsData = querySnapshot.docs.map(
        (doc: QueryDocumentSnapshot<DocumentData>) =>
          ({
            id: doc.id,
            ...doc.data(),
          } as Terminal)
      );
      setTerminals(terminalsData);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Active Tickets (queued, called, in_progress)
  useEffect(() => {
    const q = query(
      collection(db, "supportTickets"),
      where("status", "in", ["queued", "called", "in_progress"])
      // No specific order needed here, will sort based on terminal.queueOrder
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ticketsData = querySnapshot.docs.map(
        (doc: QueryDocumentSnapshot<DocumentData>) =>
          ({
            id: doc.id,
            ...doc.data(),
          } as SupportTicket)
      );
      setActiveTickets(ticketsData);
    });
    return () => unsubscribe();
  }, []);

  // --- Audio Notification Logic ---
  const prevActiveTicketsRef = useRef<SupportTicket[]>([]);

  // Initialize Audio object once
  useEffect(() => {
    // Preload the audio file
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.load(); // Attempt to load the audio file
  }, []);

  // Effect to play sound when tickets become 'called' *if* audio is enabled
  useEffect(() => {
    if (!audioEnabled || !audioRef.current) {
      // Don't play sound if user hasn't enabled it or audio isn't ready
      prevActiveTicketsRef.current = activeTickets; // Still update previous tickets
      return;
    }

    const newlyCalledTickets = activeTickets.filter(currentTicket => {
      const prevTicket = prevActiveTicketsRef.current.find(t => t.id === currentTicket.id);
      return currentTicket.status === 'called' && (!prevTicket || prevTicket.status !== 'called');
    });

    if (newlyCalledTickets.length > 0) {
      console.log(`Audio Enabled: Playing notification for ${newlyCalledTickets.length} newly called ticket(s).`);
      audioRef.current.play().catch(error => {
        console.error("Audio playback failed even after enabling:", error);
        // If it still fails, there might be other issues or stricter browser policies.
        // Resetting audioEnabled might prompt the user again, but could be annoying.
        // setAudioEnabled(false);
      });
    }

    prevActiveTicketsRef.current = activeTickets;
  }, [activeTickets, audioEnabled]); // Depend on audioEnabled state

  // Function to handle enabling audio via user interaction
  const handleEnableAudio = useCallback(() => {
    setAudioEnabled(true);
    // Attempt to play the audio muted immediately after user interaction
    // This often satisfies the browser's requirement.
    if (audioRef.current) {
        audioRef.current.muted = true; // Mute it first
        audioRef.current.play().then(() => {
            // Success! Pause and unmute for actual plays later.
            audioRef.current?.pause();
            audioRef.current!.currentTime = 0; // Reset playback position
            audioRef.current!.muted = false;
            console.log("Audio context unlocked by user interaction.");
        }).catch(error => {
            console.error("Initial muted playback failed:", error);
            // Might need a more direct user interaction or different approach
            // depending on the browser's specific policy.
        });
    }
  }, []);

  // Group and sort tickets by terminal based on queueOrder
  const ticketsByTerminal = useMemo(() => {
    const grouped: { [key: string]: SupportTicket[] } = {};
    terminals.forEach(terminal => {
      // Filter active tickets assigned to this terminal
      const ticketsInTerminal = activeTickets.filter(
        (ticket) => ticket.assignedTerminalId === terminal.id
      );
      // Sort them based on the terminal's queueOrder array
      grouped[terminal.id] = ticketsInTerminal.sort((a, b) => {
        const indexA = terminal.queueOrder.indexOf(a.id);
        const indexB = terminal.queueOrder.indexOf(b.id);
        if (indexA === -1) return 1; // Should not happen if data is consistent
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    });
    return grouped;
  }, [terminals, activeTickets]);

  // --- Marquee Text Calculation ---
  const marqueeText = useMemo(() => {
    const calledTickets = activeTickets
      .filter(ticket => ticket.status === 'called' && ticket.assignedTerminalName)
      .map(ticket => `${ticket.teamName} please go to ${ticket.assignedTerminalName}`);
    return calledTickets.length > 0 ? calledTickets.join(' ••• ') : null;
  }, [activeTickets]);

  return (
    <main className="flex min-h-screen flex-col items-center p-8 sm:p-12 md:p-16 bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300">
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold mb-6 sm:mb-8 md:mb-6 text-center"> {/* Reduced bottom margin */}
        Young iOS Developer Hackathon
      </h1>
      <h2 className="text-4xl text-neutral-500 mb-6 sm:mb-8 md:mb-10 text-center"> {/* Reduced bottom margin */}
        Clinic Queue
      </h2>

      {/* --- Enable Audio Button --- */}
      {!audioEnabled && (
        <div className="w-full flex justify-center mb-6">
          <button
            onClick={handleEnableAudio}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75"
          >
            Enable Sound Notifications
          </button>
        </div>
      )}

      {/* --- Marquee Display --- */}
      {marqueeText && (
        <div className="marquee w-full max-w-6xl mb-8 sm:mb-10 md:mb-12">
          <span>{marqueeText}</span>
        </div>
      )}

      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
        {terminals.map((terminal) => {
          const terminalQueue = ticketsByTerminal[terminal.id] || [];
          const currentTicket = terminalQueue.find(t => t.id === terminal.currentTicketId);

          return (
            // Apply Apple-like card styling with frosted glass effect and transition
            <div
              key={terminal.id}
              className={`rounded-xl shadow-lg border ${
                terminal.isOpen
                  ? "bg-white/60 dark:bg-neutral-800/60 backdrop-blur-lg border-neutral-200 dark:border-neutral-700"
                  : "bg-neutral-300/50 dark:bg-neutral-700/50 border-neutral-400 dark:border-neutral-600 opacity-80"
              } p-5 sm:p-6 flex flex-col transition-all duration-300 ease-in-out`}
            >
              {/* Adjusted heading styles */}
              <h2 className={`text-2xl sm:text-3xl font-semibold mb-4 text-center border-b pb-3 ${terminal.isOpen ? "border-neutral-200 dark:border-neutral-700 text-[var(--foreground)]" : "border-neutral-400 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400"}`}>
                {terminal.name}
                <span className={`block text-lg font-normal mt-1 ${terminal.isOpen ? 'text-neutral-600 dark:text-neutral-300' : 'text-neutral-500 dark:text-neutral-400'}`}>
                    ({terminal.isOpen ? "Open" : "Closed"})
                </span>
              </h2>

              {/* Currently Serving / Called Section - Conditional styling and animation */}
              {terminal.isOpen && currentTicket && (currentTicket.status === 'called' || currentTicket.status === 'in_progress') && (
                <div className={`mb-5 p-4 rounded-lg text-center shadow-md border transition-all duration-300 ease-in-out ${
                  currentTicket.status === 'called'
                    ? 'bg-green-500 dark:bg-green-600 text-white border-green-300 dark:border-green-500 animate-prominent-call'
                    : 'bg-amber-400 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 border-yellow-300 dark:border-neutral-600' // background for in_progress
                }`}>
                  <p className="text-sm uppercase tracking-wider font-medium">
                    {currentTicket.status === 'called' ? 'Now Calling' : 'Now Serving'}
                  </p>
                  <p className="text-xl sm:text-2xl font-bold mt-1">{currentTicket.teamName}</p>
                  {currentTicket.status === 'in_progress' && <p className="text-xs mt-1 opacity-80">(Support In Progress)</p>}
                </div>
              )}

              {/* Queue List - Adjusted styling */}
              <div className="space-y-3 flex-grow pt-1">
                {terminal.isOpen && terminalQueue.filter(ticket => !(ticket.status === 'called' || ticket.status === 'in_progress')).length > 0 && (
                    <h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-2">Queue:</h3>
                )}
                {terminal.isOpen && terminalQueue
                  .filter(ticket => !(ticket.status === 'called' || ticket.status === 'in_progress'))
                  .map((ticket, index) => (
                  // Apply subtle card style to queue items with transition
                  <div
                    key={ticket.id}
                    className="bg-neutral-100/50 dark:bg-neutral-700/50 p-3 rounded-md border border-neutral-200 dark:border-neutral-600 shadow-sm transition-all duration-200 ease-in-out"
                  >
                    <p className="font-medium text-lg text-neutral-800 dark:text-neutral-100">
                      {index + 1}. {ticket.teamName}
                    </p>
                    {/* <p className="text-sm text-neutral-500 dark:text-neutral-400">{ticket.topic}</p> */}
                  </div>
                ))}
                {/* Adjusted empty/closed messages */}
                {terminal.isOpen && terminalQueue.filter(ticket => !(ticket.status === 'called' || ticket.status === 'in_progress')).length === 0 && !currentTicket && (
                  <p className="text-neutral-500 dark:text-neutral-400 text-center pt-8">Queue is empty.</p>
                )}
                 {!terminal.isOpen && (
                    <p className="text-neutral-500 dark:text-neutral-400 text-center pt-8 font-medium text-xl">Terminal Closed</p>
                 )}
              </div>
            </div>
          );
        })}
         {terminals.length === 0 && (
            <p className="text-neutral-500 dark:text-neutral-400 text-2xl col-span-full text-center mt-10">No support terminals are currently configured.</p>
         )}
      </div>
    </main>
  );
}
