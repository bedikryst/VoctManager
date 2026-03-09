/**
 * @file CursorContext.jsx
 * @description Global state management for the custom cursor.
 * Abstracts cursor interactions, allowing any deeply nested component 
 * to easily mutate the global cursor state without prop drilling.
 * @author Krystian Bugalski
 */

import { createContext, useContext, useState } from 'react';

const CursorContext = createContext();

export const useCursor = () => useContext(CursorContext);

export const CursorProvider = ({ children }) => {
  // --- STATE ---
  // Tracks the visual representation of the cursor across the application
  const [cursorType, setCursorType] = useState("default");
  const [cursorText, setCursorText] = useState("");

  // --- MUTATION METHODS ---
  // Encapsulated logic for specific interaction states
  
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

  return (
    <CursorContext.Provider value={{ cursorType, cursorText, enterDrag, leaveDrag, enterPointer, leavePointer }}>
      {children}
    </CursorContext.Provider>
  );
};