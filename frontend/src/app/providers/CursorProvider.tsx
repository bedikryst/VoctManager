/**
 * @file CursorContext.tsx
 * @description Global state management for the custom physics-based cursor.
 * Abstracts cursor interactions, allowing any deeply nested component 
 * to mutate the global cursor state without prop drilling.
 * @architecture Enterprise 2026 Standards
 * @module context/CursorContext
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type CursorType = "default" | "drag" | "pointer";

interface CursorContextType {
  cursorType: CursorType;
  cursorText: string;
  enterDrag: () => void;
  leaveDrag: () => void;
  enterPointer: () => void;
  leavePointer: () => void;
}

const CursorContext = createContext<CursorContextType | null>(null);

export const CursorProvider = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const [cursorType, setCursorType] = useState<CursorType>("default");
  const [cursorText, setCursorText] = useState<string>("");

  const enterDrag = () => {
    setCursorType("drag");
    setCursorText("⭤");
  };

  const leaveDrag = () => {
    setCursorType("default");
    setCursorText("");
  };

  const enterPointer = () => setCursorType("pointer");
  
  const leavePointer = () => setCursorType("default");

  const value: CursorContextType = {
    cursorType,
    cursorText,
    enterDrag,
    leaveDrag,
    enterPointer,
    leavePointer
  };

  return (
    <CursorContext.Provider value={value}>
      {children}
    </CursorContext.Provider>
  );
};

export const useCursor = (): CursorContextType => {
  const context = useContext(CursorContext);
  if (!context) {
    throw new Error("useCursor must be used within a CursorProvider");
  }
  return context;
};